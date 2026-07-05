import crypto from "node:crypto";
import AuditLog from "../models/audit-log.models.js";

export const AUDIT_LOG_RETENTION_DAYS = 7;
export const AUDITED_ROLES = new Set(["admin", "companion"]);

const objectIdPattern = /^[a-f\d]{24}$/i;

const normalizePath = (value) => String(value || "").split("?")[0].slice(0, 500);

const normalizeUserAgent = (value) => String(value || "").trim().slice(0, 500);

export const hashAuditIp = (value) => {
  const normalizedIp = String(value || "").split(",")[0].trim();
  if (!normalizedIp) return "";
  const salt = process.env.AUDIT_LOG_SALT || process.env.JWT_SECRET_KEY || "carego-audit";
  return crypto.createHash("sha256").update(`${salt}:${normalizedIp}`).digest("hex");
};

export const resolveAuditResource = (route) => {
  const segments = normalizePath(route).split("/").filter(Boolean);
  const apiIndex = segments.indexOf("api");
  const apiSegments = apiIndex >= 0 ? segments.slice(apiIndex + 1) : segments;
  const resourceSegments = apiSegments[0] === "admin" ? apiSegments.slice(1) : apiSegments;
  const resourceType = resourceSegments[0] || "system";
  const resourceId = resourceSegments.find((segment) => objectIdPattern.test(segment)) || "";
  return { resourceType, resourceId };
};

export const getHttpAuditAction = (method) => {
  const actions = {
    GET: "http.read",
    POST: "http.create",
    PUT: "http.replace",
    PATCH: "http.update",
    DELETE: "http.delete",
  };
  return actions[String(method || "").toUpperCase()] || "http.request";
};

export const buildAuditLogEntry = ({
  actor,
  source,
  action,
  method = "",
  route = "",
  resourceType,
  resourceId,
  outcome = "success",
  statusCode = 0,
  durationMs = 0,
  ipAddress = "",
  userAgent = "",
}) => {
  if (!actor?.userId || !AUDITED_ROLES.has(actor.role)) return null;
  const resolvedResource = resolveAuditResource(route);

  return {
    actorId: actor.userId,
    actorName: String(actor.name || "").trim(),
    actorEmail: String(actor.email || "").trim().toLowerCase(),
    actorRole: actor.role,
    source,
    action,
    method: String(method || "").toUpperCase(),
    route: normalizePath(route),
    resourceType: resourceType || resolvedResource.resourceType,
    resourceId: String(resourceId || resolvedResource.resourceId || ""),
    outcome,
    statusCode: Number(statusCode) || 0,
    durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
    ipHash: hashAuditIp(ipAddress),
    userAgent: normalizeUserAgent(userAgent),
  };
};

export const recordAuditLog = async (data) => {
  const entry = buildAuditLogEntry(data);
  if (!entry) return null;

  try {
    return await AuditLog.create(entry);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
    return null;
  }
};

export const recordAuditLogLater = (data) => {
  void recordAuditLog(data);
};
