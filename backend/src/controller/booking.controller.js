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
import { toPaymentDto } from "../dto/payment.dto.js";
import Review from "../models/review.models.js";
import Service from "../models/service.models.js";
import ShiftLog from "../models/shift-log.models.js";
import User from "../models/user.models.js";
import { emitBookingChatState } from "../socket/booking-chat.socket.js";
import { getUserOnlineStatuses } from "../socket/location.socket.js";
import { sendCompanionBookingCreatedEmail } from "../utils/email.js";
import {
  createBookingAcceptedNotification,
  createBookingCompletedNotification,
  createBookingCreatedNotification,
  createNotification,
  createCompanionBookingCreatedNotification,
  createCompanionPaymentSuccessNotification,
  createCompanionReviewCreatedNotification,
  createCompanionCheckedInNotification,
  createPaymentReminderNotification,
  createPaymentSuccessNotification,
  createReviewReminderNotification,
  createShiftNoteUpdatedNotification,
} from "../utils/notifications.js";
import {
  emitAdminBookingCreatedAlert,
  emitAdminBookingIncidentAlert,
  emitAdminPaymentOverdueRestrictionAlert,
  emitAdminPaymentSuccessAlert,
} from "../utils/admin-alerts.js";
import {
  getBookingEndTime,
  getRequestedEndTime,
  isCompanionScheduleAvailable,
  isTimeOverlapped,
  parseBookingAvailabilityWindow,
  parseInstantBookingAvailabilityWindow,
} from "../utils/companion-availability.js";
import { buildPagination, parsePagination } from "../utils/pagination.js";

const populateBooking = [
  { path: "customerId", select: "name email phone" },
  { path: "elderProfileId" },
  { path: "serviceId" },
  { path: "companionId", select: "name avatar" },
];

const toIdString = (value) => {
  if (!value) {
    return "";
  }

  return (value._id || value).toString();
};

export const normalizeBookingIdempotencyKey = (value) => String(value || "").trim();

