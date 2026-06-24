import crypto from "crypto";
import mongoose from "mongoose";
import WithdrawalCompanionLock from "../models/withdrawal-companion-lock.models.js";
import WithdrawalRequest from "../models/withdrawal-request.models.js";
import Payment from "../models/payment.models.js";

const WITHDRAWAL_CREATE_LOCK_TTL_MS = 10 * 1000;
const WITHDRAWAL_CREATE_LOCK_WAIT_MS = 1200;
const WITHDRAWAL_CREATE_LOCK_RETRY_MS = 75;
const MIN_WITHDRAWAL_AMOUNT = 1000;
const WITHDRAWAL_STATUS_TRANSITIONS = {
  pending: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  paid: [],
  rejected: [],
};

const getUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createWithdrawalLockBusyError = () => {
  const error = new Error("Withdrawal request is being created. Please try again.");
  error.statusCode = 409;
  return error;
};

const acquireCompanionWithdrawalLock = async (companionId) => {
  const lockId = String(companionId);
  const ownerToken = crypto.randomUUID?.() || crypto.randomBytes(16).toString("hex");
  const getExpiresAt = () => new Date(Date.now() + WITHDRAWAL_CREATE_LOCK_TTL_MS);
  const deadline = Date.now() + WITHDRAWAL_CREATE_LOCK_WAIT_MS;

  while (Date.now() <= deadline) {
    try {
      await WithdrawalCompanionLock.create({
        _id: lockId,
        ownerToken,
        expiresAt: getExpiresAt(),
      });
      return { lockId, ownerToken };
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }

    const acquiredLock = await WithdrawalCompanionLock.findOneAndUpdate(
      {
        _id: lockId,
        expiresAt: { $lte: new Date() },
      },
      { $set: { ownerToken, expiresAt: getExpiresAt() } },
      { new: true },
    ).select("ownerToken");

    if (acquiredLock?.ownerToken === ownerToken) {
      return { lockId, ownerToken };
    }

    await sleep(WITHDRAWAL_CREATE_LOCK_RETRY_MS);
  }

  throw createWithdrawalLockBusyError();
};

const releaseCompanionWithdrawalLock = async (lock) => {
  if (!lock) return;

  try {
    await WithdrawalCompanionLock.deleteOne({
      _id: lock.lockId,
      ownerToken: lock.ownerToken,
    });
  } catch {
    // The lock has a TTL fallback, so release failure should not mask the withdrawal response.
  }
};

const normalizeAmount = (amount) => {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
};

const isValidWithdrawalAmount = (amount) =>
  Number.isInteger(amount) && amount >= MIN_WITHDRAWAL_AMOUNT;

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const canTransitionWithdrawalStatus = (currentStatus, nextStatus) =>
  currentStatus === nextStatus ||
  Boolean(WITHDRAWAL_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus));

const toPaymentCompanionId = (companionId) => {
  const id = String(companionId || "");
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : companionId;
};

const getTotalPaidCompanionEarnings = async (companionId) => {
  const paymentCompanionId = toPaymentCompanionId(companionId);
  const [earnings] = await Payment.aggregate([
    {
      $match: {
        companionId: paymentCompanionId,
        status: "paid",
      },
    },
    {
      $group: {
        _id: "$companionId",
        totalEarned: { $sum: { $ifNull: ["$companionEarning", 0] } },
      },
    },
  ]);

  return normalizeAmount(earnings?.totalEarned);
};

const getWithdrawalSummary = async (companionId) => {
  const requests = await WithdrawalRequest.find({ companionId })
    .sort({ createdAt: -1 })
    .lean();

  const totalEarned = await getTotalPaidCompanionEarnings(companionId);

  const pendingAmount = requests
    .filter((item) => normalizeStatus(item.status) === "pending")
    .reduce((sum, item) => sum + normalizeAmount(item.amount), 0);

  const withdrawnAmount = requests
    .filter((item) => {
      const status = normalizeStatus(item.status);
      return status === "approved" || status === "paid";
    })
    .reduce((sum, item) => sum + normalizeAmount(item.amount), 0);

  const availableBalance = Math.max(totalEarned - pendingAmount - withdrawnAmount, 0);

  return {
    availableBalance,
    available: availableBalance,
    balance: availableBalance,
    totalEarned,
    pendingAmount,
    pending: pendingAmount,
    withdrawnAmount,
    withdrawn: withdrawnAmount,
    requests,
    withdrawals: requests,
  };
};

