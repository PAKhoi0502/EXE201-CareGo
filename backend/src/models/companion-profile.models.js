import mongoose from "mongoose";

const CompanionProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    dateOfBirth: Date,
    university: {
      type: String,
      default: "",
    },
    major: {
      type: String,
      default: "",
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    documents: {
      citizenId: {
        type: String,
        default: "",
      },
      studentCardUrl: {
        type: String,
        default: "",
      },
      backgroundCheckUrl: {
        type: String,
        default: "",
      },
    },
    vettingStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    serviceAreas: [
      {
        type: String,
        trim: true,
      },
    ],
    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    completedBookings: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const CompanionProfile = mongoose.model(
  "companionProfile",
  CompanionProfileSchema,
);
export default CompanionProfile;
