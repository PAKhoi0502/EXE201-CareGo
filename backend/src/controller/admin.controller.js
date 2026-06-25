import Booking from "../models/booking.models.js";
import BlogComment from "../models/blog-comment.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import Payment from "../models/payment.models.js";
import Service from "../models/service.models.js";
import User from "../models/user.models.js";
import { ensureDefaultBlogPosts } from "./blog.controller.js";
import BlogPost from "../models/blog-post.models.js";
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

const toDateInputValue = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
};

const getDefaultReportRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * MS_PER_DAY);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
};

const parseReportRange = ({ from, to }) => {
  const defaults = getDefaultReportRange();
  const fromValue = from || defaults.from;
  const toValue = to || defaults.to;

  if (!REPORT_DATE_PATTERN.test(fromValue) || !REPORT_DATE_PATTERN.test(toValue)) {
    return { error: "from and to must use YYYY-MM-DD format" };
  }

  const start = new Date(`${fromValue}T00:00:00.000Z`);
  const end = new Date(`${toValue}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "invalid report date range" };
  }
  if (start > end) {
    return { error: "from must be before or equal to to" };
  }

  return { from: fromValue, to: toValue, start, end };
};

const parseReportPagination = ({ page, limit }) => {
  const pageValue = Number(page || 1);
  const limitValue = Number(limit || REPORT_DETAIL_DEFAULT_LIMIT);

  if (!Number.isInteger(pageValue) || pageValue < 1) {
    return { error: "page must be a positive integer" };
  }
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > REPORT_DETAIL_MAX_LIMIT) {
    return { error: `limit must be between 1 and ${REPORT_DETAIL_MAX_LIMIT}` };
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

const buildReportMonthly = (bookings) => {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - (5 - index));
    return {
      key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`,
      label: new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(date),
      count: 0,
      revenue: 0,
      penalty: 0,
    };
  });

  bookings.forEach((booking) => {
    const date = new Date(booking.createdAt);
    const bucket = months.find((item) => item.key === `${date.getUTCFullYear()}-${date.getUTCMonth()}`);
    if (!bucket) return;

    bucket.count += 1;
    if (booking.payment?.status === "paid") {
      bucket.revenue += getPaymentPaidAmount(booking.payment);
      bucket.penalty += getPaymentPenaltyAmount(booking.payment);
    }
  });

  return months;
};

const buildReportDaily = (bookings, range) => {
  const days = [];
  const cursor = new Date(range.start);

  while (cursor <= range.end && days.length < REPORT_DAILY_LIMIT) {
    days.push({
      key: toDateInputValue(cursor),
      label: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(cursor),
      count: 0,
      caregoRevenue: 0,
      companionEarning: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  bookings.forEach((booking) => {
    const bucket = days.find((item) => item.key === toDateInputValue(booking.createdAt));
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
    await ensureDefaultBlogPosts();

    const [totalUsers, totalCompanions, totalServices, totalBookings, revenueStats, blogStats] =
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
          .lean(),
      ]);

    const bookingsByStatus = await Booking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const blogCommentCounts = await getDashboardBlogCommentCountMap(blogStats);

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
      blogStats: blogStats.map((post) => ({
        ...post,
        ratingAverage: post.ratingCount ? Number((post.ratingSum / post.ratingCount).toFixed(1)) : 0,
        commentCount: blogCommentCounts.get(getIdKey(post._id)) || 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password -refreshToken").sort({ createdAt: -1 });
    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be boolean" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select(
      "-password -refreshToken",
    );
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    if (!user.isActive) {
      disconnectUserSockets(user._id, "account has been disabled");
    }

    return res.status(200).json({ message: "user status updated", user });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getAdminBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("customerId", "name email phone")
      .populate("companionId", "name email phone")
      .populate("elderProfileId")
      .populate("serviceId")
      .sort({ createdAt: -1 })
      .lean();

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
      payment: paymentByBookingId.get(booking._id.toString()) || null,
    }));

    return res.status(200).json({ bookings: bookingsWithPayment });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
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
      createdAt: {
        $gte: range.start,
        $lte: range.end,
      },
    };

    const [reportBookings, totalBookings, detailBookings, pendingCompanions] = await Promise.all([
      Booking.find(bookingFilter)
        .select("companionId serviceId status createdAt addressLocation totalAmount platformFee")
        .populate("companionId", "name email")
        .populate("serviceId", "name")
        .sort({ createdAt: -1 })
        .lean(),
      Booking.countDocuments(bookingFilter),
      Booking.find(bookingFilter)
        .populate("customerId", "name email phone")
        .populate("companionId", "name email phone")
        .populate("elderProfileId")
        .populate("serviceId")
        .sort({ createdAt: -1 })
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
      payment: paidPaymentByBookingId.get(booking._id.toString()) || null,
    }));
    const detailBookingsWithPayment = detailBookings.map((booking) => ({
      ...booking,
      payment: paidPaymentByBookingId.get(booking._id.toString()) || null,
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
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getAdminGpsStatuses = async (req, res) => {
  try {
    return res.status(200).json({ gpsStatuses: getCompanionGpsStatuses() });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getAdminOnlineStatuses = async (req, res) => {
  try {
    return res.status(200).json({ onlineStatuses: getUserOnlineStatuses() });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
