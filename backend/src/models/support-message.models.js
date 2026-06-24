import mongoose from "mongoose";

export const SUPPORT_MESSAGE_MAX_LENGTH = 3000;

const SupportMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "supportConversation",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: SUPPORT_MESSAGE_MAX_LENGTH,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

SupportMessageSchema.index({ conversationId: 1, createdAt: 1 });

const SupportMessage = mongoose.model("supportMessage", SupportMessageSchema);
export default SupportMessage;
