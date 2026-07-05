let notificationIo = null;

const userRoomName = (userId) => `user:${userId}`;
const roleRoomName = (role) => `role:${role}`;

const buildAlertId = (type) => `${type || "admin-alert"}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

const serializeAdminAlert = (payload = {}) => ({
  id: payload.id || buildAlertId(payload.type),
  type: String(payload.type || "admin_alert"),
  title: String(payload.title || "Có cập nhật mới"),
  message: String(payload.message || "Có sự kiện mới cần admin kiểm tra."),
  tone: String(payload.tone || "info"),
  link: String(payload.link || ""),
  metadata: payload.metadata || {},
  createdAt: payload.createdAt || new Date().toISOString(),
});

export const setupNotificationSocket = (io) => {
  notificationIo = io;

  io.on("connection", (socket) => {
    if (socket.user?.userId) socket.join(userRoomName(socket.user.userId));
    if (socket.user?.role) socket.join(roleRoomName(socket.user.role));
  });
};

export const emitUserNotification = (userId, payload) => {
  if (!notificationIo || !userId) return;
  notificationIo.to(userRoomName(userId)).emit("notification:new", payload);
};

export const emitAdminAlert = (payload) => {
  if (!notificationIo) return;
  notificationIo.to(roleRoomName("admin")).emit("admin:alert", { alert: serializeAdminAlert(payload) });
};
