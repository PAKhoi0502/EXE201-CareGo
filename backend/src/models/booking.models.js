import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    seedKey: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },
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
    bookingMode: {
      type: String,
      enum: ["scheduled", "instant"],
      default: "scheduled",
      index: true,
    },
    offerExpiresAt: {
      type: Date,
      default: null,
      index: true,
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
    completedAt: {
      type: Date,
      default: null,
    },
    paymentDueAt: {
      type: Date,
      default: null,
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

BookingSchema.index({ companionId: 1, startTime: 1, status: 1 });
BookingSchema.index({ customerId: 1, status: 1, paymentDueAt: 1 });

const Booking = mongoose.model("booking", BookingSchema);
export default Booking;
