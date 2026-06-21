import Booking from "../models/booking.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import Payment from "../models/payment.models.js";
import Service from "../models/service.models.js";
import User from "../models/user.models.js";
import { ensureDefaultBlogPosts } from "./blog.controller.js";
import BlogPost from "../models/blog-post.models.js";
import { getCompanionGpsStatuses, getUserOnlineStatuses } from "../socket/location.socket.js";

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
          .select("title slug category viewCount ratingSum ratingCount comments")
          .sort({ viewCount: -1 })
          .lean(),
      ]);

    const bookingsByStatus = await Booking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

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
        commentCount: post.comments?.length || 0,
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
    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select(
      "-password -refreshToken",
    );
    if (!user) {
      return res.status(404).json({ message: "user not found" });
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
