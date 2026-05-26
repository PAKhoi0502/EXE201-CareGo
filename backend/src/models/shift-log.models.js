import mongoose from "mongoose";

const ShiftLogSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "booking",
      required: true,
      unique: true,
    },
    checkInPhotoUrl: {
      type: [String],
      default: [],
    },
    checkOutPhotoUrl: {
      type: [String],
      default: [],
    },
    locations: [
      {
        lat: Number,
        lng: Number,
        note: String,
        recordedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    checklist: [
      {
        label: String,
        done: {
          type: Boolean,
          default: false,
        },
      },
    ],
    healthMetrics: {
      bloodPressure: String,
      heartRate: Number,
      mood: String,
    },
    companionNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const ShiftLog = mongoose.model("shiftLog", ShiftLogSchema);
export default ShiftLog;