export const buildBookingIdempotencyFingerprint = (payload = {}) => {
  const addressLocation = payload.addressLocation || {};
  const canonicalPayload = {
    elderProfileId: toIdString(payload.elderProfileId),
    serviceId: toIdString(payload.serviceId),
    companionId: toIdString(payload.companionId),
    startTime: String(payload.startTime || ""),
    durationHours: Number(payload.durationHours),
    address: String(payload.address || "").trim(),
    addressLocation: {
      lat: Number(addressLocation.lat),
      lng: Number(addressLocation.lng),
      displayName: String(addressLocation.displayName || "").trim(),
    },
    note: String(payload.note || ""),
    bookingMode: payload.bookingMode === undefined ? "scheduled" : String(payload.bookingMode).trim(),
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex");
};

const toBookingResponse = (booking) => {
  const payload = typeof booking?.toObject === "function" ? booking.toObject() : { ...booking };
  delete payload.idempotencyKey;
  delete payload.idempotencyFingerprint;
  return payload;
};

const findIdempotentBooking = ({ customerId, idempotencyKey }) =>
  Booking.findOne({ customerId, idempotencyKey }).select("+idempotencyFingerprint");

const sendIdempotentBookingResponse = ({ res, booking, fingerprint }) => {
  if (booking.idempotencyFingerprint !== fingerprint) {
    return res.status(409).json({
      message: "Khóa chống trùng đã được sử dụng cho một yêu cầu đặt lịch khác.",
      code: "IDEMPOTENCY_KEY_REUSED",
    });
  }

  return res.status(200).json({
    message: "Yêu cầu đặt lịch này đã được xử lý trước đó.",
    booking: toBookingResponse(booking),
    idempotentReplay: true,
  });
};

const isIdempotencyDuplicateError = (error) =>
  error?.code === 11000 && (
    Boolean(error?.keyPattern?.idempotencyKey) ||
    Boolean(error?.keyValue?.idempotencyKey) ||
    String(error?.message || "").includes("idempotencyKey")
  );

const customerBookingLink = (bookingId) => `/customer/bookings/${toIdString(bookingId)}`;
const companionBookingLink = (bookingId) => `/companion/bookings/${toIdString(bookingId)}`;
const normalizeIncidentReason = (value) => String(value || "").trim().toLowerCase();
const normalizeIncidentResolution = (value) => String(value || "").trim().toLowerCase();
const normalizeIncidentDetails = (value) => String(value || "").trim();

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
const INCIDENT_REPORTABLE_BOOKING_STATUSES = ["accepted", "in_progress"];
const INCIDENT_RESOLUTION_OPTIONS = ["resume", "reassign", "cancel"];
const INCIDENT_REASON_OPTIONS = ["health", "transport", "family_emergency", "safety", "other"];
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

const INSTANT_BOOKING_OFFER_TTL_MS = getPositiveEnvNumber(
  ["CAREGO_INSTANT_BOOKING_OFFER_MINUTES", "INSTANT_BOOKING_OFFER_MINUTES"],
  5,
) * 60 * 1000;

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

const findCompanionTimeConflict = async ({
  companionId,
  startTime,
  durationHours,
  statuses = CONFIRMED_BOOKING_STATUSES,
  excludeBookingId,
}) => {
  const requestedStart = new Date(startTime);
  const requestedEnd = getRequestedEndTime(requestedStart, durationHours);
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

const createBookingIncidentCustomerNotification = (booking, reason) =>
  createNotification({
    recipientId: toIdString(booking?.customerId),
    recipientRole: "customer",
    type: "BOOKING_INCIDENT_REPORTED",
    title: "Companion vừa báo bận hoặc sự cố",
    message: "CareGo đã nhận thông tin sự cố và đang xử lý phương án phù hợp cho booking của bạn.",
    link: customerBookingLink(booking?._id),
    bookingId: toIdString(booking?._id),
    metadata: {
      status: booking?.status || "",
      reason,
    },
  });

const createIncidentResolutionNotification = ({
  recipientId,
  recipientRole,
  booking,
  resolution,
  message,
  link,
}) =>
  createNotification({
    recipientId,
    recipientRole,
    type: "BOOKING_INCIDENT_RESOLVED",
    title: resolution === "cancel" ? "Booking đã được xử lý sau sự cố" : "Sự cố booking đã được xử lý",
    message,
    link: link || (recipientRole === "customer" ? customerBookingLink(booking?._id) : companionBookingLink(booking?._id)),
    bookingId: toIdString(booking?._id),
    metadata: {
      status: booking?.status || "",
      resolution,
    },
  });

const createCompanionReassignmentNotification = ({ recipientId, booking }) =>
  createNotification({
    recipientId,
    recipientRole: "companion",
    type: "COMPANION_BOOKING_REASSIGNED",
    title: "CareGo vừa điều phối lại một booking",
    message: "Một booking mới đã được chuyển sang cho bạn. Vui lòng kiểm tra và phản hồi sớm.",
    link: companionBookingLink(booking?._id),
    bookingId: toIdString(booking?._id),
    metadata: {
      status: booking?.status || "",
      reassigned: true,
      startTime: booking?.startTime || null,
    },
  });

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
    res.status(403).json({ message: "Không tìm thấy hồ sơ người đồng hành." });
    return false;
  }

  if (profile.vettingStatus !== "approved") {
    res.status(403).json({
      message: "Tài khoản người đồng hành đang chờ quản trị viên phê duyệt.",
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
      reason: "Vị trí GPS vừa được ghi nhận nên chưa cần cập nhật lại.",
      retryAfterMs: SHIFT_GPS_MIN_INTERVAL_MS - elapsedMs,
    };
  }

  const previousLocation = normalizeGpsLocation(previous);
  if (previousLocation && getDistanceMeters(previousLocation, location) < SHIFT_GPS_MIN_DISTANCE_METERS) {
    return {
      shouldStore: false,
      reason: "Vị trí GPS chưa thay đổi đủ xa để ghi nhận điểm mới.",
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

  const error = new Error("Không thể tạo mã thanh toán PayOS.");
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
      const error = new Error("Số tiền thanh toán không khớp.");
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

    await Promise.all([
      createPaymentSuccessNotification({ booking, payment }),
      createCompanionPaymentSuccessNotification({ booking, payment }),
      createReviewReminderNotification(booking),
      emitAdminPaymentSuccessAlert({ booking, payment }),
    ]);

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
  const error = new Error("Lịch làm việc của người đồng hành đang được cập nhật. Vui lòng thử lại.");
  error.statusCode = 409;
  return error;
};

const createPaymentLockBusyError = () => {
  const error = new Error("Liên kết thanh toán đang được tạo. Vui lòng thử lại.");
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
  const bookingLocks = [];
  let idempotencyContext = null;

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
      bookingMode,
      idempotencyKey: submittedIdempotencyKey,
    } = req.body;
    const cleanAddress = String(address || "").trim();
    const normalizedBookingMode = bookingMode === undefined ? "scheduled" : String(bookingMode).trim();
    const idempotencyKey = normalizeBookingIdempotencyKey(submittedIdempotencyKey);

    if (!["scheduled", "instant"].includes(normalizedBookingMode)) {
      return res.status(400).json({ message: "Hình thức đặt lịch không hợp lệ." });
    }

    if (!elderProfileId || !serviceId || !companionId || !startTime || !durationHours || !cleanAddress) {
      return res.status(400).json({
        message: "Vui lòng chọn người thân, dịch vụ, người đồng hành, thời gian, thời lượng và địa chỉ.",
      });
    }

    if (!/^[A-Za-z0-9._:-]{16,100}$/.test(idempotencyKey)) {
      return res.status(400).json({
        message: "Khóa chống trùng booking không hợp lệ. Vui lòng tải lại trang và thử lại.",
        code: "INVALID_IDEMPOTENCY_KEY",
      });
    }

    const normalizedAddressLocation = normalizeAddressLocation(addressLocation);
    if (!normalizedAddressLocation) {
      return res.status(400).json({ message: "Vui lòng ghim vị trí có vĩ độ và kinh độ hợp lệ." });
    }

    const idempotencyFingerprint = buildBookingIdempotencyFingerprint({
      elderProfileId,
      serviceId,
      companionId,
      startTime,
      durationHours,
      address: cleanAddress,
      addressLocation: normalizedAddressLocation,
      note,
      bookingMode: normalizedBookingMode,
    });
    idempotencyContext = { idempotencyKey, idempotencyFingerprint };

    const existingIdempotentBooking = await findIdempotentBooking({
      customerId: req.user.userId,
      idempotencyKey,
    });
    if (existingIdempotentBooking) {
      return sendIdempotentBookingResponse({
        res,
        booking: existingIdempotentBooking,
        fingerprint: idempotencyFingerprint,
      });
    }

    const now = new Date();
    const availabilityWindow = normalizedBookingMode === "instant"
      ? parseInstantBookingAvailabilityWindow({ startTime, durationHours, now })
      : parseBookingAvailabilityWindow({
          startTime,
          durationHours,
          now,
          requireFuture: true,
        });
    if (availabilityWindow.error) {
      return res.status(400).json({ message: availabilityWindow.error });
    }
    const parsedStartTime = availabilityWindow.start;
    const parsedDurationHours = availabilityWindow.durationHours;
    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedDurationHours) || parsedDurationHours < 1) {
      return res.status(400).json({ message: "Thời gian đặt lịch hoặc thời lượng không hợp lệ" });
    }

    if (parsedStartTime <= now) {
      return res.status(400).json({ message: "Thời gian bắt đầu sai, quý khách vui lòng chọn lại." });
    }

    if (toIdString(companionId) === req.user.userId) {
      return res.status(409).json({ message: "Bạn không thể đặt lịch cho chính tài khoản người đồng hành của mình." });
    }

    const overdueBooking = await Booking.findOne({
      customerId: req.user.userId,
      status: "completed",
      paymentDueAt: { $lt: now },
    })
      .select("_id paymentDueAt totalAmount")
      .sort({ paymentDueAt: 1 });

    if (overdueBooking) {
      emitAdminPaymentOverdueRestrictionAlert({ customer: req.user, booking: overdueBooking });
      return res.status(409).json({
        message: "Bạn có lịch chăm sóc quá hạn thanh toán. Vui lòng thanh toán lịch quá hạn trước khi đặt lịch mới.",
        bookingId: overdueBooking._id,
        overdueBookingId: overdueBooking._id,
        paymentDueAt: overdueBooking.paymentDueAt,
        totalAmount: overdueBooking.totalAmount,
      });
    }

    if (normalizedBookingMode === "instant") {
      bookingLocks.push(await acquireCompanionBookingLock(`instant-customer:${req.user.userId}`));
      const activeInstantBooking = await Booking.findOne({
        customerId: req.user.userId,
        bookingMode: "instant",
        status: "pending",
        offerExpiresAt: { $gt: now },
      }).select("_id offerExpiresAt");
      if (activeInstantBooking) {
        return res.status(409).json({
          message: "Bạn đang có một yêu cầu đặt ngay chờ phản hồi. Vui lòng chờ hoặc hủy yêu cầu hiện tại.",
          bookingId: activeInstantBooking._id,
          offerExpiresAt: activeInstantBooking.offerExpiresAt,
        });
      }
    }

    const elder = await ElderProfile.findOne({
      _id: elderProfileId,
      customerId: req.user.userId,
      isArchived: { $ne: true },
    });
    if (!elder) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người thân." });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: "Không tìm thấy dịch vụ." });
    }

    const companionUser = await User.findOne({
      _id: companionId,
      role: "companion",
      isActive: true,
      isEmailVerified: true,
    }).select("_id name email recoveryEmail");
    if (!companionUser) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản người đồng hành đang hoạt động." });
    }

    const companionProfile = await CompanionProfile.findOne({
      userId: companionId,
      vettingStatus: "approved",
    }).select("+applicantCustomerId");
    if (!companionProfile) {
      return res.status(404).json({ message: "Không tìm thấy người đồng hành đã được phê duyệt." });
    }

    if (toIdString(companionProfile.applicantCustomerId) === req.user.userId) {
      return res.status(409).json({ message: "Bạn không thể đặt lịch cho chính hồ sơ người đồng hành của mình." });
    }

    if (!companionProfile.phoneVerifiedAt) {
      return res.status(409).json({ message: "Người đồng hành cần xác minh số điện thoại trước khi nhận booking." });
    }
    if (!isCompanionScheduleAvailable(companionProfile, parsedStartTime, parsedDurationHours)) {
      return res.status(409).json({ message: "Người đồng hành không làm việc trong khung giờ bạn đã chọn." });
    }
    if (
      normalizedBookingMode === "instant" &&
      !getUserOnlineStatuses()[String(companionId)]?.isOnline
    ) {
      return res.status(409).json({ message: "Người đồng hành vừa offline. Vui lòng chọn người đang online khác." });
    }

    bookingLocks.push(await acquireCompanionBookingLock(companionId));

    const bookingCreatedWhileWaiting = await findIdempotentBooking({
      customerId: req.user.userId,
      idempotencyKey,
    });
    if (bookingCreatedWhileWaiting) {
      return sendIdempotentBookingResponse({
        res,
        booking: bookingCreatedWhileWaiting,
        fingerprint: idempotencyFingerprint,
      });
    }

    const duplicateCustomerBooking = await Booking.findOne({
      customerId: req.user.userId,
      elderProfileId,
      serviceId,
      companionId,
      startTime: parsedStartTime,
      durationHours: parsedDurationHours,
      status: { $in: ["pending", ...CONFIRMED_BOOKING_STATUSES] },
    }).select("_id status");
    if (duplicateCustomerBooking) {
      return res.status(409).json({
        message: "Bạn đã có một booking trùng người thân, dịch vụ, người đồng hành và thời gian.",
        code: "DUPLICATE_BOOKING",
        bookingId: duplicateCustomerBooking._id,
      });
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
    if (normalizedBookingMode === "instant") {
      const activeInstantOffer = await Booking.findOne({
        companionId,
        bookingMode: "instant",
        status: "pending",
        offerExpiresAt: { $gt: now },
      }).select("_id");
      if (activeInstantOffer) {
        return res.status(409).json({
          message: "Người đồng hành đang phản hồi một yêu cầu đặt ngay khác. Vui lòng chọn người khác.",
        });
      }
    }

    const totalAmount = service.pricePerHour * parsedDurationHours;
    const platformFee = Math.round(totalAmount * getPlatformFeeRate());

    const booking = await Booking.create({
      customerId: req.user.userId,
      idempotencyKey,
      idempotencyFingerprint,
      elderProfileId,
      serviceId,
      companionId,
      startTime: parsedStartTime,
      durationHours: parsedDurationHours,
      address: cleanAddress,
      addressLocation: normalizedAddressLocation,
      note,
      bookingMode: normalizedBookingMode,
      offerExpiresAt: normalizedBookingMode === "instant"
        ? new Date(now.getTime() + INSTANT_BOOKING_OFFER_TTL_MS)
        : null,
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
      emitAdminBookingCreatedAlert(booking, { elder, service }),
      sendCompanionBookingCreatedEmail({
        to: companionUser.recoveryEmail || companionUser.email,
        name: companionUser.name,
        booking,
        elder,
        service,
      }).catch((emailError) => {
        console.warn("Failed to send companion booking email:", emailError.message);
      }),
    ]);

    emitBookingChatState(booking);

    return res.status(201).json({
      message: normalizedBookingMode === "instant"
        ? "Đã gửi yêu cầu đặt ngay. Người đồng hành có 5 phút để phản hồi."
        : "Tạo lịch chăm sóc thành công.",
      booking: toBookingResponse(booking),
    });
  } catch (error) {
    if (isIdempotencyDuplicateError(error) && idempotencyContext) {
      const existingBooking = await findIdempotentBooking({
        customerId: req.user.userId,
        idempotencyKey: idempotencyContext.idempotencyKey,
      });
      if (existingBooking) {
        return sendIdempotentBookingResponse({
          res,
          booking: existingBooking,
          fingerprint: idempotencyContext.idempotencyFingerprint,
        });
      }
    }

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.statusCode ? error.message : "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      error: error.message,
    });
  } finally {
    await Promise.all(bookingLocks.map((lock) => releaseCompanionBookingLock(lock)));
  }
};

