import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "CUSTOMER_WELCOME",
  "BOOKING_CREATED",
  "COMPANION_BOOKING_CREATED",
  "BOOKING_ACCEPTED",
  "COMPANION_CHECKED_IN",
  "SHIFT_NOTE_UPDATED",
  "BOOKING_COMPLETED",
  "PAYMENT_REMINDER",
  "PAYMENT_SUCCESS",
  "COMPANION_PAYMENT_SUCCESS",
  "REVIEW_REMINDER",
  "COMPANION_REVIEW_CREATED",
];

const NotificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ["customer", "companion", "admin"],
      required: true,
      default: "customer",
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    link: {
      type: String,
      trim: true,
      default: "",
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "booking",
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    dedupeKey: {
      type: String,
      trim: true,
      default: "",
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string", $gt: "" } },
  },
);

const Notification = mongoose.model("notification", NotificationSchema);
export default Notification;
