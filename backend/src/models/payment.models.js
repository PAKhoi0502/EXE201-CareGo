import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "booking",
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    companionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    companionEarning: {
      type: Number,
      required: true,
    },
    orderCode: {
      type: Number,
    },
    paymentLinkId: {
      type: String,
      default: "",
    },
    checkoutUrl: {
      type: String,
      default: "",
    },
    qrCode: {
      type: String,
      default: "",
    },
    baseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    penaltyAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    method: {
      type: String,
      enum: ["cash", "banking", "momo", "vnpay", "prototype", "payos"],
      default: "prototype",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "expired"],
      default: "pending",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    rawWebhook: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

PaymentSchema.index({ orderCode: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ paymentLinkId: 1 }, { sparse: true });
PaymentSchema.index({ status: 1, expiresAt: 1 });

const Payment = mongoose.model("payment", PaymentSchema);
export default Payment;
