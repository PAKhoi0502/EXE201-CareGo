import mongoose from "mongoose";
import SupportConversation from "../models/support-conversation.models.js";

let supportIo = null;

const roomName = (conversationId) => `support:${conversationId}`;

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
        if (await canAccessConversation(conversationId, socket.user)) {
          socket.join(roomName(conversationId));
        }
      } catch {
        return;
      }
    });

    socket.on("support:leave", ({ conversationId }) => {
      if (conversationId) socket.leave(roomName(conversationId));
    });

    socket.on("support:admin:join", () => {
      if (socket.user.role === "admin") socket.join("support:admins");
    });

    socket.on("support:typing", ({ conversationId, isTyping }) => {
      if (!conversationId || !socket.rooms.has(roomName(conversationId))) return;
      socket.to(roomName(conversationId)).emit("support:typing", {
        conversationId,
        userId: socket.user.userId,
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
