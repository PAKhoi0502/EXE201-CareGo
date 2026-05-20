import mongoose from "mongoose";

const ElderProfileSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    address: {
      type: String,
      required: true,
    },
    medicalNotes: {
      type: String,
      default: "",
    },
    chronicConditions: [
      {
        type: String,
        trim: true,
      },
    ],
    medicines: [
      {
        name: String,
        dosage: String,
        schedule: String,
        note: String,
      },
    ],
    emergencyContact: {
      name: {
        type: String,
        default: "",
      },
      phone: {
        type: String,
        default: "",
      },
      relationship: {
        type: String,
        default: "",
      },
    },
  },
  { timestamps: true },
);

const ElderProfile = mongoose.model("elderProfile", ElderProfileSchema);
export default ElderProfile;
