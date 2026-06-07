import Booking from "../models/booking.models.js";
import {
  buildPayOSRedirectUrl,
  createPayOSPaymentLink,
  getPayOSPaymentExpireMinutes,
} from "../config/payos.js";
import CompanionProfile from "../models/companion-profile.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import Payment from "../models/payment.models.js";
import Review from "../models/review.models.js";
import Service from "../models/service.models.js";
import ShiftLog from "../models/shift-log.models.js";

const populateBooking = [
  { path: "customerId", select: "name email phone" },
  { path: "elderProfileId" },
  { path: "serviceId" },
  { path: "companionId", select: "name email phone avatar" },
];

const toIdString = (value) => {
  if (!value) {
    return "";
  }

  return (value._id || value).toString();
};

const ACTIVE_BOOKING_STATUSES = ["pending", "accepted", "in_progress"];
const CONFIRMED_BOOKING_STATUSES = ["accepted", "in_progress"];
const PAYMENT_DUE_MS = 3 * 24 * 60 * 60 * 1000;
const OVERDUE_PAYMENT_PENALTY_AMOUNT = 50000;

const getPlatformFeeRate = () => {
  const rate = Number(
    process.env.CAREGO_PLATFORM_FEE_RATE ??
      process.env.PLATFORM_FEE_RATE ??
      process.env.COMPANION_PLATFORM_FEE_RATE ??
      0.2,
  );

  if (!Number.isFinite(rate) || rate < 0) return 0.2;
  return rate > 1 ? rate / 100 : rate;
};

const getBookingEndTime = (booking) =>
  new Date(new Date(booking.startTime).getTime() + Number(booking.durationHours || 0) * 60 * 60 * 1000);

const isTimeOverlapped = (firstStart, firstEnd, secondStart, secondEnd) =>
  firstStart < secondEnd && secondStart < firstEnd;

const findCompanionTimeConflict = async ({
  companionId,
  startTime,
  durationHours,
  statuses = ACTIVE_BOOKING_STATUSES,
  excludeBookingId,
}) => {
  const requestedStart = new Date(startTime);
  const requestedEnd = new Date(requestedStart.getTime() + Number(durationHours) * 60 * 60 * 1000);
  const query = {
    companionId,
    status: { $in: statuses },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const bookings = await Booking.find(query).select("startTime durationHours status");
  return bookings.find((booking) =>
    isTimeOverlapped(requestedStart, requestedEnd, new Date(booking.startTime), getBookingEndTime(booking)),
  );
};

const canAccessBooking = (booking, user) => {
  return (
    user.role === "admin" ||
    toIdString(booking.customerId) === user.userId ||
    toIdString(booking.companionId) === user.userId
  );
};

const generatePayOSOrderCode = () => {
  const randomPart = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return Number(`${Date.now()}${randomPart}`);
};

const createUniquePayOSOrderCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderCode = generatePayOSOrderCode();
    const existingPayment = await Payment.exists({ orderCode });
    if (!existingPayment) {
      return orderCode;
    }
  }

  const error = new Error("Khong the tao ma thanh toan PayOS.");
  error.statusCode = 500;
  throw error;
};

const ensureBookingPaymentDueAt = async (booking, now) => {
  let shouldSave = false;

  if (!booking.completedAt) {
    booking.completedAt = now;
    shouldSave = true;
  }

  if (!booking.paymentDueAt) {
    booking.paymentDueAt = new Date(booking.completedAt.getTime() + PAYMENT_DUE_MS);
    shouldSave = true;
  }

  if (shouldSave) {
    await booking.save();
  }
};

const getPayOSLinkExpiresAt = ({ now, paymentDueAt, hasPenalty }) => {
  const configuredExpiresAt = new Date(
    now.getTime() + getPayOSPaymentExpireMinutes() * 60 * 1000,
  );

  if (!hasPenalty && paymentDueAt && paymentDueAt > now && paymentDueAt < configuredExpiresAt) {
    return paymentDueAt;
  }

  return configuredExpiresAt;
};