const BOOKING_LIST_STATUSES = new Set(["pending", "accepted", "in_progress", "completed", "paid", "cancelled"]);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseBookingListDate = (value, { endOfDay = false } = {}) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return { date: null };

  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? new Date(`${rawValue}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`)
    : new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return { error: "Ngày lọc lịch không hợp lệ." };
  }

  return { date };
};

const buildBookingSearchConditions = async ({ perspective, search }) => {
  const trimmedSearch = String(search || "").trim();
  if (!trimmedSearch) return [];

  const regex = new RegExp(escapeRegex(trimmedSearch), "i");
  const [elderIds, serviceIds, userIds] = await Promise.all([
    ElderProfile.find({ fullName: regex }).distinct("_id"),
    Service.find({ name: regex }).distinct("_id"),
    User.find({ name: regex }).distinct("_id"),
  ]);

  const conditions = [
    { address: regex },
    { note: regex },
  ];

  if (elderIds.length) {
    conditions.push({ elderProfileId: { $in: elderIds } });
  }
  if (serviceIds.length) {
    conditions.push({ serviceId: { $in: serviceIds } });
  }
  if (userIds.length) {
    conditions.push(perspective === "companion"
      ? { customerId: { $in: userIds } }
      : { companionId: { $in: userIds } });
  }

  return conditions;
};

