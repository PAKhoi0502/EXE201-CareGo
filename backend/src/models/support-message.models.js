import mongoose from "mongoose";

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
      maxlength: 3000,
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
