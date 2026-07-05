import AuditLog from "../models/audit-log.models.js";
import { AUDIT_LOG_RETENTION_DAYS } from "../utils/audit-log.js";

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}${suffix}` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getAdminAuditLogs = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const skip = (page - 1) * limit;
    const retentionStart = new Date(Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const requestedFrom = parseDate(req.query.from);
    const requestedTo = parseDate(req.query.to, true);
    const from = requestedFrom && requestedFrom > retentionStart ? requestedFrom : retentionStart;
    const to = requestedTo && requestedTo < new Date() ? requestedTo : new Date();
    const dateFilter = { createdAt: { $gte: from, $lte: to } };
    const filter = { ...dateFilter };

    if (["admin", "companion", "customer"].includes(req.query.role)) {
      filter.actorRole = req.query.role;
    }
    if (["http", "socket"].includes(req.query.source)) {
      filter.source = req.query.source;
    }
    if (["success", "failure"].includes(req.query.outcome)) {
      filter.outcome = req.query.outcome;
    }
    if (["GET", "POST", "PUT", "PATCH", "DELETE"].includes(req.query.method)) {
      filter.method = req.query.method;
    }

    const search = String(req.query.search || "").trim().slice(0, 100);
    if (search) {
      const searchPattern = new RegExp(escapeRegExp(search), "i");
      filter.$or = [
        { actorName: searchPattern },
        { actorEmail: searchPattern },
        { action: searchPattern },
        { route: searchPattern },
        { resourceType: searchPattern },
        { resourceId: searchPattern },
      ];
    }

    const [auditLogs, total, summaryRows] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
      AuditLog.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            admin: { $sum: { $cond: [{ $eq: ["$actorRole", "admin"] }, 1, 0] } },
            companion: { $sum: { $cond: [{ $eq: ["$actorRole", "companion"] }, 1, 0] } },
            customer: { $sum: { $cond: [{ $eq: ["$actorRole", "customer"] }, 1, 0] } },
            http: { $sum: { $cond: [{ $eq: ["$source", "http"] }, 1, 0] } },
            socket: { $sum: { $cond: [{ $eq: ["$source", "socket"] }, 1, 0] } },
            failures: { $sum: { $cond: [{ $eq: ["$outcome", "failure"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const summary = summaryRows[0] || {
      total: 0,
      admin: 0,
      companion: 0,
      customer: 0,
      http: 0,
      socket: 0,
      failures: 0,
    };
    delete summary._id;

    return res.status(200).json({
      auditLogs,
      summary,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      filters: { from, to },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Không thể tải nhật ký hoạt động. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};