const buildMyBookingsFilter = async ({ req, perspective }) => {
  const filter = perspective === "companion"
    ? { companionId: req.user.userId }
    : { customerId: req.user.userId };

  const status = String(req.query.status || "all").trim();
  if (status && status !== "all") {
    if (!BOOKING_LIST_STATUSES.has(status)) {
      return { error: "Trạng thái lịch chăm sóc không hợp lệ." };
    }
    filter.status = status;
  }

  const dateFrom = parseBookingListDate(req.query.dateFrom || req.query.from);
  if (dateFrom.error) return { error: dateFrom.error };

  const dateTo = parseBookingListDate(req.query.dateTo || req.query.to, { endOfDay: true });
  if (dateTo.error) return { error: dateTo.error };

  if (dateFrom.date || dateTo.date) {
    filter.startTime = {};
    if (dateFrom.date) filter.startTime.$gte = dateFrom.date;
    if (dateTo.date) filter.startTime.$lte = dateTo.date;
  }

  const searchConditions = await buildBookingSearchConditions({
    perspective,
    search: req.query.search,
  });
  if (searchConditions.length) {
    filter.$or = searchConditions;
  }

  return { filter };
};

export const getMyBookings = async (req, res) => {
  try {
    const perspective = getBookingListPerspective(req);
    if (perspective === "companion" && req.user.role !== "companion") {
      return res.status(403).json({ message: "Bạn không có quyền xem lịch chăm sóc này." });
    }

    if (perspective === "companion" && !(await ensureApprovedCompanionRequest(req, res))) {
      return;
    }

    const paginationParams = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    if (paginationParams.error) {
      return res.status(400).json({ message: paginationParams.error });
    }

    const { filter, error: filterError } = await buildMyBookingsFilter({ req, perspective });
    if (filterError) {
      return res.status(400).json({ message: filterError });
    }

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .populate(populateBooking)
        .sort({ createdAt: -1 })
        .skip(paginationParams.skip)
        .limit(paginationParams.limit),
    ]);

    return res.status(200).json({
      bookings,
      perspective,
      pagination: buildPagination(paginationParams, total),
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate(populateBooking);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    const perspective = getBookingDetailPerspective(req, booking);
    const isCustomerSide = toIdString(booking.customerId) === req.user.userId;
    const isCompanionSide = toIdString(booking.companionId) === req.user.userId;
    if (req.user.role !== "admin" && perspective === "customer" && !isCustomerSide) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (req.user.role !== "admin" && perspective === "companion" && !isCompanionSide) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
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
    const canViewCompanionContact = isCustomerSide && ["accepted", "in_progress", "completed", "paid"].includes(booking.status);
    const companionContact = canViewCompanionContact
      ? await User.findById(toIdString(booking.companionId)).select("name email phone")
      : null;

    const paymentRole = req.user.role === "admin" ? "admin" : perspective;
    return res.status(200).json({
      booking,
      shiftLog,
      payment: toPaymentDto(payment, paymentRole),
      review,
      perspective,
      companionContact,
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const updateBookingStatus = async (req, res) => {
  let bookingLock = null;

  try {
    const { status } = req.body;
    const allowed = ["accepted", "in_progress", "completed", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Trạng thái lịch chăm sóc không hợp lệ." });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (req.user.role === "companion" && toIdString(booking.companionId) !== req.user.userId) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật lịch chăm sóc này." });
    }

    if (
      req.user.role === "companion" &&
      status === "cancelled" &&
      !COMPANION_REJECTABLE_BOOKING_STATUSES.includes(booking.status)
    ) {
      return res.status(409).json({ message: "Người đồng hành chỉ có thể từ chối lịch đang chờ xác nhận." });
    }

    if (!BOOKING_STATUS_TRANSITIONS[booking.status]?.includes(status)) {
      return res.status(409).json({ message: "Không thể chuyển lịch chăm sóc sang trạng thái này." });
    }

    if (
      status === "accepted" &&
      booking.bookingMode === "instant" &&
      (!booking.offerExpiresAt || booking.offerExpiresAt <= new Date())
    ) {
      return res.status(409).json({ message: "Yêu cầu đặt ngay đã hết thời gian phản hồi." });
    }

    if (["accepted", "in_progress"].includes(status)) {
      bookingLock = await acquireCompanionBookingLock(booking.companionId);
    }

    if (status === "accepted") {
      const companionProfile = await CompanionProfile.findOne({
        userId: booking.companionId,
        vettingStatus: "approved",
      }).select("phoneVerifiedAt workingShift workingDays unavailableDates acceptingBookings");
      if (!companionProfile?.phoneVerifiedAt) {
        return res.status(409).json({ message: "Người đồng hành cần xác minh số điện thoại trước khi nhận booking." });
      }
      if (!isCompanionScheduleAvailable(companionProfile, booking.startTime, booking.durationHours)) {
        return res.status(409).json({ message: "Booking này nằm ngoài ca làm việc hiện tại của người đồng hành." });
      }
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
          message: "Vui lòng hoàn tất ảnh và ghi chú của ca chăm sóc trước khi tiếp tục.",
          missingRequirements,
        });
      }
    }

    const previousStatus = booking.status;
    const statusUpdates = { status };
    const statusFilter = { _id: booking._id, status: previousStatus };

    if (status === "accepted" && booking.bookingMode === "instant") {
      statusFilter.offerExpiresAt = { $gt: new Date() };
    }

    if (status === "completed") {
      const completedAt = booking.completedAt || new Date();
      statusUpdates.completedAt = completedAt;
      statusUpdates.paymentDueAt = booking.paymentDueAt || new Date(completedAt.getTime() + PAYMENT_DUE_MS);
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      statusFilter,
      { $set: statusUpdates },
      { new: true, runValidators: true },
    );
    if (!updatedBooking) {
      if (status === "accepted" && booking.bookingMode === "instant") {
        return res.status(409).json({ message: "Yêu cầu đặt ngay đã hết thời gian phản hồi." });
      }
      return res.status(409).json({ message: "Trạng thái lịch chăm sóc đã thay đổi. Vui lòng thử lại." });
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

    return res.status(200).json({ message: "Cập nhật trạng thái lịch chăm sóc thành công.", booking: updatedBooking });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.statusCode ? error.message : "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      error: error.message,
    });
  } finally {
    await releaseCompanionBookingLock(bookingLock);
  }
};

