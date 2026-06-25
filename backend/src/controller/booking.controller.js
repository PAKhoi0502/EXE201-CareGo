import crypto from "crypto";
import BookingCompanionLock from "../models/booking-companion-lock.models.js";
import BookingPaymentLock from "../models/booking-payment-lock.models.js";
import Booking from "../models/booking.models.js";
import {
  buildPayOSRedirectUrl,
  createPayOSPaymentLink,
  getPayOSPaymentLink,
  getPayOSPaymentExpireMinutes,
} from "../config/payos.js";
import CompanionProfile from "../models/companion-profile.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import Payment from "../models/payment.models.js";
import Review from "../models/review.models.js";
import Service from "../models/service.models.js";
import ShiftLog from "../models/shift-log.models.js";
import User from "../models/user.models.js";
import { emitBookingChatState } from "../socket/booking-chat.socket.js";
import { sendCompanionBookingCreatedEmail } from "../utils/email.js";
import {
  createBookingAcceptedNotification,
  createBookingCompletedNotification,
  createBookingCreatedNotification,
  createCompanionBookingCreatedNotification,
  createCompanionCheckedInNotification,
  createPaymentReminderNotification,
  createPaymentSuccessNotification,
  createReviewReminderNotification,
  createShiftNoteUpdatedNotification,
} from "../utils/notifications.js";

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
const BOOKING_STATUS_TRANSITIONS = {
  pending: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  paid: [],
};
const CUSTOMER_CANCELLABLE_BOOKING_STATUSES = ["pending", "accepted"];
const ADMIN_CANCELLABLE_BOOKING_STATUSES = ["pending", "accepted", "in_progress"];
const COMPANION_REJECTABLE_BOOKING_STATUSES = ["pending"];
const SHIFT_EVIDENCE_EDITABLE_BOOKING_STATUSES = ["accepted", "in_progress"];
const SHIFT_PHOTO_FOLDERS = {
  checkInPhotoUrl: "carego/check-in",
  checkOutPhotoUrl: "carego/check-out",
};
const SHIFT_GPS_REQUIREMENT = "gpsLocationNearAddress";
const PAYMENT_DUE_MS = 3 * 24 * 60 * 60 * 1000;
const OVERDUE_PAYMENT_PENALTY_AMOUNT = 50000;
const BOOKING_CREATE_LOCK_TTL_MS = 10 * 1000;
const BOOKING_CREATE_LOCK_WAIT_MS = 1200;
const BOOKING_CREATE_LOCK_RETRY_MS = 75;
const PAYMENT_LINK_LOCK_TTL_MS = 60 * 1000;
const PAYMENT_LINK_LOCK_WAIT_MS = 3000;
const PAYMENT_LINK_LOCK_RETRY_MS = 100;

