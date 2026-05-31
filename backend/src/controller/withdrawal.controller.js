import WithdrawalRequest from "../models/withdrawal-request.models.js";
import Booking from "../models/booking.models.js";
import CompanionProfile from "../models/companion-profile.models.js";

const getUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;

const normalizeAmount = (amount) => {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
};

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const getPlatformFeeRate = () => {
  const rate = Number(
    process.env.CAREGO_PLATFORM_FEE_RATE ??
      process.env.COMPANION_PLATFORM_FEE_RATE ??
      process.env.PLATFORM_FEE_RATE ??
      0.1
  );

  if (!Number.isFinite(rate) || rate < 0) return 0.1;
  return rate > 1 ? rate / 100 : rate;
};

const getBookingEarning = (booking) => {
  const directEarning = normalizeAmount(
    booking.companionEarning ??
      booking.companionAmount ??
      booking.earningAmount ??
      booking.totalEarning ??
      booking.companionFee
  );

  if (directEarning > 0) return directEarning;

  const serviceAmount = normalizeAmount(
    booking.servicePrice ??
      booking.basePrice ??
      booking.subtotal ??
      booking.serviceAmount
  );

  if (serviceAmount > 0) return serviceAmount;

  const totalAmount = normalizeAmount(
    booking.totalAmount ??
      booking.finalAmount ??
      booking.totalPrice ??
      booking.price ??
      booking.amount
  );

  if (totalAmount <= 0) return 0;

  const explicitFee =
    normalizeAmount(booking.platformFee) +
    normalizeAmount(booking.serviceFee) +
    normalizeAmount(booking.appFee) +
    normalizeAmount(booking.systemFee) +
    normalizeAmount(booking.commissionFee);

  if (explicitFee > 0) {
    return Math.max(totalAmount - explicitFee, 0);
  }

  return Math.max(totalAmount * (1 - getPlatformFeeRate()), 0);
};

const getWithdrawalSummary = async (companionId) => {
  const requests = await WithdrawalRequest.find({ companionId })
    .sort({ createdAt: -1 })
    .lean();

  const profile = await CompanionProfile.findOne({
    $or: [
      { userId: companionId },
      { user: companionId },
      { accountId: companionId },
      { companionId },
    ],
  }).lean();

  const companionIds = [
    companionId,
    profile?._id,
    profile?.userId,
    profile?.user,
    profile?.accountId,
  ]
    .filter(Boolean)
    .map((id) => String(id))
    .filter((id, index, ids) => id !== "[object Object]" && ids.indexOf(id) === index);

  let earningBookings = await Booking.find({
    $and: [
      {
        $or: companionIds.flatMap((id) => [
          { companionId: id },
          { companion: id },
          { companionUserId: id },
          { companionProfileId: id },
          { companionProfile: id },
          { companion_id: id },
          { "companion._id": id },
          { "companion.id": id },
          { "companion.userId": id },
          { "companionProfile._id": id },
        ]),
      },
      {
        $or: [
          {
            status: {
              $in: [
                "completed",
                "complete",
                "finished",
                "done",
                "paid",
                "COMPLETED",
                "COMPLETE",
                "FINISHED",
                "DONE",
                "PAID",
                "Đã hoàn thành",
                "Hoàn thành",
              ],
            },
          },
          {
            paymentStatus: {
              $in: [
                "paid",
                "completed",
                "success",
                "PAID",
                "COMPLETED",
                "SUCCESS",
                "Đã thanh toán",
              ],
            },
          },
        ],
      },
    ],
  }).lean();

  const totalEarned = earningBookings.reduce(
    (sum, booking) => sum + getBookingEarning(booking),
    0
  );

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
  try {
    const companionId = getUserId(req);

    if (!companionId) {
      return res.status(401).json({ message: "Không xác định được tài khoản." });
    }

    const { amount, bankName, bankAccountNumber, bankAccountName, note } = req.body;
    const requestAmount = normalizeAmount(amount);

    if (requestAmount <= 0) {
      return res.status(400).json({ message: "Số tiền rút không hợp lệ." });
    }

    if (!bankName || !bankAccountNumber || !bankAccountName) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin ngân hàng." });
    }

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
    return res.status(500).json({ message: error.message });
  }
};

export const getAdminWithdrawalRequests = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find()
      .populate("companionId", "name fullName email phone avatar")
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
    const allowedStatuses = ["pending", "approved", "paid", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Trạng thái rút tiền không hợp lệ." });
    }

    const withdrawal = await WithdrawalRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNote: adminNote || "",
        processedAt: status === "pending" ? null : new Date(),
        processedBy: getUserId(req),
      },
      { new: true }
    ).populate("companionId", "name fullName email phone avatar");

    if (!withdrawal) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
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
