import Booking from "../models/booking.models.js";
import BookingMessage, { BOOKING_MESSAGE_MAX_LENGTH } from "../models/booking-message.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import { emitBookingChatMessage } from "../socket/booking-chat.socket.js";
import {
  BOOKING_CHAT_AFTER_COMPLETION_MS,
  getBookingChatState,
} from "../utils/booking-chat.js";

const populateBookingChat = [
  { path: "customerId", select: "name avatar role" },
  { path: "companionId", select: "name avatar role" },
  { path: "elderProfileId", select: "fullName" },
  { path: "serviceId", select: "name" },
];

const toIdString = (value) => (value?._id || value || "").toString();

const isCustomerSideParticipant = (booking, user) =>
  toIdString(booking?.customerId) === user?.userId;

const isCompanionSideParticipant = (booking, user) =>
  user?.role === "companion" && toIdString(booking?.companionId) === user?.userId;

const canUseCompanionChatSide = async (req) => {
  if (req.user.role !== "companion") {
    return false;
  }

  const profile = await CompanionProfile.findOne({ userId: req.user.userId }).select("vettingStatus");
  return profile?.vettingStatus === "approved";
};

const getParticipantFilter = async (req) => {
  const filters = [{ customerId: req.user.userId }];
  if (await canUseCompanionChatSide(req)) {
    filters.push({ companionId: req.user.userId });
  }

  return { $or: filters };
};

const findAllowedBooking = async (req) => {
  const booking = await Booking.findById(req.params.bookingId).populate(populateBookingChat);
  if (!booking) return null;
  if (isCustomerSideParticipant(booking, req.user)) return booking;
  if (isCompanionSideParticipant(booking, req.user) && await canUseCompanionChatSide(req)) return booking;
  return null;
};

const serializeChat = (booking, now = new Date()) => ({
  booking,
  ...getBookingChatState(booking, now),
});

const normalizeMessageText = (value) => (typeof value === "string" ? value.trim() : "");

const getMessageTextError = (text) => {
  if (!text) {
    return { statusCode: 400, message: "Vui lòng nhập nội dung tin nhắn." };
  }

  if (text.length > BOOKING_MESSAGE_MAX_LENGTH) {
    return {
      statusCode: 413,
      message: `Tin nhắn tối đa ${BOOKING_MESSAGE_MAX_LENGTH} ký tự.`,
      maxLength: BOOKING_MESSAGE_MAX_LENGTH,
    };
  }

  return null;
};

const getValidationErrorResponse = (error) => {
  if (error?.name !== "ValidationError") {
    return null;
  }

  const isTooLong = Object.values(error.errors || {}).some((item) => item?.kind === "maxlength");
  return {
    statusCode: isTooLong ? 413 : 400,
    message: isTooLong
      ? `Tin nhắn tối đa ${BOOKING_MESSAGE_MAX_LENGTH} ký tự.`
      : "Nội dung tin nhắn không hợp lệ.",
    maxLength: isTooLong ? BOOKING_MESSAGE_MAX_LENGTH : undefined,
  };
};

export const getActiveBookingChats = async (req, res) => {
  try {
    const now = new Date();
    const completedAfter = new Date(now.getTime() - BOOKING_CHAT_AFTER_COMPLETION_MS);
    const bookings = await Booking.find({
      $and: [
        await getParticipantFilter(req),
        {
          $or: [
            { status: { $in: ["accepted", "in_progress"] } },
            {
              status: { $in: ["completed", "paid"] },
              completedAt: { $gt: completedAfter },
            },
          ],
        },
      ],
    })
      .populate(populateBookingChat)
      .sort({ updatedAt: -1 });

    const chats = bookings
      .map((booking) => serializeChat(booking, now))
      .filter((chat) => chat.isAvailable);

    return res.status(200).json({ chats });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getBookingChatMessages = async (req, res) => {
  try {
    const booking = await findAllowedBooking(req);
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });
    }

    const chat = serializeChat(booking);
    if (!chat.isAvailable) {
      return res.status(403).json({ message: "Cuộc trò chuyện hiện không khả dụng.", chat });
    }

    const messages = await BookingMessage.find({ bookingId: booking._id })
      .populate("senderId", "name role avatar")
      .sort({ createdAt: -1 })
      .limit(200);

    return res.status(200).json({ chat, messages: messages.reverse() });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const sendBookingChatMessage = async (req, res) => {
  try {
    const booking = await findAllowedBooking(req);
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });
    }

    const chat = serializeChat(booking);
    if (!chat.canSend) {
      return res.status(403).json({ message: "Cuộc trò chuyện đã đóng.", chat });
    }

    const text = normalizeMessageText(req.body?.message);
    const textError = getMessageTextError(text);
    if (textError) {
      return res.status(textError.statusCode).json(textError);
    }

    const created = await BookingMessage.create({
      bookingId: booking._id,
      senderId: req.user.userId,
      message: text,
    });
    const message = await BookingMessage.findById(created._id).populate(
      "senderId",
      "name role avatar",
    );

    emitBookingChatMessage(booking._id, message, chat);
    return res.status(201).json({ message, chat });
  } catch (error) {
    const validationError = getValidationErrorResponse(error);
    if (validationError) {
      return res.status(validationError.statusCode).json(validationError);
    }

    return res.status(500).json({ message: error.message });
  }
};