export const reportBookingIncident = async (req, res) => {
  try {
    const reason = normalizeIncidentReason(req.body?.reason);
    const details = normalizeIncidentDetails(req.body?.details);

    if (!INCIDENT_REASON_OPTIONS.includes(reason)) {
      return res.status(400).json({ message: "Lý do báo sự cố không hợp lệ." });
    }

    if (!details) {
      return res.status(400).json({ message: "Vui lòng mô tả ngắn gọn tình trạng bận hoặc sự cố." });
    }

    if (details.length > 1000) {
      return res.status(400).json({ message: "Nội dung sự cố không được vượt quá 1000 ký tự." });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (toIdString(booking.companionId) !== req.user.userId) {
      return res.status(403).json({ message: "Bạn không có quyền báo sự cố cho lịch chăm sóc này." });
    }

    if (!INCIDENT_REPORTABLE_BOOKING_STATUSES.includes(booking.status)) {
      return res.status(409).json({ message: "Chỉ có thể báo sự cố sau khi đã nhận ca hoặc khi ca đang diễn ra." });
    }

    if (booking.incident?.status === "reported") {
      return res.status(409).json({ message: "Sự cố của booking này đang chờ admin xử lý." });
    }

    const incidentUpdates = {
      "incident.status": "reported",
      "incident.reason": reason,
      "incident.details": details,
      "incident.reportedAt": new Date(),
      "incident.reportedBy": req.user.userId,
      "incident.resolvedAt": null,
      "incident.resolvedBy": null,
      "incident.resolution": "",
      "incident.adminNote": "",
    };

    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        companionId: req.user.userId,
        status: { $in: INCIDENT_REPORTABLE_BOOKING_STATUSES },
        "incident.status": { $ne: "reported" },
      },
      { $set: incidentUpdates },
      { new: true, runValidators: true },
    ).populate(populateBooking);

    if (!updatedBooking) {
      return res.status(409).json({ message: "Booking đã thay đổi trạng thái. Vui lòng tải lại và thử lại." });
    }

    const companion = await User.findById(req.user.userId).select("name email");
    await createBookingIncidentCustomerNotification(updatedBooking, reason);
    emitAdminBookingIncidentAlert(updatedBooking, companion || req.user);

    return res.status(200).json({
      message: "Đã gửi báo bận hoặc sự cố cho admin.",
      booking: updatedBooking,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

export const resolveBookingIncident = async (req, res) => {
  const bookingLocks = [];

  try {
    const resolution = normalizeIncidentResolution(req.body?.resolution);
    const adminNote = normalizeIncidentDetails(req.body?.adminNote);
    const nextCompanionId = toIdString(req.body?.companionId);

    if (!INCIDENT_RESOLUTION_OPTIONS.includes(resolution)) {
      return res.status(400).json({ message: "Phương án xử lý sự cố không hợp lệ." });
    }

    if (adminNote.length > 1000) {
      return res.status(400).json({ message: "Ghi chú xử lý không được vượt quá 1000 ký tự." });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (booking.incident?.status !== "reported") {
      return res.status(409).json({ message: "Booking này hiện không có sự cố chờ xử lý." });
    }

    if (resolution === "reassign" && booking.status !== "accepted") {
      return res.status(409).json({ message: "Chỉ có thể đổi companion khi booking đã nhận nhưng chưa bắt đầu ca." });
    }

    if (resolution === "reassign" && !nextCompanionId) {
      return res.status(400).json({ message: "Vui lòng chọn companion thay thế." });
    }

    if (resolution === "reassign" && nextCompanionId === toIdString(booking.companionId)) {
      return res.status(400).json({ message: "Companion thay thế phải khác companion hiện tại." });
    }

    const lockIds = resolution === "reassign"
      ? [toIdString(booking.companionId), nextCompanionId]
      : [toIdString(booking.companionId)];
    for (const lockId of [...new Set(lockIds.filter(Boolean))].sort()) {
      bookingLocks.push(await acquireCompanionBookingLock(lockId));
    }

    let reassignedCompanion = null;
    if (resolution === "reassign") {
      reassignedCompanion = await User.findById(nextCompanionId).select("name email phone isActive isEmailVerified");
      if (!reassignedCompanion?.isActive || !reassignedCompanion?.isEmailVerified) {
        return res.status(409).json({ message: "Companion thay thế hiện không sẵn sàng nhận ca." });
      }

      const companionProfile = await CompanionProfile.findOne({
        userId: nextCompanionId,
        vettingStatus: "approved",
      }).select("phoneVerifiedAt workingShift workingDays unavailableDates acceptingBookings");

      if (!companionProfile?.phoneVerifiedAt) {
        return res.status(409).json({ message: "Companion thay thế cần xác minh số điện thoại trước khi nhận ca." });
      }

      if (!isCompanionScheduleAvailable(companionProfile, booking.startTime, booking.durationHours)) {
        return res.status(409).json({ message: "Booking này nằm ngoài lịch khả dụng hiện tại của companion thay thế." });
      }

      const conflictingBooking = await findCompanionTimeConflict({
        companionId: nextCompanionId,
        startTime: booking.startTime,
        durationHours: booking.durationHours,
        statuses: CONFIRMED_BOOKING_STATUSES,
      });

      if (conflictingBooking) {
        return res.status(409).json({ message: "Companion thay thế đang có ca khác trùng thời gian." });
      }
    }

    const incidentStatus =
      resolution === "resume"
        ? "resolved"
        : resolution === "reassign"
          ? "reassigned"
          : "cancelled";
    const bookingUpdates = {
      "incident.status": incidentStatus,
      "incident.resolution": resolution,
      "incident.resolvedAt": new Date(),
      "incident.resolvedBy": req.user.userId,
      "incident.adminNote": adminNote,
    };

    if (resolution === "cancel") {
      bookingUpdates.status = "cancelled";
    }

    if (resolution === "reassign") {
      bookingUpdates.status = "pending";
      bookingUpdates.companionId = nextCompanionId;
      bookingUpdates["incident.previousCompanionId"] = booking.companionId;
      bookingUpdates.offerExpiresAt = null;
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        companionId: booking.companionId,
        status: booking.status,
        "incident.status": "reported",
      },
      { $set: bookingUpdates },
      { new: true, runValidators: true },
    ).populate(populateBooking);

    if (!updatedBooking) {
      return res.status(409).json({ message: "Booking đã thay đổi trạng thái. Vui lòng tải lại và thử lại." });
    }

    if (resolution === "reassign") {
      await ShiftLog.deleteOne({ bookingId: booking._id });
    }

    emitBookingChatState(updatedBooking);

    const previousCompanionId = toIdString(booking.companionId);
    const customerId = toIdString(updatedBooking.customerId);
    const nextAssignedCompanionId = toIdString(updatedBooking.companionId);

    if (resolution === "resume") {
      await Promise.all([
        createIncidentResolutionNotification({
          recipientId: customerId,
          recipientRole: "customer",
          booking: updatedBooking,
          resolution,
          message: "CareGo đã xác nhận companion có thể tiếp tục booking này.",
        }),
        createIncidentResolutionNotification({
          recipientId: previousCompanionId,
          recipientRole: "companion",
          booking: updatedBooking,
          resolution,
          message: "Admin đã xác nhận bạn có thể tiếp tục booking này.",
        }),
      ]);
    }

    if (resolution === "cancel") {
      await Promise.all([
        createIncidentResolutionNotification({
          recipientId: customerId,
          recipientRole: "customer",
          booking: updatedBooking,
          resolution,
          message: "CareGo đã hủy booking sau khi xử lý sự cố. Bộ phận hỗ trợ sẽ liên hệ nếu cần thêm phương án khác.",
        }),
        createIncidentResolutionNotification({
          recipientId: previousCompanionId,
          recipientRole: "companion",
          booking: updatedBooking,
          resolution,
          message: "Admin đã hủy booking này sau khi tiếp nhận báo sự cố của bạn.",
        }),
      ]);
    }

    if (resolution === "reassign") {
      await Promise.all([
        createIncidentResolutionNotification({
          recipientId: customerId,
          recipientRole: "customer",
          booking: updatedBooking,
          resolution,
          message: "CareGo đang đổi companion cho booking này. Booking đã quay về trạng thái chờ xác nhận từ companion thay thế.",
        }),
        createIncidentResolutionNotification({
          recipientId: previousCompanionId,
          recipientRole: "companion",
          booking: updatedBooking,
          resolution,
          message: "Admin đã tiếp nhận báo sự cố và chuyển booking này sang companion khác.",
          link: "/companion/bookings",
        }),
        createCompanionReassignmentNotification({
          recipientId: nextAssignedCompanionId,
          booking: updatedBooking,
        }),
      ]);
    }

    return res.status(200).json({
      message: "Đã cập nhật phương án xử lý sự cố.",
      booking: updatedBooking,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.statusCode ? error.message : "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      error: error.message,
    });
  } finally {
    await Promise.all(bookingLocks.map((lock) => releaseCompanionBookingLock(lock)));
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (req.user.role !== "admin" && toIdString(booking.customerId) !== req.user.userId) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    const cancellableStatuses =
      req.user.role === "admin"
        ? ADMIN_CANCELLABLE_BOOKING_STATUSES
        : CUSTOMER_CANCELLABLE_BOOKING_STATUSES;
    if (!cancellableStatuses.includes(booking.status)) {
      return res.status(409).json({ message: "Không thể hủy lịch chăm sóc ở trạng thái hiện tại." });
    }

    const paidPayment = await Payment.exists({
      bookingId: booking._id,
      status: "paid",
    });
    if (paidPayment) {
      return res.status(409).json({ message: "Không thể hủy lịch chăm sóc đã thanh toán." });
    }

    booking.status = "cancelled";
    await booking.save();
    emitBookingChatState(booking);
    return res.status(200).json({ message: "Hủy lịch chăm sóc thành công.", booking });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const addLocation = async (req, res) => {
  try {
    const { lat, lng, note } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "Vui lòng cung cấp vĩ độ và kinh độ." });
    }

    const gpsLocation = normalizeGpsLocation({ lat, lng });
    if (!gpsLocation) {
      return res.status(400).json({ message: "Vĩ độ và kinh độ không hợp lệ." });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (!canUpdateShiftEvidence(booking)) {
      return res.status(409).json({ message: "Không thể cập nhật minh chứng ca chăm sóc ở trạng thái hiện tại." });
    }

    const location = {
      ...gpsLocation,
      note,
      createdBy: req.user.userId,
      recordedAt: new Date(),
    };

    if (!isGpsNearBookingAddress(location, booking)) {
      return res.status(409).json({
        message: "Vị trí GPS hiện tại quá xa địa chỉ chăm sóc.",
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
        message: "Vị trí này đã được ghi nhận.",
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

    return res.status(200).json({ message: "Cập nhật vị trí thành công.", maxLocations: SHIFT_GPS_MAX_LOCATIONS, shiftLog });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const updateShiftLog = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (!canUpdateShiftEvidence(booking)) {
      return res.status(409).json({ message: "Không thể cập nhật minh chứng ca chăm sóc ở trạng thái hiện tại." });
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
        message: "Ảnh ca chăm sóc phải là ảnh đã được tải lên hệ thống.",
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

    return res.status(200).json({ message: "Cập nhật nhật ký ca chăm sóc thành công.", shiftLog });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
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
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (booking.status === "paid") {
      return res.status(400).json({ message: "Lịch chăm sóc đã được thanh toán." });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ message: "Chỉ có thể thanh toán sau khi ca chăm sóc hoàn thành." });
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
      return res.status(400).json({ message: "Số tiền thanh toán không hợp lệ." });
    }

    paymentLock = await acquireBookingPaymentLock(booking._id);

    const existingPayment = await Payment.findOne({ bookingId: booking._id }).select("+checkoutUrl");
    if (existingPayment?.status === "paid") {
      return res.status(400).json({ message: "Lịch chăm sóc đã được thanh toán." });
    }

    if (isReusablePendingPayOSPayment(existingPayment, paidAmount, now)) {
      const reusablePayment = await refreshReusablePendingPayOSPayment({
        payment: existingPayment,
        booking,
        paidAmount,
      });

      if (!reusablePayment && existingPayment.status === "paid") {
        return res.status(400).json({ message: "Lịch chăm sóc đã được thanh toán." });
      }

      if (reusablePayment) {
        return res.status(200).json({
          message: "Liên kết thanh toán đã sẵn sàng.",
          checkoutUrl: reusablePayment.checkoutUrl,
          payment: toPaymentDto(reusablePayment, "customer"),
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
        message: "Tạo liên kết thanh toán thành công.",
        checkoutUrl: payment.checkoutUrl,
        payment: toPaymentDto(payment, "customer"),
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
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      error: error.message,
    });
  } finally {
    await releaseBookingPaymentLock(paymentLock);
  }
};

export const createReview = async (req, res) => {
  try {
    const { rating, comment, tags } = req.body;
    const ratingValue = Number(rating);

    if (!rating) {
      return res.status(400).json({ message: "Vui lòng chọn số sao đánh giá." });
    }

    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ message: "Số sao đánh giá phải từ 1 đến 5." });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user.userId,
    });
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy lịch chăm sóc." });
    }

    if (booking.status !== "paid") {
      return res.status(409).json({ message: "Lịch chăm sóc phải được thanh toán trước khi đánh giá." });
    }

    const existingReview = await Review.exists({ bookingId: booking._id });
    if (existingReview) {
      return res.status(409).json({ message: "Lịch chăm sóc này đã được đánh giá." });
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

    await createCompanionReviewCreatedNotification({ booking, review });

    return res.status(201).json({ message: "Gửi đánh giá thành công.", review });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Lịch chăm sóc này đã được đánh giá." });
    }

    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};
