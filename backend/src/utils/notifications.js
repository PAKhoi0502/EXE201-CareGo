import Notification from "../models/notification.models.js";
import { emitUserNotification } from "../socket/notification.socket.js";

const SHIFT_NOTE_NOTIFICATION_WINDOW_MS = 2 * 60 * 1000;

const toIdString = (value) => {
  if (!value) return "";
  return (value._id || value).toString();
};

const bookingLink = (booking) => `/customer/bookings/${toIdString(booking?._id)}`;

const getBookingId = (booking) => toIdString(booking?._id);

const getCustomerId = (booking) => toIdString(booking?.customerId);

const truncateText = (value, maxLength = 160) => {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
};

export const serializeNotification = (notification) => {
  const data = notification?.toObject ? notification.toObject() : notification;
  if (!data) return null;

  return {
    _id: data._id,
    recipientId: data.recipientId,
    recipientRole: data.recipientRole,
    type: data.type,
    title: data.title,
    message: data.message,
    link: data.link || "",
    bookingId: data.bookingId || null,
    metadata: data.metadata || {},
    readAt: data.readAt || null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

export const createNotification = async ({
  recipientId,
  recipientRole = "customer",
  type,
  title,
  message,
  link = "",
  bookingId = null,
  metadata = {},
  dedupeKey = "",
}) => {
  try {
    if (!recipientId || !type || !title || !message) return null;

    const payload = {
      recipientId,
      recipientRole,
      type,
      title,
      message,
      link,
      bookingId,
      metadata,
      dedupeKey,
    };

    const notification = await Notification.create(payload);
    emitUserNotification(recipientId, { notification: serializeNotification(notification) });
    return notification;
  } catch (error) {
    if (error?.code === 11000 && dedupeKey) {
      return Notification.findOne({ dedupeKey });
    }

    console.warn("Notification create failed:", error.message);
    return null;
  }
};

export const createCustomerWelcomeNotification = (user) =>
  createNotification({
    recipientId: toIdString(user?._id),
    recipientRole: "customer",
    type: "CUSTOMER_WELCOME",
    title: "Chào mừng bạn đến với CareGo",
    message: "Tài khoản của bạn đã sẵn sàng. Hãy tạo hồ sơ người thân và đặt lịch chăm sóc đầu tiên khi cần.",
    link: "/customer/bookings/new",
    metadata: { userId: toIdString(user?._id) },
    dedupeKey: `customer:${toIdString(user?._id)}:welcome`,
  });

export const createBookingCreatedNotification = (booking) =>
  createNotification({
    recipientId: getCustomerId(booking),
    recipientRole: "customer",
    type: "BOOKING_CREATED",
    title: "Đặt lịch thành công",
    message: "Yêu cầu đặt lịch của bạn đã được ghi nhận. CareGo sẽ thông báo khi companion phản hồi.",
    link: bookingLink(booking),
    bookingId: getBookingId(booking),
    metadata: { status: booking?.status || "pending" },
    dedupeKey: `booking:${getBookingId(booking)}:created:customer`,
  });

export const createBookingAcceptedNotification = (booking) =>
  createNotification({
    recipientId: getCustomerId(booking),
    recipientRole: "customer",
    type: "BOOKING_ACCEPTED",
    title: "Companion đã nhận booking",
    message: "Companion đã chấp nhận lịch chăm sóc của bạn. Bạn có thể theo dõi chi tiết trong trang booking.",
    link: bookingLink(booking),
    bookingId: getBookingId(booking),
    metadata: { status: "accepted" },
    dedupeKey: `booking:${getBookingId(booking)}:accepted:customer`,
  });

export const createCompanionCheckedInNotification = (booking) =>
  createNotification({
    recipientId: getCustomerId(booking),
    recipientRole: "customer",
    type: "COMPANION_CHECKED_IN",
    title: "Companion đã check-in",
    message: "Companion đã check-in tại điểm đón và bắt đầu ca chăm sóc.",
    link: bookingLink(booking),
    bookingId: getBookingId(booking),
    metadata: { status: "in_progress" },
    dedupeKey: `booking:${getBookingId(booking)}:check-in:customer`,
  });

export const createShiftNoteUpdatedNotification = (booking, shiftLog) => {
  const bookingId = getBookingId(booking);
  const bucket = Math.floor(Date.now() / SHIFT_NOTE_NOTIFICATION_WINDOW_MS);
  const note = truncateText(shiftLog?.companionNote, 220);

  return createNotification({
    recipientId: getCustomerId(booking),
    recipientRole: "customer",
    type: "SHIFT_NOTE_UPDATED",
    title: "Companion vừa cập nhật ghi chú",
    message: note ? `Ghi chú mới: ${note}` : "Companion vừa cập nhật ghi chú trong ca chăm sóc.",
    link: bookingLink(booking),
    bookingId,
    metadata: { note },
    dedupeKey: `booking:${bookingId}:shift-note:${bucket}:customer`,
  });
};

export const createBookingCompletedNotification = (booking) =>
  createNotification({
    recipientId: getCustomerId(booking),
    recipientRole: "customer",
    type: "BOOKING_COMPLETED",
    title: "Ca chăm sóc đã hoàn thành",
    message: "Companion đã kết thúc ca. Báo cáo sau ca đã sẵn sàng để bạn kiểm tra.",
    link: bookingLink(booking),
    bookingId: getBookingId(booking),
    metadata: {
      status: "completed",
      completedAt: booking?.completedAt || null,
      paymentDueAt: booking?.paymentDueAt || null,
    },
    dedupeKey: `booking:${getBookingId(booking)}:completed:customer`,
  });

export const createPaymentReminderNotification = (booking) =>
  createNotification({
    recipientId: getCustomerId(booking),
    recipientRole: "customer",
    type: "PAYMENT_REMINDER",
    title: "Nhắc thanh toán booking",
    message: "Ca chăm sóc đã hoàn thành. Vui lòng thanh toán để hoàn tất booking và mở phần đánh giá companion.",
    link: bookingLink(booking),
    bookingId: getBookingId(booking),
    metadata: {
      status: booking?.status || "completed",
      paymentDueAt: booking?.paymentDueAt || null,
      totalAmount: booking?.totalAmount || 0,
    },
    dedupeKey: `booking:${getBookingId(booking)}:payment-reminder:customer`,
  });

export const createPaymentSuccessNotification = ({ booking, payment }) =>
  createNotification({
    recipientId: getCustomerId(booking),
    recipientRole: "customer",
    type: "PAYMENT_SUCCESS",
    title: "Thanh toán thành công",
    message: "CareGo đã ghi nhận thanh toán của bạn. Cảm ơn bạn đã sử dụng dịch vụ.",
    link: bookingLink(booking),
    bookingId: getBookingId(booking),
    metadata: {
      paymentId: toIdString(payment?._id),
      paidAmount: payment?.paidAmount || payment?.amount || 0,
      paidAt: payment?.paidAt || null,
    },
    dedupeKey: `booking:${getBookingId(booking)}:payment-success:customer`,
  });

export const createReviewReminderNotification = (booking) =>
  createNotification({
    recipientId: getCustomerId(booking),
    recipientRole: "customer",
    type: "REVIEW_REMINDER",
    title: "Đánh giá companion",
    message: "Bạn có thể để lại đánh giá sau ca để CareGo cải thiện chất lượng đồng hành.",
    link: bookingLink(booking),
    bookingId: getBookingId(booking),
    metadata: { status: booking?.status || "paid" },
    dedupeKey: `booking:${getBookingId(booking)}:review-reminder:customer`,
  });