const getPositiveEnvNumber = (names, fallback) => {
  for (const name of names) {
    const value = Number(process.env[name]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return fallback;
};

const SHIFT_GPS_MAX_DISTANCE_METERS = getPositiveEnvNumber(
  ["CAREGO_SHIFT_GPS_MAX_DISTANCE_METERS", "SHIFT_GPS_MAX_DISTANCE_METERS"],
  500,
);
const SHIFT_GPS_MIN_INTERVAL_MS = getPositiveEnvNumber(
  ["CAREGO_SHIFT_GPS_MIN_INTERVAL_MS", "SHIFT_GPS_MIN_INTERVAL_MS"],
  10000,
);
const SHIFT_GPS_MIN_DISTANCE_METERS = getPositiveEnvNumber(
  ["CAREGO_SHIFT_GPS_MIN_DISTANCE_METERS", "SHIFT_GPS_MIN_DISTANCE_METERS"],
  10,
);
const SHIFT_GPS_MAX_LOCATIONS = Math.max(
  1,
  Math.floor(getPositiveEnvNumber(["CAREGO_SHIFT_GPS_MAX_LOCATIONS", "SHIFT_GPS_MAX_LOCATIONS"], 100)),
);

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

const getRequestedBookingPerspective = (req) => {
  const value = String(req.query?.as || "").trim().toLowerCase();
  return ["customer", "companion"].includes(value) ? value : "";
};

const getBookingListPerspective = (req) =>
  getRequestedBookingPerspective(req) || (req.user.role === "companion" ? "companion" : "customer");

const getBookingDetailPerspective = (req, booking) => {
  const requestedPerspective = getRequestedBookingPerspective(req);
  if (requestedPerspective) {
    return requestedPerspective;
  }

  return req.user.role === "companion" && toIdString(booking.companionId) === req.user.userId
    ? "companion"
    : "customer";
};

const ensureApprovedCompanionRequest = async (req, res) => {
  if (req.user.role !== "companion") {
    return true;
  }

  const profile = await CompanionProfile.findOne({ userId: req.user.userId }).select("vettingStatus");
  if (!profile) {
    res.status(403).json({ message: "companion profile not found" });
    return false;
  }

  if (profile.vettingStatus !== "approved") {
    res.status(403).json({
      message: "companion account is waiting for admin approval",
      vettingStatus: profile.vettingStatus,
    });
    return false;
  }

  req.companionProfile = profile;
  return true;
};

const canUpdateShiftEvidence = (booking) =>
  SHIFT_EVIDENCE_EDITABLE_BOOKING_STATUSES.includes(booking.status);

const normalizeShiftPhotoUrls = (value) => {
  if (Array.isArray(value)) {
    return value.map((url) => String(url || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return null;
};

const getCloudinaryPathname = (url) => {
  try {
    const parsedUrl = new URL(String(url || "").trim());
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "res.cloudinary.com") {
      return "";
    }

    return decodeURIComponent(parsedUrl.pathname);
  } catch {
    return "";
  }
};

const isTrustedShiftPhotoUrl = (url, folder) => {
  const pathname = getCloudinaryPathname(url);
  if (!pathname) {
    return false;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (cloudName && !pathname.startsWith(`/${cloudName}/image/upload/`)) {
    return false;
  }

  return pathname.includes(`/${folder}/`);
};

const hasShiftPhoto = (value, folder) => {
  const urls = normalizeShiftPhotoUrls(value);
  return Boolean(urls?.some((url) => isTrustedShiftPhotoUrl(url, folder)));
};

const normalizeGpsLocation = (location) => {
  if (!location || typeof location !== "object") {
    return null;
  }

  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
};

const getDistanceMeters = (first, second) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLng = toRadians(second.lng - first.lng);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const isGpsNearBookingAddress = (location, booking) => {
  const currentLocation = normalizeGpsLocation(location);
  const addressLocation = normalizeGpsLocation(booking?.addressLocation);
  if (!currentLocation || !addressLocation) {
    return false;
  }

  return getDistanceMeters(currentLocation, addressLocation) <= SHIFT_GPS_MAX_DISTANCE_METERS;
};

const getRecordedAtMs = (location) => {
  const recordedAtMs = new Date(location?.recordedAt).getTime();
  return Number.isFinite(recordedAtMs) ? recordedAtMs : 0;
};

const getLatestShiftGpsLocation = (locations, userId) => {
  const entries = Array.isArray(locations) ? locations : [];
  const fallback = [...entries].reverse().find((location) => normalizeGpsLocation(location));
  const userLocation = [...entries]
    .reverse()
    .find((location) => normalizeGpsLocation(location) && toIdString(location.createdBy) === userId);

  return userLocation || fallback || null;
};

const shouldStoreShiftGpsLocation = ({ locations, userId, location }) => {
  const previous = getLatestShiftGpsLocation(locations, userId);
  if (!previous) {
    return { shouldStore: true };
  }

  const elapsedMs = location.recordedAt.getTime() - getRecordedAtMs(previous);
  if (elapsedMs >= 0 && elapsedMs < SHIFT_GPS_MIN_INTERVAL_MS) {
    return {
      shouldStore: false,
      reason: "gps location was sampled too recently",
      retryAfterMs: SHIFT_GPS_MIN_INTERVAL_MS - elapsedMs,
    };
  }

  const previousLocation = normalizeGpsLocation(previous);
  if (previousLocation && getDistanceMeters(previousLocation, location) < SHIFT_GPS_MIN_DISTANCE_METERS) {
    return {
      shouldStore: false,
      reason: "gps location has not moved enough",
      minDistanceMeters: SHIFT_GPS_MIN_DISTANCE_METERS,
    };
  }

  return { shouldStore: true };
};

const hasGpsEvidence = (shiftLog, booking) =>
  Boolean(shiftLog?.locations?.some((location) => isGpsNearBookingAddress(location, booking)));

const isShiftChecklistDone = (shiftLog) => {
  const checklist = Array.isArray(shiftLog?.checklist) ? shiftLog.checklist : [];
  return checklist.length === 0 || checklist.every((item) => item?.done === true);
};

const getMissingShiftRequirements = (shiftLog, nextStatus, booking) => {
  const missing = [];

  if (!shiftLog) {
    return nextStatus === "completed"
      ? ["checkInPhotoUrl", SHIFT_GPS_REQUIREMENT, "checklist", "companionNote", "checkOutPhotoUrl"]
      : ["checkInPhotoUrl", SHIFT_GPS_REQUIREMENT];
  }

  if (!hasShiftPhoto(shiftLog.checkInPhotoUrl, SHIFT_PHOTO_FOLDERS.checkInPhotoUrl)) {
    missing.push("checkInPhotoUrl");
  }

  if (!hasGpsEvidence(shiftLog, booking)) {
    missing.push(SHIFT_GPS_REQUIREMENT);
  }

  if (nextStatus === "completed") {
    if (!isShiftChecklistDone(shiftLog)) {
      missing.push("checklist");
    }

    if (!String(shiftLog.companionNote || "").trim()) {
      missing.push("companionNote");
    }

    if (!hasShiftPhoto(shiftLog.checkOutPhotoUrl, SHIFT_PHOTO_FOLDERS.checkOutPhotoUrl)) {
      missing.push("checkOutPhotoUrl");
    }
  }

  return missing;
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

const getPayOSPaymentPaidAt = (paymentLink) => {
  const transactionDate =
    paymentLink?.transactions?.findLast?.((transaction) => transaction.transactionDateTime)?.transactionDateTime;
  return transactionDate ? new Date(transactionDate) : new Date();
};

const refreshReusablePendingPayOSPayment = async ({ payment, booking, paidAmount }) => {
  if (!payment?.orderCode) {
    return null;
  }

  const paymentLink = await getPayOSPaymentLink(payment.orderCode);
  const payosStatus = String(paymentLink?.status || "").toUpperCase();

  if (payosStatus === "PAID") {
    const amountPaid = Number(paymentLink.amountPaid ?? paymentLink.amount ?? 0);
    const orderAmount = Number(paymentLink.amount ?? 0);
    if (paidAmount > 0 && amountPaid !== paidAmount && orderAmount !== paidAmount) {
      payment.status = "failed";
      await payment.save();
      const error = new Error("payment amount mismatch");
      error.statusCode = 400;
      throw error;
    }

    payment.status = "paid";
    payment.paidAt = payment.paidAt || getPayOSPaymentPaidAt(paymentLink);
    payment.rawWebhook = {
      source: "payos-reuse-sync",
      syncedAt: new Date(),
      paymentLink,
    };
    await payment.save();

    if (booking.status !== "paid") {
      booking.status = "paid";
      await booking.save();
    }

    await createPaymentSuccessNotification({ booking, payment });
    await createReviewReminderNotification(booking);

    return null;
  }

  if (payosStatus === "CANCELLED" || payosStatus === "EXPIRED" || payosStatus === "FAILED") {
    payment.status = payosStatus.toLowerCase();
    payment.rawWebhook = {
      source: "payos-reuse-sync",
      syncedAt: new Date(),
      paymentLink,
    };
    await payment.save();
    return null;
  }

  return payment;
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

const normalizeAddressLocation = (addressLocation) => {
  if (!addressLocation || typeof addressLocation !== "object") {
    return null;
  }

  const lat = Number(addressLocation.lat);
  const lng = Number(addressLocation.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return {
    lat,
    lng,
    displayName: String(addressLocation.displayName || "").trim(),
  };
};

const createBookingLockBusyError = () => {
  const error = new Error("Companion schedule is being updated. Please try again.");
  error.statusCode = 409;
  return error;
};

const createPaymentLockBusyError = () => {
  const error = new Error("Payment link is being created. Please try again.");
  error.statusCode = 409;
  return error;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const acquireCompanionBookingLock = async (companionId) => {
  const lockId = String(companionId);
  const ownerToken = crypto.randomUUID?.() || crypto.randomBytes(16).toString("hex");
  const getExpiresAt = () => new Date(Date.now() + BOOKING_CREATE_LOCK_TTL_MS);
  const deadline = Date.now() + BOOKING_CREATE_LOCK_WAIT_MS;

  while (Date.now() <= deadline) {
    try {
      await BookingCompanionLock.create({
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

    const acquiredLock = await BookingCompanionLock.findOneAndUpdate(
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

    await sleep(BOOKING_CREATE_LOCK_RETRY_MS);
  }

  throw createBookingLockBusyError();
};

const releaseCompanionBookingLock = async (lock) => {
  if (!lock) return;

  try {
    await BookingCompanionLock.deleteOne({
      _id: lock.lockId,
      ownerToken: lock.ownerToken,
    });
  } catch {
    // The lock is short-lived and has a TTL fallback, so release failure should not mask the booking response.
  }
};

const acquireBookingPaymentLock = async (bookingId) => {
  const lockId = String(bookingId);
  const ownerToken = crypto.randomUUID?.() || crypto.randomBytes(16).toString("hex");
  const getExpiresAt = () => new Date(Date.now() + PAYMENT_LINK_LOCK_TTL_MS);
  const deadline = Date.now() + PAYMENT_LINK_LOCK_WAIT_MS;

  while (Date.now() <= deadline) {
    try {
      await BookingPaymentLock.create({
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

    const acquiredLock = await BookingPaymentLock.findOneAndUpdate(
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

    await sleep(PAYMENT_LINK_LOCK_RETRY_MS);
  }

  throw createPaymentLockBusyError();
};

const releaseBookingPaymentLock = async (lock) => {
  if (!lock) return;

  try {
    await BookingPaymentLock.deleteOne({
      _id: lock.lockId,
      ownerToken: lock.ownerToken,
    });
  } catch {
    // The lock has a TTL fallback; release failure should not mask the payment response.
  }
};

const getExistingRatingTotalExpression = () => ({
  $cond: [
    { $gt: [{ $ifNull: ["$ratingTotal", 0] }, 0] },
    { $ifNull: ["$ratingTotal", 0] },
    { $multiply: [{ $ifNull: ["$ratingAverage", 0] }, { $ifNull: ["$ratingCount", 0] }] },
  ],
});

const updateCompanionRatingStats = async ({ companionId, ratingValue }) => {
  await CompanionProfile.findOneAndUpdate(
    { userId: companionId },
    [
      {
        $set: {
          ratingTotal: {
            $add: [getExistingRatingTotalExpression(), ratingValue],
          },
          ratingCount: {
            $add: [{ $ifNull: ["$ratingCount", 0] }, 1],
          },
        },
      },
      {
        $set: {
          ratingAverage: {
            $round: [{ $divide: ["$ratingTotal", "$ratingCount"] }, 1],
          },
        },
      },
    ],
    { new: true },
  );
};

export const createBooking = async (req, res) => {
  let bookingLock = null;

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
    const cleanAddress = String(address || "").trim();

    if (!elderProfileId || !serviceId || !companionId || !startTime || !durationHours || !cleanAddress) {
      return res.status(400).json({
        message: "elderProfileId, serviceId, companionId, startTime, durationHours and address are required",
      });
    }

    const parsedStartTime = new Date(startTime);
    const parsedDurationHours = Number(durationHours);
    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedDurationHours) || parsedDurationHours < 1) {
      return res.status(400).json({ message: "Thời gian đặt lịch hoặc thời lượng không hợp lệ" });
    }

    const now = new Date();
    if (parsedStartTime <= now) {
      return res.status(400).json({ message: "Thời gian bắt đầu sai, quý khách vui lòng chọn lại." });
    }

    const normalizedAddressLocation = normalizeAddressLocation(addressLocation);
    if (!normalizedAddressLocation) {
      return res.status(400).json({ message: "valid addressLocation with lat and lng is required" });
    }

    if (toIdString(companionId) === req.user.userId) {
      return res.status(409).json({ message: "Bạn không thể đặt lịch cho chính tài khoản companion của mình." });
    }

    const overdueBooking = await Booking.findOne({
      customerId: req.user.userId,
      status: "completed",
      paymentDueAt: { $lt: now },
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

    const companionUser = await User.findOne({
      _id: companionId,
      role: "companion",
      isActive: true,
      isEmailVerified: true,
    }).select("_id name email");
    if (!companionUser) {
      return res.status(404).json({ message: "active companion not found" });
    }

    const companionProfile = await CompanionProfile.findOne({
      userId: companionId,
      vettingStatus: "approved",
    });
    if (!companionProfile) {
      return res.status(404).json({ message: "approved companion not found" });
    }

    bookingLock = await acquireCompanionBookingLock(companionId);

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
      address: cleanAddress,
      addressLocation: normalizedAddressLocation,
      note,
      totalAmount,
      platformFee,
    });

    await ShiftLog.create({
      bookingId: booking._id,
      checklist: service.defaultChecklist?.map((label) => ({ label, done: false })) || [],
    });

    await Promise.all([
      createBookingCreatedNotification(booking),
      createCompanionBookingCreatedNotification(booking, { elder, service }),
      sendCompanionBookingCreatedEmail({
        to: companionUser.email,
        name: companionUser.name,
        booking,
        elder,
        service,
      }).catch((emailError) => {
        console.warn("Failed to send companion booking email:", emailError.message);
      }),
    ]);

    return res.status(201).json({ message: "booking created", booking });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.statusCode ? error.message : "internal server error",
      error: error.message,
    });
  } finally {
    await releaseCompanionBookingLock(bookingLock);
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const perspective = getBookingListPerspective(req);
    if (perspective === "companion" && req.user.role !== "companion") {
      return res.status(403).json({ message: "permission denied" });
    }

    if (perspective === "companion" && !(await ensureApprovedCompanionRequest(req, res))) {
      return;
    }

    const filter = perspective === "companion"
      ? { companionId: req.user.userId }
      : { customerId: req.user.userId };

    const bookings = await Booking.find(filter).populate(populateBooking).sort({ createdAt: -1 });
    return res.status(200).json({ bookings, perspective });
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

    const perspective = getBookingDetailPerspective(req, booking);
    const isCustomerSide = toIdString(booking.customerId) === req.user.userId;
    const isCompanionSide = toIdString(booking.companionId) === req.user.userId;
    if (req.user.role !== "admin" && perspective === "customer" && !isCustomerSide) {
      return res.status(404).json({ message: "booking not found" });
    }

    if (req.user.role !== "admin" && perspective === "companion" && !isCompanionSide) {
      return res.status(404).json({ message: "booking not found" });
    }

    if (
      perspective === "companion" &&
      isCompanionSide &&
      !(await ensureApprovedCompanionRequest(req, res))
    ) {
      return;
    }

    const shiftLog = await ShiftLog.findOne({ bookingId: booking._id });
    const payment = await Payment.findOne({ bookingId: booking._id });
    const review = await Review.findOne({ bookingId: booking._id });

    return res.status(200).json({ booking, shiftLog, payment, review, perspective });
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

    if (
      req.user.role === "companion" &&
      status === "cancelled" &&
      !COMPANION_REJECTABLE_BOOKING_STATUSES.includes(booking.status)
    ) {
      return res.status(409).json({ message: "companion can only reject pending bookings" });
    }

    if (!BOOKING_STATUS_TRANSITIONS[booking.status]?.includes(status)) {
      return res.status(409).json({ message: "booking status transition is not allowed" });
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

    if (["in_progress", "completed"].includes(status)) {
      const shiftLog = await ShiftLog.findOne({ bookingId: booking._id });
      const missingRequirements = getMissingShiftRequirements(shiftLog, status, booking);

      if (missingRequirements.length > 0) {
        return res.status(409).json({
          message: "booking shift evidence is incomplete",
          missingRequirements,
        });
      }
    }

    const previousStatus = booking.status;
    const statusUpdates = { status };

    if (status === "completed") {
      const completedAt = booking.completedAt || new Date();
      statusUpdates.completedAt = completedAt;
      statusUpdates.paymentDueAt = booking.paymentDueAt || new Date(completedAt.getTime() + PAYMENT_DUE_MS);
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, status: previousStatus },
      { $set: statusUpdates },
      { new: true, runValidators: true },
    );
    if (!updatedBooking) {
      return res.status(409).json({ message: "booking status changed, please retry" });
    }

    emitBookingChatState(updatedBooking);

    if (status === "completed") {
      await CompanionProfile.findOneAndUpdate(
        { userId: updatedBooking.companionId },
        { $inc: { completedBookings: 1 } },
      );
    }

    if (status === "accepted") {
      await createBookingAcceptedNotification(updatedBooking);
    } else if (status === "in_progress") {
      await createCompanionCheckedInNotification(updatedBooking);
    } else if (status === "completed") {
      await createBookingCompletedNotification(updatedBooking);
      await createPaymentReminderNotification(updatedBooking);
    }

    return res.status(200).json({ message: "booking status updated", booking: updatedBooking });
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

    if (req.user.role !== "admin" && toIdString(booking.customerId) !== req.user.userId) {
      return res.status(404).json({ message: "booking not found" });
    }

    const cancellableStatuses =
      req.user.role === "admin"
        ? ADMIN_CANCELLABLE_BOOKING_STATUSES
        : CUSTOMER_CANCELLABLE_BOOKING_STATUSES;
    if (!cancellableStatuses.includes(booking.status)) {
      return res.status(409).json({ message: "booking cannot be cancelled in current status" });
    }

    const paidPayment = await Payment.exists({
      bookingId: booking._id,
      status: "paid",
    });
    if (paidPayment) {
      return res.status(409).json({ message: "paid booking cannot be cancelled" });
    }

    booking.status = "cancelled";
    await booking.save();
    emitBookingChatState(booking);
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

    const gpsLocation = normalizeGpsLocation({ lat, lng });
    if (!gpsLocation) {
      return res.status(400).json({ message: "valid lat and lng are required" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    if (!canUpdateShiftEvidence(booking)) {
      return res.status(409).json({ message: "booking shift evidence cannot be updated in current status" });
    }

    const location = {
      ...gpsLocation,
      note,
      createdBy: req.user.userId,
      recordedAt: new Date(),
    };

    if (!isGpsNearBookingAddress(location, booking)) {
      return res.status(409).json({
        message: "gps location is too far from booking address",
        maxDistanceMeters: SHIFT_GPS_MAX_DISTANCE_METERS,
      });
    }

    const existingShiftLog = await ShiftLog.findOne({ bookingId: booking._id }).select("locations");
    const sampleDecision = shouldStoreShiftGpsLocation({
      locations: existingShiftLog?.locations,
      userId: req.user.userId,
      location,
    });
    if (!sampleDecision.shouldStore) {
      return res.status(200).json({
        message: "location already sampled",
        ...sampleDecision,
        maxLocations: SHIFT_GPS_MAX_LOCATIONS,
        shiftLog: existingShiftLog,
      });
    }

    const shiftLog = await ShiftLog.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $push: {
          locations: {
            $each: [location],
            $slice: -SHIFT_GPS_MAX_LOCATIONS,
          },
        },
      },
      { new: true, upsert: true },
    );

    return res.status(200).json({ message: "location added", maxLocations: SHIFT_GPS_MAX_LOCATIONS, shiftLog });
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

    if (!canUpdateShiftEvidence(booking)) {
      return res.status(409).json({ message: "booking shift evidence cannot be updated in current status" });
    }

    const allowedFields = {};
    Object.entries(SHIFT_PHOTO_FOLDERS).forEach(([field, folder]) => {
      if (req.body[field] === undefined) {
        return;
      }

      const photoUrls = normalizeShiftPhotoUrls(req.body[field]);
      if (!photoUrls || photoUrls.some((url) => !isTrustedShiftPhotoUrl(url, folder))) {
        allowedFields.__invalidPhotoField = field;
        return;
      }

      allowedFields[field] = photoUrls;
    });

    if (allowedFields.__invalidPhotoField) {
      return res.status(400).json({
        message: "shift photo url must be a trusted uploaded image",
        field: allowedFields.__invalidPhotoField,
      });
    }

    const fields = ["checklist", "healthMetrics", "companionNote"];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        allowedFields[field] = req.body[field];
      }
    });

    const shouldNotifyNoteUpdate = Object.prototype.hasOwnProperty.call(allowedFields, "companionNote");
    const previousShiftLog = shouldNotifyNoteUpdate
      ? await ShiftLog.findOne({ bookingId: booking._id }).select("companionNote")
      : null;

    const shiftLog = await ShiftLog.findOneAndUpdate(
      { bookingId: booking._id },
      allowedFields,
      { new: true, upsert: true },
    );

    if (shouldNotifyNoteUpdate) {
      const previousNote = String(previousShiftLog?.companionNote || "").trim();
      const nextNote = String(shiftLog?.companionNote || "").trim();
      if (nextNote && nextNote !== previousNote) {
        await createShiftNoteUpdatedNotification(booking, shiftLog);
      }
    }

    return res.status(200).json({ message: "shift log updated", shiftLog });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const payBooking = async (req, res) => {
  let paymentLock = null;

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

    paymentLock = await acquireBookingPaymentLock(booking._id);

    const existingPayment = await Payment.findOne({ bookingId: booking._id });
    if (existingPayment?.status === "paid") {
      return res.status(400).json({ message: "Booking da duoc thanh toan." });
    }

    if (isReusablePendingPayOSPayment(existingPayment, paidAmount, now)) {
      const reusablePayment = await refreshReusablePendingPayOSPayment({
        payment: existingPayment,
        booking,
        paidAmount,
      });

      if (!reusablePayment && existingPayment.status === "paid") {
        return res.status(400).json({ message: "Booking da duoc thanh toan." });
      }

      if (reusablePayment) {
        return res.status(200).json({
          message: "payment link ready",
          checkoutUrl: reusablePayment.checkoutUrl,
          payment: reusablePayment,
          booking,
          baseAmount,
          penaltyAmount,
          paidAmount,
        });
      }
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
  } finally {
    await releaseBookingPaymentLock(paymentLock);
  }
};

export const createReview = async (req, res) => {
  try {
    const { rating, comment, tags } = req.body;
    const ratingValue = Number(rating);

    if (!rating) {
      return res.status(400).json({ message: "rating is required" });
    }

    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user.userId,
    });
    if (!booking) {
      return res.status(404).json({ message: "booking not found" });
    }

    if (booking.status !== "paid") {
      return res.status(409).json({ message: "booking must be paid before review" });
    }

    const existingReview = await Review.exists({ bookingId: booking._id });
    if (existingReview) {
      return res.status(409).json({ message: "booking already reviewed" });
    }

    const review = await Review.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      companionId: booking.companionId,
      rating: ratingValue,
      comment,
      tags,
    });

    await updateCompanionRatingStats({
      companionId: booking.companionId,
      ratingValue,
    });

    return res.status(201).json({ message: "review created", review });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "booking already reviewed" });
    }

    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
