import Booking from "../models/booking.models.js";
import BlogComment from "../models/blog-comment.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import Payment from "../models/payment.models.js";
import { toPaymentDto } from "../dto/payment.dto.js";
import Service from "../models/service.models.js";
import User from "../models/user.models.js";
import BlogPost from "../models/blog-post.models.js";
import { buildPagination, parsePagination } from "../utils/pagination.js";
import {
  disconnectUserSockets,
  getCompanionGpsStatuses,
  getUserOnlineStatuses,
} from "../socket/location.socket.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REPORT_DAILY_LIMIT = 45;
const REPORT_DETAIL_DEFAULT_LIMIT = 25;
const REPORT_DETAIL_MAX_LIMIT = 100;
const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VIETNAM_UTC_OFFSET = "+07:00";
const ADMIN_USER_RESPONSE_FIELDS = [
  "_id",
  "name",
  "email",
  "phone",
  "avatar",
  "role",
  "isActive",
  "isEmailVerified",
  "createdAt",
  "updatedAt",
].join(" ");
const ADMIN_BOOKING_STATUSES = new Set([
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "paid",
  "cancelled",
]);
const ADMIN_USER_ROLES = new Set(["customer", "companion", "admin"]);

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAdminSearch = (value) => String(value || "").trim().slice(0, 100);

const buildAdminBookingFilter = async (query = {}) => {
  const filter = {};

  if (ADMIN_BOOKING_STATUSES.has(query.status)) {
    filter.status = query.status;
  }
  if (query.serviceId) {
    if (!/^[a-f\d]{24}$/i.test(query.serviceId)) {
      return { error: "Dịch vụ không hợp lệ." };
    }
    filter.serviceId = query.serviceId;
  }

  const search = getAdminSearch(query.search);
  if (!search) return { filter };

  const pattern = new RegExp(escapeRegExp(search), "i");
  const [users, elders, services] = await Promise.all([
    User.find({ $or: [{ name: pattern }, { email: pattern }, { phone: pattern }] }).select("_id").lean(),
    ElderProfile.find({ fullName: pattern }).select("_id").lean(),
    Service.find({ name: pattern }).select("_id").lean(),
  ]);

  filter.$or = [
    { address: pattern },
    { customerId: { $in: users.map((item) => item._id) } },
    { companionId: { $in: users.map((item) => item._id) } },
    { elderProfileId: { $in: elders.map((item) => item._id) } },
    { serviceId: { $in: services.map((item) => item._id) } },
  ];

  return { filter };
};

export const toVietnamDateInputValue = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const toVietnamMonthKey = (date) => toVietnamDateInputValue(date).slice(0, 7);

const getDefaultReportRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * MS_PER_DAY);
  return {
    from: toVietnamDateInputValue(start),
    to: toVietnamDateInputValue(end),
  };
};

export const parseReportRange = ({ from, to }) => {
  const defaults = getDefaultReportRange();
  const fromValue = from || defaults.from;
  const toValue = to || defaults.to;

  if (!REPORT_DATE_PATTERN.test(fromValue) || !REPORT_DATE_PATTERN.test(toValue)) {
    return { error: "Ngày bắt đầu và ngày kết thúc phải có định dạng YYYY-MM-DD." };
  }

  const start = new Date(`${fromValue}T00:00:00.000${VIETNAM_UTC_OFFSET}`);
  const end = new Date(`${toValue}T23:59:59.999${VIETNAM_UTC_OFFSET}`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    toVietnamDateInputValue(start) !== fromValue ||
    toVietnamDateInputValue(end) !== toValue
  ) {
    return { error: "Khoảng thời gian báo cáo không hợp lệ." };
  }
  if (start > end) {
    return { error: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." };
  }

  return { from: fromValue, to: toValue, start, end };
};

const parseReportPagination = ({ page, limit }) => {
  const pageValue = Number(page || 1);
  const limitValue = Number(limit || REPORT_DETAIL_DEFAULT_LIMIT);

  if (!Number.isInteger(pageValue) || pageValue < 1) {
    return { error: "Số trang phải là số nguyên dương." };
  }
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > REPORT_DETAIL_MAX_LIMIT) {
    return { error: `Số bản ghi mỗi trang phải từ 1 đến ${REPORT_DETAIL_MAX_LIMIT}.` };
  }

  return {
    page: pageValue,
    limit: limitValue,
    skip: (pageValue - 1) * limitValue,
  };
};

