export const BOOKING_CHAT_AFTER_COMPLETION_MS = 3 * 60 * 60 * 1000;

const toIdString = (value) => {
  if (!value) return "";
  return String(value._id || value);
};

export const isBookingChatParticipant = (booking, user) => {
  const userId = String(user?.userId || user?.id || user?._id || "");
  return (
    Boolean(userId) &&
    (toIdString(booking?.customerId) === userId || toIdString(booking?.companionId) === userId)
  );
};

export const getBookingChatState = (booking, now = new Date()) => {
  const status = booking?.status;

  if (["accepted", "in_progress"].includes(status)) {
    return {
      isAvailable: true,
      canSend: true,
      expiresAt: null,
      reason: null,
    };
  }

  if (["completed", "paid"].includes(status) && booking?.completedAt) {
    const completedAt = new Date(booking.completedAt);
    const expiresAt = new Date(completedAt.getTime() + BOOKING_CHAT_AFTER_COMPLETION_MS);
    const isAvailable = !Number.isNaN(expiresAt.getTime()) && expiresAt > now;

    return {
      isAvailable,
      canSend: isAvailable,
      expiresAt,
      reason: isAvailable ? null : "expired",
    };
  }

  return {
    isAvailable: false,
    canSend: false,
    expiresAt: null,
    reason: status === "cancelled" ? "cancelled" : "not_accepted",
  };
};
