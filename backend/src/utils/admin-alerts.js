import { emitAdminAlert } from "../socket/notification.socket.js";

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

const toIdString = (value) => String(value?._id || value || "");

const cleanText = (value, fallback = "") => String(value || fallback).trim();

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return moneyFormatter.format(Number.isFinite(amount) ? amount : 0);
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateTimeFormatter.format(date);
};

const personLabel = (person, fallback = "Người dùng") =>
  cleanText(person?.name || person?.fullName, cleanText(person?.email, fallback));

const bookingCode = (booking) => toIdString(booking?._id).slice(-6).toUpperCase();

export const emitAdminCustomerCreatedAlert = (user) => {
  emitAdminAlert({
    type: "customer_created",
    tone: "info",
    title: "Customer mới",
    message: `${personLabel(user, "Customer mới")} vừa xác thực tài khoản.`,
    link: "/admin/users",
    metadata: { userId: toIdString(user?._id), email: user?.email || "" },
  });
};

export const emitAdminCompanionApplicationAlert = (profile, user) => {
  emitAdminAlert({
    type: "companion_pending",
    tone: "warning",
    title: "Companion chờ duyệt",
    message: `${cleanText(profile?.fullName, personLabel(user, "Ứng viên"))} vừa gửi hồ sơ người đồng hành.`,
    link: "/admin/companions",
    metadata: {
      companionProfileId: toIdString(profile?._id),
      applicantCustomerId: toIdString(profile?.applicantCustomerId || user?._id),
      applicantType: profile?.applicantType || "",
    },
  });
};

export const emitAdminCompanionReapprovalAlert = (profile, user) => {
  emitAdminAlert({
    type: "companion_reapproval_pending",
    tone: "warning",
    title: "Companion cần duyệt lại",
    message: `${cleanText(profile?.fullName, personLabel(user, "Companion"))} vừa cập nhật hồ sơ và chuyển về chờ duyệt.`,
    link: "/admin/companions",
    metadata: {
      companionProfileId: toIdString(profile?._id),
      companionUserId: toIdString(user?._id),
    },
  });
};

export const emitAdminBookingCreatedAlert = (booking, details = {}) => {
  const serviceName = cleanText(details.service?.name);
  const elderName = cleanText(details.elder?.fullName || details.elder?.name);
  const startText = formatDateTime(booking?.startTime);
  const parts = [
    booking?.bookingMode === "instant" ? "Đặt ngay" : "Theo lịch",
    serviceName,
    elderName ? `cho ${elderName}` : "",
    startText ? `lúc ${startText}` : "",
  ].filter(Boolean);

  emitAdminAlert({
    type: "booking_pending",
    tone: booking?.bookingMode === "instant" ? "urgent" : "info",
    title: "Booking mới chờ nhận",
    message: `${parts.join(" ")}${bookingCode(booking) ? ` · #${bookingCode(booking)}` : ""}`,
    link: "/admin/bookings",
    metadata: {
      bookingId: toIdString(booking?._id),
      customerId: toIdString(booking?.customerId),
      companionId: toIdString(booking?.companionId),
      bookingMode: booking?.bookingMode || "scheduled",
      status: booking?.status || "pending",
    },
  });
};

export const emitAdminPaymentSuccessAlert = ({ booking, payment }) => {
  emitAdminAlert({
    type: "booking_payment_success",
    tone: "success",
    title: "Booking đã thanh toán",
    message: `Booking #${bookingCode(booking)} thanh toán thành công ${formatMoney(payment?.paidAmount || payment?.amount || booking?.totalAmount)}.`,
    link: "/admin/bookings",
    metadata: {
      bookingId: toIdString(booking?._id),
      paymentId: toIdString(payment?._id),
      customerId: toIdString(booking?.customerId),
      paidAt: payment?.paidAt || null,
    },
  });
};

export const emitAdminPaymentOverdueRestrictionAlert = ({ customer, booking }) => {
  emitAdminAlert({
    type: "customer_payment_overdue_restricted",
    tone: "urgent",
    title: "Customer bị hạn chế booking",
    message: `${personLabel(customer, "Customer")} có booking #${bookingCode(booking)} quá hạn thanh toán và vừa bị chặn đặt lịch mới.`,
    link: "/admin/bookings",
    metadata: {
      customerId: toIdString(customer?._id || customer?.userId),
      bookingId: toIdString(booking?._id),
      paymentDueAt: booking?.paymentDueAt || null,
      totalAmount: booking?.totalAmount || 0,
    },
  });
};

export const emitAdminSupportConversationAlert = (conversation) => {
  const user = conversation?.userId;
  emitAdminAlert({
    type: "support_conversation_created",
    tone: conversation?.priority === "urgent" ? "urgent" : "warning",
    title: conversation?.priority === "urgent" ? "Hỗ trợ khẩn cấp" : "Yêu cầu hỗ trợ mới",
    message: `${personLabel(user, "Người dùng")} gửi hỗ trợ: ${cleanText(conversation?.subject, "Không có tiêu đề")}.`,
    link: "/admin/support",
    metadata: {
      conversationId: toIdString(conversation?._id),
      userId: toIdString(user?._id || user),
      category: conversation?.category || "",
      priority: conversation?.priority || "normal",
    },
  });
};
