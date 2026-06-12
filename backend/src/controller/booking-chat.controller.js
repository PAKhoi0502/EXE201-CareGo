import Booking from "../models/booking.models.js";
import BookingMessage from "../models/booking-message.models.js";
import { emitBookingChatMessage } from "../socket/booking-chat.socket.js";
import {
  BOOKING_CHAT_AFTER_COMPLETION_MS,
  getBookingChatState,
  isBookingChatParticipant,
} from "../utils/booking-chat.js";

const populateBookingChat = [
  { path: "customerId", select: "name avatar role" },
  { path: "companionId", select: "name avatar role" },
  { path: "elderProfileId", select: "fullName" },
  { path: "serviceId", select: "name" },
];

const getParticipantFilter = (req) =>
  req.user.role === "companion"
    ? { companionId: req.user.userId }
    : { customerId: req.user.userId };

const findAllowedBooking = async (req) => {
  const booking = await Booking.findById(req.params.bookingId).populate(populateBookingChat);
  if (!booking || !isBookingChatParticipant(booking, req.user)) return null;
  return booking;
};

const serializeChat = (booking, now = new Date()) => ({
  booking,
  ...getBookingChatState(booking, now),
});

export const getActiveBookingChats = async (req, res) => {
  try {
    const now = new Date();
    const completedAfter = new Date(now.getTime() - BOOKING_CHAT_AFTER_COMPLETION_MS);
    const bookings = await Booking.find({
      ...getParticipantFilter(req),
      $or: [
        { status: { $in: ["accepted", "in_progress"] } },
        {
          status: { $in: ["completed", "paid"] },
          completedAt: { $gt: completedAfter },
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

    const text = req.body.message?.trim();
    if (!text) {
      return res.status(400).json({ message: "Vui lòng nhập nội dung tin nhắn." });
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
    return res.status(500).json({ message: error.message });
  }
};
