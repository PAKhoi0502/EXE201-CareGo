import CompanionProfile from "../models/companion-profile.models.js";

export const requireApprovedCompanion = async (req, res, next) => {
  try {
    if (req.user.role !== "companion") {
      return next();
    }

    const profile = await CompanionProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      return res.status(403).json({ message: "companion profile not found" });
    }

    if (profile.vettingStatus !== "approved") {
      return res.status(403).json({
        message: "companion account is waiting for admin approval",
        vettingStatus: profile.vettingStatus,
      });
    }

    req.companionProfile = profile;
    next();
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
