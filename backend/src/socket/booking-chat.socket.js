import mongoose from "mongoose";
import { createRateLimitChecker, getPositiveEnvNumber } from "../middlleware/rate-limit.middleware.js";
import Booking from "../models/booking.models.js";
import { getBookingChatState, isBookingChatParticipant } from "../utils/booking-chat.js";
import { revalidateSocketUser } from "./auth.socket.js";

let bookingChatIo = null;

const roomName = (bookingId) => `booking-chat:${bookingId}`;
const bookingChatTypingRateLimit = createRateLimitChecker({
  windowMs: getPositiveEnvNumber(["CAREGO_CHAT_TYPING_RATE_LIMIT_WINDOW_MS", "CHAT_TYPING_RATE_LIMIT_WINDOW_MS"], 10000),
  max: getPositiveEnvNumber(["CAREGO_CHAT_TYPING_RATE_LIMIT_MAX", "CHAT_TYPING_RATE_LIMIT_MAX"], 20),
  keyGenerator: ({ userId, bookingId }) => `${userId}:booking:${bookingId}`,
});

const findAvailableBooking = async (bookingId, user) => {
  if (!mongoose.isValidObjectId(bookingId)) return null;
  const booking = await Booking.findById(bookingId);
  if (!booking || !isBookingChatParticipant(booking, user)) return null;
  const state = getBookingChatState(booking);
  return state.isAvailable ? { booking, state } : null;
};

export const setupBookingChatSocket = (io) => {
  bookingChatIo = io;

  io.on("connection", (socket) => {
    socket.on("booking-chat:join", async ({ bookingId }, acknowledge) => {
      try {
        const activeUser = await revalidateSocketUser(socket);
        const result = activeUser && bookingId ? await findAvailableBooking(bookingId, activeUser) : null;
        if (!result) {
          acknowledge?.({ ok: false });
          return;
        }

        socket.join(roomName(bookingId));
        acknowledge?.({ ok: true, state: result.state });
      } catch {
        acknowledge?.({ ok: false });
      }
    });

    socket.on("booking-chat:leave", ({ bookingId }) => {
      if (bookingId) socket.leave(roomName(bookingId));
    });

    socket.on("booking-chat:typing", async ({ bookingId, isTyping }) => {
      if (!bookingId || !socket.rooms.has(roomName(bookingId))) return;
      try {
        const activeUser = await revalidateSocketUser(socket);
        if (!activeUser) return;
        const rateLimit = bookingChatTypingRateLimit({ userId: activeUser.userId, bookingId });
        if (!rateLimit.allowed) {
          socket.emit("booking-chat:rate-limit", {
            event: "typing",
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          });
          return;
        }

        const result = await findAvailableBooking(bookingId, activeUser);
        if (!result) {
          socket.leave(roomName(bookingId));
          return;
        }

        socket.to(roomName(bookingId)).emit("booking-chat:typing", {
          bookingId,
          userId: socket.user.userId,
          isTyping: Boolean(isTyping),
        });
      } catch {
        socket.leave(roomName(bookingId));
      }
    });
  });
};

export const emitBookingChatMessage = (bookingId, message, chat) => {
  if (!bookingChatIo) return;
  bookingChatIo.to(roomName(bookingId)).emit("booking-chat:new-message", { message, chat });
};

export const emitBookingChatState = (booking) => {
  if (!bookingChatIo) return;

  const bookingId = String(booking._id);
  const payload = {
    bookingId,
    status: booking.status,
    completedAt: booking.completedAt,
    ...getBookingChatState(booking),
  };

  bookingChatIo.to(roomName(bookingId)).emit("booking-chat:state", payload);
  bookingChatIo.to(`user:${booking.customerId}`).emit("booking-chat:state", payload);
  bookingChatIo.to(`user:${booking.companionId}`).emit("booking-chat:state", payload);
};
