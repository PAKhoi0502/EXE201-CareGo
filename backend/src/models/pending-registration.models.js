import mongoose from "mongoose";

const PendingRegistrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["customer", "companion"],
      default: "customer",
    },
    companionProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    emailOtpHash: {
      type: String,
      required: true,
    },
    emailOtpExpires: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true },
);

const PendingRegistration = mongoose.model("pendingRegistration", PendingRegistrationSchema);
export default PendingRegistration;
