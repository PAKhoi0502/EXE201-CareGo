import crypto from "crypto";
import mongoose from "mongoose";
import WithdrawalCompanionLock from "../models/withdrawal-companion-lock.models.js";
import WithdrawalRequest from "../models/withdrawal-request.models.js";
import Payment from "../models/payment.models.js";
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  maskBankAccountNumber,
} from "../utils/field-encryption.js";
import { buildPagination, parsePagination } from "../utils/pagination.js";

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
const DEFAULT_EARNINGS_LIMIT = 20;
const MAX_EARNINGS_LIMIT = 100;

const getUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createWithdrawalLockBusyError = () => {
  const error = new Error("Yêu cầu rút tiền đang được tạo. Vui lòng thử lại.");
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
  }
};

const normalizeAmount = (amount) => {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
};

const normalizeText = (value) => String(value || "").trim();

const isValidWithdrawalAmount = (amount) =>
  Number.isInteger(amount) && amount >= MIN_WITHDRAWAL_AMOUNT;

const normalizeStatus = (status) => normalizeText(status).toLowerCase();

const canTransitionWithdrawalStatus = (currentStatus, nextStatus) =>
  currentStatus === nextStatus ||
  Boolean(WITHDRAWAL_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus));

const toPaymentCompanionId = (companionId) => {
  const id = String(companionId || "");
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : companionId;
};

const parsePositiveInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfWeek = (date) => {
  const next = startOfDay(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const serializeWithdrawalRequest = (request, { includeFullBankAccount = false } = {}) => {
  const payload = request?.toObject ? request.toObject() : request;
  const bankAccountNumberFull = decryptSensitiveValue(payload?.bankAccountNumber);
  const bankAccountName = decryptSensitiveValue(payload?.bankAccountName);
  const bankAccountNumberMasked = maskBankAccountNumber(bankAccountNumberFull);
  const companion = payload?.companion || payload?.companionId || null;

  const serialized = {
    ...payload,
    bankAccountNumber: bankAccountNumberMasked,
    bankAccountNumberMasked,
    bankAccountName: bankAccountName || normalizeText(payload?.bankAccountName),
    companion,
  };
  if (includeFullBankAccount) {
    serialized.bankAccountNumberFull = bankAccountNumberFull;
  }
  return serialized;
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
  const serializedRequests = requests.map(serializeWithdrawalRequest);
  const totalEarned = await getTotalPaidCompanionEarnings(companionId);

  const pendingAmount = serializedRequests
    .filter((item) => normalizeStatus(item.status) === "pending")
    .reduce((sum, item) => sum + normalizeAmount(item.amount), 0);

  const withdrawnAmount = serializedRequests
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
    requests: serializedRequests,
    withdrawals: serializedRequests,
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
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};

export const getMyEarnings = async (req, res) => {
  try {
    const companionId = getUserId(req);

    if (!companionId) {
      return res.status(401).json({ message: "Không xác định được tài khoản." });
    }

    const page = parsePositiveInteger(req.query?.page, 1);
    const limit = Math.min(parsePositiveInteger(req.query?.limit, DEFAULT_EARNINGS_LIMIT), MAX_EARNINGS_LIMIT);
    const skip = (page - 1) * limit;
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const paymentFilter = {
      companionId: toPaymentCompanionId(companionId),
      status: "paid",
      paidAt: { $ne: null },
    };

    const [payments, total, [summaryRow]] = await Promise.all([
      Payment.find(paymentFilter)
        .sort({ paidAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "bookingId",
          select: "serviceId elderProfileId customerId startTime durationHours status address totalAmount platformFee updatedAt",
          populate: [
            { path: "serviceId", select: "name" },
            { path: "elderProfileId", select: "fullName" },
            { path: "customerId", select: "name email" },
          ],
        })
        .lean(),
      Payment.countDocuments(paymentFilter),
      Payment.aggregate([
        { $match: paymentFilter },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$companionEarning", 0] } },
            today: {
              $sum: {
                $cond: [
                  { $gte: ["$paidAt", todayStart] },
                  { $ifNull: ["$companionEarning", 0] },
                  0,
                ],
              },
            },
            week: {
              $sum: {
                $cond: [
                  { $gte: ["$paidAt", weekStart] },
                  { $ifNull: ["$companionEarning", 0] },
                  0,
                ],
              },
            },
            month: {
              $sum: {
                $cond: [
                  { $gte: ["$paidAt", monthStart] },
                  { $ifNull: ["$companionEarning", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const entries = payments.map((payment) => ({
      _id: payment._id,
      amount: normalizeAmount(payment.companionEarning),
      paidAt: payment.paidAt,
      bookingId: payment.bookingId?._id || payment.bookingId || null,
      booking: payment.bookingId || null,
      payment: {
        _id: payment._id,
        baseAmount: normalizeAmount(payment.baseAmount),
        paidAmount: normalizeAmount(payment.paidAmount || payment.amount),
        platformFee: normalizeAmount(payment.platformFee),
        penaltyAmount: normalizeAmount(payment.penaltyAmount),
        companionEarning: normalizeAmount(payment.companionEarning),
        method: payment.method || "",
        status: payment.status || "",
      },
    }));
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

    return res.status(200).json({
      summary: {
        today: normalizeAmount(summaryRow?.today),
        week: normalizeAmount(summaryRow?.week),
        month: normalizeAmount(summaryRow?.month),
        total: normalizeAmount(summaryRow?.total),
      },
      entries,
      items: entries,
      earnings: entries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};

export const createWithdrawalRequest = async (req, res) => {
  let withdrawalLock;

  try {
    const companionId = getUserId(req);

    if (!companionId) {
      return res.status(401).json({ message: "Không xác định được tài khoản." });
    }

    const {
      amount,
      bankName,
      bankAccountNumber,
      bankAccountName,
      note,
    } = req.body;
    const requestAmount = normalizeAmount(amount);
    const cleanBankName = normalizeText(bankName);
    const cleanBankAccountNumber = normalizeText(bankAccountNumber);
    const cleanBankAccountName = normalizeText(bankAccountName);

    if (!isValidWithdrawalAmount(requestAmount)) {
      return res.status(400).json({ message: "Số tiền rút không hợp lệ." });
    }

    if (!cleanBankName || !cleanBankAccountNumber || !cleanBankAccountName) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin ngân hàng." });
    }

    withdrawalLock = await acquireCompanionWithdrawalLock(companionId);

    const currentSummary = await getWithdrawalSummary(companionId);

    if (requestAmount > currentSummary.availableBalance) {
      return res.status(400).json({
        message: "Số tiền rút vượt quá số dư có thể rút.",
      });
    }

    await WithdrawalRequest.create({
      companionId,
      amount: requestAmount,
      bankName: cleanBankName,
      bankAccountNumber: encryptSensitiveValue(cleanBankAccountNumber),
      bankAccountName: encryptSensitiveValue(cleanBankAccountName),
      note: normalizeText(note),
      status: "pending",
    });

    const summary = await getWithdrawalSummary(companionId);
    return res.status(201).json(summary);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
    });
  } finally {
    await releaseCompanionWithdrawalLock(withdrawalLock);
  }
};

export const getAdminWithdrawalRequests = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }

    const filter = {};
    if (Object.hasOwn(WITHDRAWAL_STATUS_TRANSITIONS, req.query?.status)) {
      filter.status = req.query.status;
    }

    const [requests, total, summaryRows] = await Promise.all([
      WithdrawalRequest.find(filter)
        .populate("companionId", "name fullName email phone avatar")
        .populate("processedBy", "name fullName email")
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      WithdrawalRequest.countDocuments(filter),
      WithdrawalRequest.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$amount", 0] } },
            paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, "$amount", 0] } },
          },
        },
      ]),
    ]);

    const normalizedRequests = requests.map((request) =>
      serializeWithdrawalRequest({
        ...request,
        companion: request.companionId,
      }),
    );

    return res.status(200).json({
      requests: normalizedRequests,
      withdrawals: normalizedRequests,
      withdrawalRequests: normalizedRequests,
      summary: summaryRows[0] || { total: 0, pending: 0, approved: 0, paid: 0, rejected: 0 },
      pagination: buildPagination(pagination, total),
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};

export const getAdminWithdrawalRequestDetail = async (req, res) => {
  try {
    const request = await WithdrawalRequest.findById(req.params.id)
      .populate("companionId", "name fullName email phone avatar")
      .populate("processedBy", "name fullName email")
      .lean();

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    return res.status(200).json({
      withdrawal: serializeWithdrawalRequest(
        { ...request, companion: request.companionId },
        { includeFullBankAccount: true },
      ),
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
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

    const statusUpdates = {};

    if (adminNote !== undefined) {
      statusUpdates.adminNote = normalizeText(adminNote);
    }

    if (currentStatus !== nextStatus) {
      statusUpdates.status = nextStatus;
      statusUpdates.processedAt = new Date();
      statusUpdates.processedBy = getUserId(req);
    }

    const withdrawal = await WithdrawalRequest.findOneAndUpdate(
      { _id: req.params.id, status: currentWithdrawal.status },
      statusUpdates,
      { new: true },
    )
      .populate("companionId", "name fullName email phone avatar")
      .populate("processedBy", "name fullName email");

    if (!withdrawal) {
      return res.status(409).json({ message: "Trạng thái rút tiền đã thay đổi, vui lòng thử lại." });
    }

    return res.status(200).json({
      withdrawal: serializeWithdrawalRequest({
        ...(withdrawal.toObject ? withdrawal.toObject() : withdrawal),
        companion: withdrawal.companionId,
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};

export const getAdminWithdrawals = getAdminWithdrawalRequests;
export const updateAdminWithdrawalStatus = updateWithdrawalStatus;