const numberValue = (value, fallback = 0) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

const getIdKey = (value) => value?._id?.toString?.() || value?.toString?.() || String(value);

const getDashboardBlogCommentCountMap = async (posts) => {
  const postIds = posts.map((post) => post._id);
  if (!postIds.length) return new Map();

  const [collectionRows, legacyRows] = await Promise.all([
    BlogComment.aggregate([
      { $match: { postId: { $in: postIds }, isVisible: true } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]),
    BlogPost.aggregate([
      { $match: { _id: { $in: postIds } } },
      { $project: { count: { $size: { $ifNull: ["$comments", []] } } } },
    ]),
  ]);

  const counts = new Map();
  postIds.forEach((postId) => counts.set(getIdKey(postId), 0));
  collectionRows.forEach((row) => {
    const key = getIdKey(row._id);
    counts.set(key, (counts.get(key) || 0) + row.count);
  });
  legacyRows.forEach((row) => {
    const key = getIdKey(row._id);
    counts.set(key, (counts.get(key) || 0) + row.count);
  });
  return counts;
};

const getPaymentPaidAmount = (payment) => numberValue(payment?.paidAmount || payment?.amount);
const getPaymentBaseAmount = (payment) => numberValue(payment?.baseAmount || payment?.amount);
const getPaymentPenaltyAmount = (payment) => numberValue(payment?.penaltyAmount);
const getPaymentPlatformFee = (payment) => numberValue(payment?.platformFee);
const getPaymentCompanionEarning = (payment) => {
  if (!payment) return 0;
  const earning = numberValue(payment.companionEarning, NaN);
  if (Number.isFinite(earning)) return earning;
  return Math.max(getPaymentBaseAmount(payment) - getPaymentPlatformFee(payment), 0);
};
const getPaymentCareGoRevenue = (payment) =>
  getPaymentPlatformFee(payment) + getPaymentPenaltyAmount(payment);

const getBookingReportAmount = (booking) =>
  booking.payment ? getPaymentBaseAmount(booking.payment) : numberValue(booking.totalAmount);

export const buildReportMonthly = (bookings, now = new Date()) => {
  const [currentYear, currentMonth] = toVietnamMonthKey(now).split("-").map(Number);
  const currentMonthIndex = currentYear * 12 + currentMonth - 1;
  const months = Array.from({ length: 6 }, (_, index) => {
    const monthIndex = currentMonthIndex - (5 - index);
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const labelDate = new Date(`${key}-15T12:00:00.000${VIETNAM_UTC_OFFSET}`);
    return {
      key,
      label: new Intl.DateTimeFormat("vi-VN", {
        month: "short",
        timeZone: VIETNAM_TIME_ZONE,
      }).format(labelDate),
      count: 0,
      revenue: 0,
      penalty: 0,
    };
  });

  bookings.forEach((booking) => {
    const bucket = months.find((item) => item.key === toVietnamMonthKey(booking.startTime));
    if (!bucket) return;

    bucket.count += 1;
    if (booking.payment?.status === "paid") {
      bucket.revenue += getPaymentPaidAmount(booking.payment);
      bucket.penalty += getPaymentPenaltyAmount(booking.payment);
    }
  });

  return months;
};

export const buildReportDaily = (bookings, range) => {
  const days = [];
  const cursor = new Date(range.start);

  while (cursor <= range.end && days.length < REPORT_DAILY_LIMIT) {
    days.push({
      key: toVietnamDateInputValue(cursor),
      label: new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        timeZone: VIETNAM_TIME_ZONE,
      }).format(cursor),
      count: 0,
      caregoRevenue: 0,
      companionEarning: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  bookings.forEach((booking) => {
    const bucket = days.find((item) => item.key === toVietnamDateInputValue(booking.startTime));
    if (!bucket) return;

    bucket.count += 1;
    if (booking.payment?.status === "paid") {
      bucket.caregoRevenue += getPaymentCareGoRevenue(booking.payment);
      bucket.companionEarning += getPaymentCompanionEarning(booking.payment);
    }
  });

  return days;
};

const buildReportServices = (bookings) => {
  const stats = {};
  bookings.forEach((booking) => {
    const name = booking.serviceId?.name || "Khac";
    stats[name] ||= { name, count: 0, revenue: 0 };
    stats[name].count += 1;
    stats[name].revenue += getBookingReportAmount(booking);
  });
  return Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 5);
};

const buildReportCompanions = (bookings) => {
  const stats = {};
  bookings.forEach((booking) => {
    const id = booking.companionId?._id?.toString?.() || booking.companionId?.email || "unknown";
    stats[id] ||= {
      id,
      name: booking.companionId?.name || "Chua co companion",
      count: 0,
      paid: 0,
      earning: 0,
    };
    stats[id].count += 1;
    if (booking.payment?.status === "paid") {
      stats[id].paid += 1;
      stats[id].earning += getPaymentCompanionEarning(booking.payment);
    }
  });
  return Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 6);
};

