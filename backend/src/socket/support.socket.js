import mongoose from "mongoose";
import { createRateLimitChecker, getPositiveEnvNumber } from "../middlleware/rate-limit.middleware.js";
import SupportConversation from "../models/support-conversation.models.js";
import { revalidateSocketUser } from "./auth.socket.js";

let supportIo = null;

const roomName = (conversationId) => `support:${conversationId}`;
const supportTypingRateLimit = createRateLimitChecker({
  windowMs: getPositiveEnvNumber(["CAREGO_CHAT_TYPING_RATE_LIMIT_WINDOW_MS", "CHAT_TYPING_RATE_LIMIT_WINDOW_MS"], 10000),
  max: getPositiveEnvNumber(["CAREGO_CHAT_TYPING_RATE_LIMIT_MAX", "CHAT_TYPING_RATE_LIMIT_MAX"], 20),
  keyGenerator: ({ userId, conversationId }) => `${userId}:support:${conversationId}`,
});

const canAccessConversation = async (conversationId, user) => {
  if (!mongoose.isValidObjectId(conversationId)) return false;
  if (user.role === "admin") {
    return Boolean(await SupportConversation.exists({ _id: conversationId }));
  }

  return Boolean(
    await SupportConversation.exists({
      _id: conversationId,
      userId: user.userId,
    }),
  );
};

export const setupSupportSocket = (io) => {
  supportIo = io;

  io.on("connection", (socket) => {
    socket.on("support:join", async ({ conversationId }) => {
      try {
        const activeUser = await revalidateSocketUser(socket);
        if (activeUser && await canAccessConversation(conversationId, activeUser)) {
          socket.join(roomName(conversationId));
        }
      } catch {
        return;
      }
    });

    socket.on("support:leave", ({ conversationId }) => {
      if (conversationId) socket.leave(roomName(conversationId));
    });

    socket.on("support:admin:join", async () => {
      const activeUser = await revalidateSocketUser(socket);
      if (activeUser?.role === "admin") socket.join("support:admins");
    });

    socket.on("support:typing", async ({ conversationId, isTyping }) => {
      if (!conversationId || !socket.rooms.has(roomName(conversationId))) return;
      const activeUser = await revalidateSocketUser(socket);
      if (!activeUser) return;
      const rateLimit = supportTypingRateLimit({ userId: activeUser.userId, conversationId });
      if (!rateLimit.allowed) {
        socket.emit("support:rate-limit", {
          event: "typing",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        });
        return;
      }

      socket.to(roomName(conversationId)).emit("support:typing", {
        conversationId,
        userId: activeUser.userId,
        isTyping: Boolean(isTyping),
      });
    });
  });
};

export const emitSupportMessage = (conversationId, message, conversation) => {
  if (!supportIo) return;
  supportIo.to(`support:${conversationId}`).emit("support:new-message", { message, conversation });
  supportIo.to("support:admins").emit("support:conversation-updated", { conversation });
};

export const emitSupportConversation = (event, conversation) => {
  if (!supportIo) return;
  supportIo.to(`support:${conversation._id}`).emit(event, { conversation });
  supportIo.to("support:admins").emit(event, { conversation });
};
