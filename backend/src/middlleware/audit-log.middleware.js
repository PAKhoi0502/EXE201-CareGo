import { getHttpAuditAction, recordAuditLogLater } from "../utils/audit-log.js";

const getRequestIp = (req) => req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";

export const auditHttpActivity = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.once("finish", () => {
    if (!req.user?.userId || !["admin", "companion"].includes(req.user.role)) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = req.originalUrl || `${req.baseUrl || ""}${req.path || ""}`;

    recordAuditLogLater({
      actor: req.user,
      source: "http",
      action: getHttpAuditAction(req.method),
      method: req.method,
      route,
      outcome: res.statusCode < 400 ? "success" : "failure",
      statusCode: res.statusCode,
      durationMs,
      ipAddress: getRequestIp(req),
      userAgent: req.headers["user-agent"] || "",
    });
  });

  next();
};
