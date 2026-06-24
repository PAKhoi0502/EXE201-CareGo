import mongoose from "mongoose";

const WithdrawalCompanionLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    ownerToken: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true, versionKey: false },
);

const WithdrawalCompanionLock = mongoose.model(
  "withdrawalCompanionLock",
  WithdrawalCompanionLockSchema,
);

export default WithdrawalCompanionLock;