const isReusablePendingPayOSPayment = (payment, paidAmount, now) => {
  if (!payment || payment.method !== "payos" || payment.status !== "pending") {
    return false;
  }

  const existingPaidAmount = Number(payment.paidAmount || payment.amount || 0);
  return Boolean(
    payment.checkoutUrl &&
      payment.expiresAt &&
      payment.expiresAt > now &&
      existingPaidAmount === paidAmount,
  );
};

const getBookingPaymentRedirectUrl = ({ configuredUrl, bookingId, orderCode, payosStatus }) => {
  const fallbackUrl = new URL(
    `/customer/bookings/${bookingId}`,
    process.env.FRONTEND_URL || "http://localhost:5173",
  ).toString();

  return buildPayOSRedirectUrl(
    configuredUrl || fallbackUrl,
    { bookingId, orderCode, payosStatus },
    `${payosStatus} URL`,
  );
};

export const createBooking = async (req, res) => {
  try {
    const {
      elderProfileId,
      serviceId,
      companionId,
      startTime,
      durationHours,
      address,
      addressLocation,
      note,
    } = req.body;

    if (!elderProfileId || !serviceId || !companionId || !startTime || !durationHours || !address) {
      return res.status(400).json({
        message: "elderProfileId, serviceId, companionId, startTime, durationHours and address are required",
      });
    }

    const parsedStartTime = new Date(startTime);
    const parsedDurationHours = Number(durationHours);
    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedDurationHours) || parsedDurationHours <= 0) {
      return res.status(400).json({ message: "Thời gian đặt lịch hoặc thời lượng không hợp lệ" });
    }

    const overdueBooking = await Booking.findOne({
      customerId: req.user.userId,
      status: "completed",
      paymentDueAt: { $lt: new Date() },
    })
      .select("_id paymentDueAt totalAmount")
      .sort({ paymentDueAt: 1 });

    if (overdueBooking) {
      return res.status(409).json({
        message: "Bạn có booking quá hạn thanh toán. Vui lòng thanh toán booking quá hạn trước khi đặt lịch mới.",
        bookingId: overdueBooking._id,
        overdueBookingId: overdueBooking._id,
        paymentDueAt: overdueBooking.paymentDueAt,
        totalAmount: overdueBooking.totalAmount,
      });
    }

    const elder = await ElderProfile.findOne({
      _id: elderProfileId,
      customerId: req.user.userId,
    });
    if (!elder) {
      return res.status(404).json({ message: "elder profile not found" });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: "service not found" });
    }

    const companionProfile = await CompanionProfile.findOne({
      userId: companionId,
      vettingStatus: "approved",
    });
    if (!companionProfile) {
      return res.status(404).json({ message: "approved companion not found" });
    }

    const conflictingBooking = await findCompanionTimeConflict({
      companionId,
      startTime: parsedStartTime,
      durationHours: parsedDurationHours,
    });
    if (conflictingBooking) {
      return res.status(409).json({
        message: "Người đồng hành này đã có lịch trong khung giờ bạn chọn. Vui lòng chọn giờ khác hoặc người đồng hành khác.",
      });
    }

    const totalAmount = service.pricePerHour * parsedDurationHours;
    const platformFee = Math.round(totalAmount * getPlatformFeeRate());

    const booking = await Booking.create({
      customerId: req.user.userId,
      elderProfileId,
      serviceId,
      companionId,
      startTime: parsedStartTime,
      durationHours: parsedDurationHours,
      address,
      addressLocation,
      note,
      totalAmount,
      platformFee,
    });

    await ShiftLog.create({
      bookingId: booking._id,
      checklist: service.defaultChecklist?.map((label) => ({ label, done: false })) || [],
    });

    return res.status(201).json({ message: "booking created", booking });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const filter =
      req.user.role === "companion"
        ? { companionId: req.user.userId }
        : { customerId: req.user.userId };

    const bookings = await Booking.find(filter).populate(populateBooking).sort({ createdAt: -1 });
    return res.status(200).json({ bookings });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate(populateBooking);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    const shiftLog = await ShiftLog.findOne({ bookingId: booking._id });
    const payment = await Payment.findOne({ bookingId: booking._id });
    const review = await Review.findOne({ bookingId: booking._id });

    return res.status(200).json({ booking, shiftLog, payment, review });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["accepted", "in_progress", "completed", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "invalid status" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    if (req.user.role === "companion" && toIdString(booking.companionId) !== req.user.userId) {
      return res.status(403).json({ message: "permission denied" });
    }

    if (["accepted", "in_progress"].includes(status)) {
      const conflictingBooking = await findCompanionTimeConflict({
        companionId: booking.companionId,
        startTime: booking.startTime,
        durationHours: booking.durationHours,
        statuses: CONFIRMED_BOOKING_STATUSES,
        excludeBookingId: booking._id,
      });

      if (conflictingBooking) {
        return res.status(409).json({
          message: "Người đồng hành đang có ca khác trùng thời gian nên không thể nhận ca này.",
        });
      }
    }

    const wasAlreadyCompleted = booking.status === "completed";

    if (status === "completed") {
      const completedAt = booking.completedAt || new Date();
      booking.completedAt = completedAt;
      booking.paymentDueAt = booking.paymentDueAt || new Date(completedAt.getTime() + PAYMENT_DUE_MS);
    }

    booking.status = status;
    await booking.save();

    if (status === "completed" && !wasAlreadyCompleted) {
      await CompanionProfile.findOneAndUpdate(
        { userId: booking.companionId },
        { $inc: { completedBookings: 1 } },
      );
    }

    return res.status(200).json({ message: "booking status updated", booking });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    booking.status = "cancelled";
    await booking.save();
    return res.status(200).json({ message: "booking cancelled", booking });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const addLocation = async (req, res) => {
  try {
    const { lat, lng, note } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    const shiftLog = await ShiftLog.findOneAndUpdate(
      { bookingId: booking._id },
      { $push: { locations: { lat, lng, note } } },
      { new: true, upsert: true },
    );

    return res.status(200).json({ message: "location added", shiftLog });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const updateShiftLog = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    const allowedFields = {};
    const fields = [
      "checkInPhotoUrl",
      "checkOutPhotoUrl",
      "checklist",
      "healthMetrics",
      "companionNote",
    ];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        allowedFields[field] = req.body[field];
      }
    });

    const shiftLog = await ShiftLog.findOneAndUpdate(
      { bookingId: booking._id },
      allowedFields,
      { new: true, upsert: true },
    );

    return res.status(200).json({ message: "shift log updated", shiftLog });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const payBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user.userId,
    })
      .populate("customerId", "name email phone")
      .populate("serviceId", "name");
    if (!booking) {
      return res.status(404).json({ message: "booking not found" });
    }

    if (booking.status === "paid") {
      return res.status(400).json({ message: "Booking da duoc thanh toan." });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ message: "Chi co the thanh toan sau khi ca cham soc hoan thanh." });
    }

    const now = new Date();
    await ensureBookingPaymentDueAt(booking, now);

    const baseAmount = Math.round(Number(booking.totalAmount || 0));
    const platformFee = Math.round(Number(booking.platformFee || 0));
    const companionEarning = Math.max(baseAmount - platformFee, 0);
    const hasPenalty = Boolean(booking.paymentDueAt && now > booking.paymentDueAt);
    const penaltyAmount = hasPenalty ? OVERDUE_PAYMENT_PENALTY_AMOUNT : 0;
    const paidAmount = baseAmount + penaltyAmount;

    if (baseAmount <= 0 || paidAmount <= 0) {
      return res.status(400).json({ message: "So tien thanh toan khong hop le." });
    }

    const existingPayment = await Payment.findOne({ bookingId: booking._id });
    if (existingPayment?.status === "paid") {
      return res.status(400).json({ message: "Booking da duoc thanh toan." });
    }

    if (isReusablePendingPayOSPayment(existingPayment, paidAmount, now)) {
      return res.status(200).json({
        message: "payment link ready",
        checkoutUrl: existingPayment.checkoutUrl,
        payment: existingPayment,
        booking,
        baseAmount,
        penaltyAmount,
        paidAmount,
      });
    }

    const orderCode = await createUniquePayOSOrderCode();
    const expiresAt = getPayOSLinkExpiresAt({
      now,
      paymentDueAt: booking.paymentDueAt,
      hasPenalty,
    });
    const expiredAt = Math.floor(expiresAt.getTime() / 1000);
    const returnUrl = getBookingPaymentRedirectUrl({
      configuredUrl: process.env.PAYOS_RETURN_URL,
      bookingId: booking._id,
      orderCode,
      payosStatus: "return",
    });
    const cancelUrl = getBookingPaymentRedirectUrl({
      configuredUrl: process.env.PAYOS_CANCEL_URL,
      bookingId: booking._id,
      orderCode,
      payosStatus: "cancel",
    });

    const payment = await Payment.findOneAndUpdate(
      { bookingId: booking._id },
      {
        bookingId: booking._id,
        customerId: booking.customerId?._id || booking.customerId,
        companionId: booking.companionId,
        amount: paidAmount,
        platformFee,
        companionEarning,
        method: "payos",
        status: "pending",
        orderCode,
        paymentLinkId: "",
        checkoutUrl: "",
        qrCode: "",
        baseAmount,
        penaltyAmount,
        paidAmount,
        paidAt: null,
        expiresAt,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    try {
      const paymentLink = await createPayOSPaymentLink({
        orderCode,
        amount: paidAmount,
        description: `CareGo ${orderCode}`,
        returnUrl,
        cancelUrl,
        expiredAt,
        buyerName: booking.customerId?.name || undefined,
        buyerEmail: booking.customerId?.email || undefined,
        buyerPhone: booking.customerId?.phone || undefined,
        items: [
          {
            name: booking.serviceId?.name || "Dich vu CareGo",
            quantity: 1,
            price: baseAmount,
          },
          ...(penaltyAmount > 0
            ? [
                {
                  name: "Phi qua han",
                  quantity: 1,
                  price: penaltyAmount,
                },
              ]
            : []),
        ],
      });

      payment.orderCode = paymentLink.orderCode || orderCode;
      payment.paymentLinkId = paymentLink.paymentLinkId || "";
      payment.checkoutUrl = paymentLink.checkoutUrl || "";
      payment.qrCode = paymentLink.qrCode || "";
      payment.expiresAt = paymentLink.expiredAt ? new Date(paymentLink.expiredAt * 1000) : expiresAt;
      await payment.save();

      return res.status(200).json({
        message: "payment link created",
        checkoutUrl: payment.checkoutUrl,
        payment,
        booking,
        baseAmount,
        penaltyAmount,
        paidAmount,
      });
    } catch (error) {
      payment.status = "failed";
      await payment.save().catch(() => null);
      throw error;
    }
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "internal server error", error: error.message });
  }
};

export const createReview = async (req, res) => {
  try {
    const { rating, comment, tags } = req.body;
    if (!rating) {
      return res.status(400).json({ message: "rating is required" });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user.userId,
    });
    if (!booking) {
      return res.status(404).json({ message: "booking not found" });
    }

    const review = await Review.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      companionId: booking.companionId,
      rating,
      comment,
      tags,
    });

    const stats = await Review.aggregate([
      { $match: { companionId: booking.companionId } },
      {
        $group: {
          _id: "$companionId",
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats[0]) {
      await CompanionProfile.findOneAndUpdate(
        { userId: booking.companionId },
        {
          ratingAverage: Math.round(stats[0].average * 10) / 10,
          ratingCount: stats[0].count,
        },
      );
    }

    return res.status(201).json({ message: "review created", review });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
