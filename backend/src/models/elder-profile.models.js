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
      maxlength: 120,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 130,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    medicalNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    chronicConditions: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],
    medicines: [
      {
        name: { type: String, trim: true, maxlength: 120 },
        dosage: { type: String, trim: true, maxlength: 120 },
        schedule: { type: String, trim: true, maxlength: 200 },
        note: { type: String, trim: true, maxlength: 500 },
      },
    ],
    emergencyContact: {
      name: {
        type: String,
        default: "",
        trim: true,
        maxlength: 120,
      },
      phone: {
        type: String,
        default: "",
        trim: true,
        maxlength: 16,
        validate: {
          validator: (value) => !value || /^\+?[0-9]{9,15}$/.test(value),
          message: "Số điện thoại khẩn cấp không hợp lệ.",
        },
      },
      relationship: {
        type: String,
        default: "",
        trim: true,
        maxlength: 120,
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
      select: false,
    },
    archivedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true },
);

ElderProfileSchema.path("chronicConditions").validate(
  (values) => values.length <= 30,
  "Chỉ được lưu tối đa 30 tình trạng sức khỏe.",
);
ElderProfileSchema.path("medicines").validate(
  (values) => values.length <= 50,
  "Chỉ được lưu tối đa 50 loại thuốc.",
);
ElderProfileSchema.index({ customerId: 1, isArchived: 1, createdAt: -1 });

const ElderProfile = mongoose.model("elderProfile", ElderProfileSchema);
export default ElderProfile;
