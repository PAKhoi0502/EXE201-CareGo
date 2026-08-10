import mongoose from "mongoose";

export const SUPPORT_CONVERSATION_SUBJECT_MAX_LENGTH = 160;

const SupportConversationSchema = new mongoose.Schema(
  {
    seedKey: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "booking",
      default: null,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: SUPPORT_CONVERSATION_SUBJECT_MAX_LENGTH,
    },
    category: {
      type: String,
      enum: ["booking", "payment", "account", "safety", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["waiting", "active", "resolved"],
      default: "waiting",
      index: true,
    },
    priority: {
      type: String,
      enum: ["normal", "urgent"],
      default: "normal",
      index: true,
    },
    lastMessage: {
      type: String,
      default: "",
      trim: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

SupportConversationSchema.index({ userId: 1, lastMessageAt: -1 });
SupportConversationSchema.index({ status: 1, priority: 1, lastMessageAt: -1 });

const SupportConversation = mongoose.model("supportConversation", SupportConversationSchema);
export default SupportConversation;
