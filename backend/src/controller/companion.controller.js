import bcrypt from "bcrypt";
import CompanionProfile from "../models/companion-profile.models.js";
import User from "../models/user.models.js";

export const getCompanions = async (req, res) => {
  try {
    const companions = await CompanionProfile.find({ vettingStatus: "approved" })
      .populate("userId", "name email phone avatar isActive")
      .sort({ ratingAverage: -1, completedBookings: -1 });

    return res.status(200).json({ companions });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
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
    return res.status(500).json({ message: "internal server error", error: error.message });
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
      pricePerHour,
    } = req.body;

    if (!name || !email || !password || !fullName) {
      return res.status(400).json({ message: "name, email, password and fullName are required" });
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
      pricePerHour,
      vettingStatus: "pending",
    });

    return res.status(201).json({
      message: "companion registered and waiting for admin approval",
      companion: profile,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
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
      pricePerHour,
    } = req.body;

    if (!name || !email || !password || !fullName) {
      return res.status(400).json({ message: "name, email, password and fullName are required" });
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
      pricePerHour,
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
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const adminGetCompanions = async (req, res) => {
  try {
    const companions = await CompanionProfile.find()
      .populate("userId", "name email phone avatar isActive")
      .sort({ createdAt: -1 });

    return res.status(200).json({ companions });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const adminUpdateCompanion = async (req, res) => {
  try {
    const profile = await CompanionProfile.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!profile) {
      return res.status(404).json({ message: "companion not found" });
    }

    return res.status(200).json({ message: "companion updated", companion: profile });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
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

    return res.status(200).json({ message: "companion status updated", companion: profile });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
