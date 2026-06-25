import mongoose from "mongoose";
import Notification from "../models/notification.models.js";
import { serializeNotification } from "../utils/notifications.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parsePagination = ({ page, limit }) => {
  const pageValue = Number(page || 1);
  const limitValue = Number(limit || DEFAULT_LIMIT);

  if (!Number.isInteger(pageValue) || pageValue < 1) {
    return { error: "page must be a positive integer" };
  }

  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > MAX_LIMIT) {
    return { error: `limit must be between 1 and ${MAX_LIMIT}` };
  }

  return {
    page: pageValue,
    limit: limitValue,
    skip: (pageValue - 1) * limitValue,
  };
};

export const getMyNotifications = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }

    const filter = { recipientId: req.user.userId };
    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Notification.countDocuments({ ...filter, readAt: null }),
      Notification.countDocuments(filter),
    ]);

    return res.status(200).json({
      notifications: notifications.map(serializeNotification),
      unreadCount,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipientId: req.user.userId,
      readAt: null,
    });
    return res.status(200).json({ unreadCount });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "invalid notification id" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.userId },
      { $set: { readAt: new Date() } },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ message: "notification not found" });
    }

    return res.status(200).json({ notification: serializeNotification(notification) });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user.userId, readAt: null },
      { $set: { readAt: new Date() } },
    );

    return res.status(200).json({ message: "notifications marked as read", unreadCount: 0 });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
