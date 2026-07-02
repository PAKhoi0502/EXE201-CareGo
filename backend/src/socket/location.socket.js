import mongoose from "mongoose";
import Booking from "../models/booking.models.js";
import { revalidateSocketUser } from "./auth.socket.js";

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
const LIVE_LOCATION_MIN_INTERVAL_MS = getPositiveEnvNumber(
  ["CAREGO_LIVE_LOCATION_MIN_INTERVAL_MS", "LIVE_LOCATION_MIN_INTERVAL_MS"],
  5000,
);
const LIVE_LOCATION_MIN_DISTANCE_METERS = getPositiveEnvNumber(
  ["CAREGO_LIVE_LOCATION_MIN_DISTANCE_METERS", "LIVE_LOCATION_MIN_DISTANCE_METERS"],
  10,
);
const companionGpsStatus = new Map();
const socketCompanions = new Map();
const userSockets = new Map();
const socketUsers = new Map();
const userPresence = new Map();
const liveLocationSamples = new Map();
let locationIo = null;

const userRoomName = (userId) => `user:${userId}`;

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
    (isApprovedCompanionSocket(user) && String(booking?.companionId || "") === userId)
  );
};

const isApprovedCompanionSocket = (user) =>
  user?.role === "companion" && user?.vettingStatus === "approved";

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

const getLiveLocationKey = (bookingId, companionId) => `${bookingId}:${companionId}`;

const clearLiveLocationSamplesForCompanion = (companionId) => {
  if (!companionId) return;
  const suffix = `:${companionId}`;
  [...liveLocationSamples.keys()].forEach((key) => {
    if (key.endsWith(suffix)) {
      liveLocationSamples.delete(key);
    }
  });
};

const shouldPublishLiveLocation = ({ bookingId, companionId, location }) => {
  const key = getLiveLocationKey(bookingId, companionId);
  const recordedAtMs = new Date(location.recordedAt).getTime();
  const previous = liveLocationSamples.get(key);

  if (previous) {
    const elapsedMs = recordedAtMs - previous.recordedAtMs;
    if (elapsedMs < LIVE_LOCATION_MIN_INTERVAL_MS) {
      return false;
    }

    if (getDistanceMeters(previous, location) < LIVE_LOCATION_MIN_DISTANCE_METERS) {
      return false;
    }
  }

  liveLocationSamples.set(key, {
    lat: location.lat,
    lng: location.lng,
    recordedAtMs,
  });
  return true;
};

export const getCompanionGpsStatuses = () => {
  const now = Date.now();

  return Object.fromEntries(
    [...companionGpsStatus.entries()].map(([companionId, status]) => {
      const lastSeenAt = status.lastSeenAt ? new Date(status.lastSeenAt) : null;
      const isFresh = lastSeenAt ? now - lastSeenAt.getTime() <= GPS_ACTIVE_THRESHOLD_MS : false;
      const isGpsOn = Boolean(status.isGpsOn && isFresh);
      const shouldExposeLocation = isGpsOn && Boolean(status.bookingId);

      return [
        companionId,
        {
          companionId,
          isGpsOn,
          bookingId: shouldExposeLocation ? status.bookingId : "",
          ...(shouldExposeLocation ? { lat: status.lat, lng: status.lng } : {}),
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
  socket.join(userRoomName(id));
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

export const disconnectUserSockets = (userId, reason = "Phiên kết nối đã hết hạn.") => {
  if (!locationIo || !userId) return false;

  const id = String(userId);
  locationIo.to(userRoomName(id)).emit("auth:revoked", { message: reason });
  locationIo.in(userRoomName(id)).disconnectSockets(true);
  return true;
};

export const setupLocationSocket = (io) => {
  locationIo = io;

  io.on("connection", (socket) => {
    socket.join(userRoomName(socket.user.userId));

    socket.on("user:online", async () => {
      const activeUser = await revalidateSocketUser(socket);
      if (!activeUser) return;
      setUserOnline(socket, activeUser.userId);
    });

    socket.on("user:heartbeat", async () => {
      const activeUser = await revalidateSocketUser(socket);
      if (!activeUser) return;
      setUserOnline(socket, activeUser.userId);
    });

    socket.on("user:offline", () => {
      setUserOfflineForSocket(socket.id);
    });

    socket.on("booking:join", async ({ bookingId }) => {
      const activeUser = await revalidateSocketUser(socket);
      if (!activeUser) return;
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
      const activeUser = await revalidateSocketUser(socket);
      if (!activeUser) return;
      if (!bookingId || lat === undefined || lng === undefined) {
        return;
      }

      const gpsLocation = normalizeGpsLocation({ lat, lng });
      if (!gpsLocation) {
        socket.emit("location:error", { message: "Vĩ độ và kinh độ không hợp lệ." });
        return;
      }

      const location = {
        ...gpsLocation,
        note: note || "Realtime GPS",
        recordedAt: new Date(),
      };

      try {
        const booking = await Booking.findById(bookingId).select("customerId companionId status");
        const canSend =
          booking &&
          (socket.user.role === "admin" ||
            (isApprovedCompanionSocket(socket.user) &&
              String(booking.companionId) === String(socket.user.userId)));
        if (!canSend) {
          socket.emit("location:error", { message: "Bạn không có quyền cập nhật vị trí này." });
          return;
        }

        if (!LOCATION_TRACKABLE_BOOKING_STATUSES.includes(booking.status)) {
          socket.emit("location:error", {
            message: "Không thể cập nhật vị trí của lịch đặt ở trạng thái hiện tại.",
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

        if (shouldPublishLiveLocation({ bookingId, companionId: resolvedCompanionId, location })) {
          io.to(`booking:${bookingId}`).emit("location:update", {
            bookingId,
            ...location,
          });
        }
      } catch (error) {
        socket.emit("location:error", { message: "Không thể cập nhật vị trí. Vui lòng thử lại." });
      }
    });

    socket.on("companion:gps:update", async () => {
      const activeUser = await revalidateSocketUser(socket);
      if (!activeUser || !isApprovedCompanionSocket(socket.user)) {
        return;
      }

      setCompanionGpsStatus(socket, socket.user.userId, {
        isGpsOn: true,
        lastSeenAt: new Date(),
      });
    });

    socket.on("companion:gps:stop", async () => {
      const activeUser = await revalidateSocketUser(socket);
      if (!activeUser || !isApprovedCompanionSocket(socket.user)) return;
      setCompanionGpsStatus(socket, socket.user.userId, {
        isGpsOn: false,
        lastSeenAt: new Date(),
      });
    });

    socket.on("location:stop", async ({ bookingId }) => {
      const activeUser = await revalidateSocketUser(socket);
      if (!activeUser) return;
      if (!mongoose.isValidObjectId(bookingId)) return;
      try {
        const booking = await Booking.findById(bookingId).select("customerId companionId");
        const canStop =
          booking &&
          (socket.user.role === "admin" ||
            (isApprovedCompanionSocket(socket.user) &&
              String(booking.companionId) === String(socket.user.userId)));
        if (!canStop) return;

        const resolvedCompanionId = booking.companionId;
        setCompanionGpsStatus(socket, resolvedCompanionId, {
          isGpsOn: false,
          bookingId,
          lastSeenAt: new Date(),
        });
        liveLocationSamples.delete(getLiveLocationKey(bookingId, resolvedCompanionId));
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
        clearLiveLocationSamplesForCompanion(companionId);
      });
      socketCompanions.delete(socket.id);
    });
  });
};
