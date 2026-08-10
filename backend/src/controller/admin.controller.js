import mongoose from "mongoose";
import Booking from "../models/booking.models.js";
import BlogComment from "../models/blog-comment.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import Payment from "../models/payment.models.js";
import Review from "../models/review.models.js";
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
const REPORT_DAILY_LIMIT = 366;
const REPORT_MAX_RANGE_DAYS = 366;
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

export const buildAdminBookingFilter = async (query = {}) => {
  const filter = {};

  if (ADMIN_BOOKING_STATUSES.has(query.status)) {
    filter.status = query.status;
  }
  if (query.serviceId) {
    if (!/^[a-f\d]{24}$/i.test(query.serviceId)) {
      return { error: "Dịch vụ không hợp lệ." };
    }
    filter.serviceId = new mongoose.Types.ObjectId(query.serviceId);
  }

  const search = getAdminSearch(query.search);
  if (!search) return { filter };

  const pattern = new RegExp(escapeRegExp(search), "i");
  const bookingId = /^[a-f\d]{24}$/i.test(search)
    ? new mongoose.Types.ObjectId(search)
    : null;
  const parsedOrderCode = /^\d+$/.test(search) ? Number(search) : NaN;
  const canSearchOrderCode = Number.isSafeInteger(parsedOrderCode) && parsedOrderCode > 0;
  const [users, elders, services, matchingPayments] = await Promise.all([
    User.find({ $or: [{ name: pattern }, { email: pattern }, { phone: pattern }] }).select("_id").lean(),
    ElderProfile.find({ fullName: pattern }).select("_id").lean(),
    Service.find({ name: pattern }).select("_id").lean(),
    canSearchOrderCode
      ? Payment.find({ orderCode: parsedOrderCode }).select("bookingId").lean()
      : [],
  ]);

  filter.$or = [
    ...(bookingId ? [{ _id: bookingId }] : []),
    ...(matchingPayments.length
      ? [{ _id: { $in: matchingPayments.map((payment) => payment.bookingId) } }]
      : []),
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
  const calendarDays = Math.round((end.getTime() - start.getTime() + 1) / MS_PER_DAY);
  if (calendarDays > REPORT_MAX_RANGE_DAYS) {
    return { error: `Báo cáo chỉ hỗ trợ tối đa ${REPORT_MAX_RANGE_DAYS} ngày.` };
  }

  return { from: fromValue, to: toValue, start, end, calendarDays };
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

export const buildReportMonthly = (bookings, rangeOrNow = new Date()) => {
  const hasExplicitRange = rangeOrNow?.start && rangeOrNow?.end;
  const [endYear, endMonth] = toVietnamMonthKey(
    hasExplicitRange ? rangeOrNow.end : rangeOrNow,
  ).split("-").map(Number);
  const endMonthIndex = endYear * 12 + endMonth - 1;
  const [startYear, startMonth] = hasExplicitRange
    ? toVietnamMonthKey(rangeOrNow.start).split("-").map(Number)
    : [endYear, endMonth - 5];
  const startMonthIndex = hasExplicitRange
    ? startYear * 12 + startMonth - 1
    : endMonthIndex - 5;
  const monthCount = Math.max(endMonthIndex - startMonthIndex + 1, 1);
  const months = Array.from({ length: monthCount }, (_, index) => {
    const monthIndex = startMonthIndex + index;
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

const COMPANION_SHIFT_HOURS = {
  morning: 4,
  afternoon: 4,
  full_day: 8,
};

const getVietnamWeekday = (dateKey) =>
  new Date(`${dateKey}T12:00:00.000${VIETNAM_UTC_OFFSET}`).getUTCDay();

const getCompanionAvailableHours = (profile, range) => {
  if (!profile || !range?.start || !range?.end) return 0;
  const workingDays = new Set(
    Array.isArray(profile.workingDays) && profile.workingDays.length
      ? profile.workingDays
      : [0, 1, 2, 3, 4, 5, 6],
  );
  const unavailableDates = new Set(profile.unavailableDates || []);
  const shiftHours = COMPANION_SHIFT_HOURS[profile.workingShift] || COMPANION_SHIFT_HOURS.full_day;
  let availableDays = 0;
  const cursor = new Date(range.start);

  while (cursor <= range.end && availableDays <= REPORT_MAX_RANGE_DAYS) {
    const dateKey = toVietnamDateInputValue(cursor);
    if (workingDays.has(getVietnamWeekday(dateKey)) && !unavailableDates.has(dateKey)) {
      availableDays += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return availableDays * shiftHours;
};

export const buildReportCompanions = (bookings, { companionProfiles = [], reviews = [], range } = {}) => {
  const stats = {};
  bookings.forEach((booking) => {
    const id = getIdKey(booking.companionId) || booking.companionId?.email || "unknown";
    stats[id] ||= {
      id,
      name: booking.companionId?.name || "Chua co companion",
      count: 0,
      paid: 0,
      earning: 0,
      assignedHours: 0,
      completedHours: 0,
    };
    stats[id].count += 1;
    if (booking.status !== "cancelled") {
      stats[id].assignedHours += numberValue(booking.durationHours);
    }
    if (["completed", "paid"].includes(booking.status)) {
      stats[id].completedHours += numberValue(booking.durationHours);
    }
    if (booking.payment?.status === "paid") {
      stats[id].paid += 1;
      stats[id].earning += getPaymentCompanionEarning(booking.payment);
    }
  });
  const profilesByUserId = new Map(
    companionProfiles.map((profile) => [getIdKey(profile.userId), profile]),
  );
  const reviewsByCompanionId = reviews.reduce((map, review) => {
    const id = getIdKey(review.companionId);
    const current = map.get(id) || { total: 0, count: 0 };
    current.total += numberValue(review.rating);
    current.count += 1;
    map.set(id, current);
    return map;
  }, new Map());

  return Object.values(stats)
    .map((item) => {
      const availableHours = getCompanionAvailableHours(profilesByUserId.get(item.id), range);
      const rating = reviewsByCompanionId.get(item.id) || { total: 0, count: 0 };
      return {
        ...item,
        availableHours,
        utilizationRate: availableHours
          ? Math.round((item.assignedHours / availableHours) * 100)
          : 0,
        completionHoursRate: item.assignedHours
          ? Math.round((item.completedHours / item.assignedHours) * 100)
          : 0,
        ratingAverage: rating.count
          ? Math.round((rating.total / rating.count) * 10) / 10
          : 0,
        reviewCount: rating.count,
      };
    })
    .sort((a, b) => b.assignedHours - a.assignedHours || b.count - a.count)
    .slice(0, 10);
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

export const buildReportSummary = ({ bookings, reviews = [], companionProfiles = [], range }) => {
  const paidBookings = bookings.filter((booking) => booking.payment?.status === "paid");
  const completed = bookings.filter((booking) => ["completed", "paid"].includes(booking.status)).length;
  const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
  const assignedHours = bookings
    .filter((booking) => booking.status !== "cancelled")
    .reduce((sum, booking) => sum + numberValue(booking.durationHours), 0);
  const companionIds = new Set(bookings.map((booking) => getIdKey(booking.companionId)).filter(Boolean));
  const availableHours = companionProfiles
    .filter((profile) => companionIds.has(getIdKey(profile.userId)))
    .reduce((sum, profile) => sum + getCompanionAvailableHours(profile, range), 0);
  const ratingTotal = reviews.reduce((sum, review) => sum + numberValue(review.rating), 0);

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
    cancellationRate: bookings.length ? Math.round((cancelled / bookings.length) * 1000) / 10 : 0,
    averageBookingValue: bookings.length
      ? Math.round(bookings.reduce((sum, booking) => sum + getBookingReportAmount(booking), 0) / bookings.length)
      : 0,
    missingGps: bookings.filter((booking) => !booking.addressLocation?.lat).length,
    assignedHours,
    availableHours,
    utilizationRate: availableHours ? Math.round((assignedHours / availableHours) * 1000) / 10 : 0,
    reviewCount: reviews.length,
    ratingAverage: reviews.length ? Math.round((ratingTotal / reviews.length) * 10) / 10 : 0,
    reviewCoverage: completed ? Math.round((reviews.length / completed) * 1000) / 10 : 0,
  };
};

export const buildAdminReportBookingFilter = ({ query = {}, range }) => {
  const filter = {
    startTime: {
      $gte: range.start,
      $lte: range.end,
    },
  };

  if (query.status && query.status !== "all") {
    if (!ADMIN_BOOKING_STATUSES.has(query.status)) {
      return { error: "Trạng thái booking không hợp lệ." };
    }
    filter.status = query.status;
  }

  const objectIdFilters = [
    ["serviceId", "Dịch vụ"],
    ["companionId", "Companion"],
    ["customerId", "Khách hàng"],
  ];
  for (const [field, label] of objectIdFilters) {
    const value = String(query[field] || "").trim();
    if (!value || value === "all") continue;
    if (!/^[a-f\d]{24}$/i.test(value)) {
      return { error: `${label} không hợp lệ.` };
    }
    filter[field] = new mongoose.Types.ObjectId(value);
  }

  const bookingId = String(query.bookingId || "").trim();
  if (bookingId) {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      return { error: "Mã booking phải là ObjectId gồm 24 ký tự hex." };
    }
    filter._id = new mongoose.Types.ObjectId(bookingId);
  }

  return { filter };
};

const buildPreviousReportRange = (range) => {
  const durationMs = range.end.getTime() - range.start.getTime() + 1;
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - durationMs + 1);
  return {
    from: toVietnamDateInputValue(start),
    to: toVietnamDateInputValue(end),
    start,
    end,
    calendarDays: range.calendarDays,
  };
};

const buildReportPaymentMethods = (bookings) => Object.values(
  bookings.reduce((stats, booking) => {
    if (booking.payment?.status !== "paid") return stats;
    const method = booking.payment.method || "unknown";
    stats[method] ||= { method, count: 0, amount: 0 };
    stats[method].count += 1;
    stats[method].amount += getPaymentPaidAmount(booking.payment);
    return stats;
  }, {}),
).sort((a, b) => b.count - a.count);

const buildReportReviews = (reviews, completedBookings) => {
  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: reviews.filter((review) => numberValue(review.rating) === rating).length,
  }));
  const tagCounts = reviews.reduce((stats, review) => {
    (review.tags || []).forEach((tag) => {
      const normalizedTag = String(tag || "").trim();
      if (normalizedTag) stats[normalizedTag] = (stats[normalizedTag] || 0) + 1;
    });
    return stats;
  }, {});
  const ratingTotal = reviews.reduce((sum, review) => sum + numberValue(review.rating), 0);

  return {
    count: reviews.length,
    average: reviews.length ? Math.round((ratingTotal / reviews.length) * 10) / 10 : 0,
    coverage: completedBookings
      ? Math.round((reviews.length / completedBookings) * 1000) / 10
      : 0,
    distribution,
    topTags: Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
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
        { $match: bookingFilterResult.filter },
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
        ...(Object.keys(bookingFilterResult.filter).length > 0
          ? [
              {
                $lookup: {
                  from: Booking.collection.collectionName,
                  localField: "bookingId",
                  foreignField: "_id",
                  as: "booking",
                },
              },
              {
                $match: {
                  booking: { $elemMatch: bookingFilterResult.filter },
                },
              },
            ]
          : []),
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
    const exportAllDetails = req.query.export === "true";
    const pagination = exportAllDetails
      ? { page: 1, limit: Number.MAX_SAFE_INTEGER, skip: 0 }
      : parseReportPagination(req.query);
    if (pagination.error) {
      return res.status(400).json({ message: pagination.error });
    }

    const bookingFilterResult = buildAdminReportBookingFilter({ query: req.query, range });
    if (bookingFilterResult.error) {
      return res.status(400).json({ message: bookingFilterResult.error });
    }
    const previousRange = buildPreviousReportRange(range);
    const previousFilterResult = buildAdminReportBookingFilter({ query: req.query, range: previousRange });

    const [
      reportBookings,
      previousBookings,
      pendingCompanions,
      filterServices,
      filterCompanions,
      filterCustomers,
    ] = await Promise.all([
      Booking.find(bookingFilterResult.filter)
        .populate("customerId", "name email phone")
        .populate("companionId", "name email phone")
        .populate("elderProfileId", "fullName")
        .populate("serviceId", "name")
        .sort({ startTime: -1, _id: -1 })
        .lean(),
      Booking.find(previousFilterResult.filter)
        .select("customerId companionId serviceId status startTime durationHours addressLocation totalAmount platformFee")
        .lean(),
      CompanionProfile.countDocuments({ vettingStatus: "pending" }),
      Service.find().select("_id name").sort({ name: 1 }).lean(),
      User.find({ role: "companion" }).select("_id name email").sort({ name: 1 }).lean(),
      User.find({ role: "customer" }).select("_id name email").sort({ name: 1 }).lean(),
    ]);

    const currentBookingIds = reportBookings.map((booking) => booking._id);
    const previousBookingIds = previousBookings.map((booking) => booking._id);
    const allBookingIds = [...currentBookingIds, ...previousBookingIds];
    const allCompanionIds = [...new Set(
      [...reportBookings, ...previousBookings]
        .map((booking) => getIdKey(booking.companionId))
        .filter(Boolean),
    )];
    const [paidPayments, reviews, companionProfiles] = await Promise.all([
      Payment.find({ bookingId: { $in: allBookingIds }, status: "paid" })
        .select("bookingId amount platformFee companionEarning baseAmount penaltyAmount paidAmount method status paidAt createdAt")
        .lean(),
      Review.find({ bookingId: { $in: allBookingIds } })
        .select("bookingId companionId rating tags createdAt")
        .lean(),
      CompanionProfile.find({ userId: { $in: allCompanionIds } })
        .select("userId workingShift workingDays unavailableDates")
        .lean(),
    ]);

    const paidPaymentByBookingId = new Map(
      paidPayments.map((payment) => [getIdKey(payment.bookingId), payment]),
    );
    const attachPayment = (booking) => ({
      ...booking,
      payment: toPaymentDto(paidPaymentByBookingId.get(getIdKey(booking._id)), "admin"),
    });
    const reportBookingsWithPayment = reportBookings.map(attachPayment);
    const previousBookingsWithPayment = previousBookings.map(attachPayment);
    const currentBookingIdSet = new Set(currentBookingIds.map(getIdKey));
    const previousBookingIdSet = new Set(previousBookingIds.map(getIdKey));
    const currentReviews = reviews.filter((review) => currentBookingIdSet.has(getIdKey(review.bookingId)));
    const previousReviews = reviews.filter((review) => previousBookingIdSet.has(getIdKey(review.bookingId)));
    const summary = buildReportSummary({
      bookings: reportBookingsWithPayment,
      reviews: currentReviews,
      companionProfiles,
      range,
    });
    const previousSummary = buildReportSummary({
      bookings: previousBookingsWithPayment,
      reviews: previousReviews,
      companionProfiles,
      range: previousRange,
    });
    const detailBookings = exportAllDetails
      ? reportBookingsWithPayment
      : reportBookingsWithPayment.slice(pagination.skip, pagination.skip + pagination.limit);
    const totalBookings = reportBookingsWithPayment.length;
    const responseLimit = exportAllDetails ? Math.max(totalBookings, 1) : pagination.limit;

    return res.status(200).json({
      range: {
        from: range.from,
        to: range.to,
      },
      pagination: {
        page: pagination.page,
        limit: responseLimit,
        total: totalBookings,
        totalPages: exportAllDetails ? 1 : Math.max(1, Math.ceil(totalBookings / pagination.limit)),
      },
      exportedAllDetails: exportAllDetails,
      summary,
      previousPeriod: {
        range: { from: previousRange.from, to: previousRange.to },
        summary: previousSummary,
      },
      currentSnapshot: { pendingCompanions },
      monthly: buildReportMonthly(reportBookingsWithPayment, range),
      daily: buildReportDaily(reportBookingsWithPayment, range),
      services: buildReportServices(reportBookingsWithPayment),
      companionRows: buildReportCompanions(reportBookingsWithPayment, {
        companionProfiles,
        reviews: currentReviews,
        range,
      }),
      statusCounts: buildReportStatusCounts(reportBookingsWithPayment),
      paymentMethods: buildReportPaymentMethods(reportBookingsWithPayment),
      reviews: buildReportReviews(currentReviews, summary.completed),
      filterOptions: {
        services: filterServices,
        companions: filterCompanions,
        customers: filterCustomers,
      },
      bookings: detailBookings,
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
