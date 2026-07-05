import mongoose from "mongoose";

const CompanionProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      unique: true,
      sparse: true,
      default: undefined,
    },
    applicantCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      unique: true,
      sparse: true,
      default: undefined,
      select: false,
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
    phoneVerifiedAt: {
      type: Date,
      default: null,
    },
    phoneVerificationOtpHash: {
      type: String,
      default: "",
      select: false,
    },
    phoneVerificationOtpExpires: {
      type: Date,
      default: null,
      select: false,
    },
    workingShift: {
      type: String,
      enum: ["morning", "afternoon", "full_day"],
      default: "full_day",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    dateOfBirth: Date,
    applicantType: {
      type: String,
      enum: ["student", "graduate", "healthcare_professional", "experienced_caregiver", "community_supporter"],
      default: null,
    },
    university: {
      type: String,
      default: "",
    },
    major: {
      type: String,
      default: "",
    },
    graduationYear: {
      type: Number,
      default: null,
      min: 1950,
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
      min: 0,
      max: 60,
    },
    qualificationDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
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
      citizenIdFrontUrl: {
        type: String,
        default: "",
      },
      citizenIdBackUrl: {
        type: String,
        default: "",
      },
      studentCardUrl: {
        type: String,
        default: "",
      },
      degreeCertificateUrl: {
        type: String,
        default: "",
      },
      professionalCertificateUrl: {
        type: String,
        default: "",
      },
      experienceProofUrl: {
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
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
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
    ratingTotal: {
      type: Number,
      default: 0,
      min: 0,
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
