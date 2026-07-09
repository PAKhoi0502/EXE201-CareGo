import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
      match: /^[A-Za-z0-9_-]+$/,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    pricePerHour: {
      type: Number,
      required: true,
      min: 0,
      max: 100000000,
    },
    defaultChecklist: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 300,
        },
      ],
      default: [],
      validate: {
        validator: (items) => items.length <= 50,
        message: "Mỗi dịch vụ chỉ được có tối đa 50 bước công việc.",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Service = mongoose.model("service", ServiceSchema);
export default Service;
