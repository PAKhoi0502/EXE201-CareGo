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
    method: {
      type: String,
      enum: ["cash", "banking", "momo", "vnpay", "prototype"],
      default: "prototype",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "paid",
    },
  },
  { timestamps: true },
);

const Payment = mongoose.model("payment", PaymentSchema);
export default Payment;
