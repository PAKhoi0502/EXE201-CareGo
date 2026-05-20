import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    elderProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "elderProfile",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "service",
      required: true,
    },
    companionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    durationHours: {
      type: Number,
      required: true,
      min: 1,
    },
    address: {
      type: String,
      required: true,
    },
    addressLocation: {
      lat: Number,
      lng: Number,
      displayName: String,
    },
    note: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
        "paid",
      ],
      default: "pending",
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

const Booking = mongoose.model("booking", BookingSchema);
export default Booking;
