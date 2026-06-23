import mongoose from "mongoose";

const BookingPaymentLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    ownerToken: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true, versionKey: false },
);

const BookingPaymentLock = mongoose.model(
  "bookingPaymentLock",
  BookingPaymentLockSchema,
);

export default BookingPaymentLock;
