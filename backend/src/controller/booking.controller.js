import Booking from "../models/booking.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import Payment from "../models/payment.models.js";
import Review from "../models/review.models.js";
import Service from "../models/service.models.js";
import ShiftLog from "../models/shift-log.models.js";

const populateBooking = [
  { path: "customerId", select: "name email phone" },
  { path: "elderProfileId" },
  { path: "serviceId" },
  { path: "companionId", select: "name email phone avatar" },
];

const toIdString = (value) => {
  if (!value) {
    return "";
  }

  return (value._id || value).toString();
};

const canAccessBooking = (booking, user) => {
  return (
    user.role === "admin" ||
    toIdString(booking.customerId) === user.userId ||
    toIdString(booking.companionId) === user.userId
  );
};

export const createBooking = async (req, res) => {
  try {
    const {
      elderProfileId,
      serviceId,
      companionId,
      startTime,
      durationHours,
      address,
      addressLocation,
      note,
    } = req.body;

    if (!elderProfileId || !serviceId || !companionId || !startTime || !durationHours || !address) {
      return res.status(400).json({
        message: "elderProfileId, serviceId, companionId, startTime, durationHours and address are required",
      });
    }

    const elder = await ElderProfile.findOne({
      _id: elderProfileId,
      customerId: req.user.userId,
    });
    if (!elder) {
      return res.status(404).json({ message: "elder profile not found" });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: "service not found" });
    }

    const companionProfile = await CompanionProfile.findOne({
      userId: companionId,
      vettingStatus: "approved",
    });
    if (!companionProfile) {
      return res.status(404).json({ message: "approved companion not found" });
    }

    const totalAmount = service.pricePerHour * durationHours;
    const platformFee = Math.round(totalAmount * 0.2);

    const booking = await Booking.create({
      customerId: req.user.userId,
      elderProfileId,
      serviceId,
      companionId,
      startTime,
      durationHours,
      address,
      addressLocation,
      note,
      totalAmount,
      platformFee,
    });

    await ShiftLog.create({
      bookingId: booking._id,
      checklist: service.defaultChecklist?.map((label) => ({ label, done: false })) || [],
    });

    return res.status(201).json({ message: "booking created", booking });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const filter =
      req.user.role === "companion"
        ? { companionId: req.user.userId }
        : { customerId: req.user.userId };

    const bookings = await Booking.find(filter).populate(populateBooking).sort({ createdAt: -1 });
    return res.status(200).json({ bookings });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate(populateBooking);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    const shiftLog = await ShiftLog.findOne({ bookingId: booking._id });
    const payment = await Payment.findOne({ bookingId: booking._id });
    const review = await Review.findOne({ bookingId: booking._id });

    return res.status(200).json({ booking, shiftLog, payment, review });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["accepted", "in_progress", "completed", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "invalid status" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    if (req.user.role === "companion" && toIdString(booking.companionId) !== req.user.userId) {
      return res.status(403).json({ message: "permission denied" });
    }

    booking.status = status;
    await booking.save();

    if (status === "completed") {
      await CompanionProfile.findOneAndUpdate(
        { userId: booking.companionId },
        { $inc: { completedBookings: 1 } },
      );
    }

    return res.status(200).json({ message: "booking status updated", booking });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    booking.status = "cancelled";
    await booking.save();
    return res.status(200).json({ message: "booking cancelled", booking });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const addLocation = async (req, res) => {
  try {
    const { lat, lng, note } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    const shiftLog = await ShiftLog.findOneAndUpdate(
      { bookingId: booking._id },
      { $push: { locations: { lat, lng, note } } },
      { new: true, upsert: true },
    );

    return res.status(200).json({ message: "location added", shiftLog });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const updateShiftLog = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || !canAccessBooking(booking, req.user)) {
      return res.status(404).json({ message: "booking not found" });
    }

    const allowedFields = {};
    const fields = [
      "checkInPhotoUrl",
      "checkOutPhotoUrl",
      "checklist",
      "healthMetrics",
      "companionNote",
    ];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        allowedFields[field] = req.body[field];
      }
    });

    const shiftLog = await ShiftLog.findOneAndUpdate(
      { bookingId: booking._id },
      allowedFields,
      { new: true, upsert: true },
    );

    return res.status(200).json({ message: "shift log updated", shiftLog });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const payBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user.userId,
    });
    if (!booking) {
      return res.status(404).json({ message: "booking not found" });
    }

    const companionEarning = booking.totalAmount - booking.platformFee;
    const payment = await Payment.findOneAndUpdate(
      { bookingId: booking._id },
      {
        bookingId: booking._id,
        customerId: booking.customerId,
        companionId: booking.companionId,
        amount: booking.totalAmount,
        platformFee: booking.platformFee,
        companionEarning,
        method: req.body.method || "prototype",
        status: "paid",
      },
      { new: true, upsert: true },
    );

    booking.status = "paid";
    await booking.save();

    return res.status(200).json({ message: "booking paid", payment, booking });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const createReview = async (req, res) => {
  try {
    const { rating, comment, tags } = req.body;
    if (!rating) {
      return res.status(400).json({ message: "rating is required" });
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user.userId,
    });
    if (!booking) {
      return res.status(404).json({ message: "booking not found" });
    }

    const review = await Review.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      companionId: booking.companionId,
      rating,
      comment,
      tags,
    });

    const stats = await Review.aggregate([
      { $match: { companionId: booking.companionId } },
      {
        $group: {
          _id: "$companionId",
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats[0]) {
      await CompanionProfile.findOneAndUpdate(
        { userId: booking.companionId },
        {
          ratingAverage: Math.round(stats[0].average * 10) / 10,
          ratingCount: stats[0].count,
        },
      );
    }

    return res.status(201).json({ message: "review created", review });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
