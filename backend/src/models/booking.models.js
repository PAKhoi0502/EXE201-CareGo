import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    seedKey: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
      select: false,
    },
    idempotencyFingerprint: {
      type: String,
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
    incident: {
      status: {
        type: String,
        enum: ["none", "reported", "resolved", "reassigned", "cancelled"],
        default: "none",
      },
      reason: {
        type: String,
        enum: ["health", "transport", "family_emergency", "safety", "other", ""],
        default: "",
      },
      details: {
        type: String,
        default: "",
        maxlength: 1000,
      },
      reportedAt: {
        type: Date,
        default: null,
      },
      reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      resolvedAt: {
        type: Date,
        default: null,
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
      resolution: {
        type: String,
        enum: ["", "resume", "reassign", "cancel"],
        default: "",
      },
      adminNote: {
        type: String,
        default: "",
        maxlength: 1000,
      },
      previousCompanionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
    },
  },
  { timestamps: true },
);

BookingSchema.index({ companionId: 1, startTime: 1, status: 1 });
BookingSchema.index({ customerId: 1, status: 1, paymentDueAt: 1 });
BookingSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
BookingSchema.index({ createdAt: -1 });
BookingSchema.index({ status: 1, createdAt: -1 });
BookingSchema.index({ serviceId: 1, createdAt: -1 });

const Booking = mongoose.model("booking", BookingSchema);
export default Booking;
