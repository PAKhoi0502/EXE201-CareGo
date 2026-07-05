import crypto from "node:crypto";
import AuditLog from "../models/audit-log.models.js";

export const AUDIT_LOG_RETENTION_DAYS = 7;
export const AUDITED_ROLES = new Set(["admin", "companion", "customer"]);
const FULL_HTTP_AUDIT_ROLES = new Set(["admin", "companion"]);

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

const customerHttpAuditRules = [
  { method: "PATCH", pattern: /^\/api\/auth\/current-user\/?$/i, action: "customer.profile.update", resourceType: "users", actorResourceId: true },
  { method: "POST", pattern: /^\/api\/auth\/current-user\/password\/request-otp\/?$/i, action: "customer.password.otp_request", resourceType: "users", actorResourceId: true },
  { method: "PATCH", pattern: /^\/api\/auth\/current-user\/password\/?$/i, action: "customer.password.change", resourceType: "users", actorResourceId: true },
  { method: "PATCH", pattern: /^\/api\/auth\/current-user\/initial-password\/?$/i, action: "customer.password.change", resourceType: "users", actorResourceId: true },
  { method: "POST", pattern: /^\/api\/companions\/me\/apply\/?$/i, action: "customer.companion.apply", resourceType: "companion-applications", actorResourceId: true },
  { method: "POST", pattern: /^\/api\/elders\/?$/i, action: "customer.elder.create", resourceType: "elders" },
  { method: "PUT", pattern: /^\/api\/elders\/([a-f\d]{24})\/?$/i, action: "customer.elder.update", resourceType: "elders" },
  { method: "DELETE", pattern: /^\/api\/elders\/([a-f\d]{24})\/?$/i, action: "customer.elder.delete", resourceType: "elders" },
  { method: "POST", pattern: /^\/api\/bookings\/?$/i, action: "customer.booking.create", resourceType: "bookings" },
  { method: "PATCH", pattern: /^\/api\/bookings\/([a-f\d]{24})\/cancel\/?$/i, action: "customer.booking.cancel", resourceType: "bookings" },
  { method: "POST", pattern: /^\/api\/bookings\/([a-f\d]{24})\/pay\/?$/i, action: "customer.booking.pay", resourceType: "bookings" },
  { method: "POST", pattern: /^\/api\/bookings\/([a-f\d]{24})\/review\/?$/i, action: "customer.review.create", resourceType: "reviews" },
  { method: "POST", pattern: /^\/api\/payments\/payos\/sync\/?$/i, action: "customer.payment.sync", resourceType: "payments" },
  { method: "POST", pattern: /^\/api\/support\/conversations\/?$/i, action: "customer.support.create", resourceType: "support-conversations" },
];

export const getHttpAuditDetails = (actor, method, route) => {
  if (!actor?.userId) return null;
  if (FULL_HTTP_AUDIT_ROLES.has(actor.role)) {
    return { action: getHttpAuditAction(method) };
  }
  if (actor.role !== "customer") return null;

  const normalizedMethod = String(method || "").toUpperCase();
  const normalizedRoute = normalizePath(route);
  for (const rule of customerHttpAuditRules) {
    if (rule.method !== normalizedMethod) continue;
    const match = normalizedRoute.match(rule.pattern);
    if (!match) continue;
    return {
      action: rule.action,
      resourceType: rule.resourceType,
      resourceId: rule.actorResourceId ? String(actor.userId) : match[1] || "",
    };
  }

  return null;
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
