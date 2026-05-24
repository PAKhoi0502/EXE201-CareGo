import bcrypt from "bcrypt";
import CompanionProfile from "../models/companion-profile.models.js";
import PendingRegistration from "../models/pending-registration.models.js";
import Review from "../models/review.models.js";
import User from "../models/user.models.js";
import { sendOtpEmail } from "../utils/email.js";
import { getUserOnlineStatuses } from "../socket/location.socket.js";
import { generateOtp, hashOtp } from "../utils/otp.js";

const OTP_EXPIRES_IN_MS = 10 * 60 * 1000;
const PENDING_REGISTER_EXPIRES_IN_MS = 30 * 60 * 1000;

export const getCompanions = async (req, res) => {
  try {
    const companions = await CompanionProfile.find({
      vettingStatus: "approved",
    })
      .populate("userId", "name email phone avatar isActive")
      .sort({ ratingAverage: -1, completedBookings: -1 });

    return res.status(200).json({ companions });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const getCompanionById = async (req, res) => {
  try {
    const companion = await CompanionProfile.findOne({
      _id: req.params.id,
      vettingStatus: "approved",
    }).populate("userId", "name email phone avatar isActive");
    if (!companion) {
      return res.status(404).json({ message: "companion not found" });
    }

    return res.status(200).json({ companion });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const getCompanionOnlineStatuses = async (req, res) => {
  try {
    const companions = await CompanionProfile.find({
      vettingStatus: "approved",
    }).select("userId");
    const allowedIds = new Set(companions.map((item) => String(item.userId)));
    const onlineStatuses = Object.fromEntries(
      Object.entries(getUserOnlineStatuses()).filter(([userId]) =>
        allowedIds.has(String(userId)),
      ),
    );

    return res.status(200).json({ onlineStatuses });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const getCompanionReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ companionId: req.params.id })
      .populate("customerId", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ reviews });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const registerCompanion = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      fullName,
      gender,
      dateOfBirth,
      university,
      major,
      skills,
      documents,
      serviceAreas,
    } = req.body;

    if (!name || !email || !password || !fullName) {
      return res
        .status(400)
        .json({ message: "name, email, password and fullName are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "email already existing" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        name,
        email: normalizedEmail,
        phone,
        password: hashedPassword,
        role: "companion",
        emailOtpHash: await hashOtp(otp),
        emailOtpExpires: new Date(Date.now() + OTP_EXPIRES_IN_MS),
        expiresAt: new Date(Date.now() + PENDING_REGISTER_EXPIRES_IN_MS),
        companionProfile: {
          fullName,
          phone,
          gender,
          dateOfBirth,
          university,
          major,
          skills,
          documents,
          serviceAreas,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await sendOtpEmail({ to: normalizedEmail, name, otp });

    return res.status(201).json({
      message:
        "companion registered, please verify email otp and wait for admin approval",
      email: normalizedEmail,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const adminCreateCompanion = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      fullName,
      gender,
      dateOfBirth,
      university,
      major,
      skills,
      documents,
      serviceAreas,
    } = req.body;

    if (!name || !email || !password || !fullName) {
      return res
        .status(400)
        .json({ message: "name, email, password and fullName are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "email already existing" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "companion",
      isEmailVerified: true,
    });

    const profile = await CompanionProfile.create({
      userId: user._id,
      fullName,
      phone,
      gender,
      dateOfBirth,
      university,
      major,
      skills,
      documents,
      serviceAreas,
      vettingStatus: "approved",
    });

    return res.status(201).json({
      message: "companion account created",
      companion: profile,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const adminGetCompanions = async (req, res) => {
  try {
    const companions = await CompanionProfile.find()
      .populate("userId", "name email phone avatar isActive")
      .sort({ createdAt: -1 });

    return res.status(200).json({ companions });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const adminUpdateCompanion = async (req, res) => {
  try {
    const profile = await CompanionProfile.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      },
    );
    if (!profile) {
      return res.status(404).json({ message: "companion not found" });
    }

    return res
      .status(200)
      .json({ message: "companion updated", companion: profile });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const adminUpdateCompanionStatus = async (req, res) => {
  try {
    const { vettingStatus } = req.body;
    const allowed = ["pending", "approved", "rejected", "suspended"];
    if (!allowed.includes(vettingStatus)) {
      return res.status(400).json({ message: "invalid vettingStatus" });
    }

    const profile = await CompanionProfile.findByIdAndUpdate(
      req.params.id,
      { vettingStatus },
      { new: true },
    );
    if (!profile) {
      return res.status(404).json({ message: "companion not found" });
    }

    return res
      .status(200)
      .json({ message: "companion status updated", companion: profile });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};
