import Booking from "../models/booking.models.js";
import ShiftLog from "../models/shift-log.models.js";

const GPS_ACTIVE_THRESHOLD_MS = 30000;
const companionGpsStatus = new Map();
const socketCompanions = new Map();
const userSockets = new Map();
const socketUsers = new Map();
const userPresence = new Map();

const setCompanionGpsStatus = (socket, companionId, data) => {
  if (!companionId) return;

  const id = String(companionId);
  companionGpsStatus.set(id, {
    companionId: id,
    isGpsOn: Boolean(data.isGpsOn),
    bookingId: data.bookingId || "",
    lat: data.lat,
    lng: data.lng,
    lastSeenAt: data.lastSeenAt || new Date(),
  });

  const companionIds = socketCompanions.get(socket.id) || new Set();
  companionIds.add(id);
  socketCompanions.set(socket.id, companionIds);
};

const resolveCompanionId = async (bookingId, companionId) => {
  if (companionId) return companionId;

  const booking = await Booking.findById(bookingId).select("companionId");
  return booking?.companionId;
};

export const getCompanionGpsStatuses = () => {
  const now = Date.now();

  return Object.fromEntries(
    [...companionGpsStatus.entries()].map(([companionId, status]) => {
      const lastSeenAt = status.lastSeenAt ? new Date(status.lastSeenAt) : null;
      const isFresh = lastSeenAt ? now - lastSeenAt.getTime() <= GPS_ACTIVE_THRESHOLD_MS : false;

      return [
        companionId,
        {
          ...status,
          isGpsOn: Boolean(status.isGpsOn && isFresh),
          lastSeenAt,
        },
      ];
    }),
  );
};

const setUserOnline = (socket, userId) => {
  if (!userId) return;

  const id = String(userId);
  const sockets = userSockets.get(id) || new Set();
  sockets.add(socket.id);
  userSockets.set(id, sockets);
  socketUsers.set(socket.id, id);
  userPresence.set(id, {
    userId: id,
    isOnline: true,
    lastSeenAt: new Date(),
  });
};

const setUserOfflineForSocket = (socketId) => {
  const userId = socketUsers.get(socketId);
  if (!userId) return;

  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size) {
      userSockets.set(userId, sockets);
    } else {
      userSockets.delete(userId);
      userPresence.set(userId, {
        userId,
        isOnline: false,
        lastSeenAt: new Date(),
      });
    }
  }

  socketUsers.delete(socketId);
};

export const getUserOnlineStatuses = () =>
  Object.fromEntries(
    [...userPresence.entries()].map(([userId, status]) => [
      userId,
      {
        ...status,
        isOnline: Boolean(userSockets.get(userId)?.size),
      },
    ]),
  );

export const setupLocationSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("user:online", ({ userId }) => {
      setUserOnline(socket, userId);
    });

    socket.on("user:heartbeat", ({ userId }) => {
      setUserOnline(socket, userId);
    });

    socket.on("user:offline", () => {
      setUserOfflineForSocket(socket.id);
    });

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

    socket.on("location:send", async ({ bookingId, companionId, lat, lng, note }) => {
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
        const resolvedCompanionId = await resolveCompanionId(bookingId, companionId);
        setCompanionGpsStatus(socket, resolvedCompanionId, {
          isGpsOn: true,
          bookingId,
          lat: location.lat,
          lng: location.lng,
          lastSeenAt: location.recordedAt,
        });

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

    socket.on("companion:gps:update", ({ companionId, lat, lng }) => {
      if (!companionId || lat === undefined || lng === undefined) {
        return;
      }

      setCompanionGpsStatus(socket, companionId, {
        isGpsOn: true,
        lat: Number(lat),
        lng: Number(lng),
        lastSeenAt: new Date(),
      });
    });

    socket.on("companion:gps:stop", ({ companionId }) => {
      setCompanionGpsStatus(socket, companionId, {
        isGpsOn: false,
        lastSeenAt: new Date(),
      });
    });

    socket.on("location:stop", async ({ bookingId, companionId }) => {
      const resolvedCompanionId = await resolveCompanionId(bookingId, companionId);
      setCompanionGpsStatus(socket, resolvedCompanionId, {
        isGpsOn: false,
        bookingId,
        lastSeenAt: new Date(),
      });
    });

    socket.on("disconnect", () => {
      setUserOfflineForSocket(socket.id);

      const companionIds = socketCompanions.get(socket.id);
      if (!companionIds) return;

      companionIds.forEach((companionId) => {
        const current = companionGpsStatus.get(companionId) || {};
        companionGpsStatus.set(companionId, {
          ...current,
          companionId,
          isGpsOn: false,
          lastSeenAt: new Date(),
        });
      });
      socketCompanions.delete(socket.id);
    });
  });
};
