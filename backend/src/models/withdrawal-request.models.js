import mongoose from "mongoose";

const WithdrawalRequestSchema = new mongoose.Schema(
  {
    companionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1000,
      validate: {
        validator: Number.isInteger,
        message: "Withdrawal amount must be an integer.",
      },
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    bankAccountName: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
  },
  { timestamps: true },
);

WithdrawalRequestSchema.index({ companionId: 1, status: 1, createdAt: -1 });

const WithdrawalRequest = mongoose.model("withdrawalRequest", WithdrawalRequestSchema);
export default WithdrawalRequest;
