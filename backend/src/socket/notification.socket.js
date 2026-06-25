let notificationIo = null;

const userRoomName = (userId) => `user:${userId}`;

export const setupNotificationSocket = (io) => {
  notificationIo = io;
};

export const emitUserNotification = (userId, payload) => {
  if (!notificationIo || !userId) return;
  notificationIo.to(userRoomName(userId)).emit("notification:new", payload);
};