const buildReportStatusCounts = (bookings) =>
  Object.values(
    bookings.reduce((acc, booking) => {
      const status = booking.status || "unknown";
      acc[status] ||= { status, count: 0 };
      acc[status].count += 1;
      return acc;
    }, {}),
  );

const buildReportSummary = ({ bookings, pendingCompanions }) => {
  const paidBookings = bookings.filter((booking) => booking.payment?.status === "paid");
  const completed = bookings.filter((booking) => ["completed", "paid"].includes(booking.status)).length;
  const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;

  return {
    totalBookings: bookings.length,
    paidBookingCount: paidBookings.length,
    paidRevenue: paidBookings.reduce((sum, booking) => sum + getPaymentPaidAmount(booking.payment), 0),
    baseRevenue: paidBookings.reduce((sum, booking) => sum + getPaymentBaseAmount(booking.payment), 0),
    penaltyRevenue: paidBookings.reduce((sum, booking) => sum + getPaymentPenaltyAmount(booking.payment), 0),
    platformFee: paidBookings.reduce((sum, booking) => sum + getPaymentPlatformFee(booking.payment), 0),
    careGoRevenue: paidBookings.reduce((sum, booking) => sum + getPaymentCareGoRevenue(booking.payment), 0),
    companionEarning: paidBookings.reduce(
      (sum, booking) => sum + getPaymentCompanionEarning(booking.payment),
      0,
    ),
    completed,
    cancelled,
    completionRate: bookings.length ? Math.round((completed / bookings.length) * 100) : 0,
    missingGps: bookings.filter((booking) => !booking.addressLocation?.lat).length,
    pendingCompanions,
  };
};

