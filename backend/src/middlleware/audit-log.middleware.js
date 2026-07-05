import { getHttpAuditDetails, recordAuditLogLater } from "../utils/audit-log.js";

const getRequestIp = (req) => req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";

export const auditHttpActivity = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.once("finish", () => {
    const route = req.originalUrl || `${req.baseUrl || ""}${req.path || ""}`;
    const auditDetails = getHttpAuditDetails(req.user, req.method, route);
    if (!auditDetails) return;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    recordAuditLogLater({
      actor: req.user,
      source: "http",
      action: auditDetails.action,
      method: req.method,
      route,
      resourceType: auditDetails.resourceType,
      resourceId: auditDetails.resourceId,
      outcome: res.statusCode < 400 ? "success" : "failure",
      statusCode: res.statusCode,
      durationMs,
      ipAddress: getRequestIp(req),
      userAgent: req.headers["user-agent"] || "",
    });
  });

  next();
};
