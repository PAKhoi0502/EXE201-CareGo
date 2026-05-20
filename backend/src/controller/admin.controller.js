import Booking from "../models/booking.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import Payment from "../models/payment.models.js";
import Service from "../models/service.models.js";
import User from "../models/user.models.js";
import { getCompanionGpsStatuses, getUserOnlineStatuses } from "../socket/location.socket.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const [totalUsers, totalCompanions, totalServices, totalBookings, revenueStats] =
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
              revenue: { $sum: "$amount" },
              platformFee: { $sum: "$platformFee" },
              companionEarning: { $sum: "$companionEarning" },
            },
          },
        ]),
      ]);

    const bookingsByStatus = await Booking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      totalUsers,
      totalCompanions,
      totalServices,
      totalBookings,
      revenue: revenueStats[0] || { revenue: 0, platformFee: 0, companionEarning: 0 },
      bookingsByStatus,
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
      .sort({ createdAt: -1 });

    return res.status(200).json({ bookings });
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