export const getAdminDashboard = async (req, res) => {
  try {
    const currentMonthKey = toVietnamMonthKey(new Date());
    const [currentYear, currentMonth] = currentMonthKey.split("-").map(Number);
    const dashboardMonths = Array.from({ length: 5 }, (_, index) => {
      const monthIndex = currentYear * 12 + currentMonth - 1 - (4 - index);
      const year = Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      return `${year}-${String(month).padStart(2, "0")}`;
    });
    const dashboardStart = new Date(`${dashboardMonths[0]}-01T00:00:00.000${VIETNAM_UTC_OFFSET}`);

    const [
      totalUsers,
      totalCompanions,
      totalServices,
      totalBookings,
      revenueStats,
      blogStats,
      monthlyRows,
      serviceShare,
      dashboardBookings,
      pendingCompanions,
      bookingsByStatus,
    ] =
      await Promise.all([
        User.countDocuments(),
        CompanionProfile.countDocuments(),
        Service.countDocuments({ isActive: true }),
        Booking.countDocuments(),
        Payment.aggregate([
          { $match: { status: "paid" } },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $ifNull: ["$paidAmount", "$amount"] } },
              baseRevenue: { $sum: { $ifNull: ["$baseAmount", "$amount"] } },
              paidAmount: { $sum: { $ifNull: ["$paidAmount", "$amount"] } },
              penaltyAmount: { $sum: { $ifNull: ["$penaltyAmount", 0] } },
              platformFee: { $sum: { $ifNull: ["$platformFee", 0] } },
              companionEarning: { $sum: { $ifNull: ["$companionEarning", 0] } },
              caregoRevenue: {
                $sum: {
                  $add: [
                    { $ifNull: ["$platformFee", 0] },
                    { $ifNull: ["$penaltyAmount", 0] },
                  ],
                },
              },
            },
          },
        ]),
        BlogPost.find({ isPublished: true })
          .select("title slug category viewCount ratingSum ratingCount")
          .sort({ viewCount: -1 })
          .limit(10)
          .lean(),
        Booking.aggregate([
          { $match: { createdAt: { $gte: dashboardStart } } },
          {
            $lookup: {
              from: "payments",
              localField: "_id",
              foreignField: "bookingId",
              as: "payments",
            },
          },
          { $set: { payment: { $arrayElemAt: ["$payments", 0] } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: "$createdAt",
                  format: "%Y-%m",
                  timezone: VIETNAM_TIME_ZONE,
                },
              },
              count: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$payment.status", "paid"] },
                    { $ifNull: ["$payment.paidAmount", "$payment.amount"] },
                    0,
                  ],
                },
              },
            },
          },
        ]),
        Booking.aggregate([
          { $group: { _id: "$serviceId", count: { $sum: 1 } } },
          {
            $lookup: {
              from: "services",
              localField: "_id",
              foreignField: "_id",
              as: "service",
            },
          },
          {
            $project: {
              _id: 0,
              name: { $ifNull: [{ $arrayElemAt: ["$service.name", 0] }, "Khác"] },
              count: 1,
            },
          },
          { $sort: { count: -1 } },
        ]),
        Booking.find({ status: { $in: ["accepted", "in_progress"] } })
          .populate("companionId", "name email")
          .populate("elderProfileId", "fullName")
          .populate("serviceId", "name")
          .sort({ startTime: -1, _id: -1 })
          .limit(10)
          .lean(),
        CompanionProfile.find({ vettingStatus: "pending" })
          .select("fullName university major applicantType createdAt")
          .sort({ createdAt: 1, _id: 1 })
          .limit(4)
          .lean(),
        Booking.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
      ]);

    const [blogCommentCounts, dashboardPayments] = await Promise.all([
      getDashboardBlogCommentCountMap(blogStats),
      Payment.find({ bookingId: { $in: dashboardBookings.map((booking) => booking._id) } })
        .select("bookingId amount baseAmount paidAmount penaltyAmount platformFee companionEarning status")
        .lean(),
    ]);
    const dashboardPaymentByBooking = new Map(
      dashboardPayments.map((payment) => [payment.bookingId.toString(), payment]),
    );

    return res.status(200).json({
      totalUsers,
      totalCompanions,
      totalServices,
      totalBookings,
      revenue: revenueStats[0] || {
        revenue: 0,
        baseRevenue: 0,
        paidAmount: 0,
        penaltyAmount: 0,
        platformFee: 0,
        companionEarning: 0,
        caregoRevenue: 0,
      },
      bookingsByStatus,
      runningBookings: dashboardBookings.map((booking) => ({
        ...booking,
        payment: toPaymentDto(dashboardPaymentByBooking.get(booking._id.toString()), "admin"),
      })),
      pendingCompanions,
      monthlyStats: dashboardMonths.map((key) => {
        const row = monthlyRows.find((item) => item._id === key);
        return { key, count: row?.count || 0, revenue: row?.revenue || 0 };
      }),
      serviceShare,
      blogStats: blogStats.map((post) => ({
        ...post,
        ratingAverage: post.ratingCount ? Number((post.ratingSum / post.ratingCount).toFixed(1)) : 0,
        commentCount: blogCommentCounts.get(getIdKey(post._id)) || 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }

    const query = req.query || {};
    const filter = {};
    if (ADMIN_USER_ROLES.has(query.role)) {
      filter.role = query.role;
    }
    if (query.status === "active") {
      filter.isActive = true;
    } else if (query.status === "suspended") {
      filter.isActive = false;
    }

    const search = getAdminSearch(query.search);
    if (search) {
      const pattern = new RegExp(escapeRegExp(search), "i");
      filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
    }

    const summaryFilter = ADMIN_USER_ROLES.has(query.role) ? { role: query.role } : {};
    const [users, total, summaryRows] = await Promise.all([
      User.find(filter)
        .select(ADMIN_USER_RESPONSE_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(filter),
      User.aggregate([
        { $match: summaryFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
            suspended: { $sum: { $cond: ["$isActive", 0, 1] } },
            verified: { $sum: { $cond: ["$isEmailVerified", 1, 0] } },
          },
        },
      ]),
    ]);

    const summary = summaryRows[0] || { total: 0, active: 0, suspended: 0, verified: 0 };
    delete summary._id;

    return res.status(200).json({
      users,
      summary,
      pagination: buildPagination(pagination, total),
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "Trạng thái hoạt động phải là giá trị đúng hoặc sai." });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select(
      ADMIN_USER_RESPONSE_FIELDS,
    );
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    if (!user.isActive) {
      disconnectUserSockets(user._id, "account has been disabled");
    }

    return res.status(200).json({ message: "Cập nhật trạng thái tài khoản thành công.", user });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getAdminBookings = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }

    const bookingFilterResult = await buildAdminBookingFilter(req.query || {});
    if (bookingFilterResult.error) {
      return res.status(400).json({ message: bookingFilterResult.error });
    }

    const [bookings, total, summaryRows, paymentSummaryRows, services] = await Promise.all([
      Booking.find(bookingFilterResult.filter)
        .populate("customerId", "name email phone")
        .populate("companionId", "name email phone")
        .populate("elderProfileId")
        .populate("serviceId")
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Booking.countDocuments(bookingFilterResult.filter),
      Booking.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            running: {
              $sum: { $cond: [{ $in: ["$status", ["accepted", "in_progress"]] }, 1, 0] },
            },
            gpsReady: {
              $sum: { $cond: [{ $ne: [{ $ifNull: ["$addressLocation.lat", null] }, null] }, 1, 0] },
            },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { status: "paid" } },
        {
          $group: {
            _id: null,
            paidRevenue: { $sum: { $ifNull: ["$paidAmount", "$amount"] } },
            penaltyRevenue: { $sum: { $ifNull: ["$penaltyAmount", 0] } },
            platformFee: { $sum: { $ifNull: ["$platformFee", 0] } },
          },
        },
      ]),
      Service.find().select("_id name").sort({ name: 1 }).lean(),
    ]);

    const payments = await Payment.find({
      bookingId: { $in: bookings.map((booking) => booking._id) },
    })
      .sort({ createdAt: -1 })
      .lean();
    const paymentByBookingId = new Map();
    payments.forEach((payment) => {
      const key = payment.bookingId.toString();
      const current = paymentByBookingId.get(key);
      if (!current || (current.status !== "paid" && payment.status === "paid")) {
        paymentByBookingId.set(key, payment);
      }
    });
    const bookingsWithPayment = bookings.map((booking) => ({
      ...booking,
      payment: toPaymentDto(paymentByBookingId.get(booking._id.toString()), "admin"),
    }));

    const bookingSummary = summaryRows[0] || { total: 0, running: 0, gpsReady: 0 };
    const paymentSummary = paymentSummaryRows[0] || {
      paidRevenue: 0,
      penaltyRevenue: 0,
      platformFee: 0,
    };

    return res.status(200).json({
      bookings: bookingsWithPayment,
      summary: {
        total: bookingSummary.total || 0,
        running: bookingSummary.running || 0,
        gpsReady: bookingSummary.gpsReady || 0,
        paidRevenue: paymentSummary.paidRevenue || 0,
        penaltyRevenue: paymentSummary.penaltyRevenue || 0,
        platformFee: paymentSummary.platformFee || 0,
        careGoRevenue: (paymentSummary.platformFee || 0) + (paymentSummary.penaltyRevenue || 0),
      },
      filterOptions: { services },
      pagination: buildPagination(pagination, total),
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getAdminReports = async (req, res) => {
  try {
    const range = parseReportRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }
    const pagination = parseReportPagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }

    const bookingFilter = {
      startTime: {
        $gte: range.start,
        $lte: range.end,
      },
    };

    const [reportBookings, totalBookings, detailBookings, pendingCompanions] = await Promise.all([
      Booking.find(bookingFilter)
        .select("companionId serviceId status startTime createdAt addressLocation totalAmount platformFee")
        .populate("companionId", "name email")
        .populate("serviceId", "name")
        .sort({ startTime: -1 })
        .lean(),
      Booking.countDocuments(bookingFilter),
      Booking.find(bookingFilter)
        .populate("customerId", "name email phone")
        .populate("companionId", "name email phone")
        .populate("elderProfileId")
        .populate("serviceId")
        .sort({ startTime: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      CompanionProfile.countDocuments({ vettingStatus: "pending" }),
    ]);

    const bookingIds = reportBookings.map((booking) => booking._id);
    const paidPayments = await Payment.find({
      bookingId: { $in: bookingIds },
      status: "paid",
    })
      .select("bookingId amount platformFee companionEarning baseAmount penaltyAmount paidAmount status paidAt createdAt")
      .lean();

    const paidPaymentByBookingId = new Map(
      paidPayments.map((payment) => [payment.bookingId.toString(), payment]),
    );
    const reportBookingsWithPayment = reportBookings.map((booking) => ({
      ...booking,
      payment: toPaymentDto(paidPaymentByBookingId.get(booking._id.toString()), "admin"),
    }));
    const detailBookingsWithPayment = detailBookings.map((booking) => ({
      ...booking,
      payment: toPaymentDto(paidPaymentByBookingId.get(booking._id.toString()), "admin"),
    }));

    return res.status(200).json({
      range: {
        from: range.from,
        to: range.to,
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: totalBookings,
        totalPages: Math.max(1, Math.ceil(totalBookings / pagination.limit)),
      },
      summary: buildReportSummary({ bookings: reportBookingsWithPayment, pendingCompanions }),
      monthly: buildReportMonthly(reportBookingsWithPayment),
      daily: buildReportDaily(reportBookingsWithPayment, range),
      services: buildReportServices(reportBookingsWithPayment),
      companionRows: buildReportCompanions(reportBookingsWithPayment),
      statusCounts: buildReportStatusCounts(reportBookingsWithPayment),
      bookings: detailBookingsWithPayment,
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getAdminGpsStatuses = async (req, res) => {
  try {
    return res.status(200).json({ gpsStatuses: getCompanionGpsStatuses() });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getAdminOnlineStatuses = async (req, res) => {
  try {
    return res.status(200).json({ onlineStatuses: getUserOnlineStatuses() });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};
