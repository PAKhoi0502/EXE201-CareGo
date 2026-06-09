let supportIo = null;

export const setupSupportSocket = (io) => {
  supportIo = io;

  io.on("connection", (socket) => {
    socket.on("support:join", ({ conversationId }) => {
      if (conversationId) socket.join(`support:${conversationId}`);
    });

    socket.on("support:leave", ({ conversationId }) => {
      if (conversationId) socket.leave(`support:${conversationId}`);
    });

    socket.on("support:admin:join", () => {
      socket.join("support:admins");
    });

    socket.on("support:typing", ({ conversationId, userId, isTyping }) => {
      if (!conversationId) return;
      socket.to(`support:${conversationId}`).emit("support:typing", {
        conversationId,
        userId,
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
