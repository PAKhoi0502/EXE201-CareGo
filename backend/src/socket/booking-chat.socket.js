import mongoose from "mongoose";
import Booking from "../models/booking.models.js";
import { getBookingChatState, isBookingChatParticipant } from "../utils/booking-chat.js";

let bookingChatIo = null;

const roomName = (bookingId) => `booking-chat:${bookingId}`;

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
        const result = bookingId ? await findAvailableBooking(bookingId, socket.user) : null;
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
        const result = await findAvailableBooking(bookingId, socket.user);
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
