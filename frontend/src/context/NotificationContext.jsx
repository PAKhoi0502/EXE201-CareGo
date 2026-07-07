import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./useAuth.js";
import { connectLocationSocket, locationSocket } from "../socket/locationSocket.js";

const NotificationContext = createContext(null);
const NOTIFICATION_LIMIT = 20;

const getUserId = (user) => user?.id || user?._id || "";

const mergeNotification = (notifications, notification) => {
  if (!notification?._id) return notifications;
  return [
    notification,
    ...notifications.filter((item) => item._id !== notification._id),
  ].slice(0, NOTIFICATION_LIMIT);
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = getUserId(user);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setError("");
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const data = await api.get(`/notifications?limit=${NOTIFICATION_LIMIT}`);
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    if (!userId) return undefined;

    const handleNewNotification = ({ notification }) => {
      if (!notification?._id) return;
      setNotifications((current) => mergeNotification(current, notification));
      if (!notification.readAt) {
        setUnreadCount((current) => current + 1);
      }
      setToast(notification);
    };

    const reconcileNotifications = () => {
      reload({ silent: true });
    };

    const reconcileWhenVisible = () => {
      if (document.visibilityState === "visible") {
        reconcileNotifications();
      }
    };

    locationSocket.on("notification:new", handleNewNotification);
    locationSocket.on("connect", reconcileNotifications);
    window.addEventListener("focus", reconcileNotifications);
    document.addEventListener("visibilitychange", reconcileWhenVisible);
    connectLocationSocket();
    const reconciliationTimer = window.setInterval(reconcileNotifications, 15000);

    return () => {
      locationSocket.off("notification:new", handleNewNotification);
      locationSocket.off("connect", reconcileNotifications);
      window.removeEventListener("focus", reconcileNotifications);
      document.removeEventListener("visibilitychange", reconcileWhenVisible);
      window.clearInterval(reconciliationTimer);
    };
  }, [reload, userId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!notificationId) return null;

    const currentNotification = notifications.find((item) => item._id === notificationId);
    const data = await api.patch(`/notifications/${notificationId}/read`, {});
    const nextNotification = data.notification;

    setNotifications((current) =>
      current.map((item) => (item._id === notificationId ? nextNotification : item)),
    );
    if (currentNotification && !currentNotification.readAt) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }

    return nextNotification;
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    await api.patch("/notifications/read-all", {});
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || now })));
    setUnreadCount(0);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      toast,
      reload,
      markAsRead,
      markAllAsRead,
      clearToast,
    }),
    [
      notifications,
      unreadCount,
      loading,
      error,
      toast,
      reload,
      markAsRead,
      markAllAsRead,
      clearToast,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationContext);