export const getMyWithdrawalSummary = async (req, res) => {
  try {
    const companionId = getUserId(req);

    if (!companionId) {
      return res.status(401).json({ message: "Không xác định được tài khoản." });
    }

    const summary = await getWithdrawalSummary(companionId);
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createWithdrawalRequest = async (req, res) => {
  let withdrawalLock;

  try {
    const companionId = getUserId(req);

    if (!companionId) {
      return res.status(401).json({ message: "Không xác định được tài khoản." });
    }

    const { amount, bankName, bankAccountNumber, bankAccountName, note } = req.body;
    const requestAmount = normalizeAmount(amount);

    if (!isValidWithdrawalAmount(requestAmount)) {
      return res.status(400).json({ message: "Số tiền rút không hợp lệ." });
    }

    if (!bankName || !bankAccountNumber || !bankAccountName) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin ngân hàng." });
    }

    withdrawalLock = await acquireCompanionWithdrawalLock(companionId);

    const currentSummary = await getWithdrawalSummary(companionId);

    if (requestAmount > currentSummary.availableBalance) {
      return res.status(400).json({
        message: "Số tiền rút vượt quá số dư có thể rút.",
      });
    }

    const withdrawal = await WithdrawalRequest.create({
      companionId,
      amount: requestAmount,
      bankName,
      bankAccountNumber,
      bankAccountName,
      note: note || "",
      status: "pending",
    });

    const summary = await getWithdrawalSummary(companionId);
    return res.status(201).json({ withdrawal, ...summary });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  } finally {
    await releaseCompanionWithdrawalLock(withdrawalLock);
  }
};

export const getAdminWithdrawalRequests = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find()
      .populate("companionId", "name fullName email phone avatar")
      .populate("processedBy", "name fullName email")
      .sort({ createdAt: -1 })
      .lean();

    const normalizedRequests = requests.map((request) => ({
      ...request,
      companion: request.companionId,
    }));

    return res.status(200).json({
      requests: normalizedRequests,
      withdrawals: normalizedRequests,
      withdrawalRequests: normalizedRequests,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateWithdrawalStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const nextStatus = normalizeStatus(status);

    if (!Object.hasOwn(WITHDRAWAL_STATUS_TRANSITIONS, nextStatus)) {
      return res.status(400).json({ message: "Trạng thái rút tiền không hợp lệ." });
    }

    const currentWithdrawal = await WithdrawalRequest.findById(req.params.id).select("status");

    if (!currentWithdrawal) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    const currentStatus = normalizeStatus(currentWithdrawal.status);
    if (!canTransitionWithdrawalStatus(currentStatus, nextStatus)) {
      return res.status(409).json({ message: "Không thể đổi trạng thái rút tiền theo luồng này." });
    }

    const statusUpdates = {
      adminNote: adminNote || "",
    };

    if (currentStatus !== nextStatus) {
      statusUpdates.status = nextStatus;
      statusUpdates.processedAt = new Date();
      statusUpdates.processedBy = getUserId(req);
    }

    const withdrawal = await WithdrawalRequest.findOneAndUpdate(
      { _id: req.params.id, status: currentWithdrawal.status },
      statusUpdates,
      { new: true }
    )
      .populate("companionId", "name fullName email phone avatar")
      .populate("processedBy", "name fullName email");

    if (!withdrawal) {
      return res.status(409).json({ message: "Trạng thái rút tiền đã thay đổi, vui lòng thử lại." });
    }

    const normalizedWithdrawal = withdrawal.toObject
      ? withdrawal.toObject()
      : withdrawal;

    return res.status(200).json({
      withdrawal: {
        ...normalizedWithdrawal,
        companion: normalizedWithdrawal.companionId,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAdminWithdrawals = getAdminWithdrawalRequests;
export const updateAdminWithdrawalStatus = updateWithdrawalStatus;
