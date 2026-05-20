import ShiftLog from "../models/shift-log.models.js";

export const setupLocationSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("booking:join", ({ bookingId }) => {
      if (bookingId) {
        socket.join(`booking:${bookingId}`);
      }
    });

    socket.on("booking:leave", ({ bookingId }) => {
      if (bookingId) {
        socket.leave(`booking:${bookingId}`);
      }
    });

    socket.on("location:send", async ({ bookingId, lat, lng, note }) => {
      if (!bookingId || lat === undefined || lng === undefined) {
        return;
      }

      const location = {
        lat: Number(lat),
        lng: Number(lng),
        note: note || "Realtime GPS",
        recordedAt: new Date(),
      };

      try {
        await ShiftLog.findOneAndUpdate(
          { bookingId },
          { $push: { locations: location } },
          { new: true, upsert: true },
        );

        io.to(`booking:${bookingId}`).emit("location:update", {
          bookingId,
          ...location,
        });
      } catch (error) {
        socket.emit("location:error", { message: error.message });
      }
    });
  });
};
