import mongoose from "mongoose";

const AUDIT_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const AuditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    actorName: {
      type: String,
      default: "",
      trim: true,
    },
    actorEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    actorRole: {
      type: String,
      enum: ["admin", "companion", "customer"],
      required: true,
    },
    source: {
      type: String,
      enum: ["http", "socket"],
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    route: {
      type: String,
      default: "",
      trim: true,
    },
    resourceType: {
      type: String,
      default: "",
      trim: true,
    },
    resourceId: {
      type: String,
      default: "",
      trim: true,
    },
    outcome: {
      type: String,
      enum: ["success", "failure"],
      required: true,
    },
    statusCode: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    ipHash: {
      type: String,
      default: "",
      select: false,
    },
    userAgent: {
      type: String,
      default: "",
      maxlength: 500,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + AUDIT_LOG_RETENTION_MS),
    },
  },
  { timestamps: true },
);

AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuditLogSchema.index({ actorRole: 1, createdAt: -1 });
AuditLogSchema.index({ source: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ outcome: 1, createdAt: -1 });

const AuditLog = mongoose.model("auditLog", AuditLogSchema);
export default AuditLog;
