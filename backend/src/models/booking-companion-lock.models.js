import mongoose from "mongoose";

const BookingCompanionLockSchema = new mongoose.Schema(
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

const BookingCompanionLock = mongoose.model(
  "bookingCompanionLock",
  BookingCompanionLockSchema,
);

export default BookingCompanionLock;
