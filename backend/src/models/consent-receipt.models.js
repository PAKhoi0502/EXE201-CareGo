import mongoose from "mongoose";

const ConsentReceiptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    audience: {
      type: String,
      enum: ["customer", "companion"],
      required: true,
    },
    documentType: {
      type: String,
      enum: ["CUSTOMER_TERMS", "COMPANION_TERMS", "PRIVACY_POLICY", "ELDER_DATA_AUTHORITY"],
      required: true,
    },
    documentVersion: {
      type: String,
      required: true,
    },
    documentHash: {
      type: String,
      required: true,
    },
    acceptedAt: {
      type: Date,
      required: true,
    },
    source: {
      type: String,
      enum: ["CUSTOMER_SIGNUP", "COMPANION_APPLICATION", "ELDER_PROFILE_CREATE", "REACCEPTANCE"],
      required: true,
    },
    contextType: {
      type: String,
      default: "",
    },
    contextId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    ipHash: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true },
);

ConsentReceiptSchema.index(
  { userId: 1, documentType: 1, documentVersion: 1, source: 1, contextId: 1 },
  { unique: true },
);

const ConsentReceipt = mongoose.model("consentReceipt", ConsentReceiptSchema);
export default ConsentReceipt;
