import mongoose from "mongoose";
import Booking from "../models/booking.models.js";
import ShiftLog from "../models/shift-log.models.js";

const GPS_ACTIVE_THRESHOLD_MS = 30000;
const LOCATION_TRACKABLE_BOOKING_STATUSES = ["accepted", "in_progress"];
const getPositiveEnvNumber = (names, fallback) => {
  for (const name of names) {
    const value = Number(process.env[name]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return fallback;
};
const LOCATION_MAX_DISTANCE_METERS = getPositiveEnvNumber(
  ["CAREGO_SHIFT_GPS_MAX_DISTANCE_METERS", "SHIFT_GPS_MAX_DISTANCE_METERS"],
  500,
);
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

const canAccessBooking = (booking, user) => {
  const userId = String(user?.userId || "");
  return (
    user?.role === "admin" ||
    String(booking?.customerId || "") === userId ||
    String(booking?.companionId || "") === userId
  );
};

const normalizeGpsLocation = (location) => {
  if (!location || typeof location !== "object") {
    return null;
  }

  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
};

const getDistanceMeters = (first, second) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const firstLat = toRadians(first.lat);
  const secondLat = toRadians(second.lat);
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLng = toRadians(second.lng - first.lng);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const isGpsNearBookingAddress = (location, booking) => {
  const currentLocation = normalizeGpsLocation(location);
  const addressLocation = normalizeGpsLocation(booking?.addressLocation);
  if (!currentLocation || !addressLocation) {
    return false;
  }

  return getDistanceMeters(currentLocation, addressLocation) <= LOCATION_MAX_DISTANCE_METERS;
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
  socket.join(`user:${id}`);
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
    socket.on("user:online", () => {
      setUserOnline(socket, socket.user.userId);
    });

    socket.on("user:heartbeat", () => {
      setUserOnline(socket, socket.user.userId);
    });

    socket.on("user:offline", () => {
      setUserOfflineForSocket(socket.id);
    });

    socket.on("booking:join", async ({ bookingId }) => {
      if (!mongoose.isValidObjectId(bookingId)) return;
      try {
        const booking = await Booking.findById(bookingId).select("customerId companionId");
        if (booking && canAccessBooking(booking, socket.user)) {
          socket.join(`booking:${bookingId}`);
        }
      } catch {
        return;
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

      const gpsLocation = normalizeGpsLocation({ lat, lng });
      if (!gpsLocation) {
        socket.emit("location:error", { message: "valid lat and lng are required" });
        return;
      }

      const location = {
        ...gpsLocation,
        note: note || "Realtime GPS",
        recordedAt: new Date(),
      };

      try {
        const booking = await Booking.findById(bookingId).select("customerId companionId status addressLocation");
        const canSend =
          booking &&
          (socket.user.role === "admin" ||
            (socket.user.role === "companion" &&
              String(booking.companionId) === String(socket.user.userId)));
        if (!canSend) {
          socket.emit("location:error", { message: "permission denied" });
          return;
        }

        if (!LOCATION_TRACKABLE_BOOKING_STATUSES.includes(booking.status)) {
          socket.emit("location:error", {
            message: "booking location cannot be updated in current status",
          });
          return;
        }

        if (!isGpsNearBookingAddress(location, booking)) {
          socket.emit("location:error", {
            message: "gps location is too far from booking address",
            maxDistanceMeters: LOCATION_MAX_DISTANCE_METERS,
          });
          return;
        }

        const resolvedCompanionId = booking.companionId;
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

    socket.on("companion:gps:update", ({ lat, lng }) => {
      if (socket.user.role !== "companion" || lat === undefined || lng === undefined) {
        return;
      }

      setCompanionGpsStatus(socket, socket.user.userId, {
        isGpsOn: true,
        lat: Number(lat),
        lng: Number(lng),
        lastSeenAt: new Date(),
      });
    });

    socket.on("companion:gps:stop", () => {
      if (socket.user.role !== "companion") return;
      setCompanionGpsStatus(socket, socket.user.userId, {
        isGpsOn: false,
        lastSeenAt: new Date(),
      });
    });

    socket.on("location:stop", async ({ bookingId }) => {
      if (!mongoose.isValidObjectId(bookingId)) return;
      try {
        const booking = await Booking.findById(bookingId).select("customerId companionId");
        const canStop =
          booking &&
          (socket.user.role === "admin" ||
            (socket.user.role === "companion" &&
              String(booking.companionId) === String(socket.user.userId)));
        if (!canStop) return;

        const resolvedCompanionId = booking.companionId;
        setCompanionGpsStatus(socket, resolvedCompanionId, {
          isGpsOn: false,
          bookingId,
          lastSeenAt: new Date(),
        });
      } catch {
        return;
      }
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
