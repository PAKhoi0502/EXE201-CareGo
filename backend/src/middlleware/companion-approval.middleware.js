import CompanionProfile from "../models/companion-profile.models.js";

export const requireApprovedCompanion = async (req, res, next) => {
  try {
    if (req.user.role !== "companion") {
      return next();
    }

    const profile = await CompanionProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      return res.status(403).json({ message: "Không tìm thấy hồ sơ người đồng hành." });
    }

    if (profile.vettingStatus !== "approved") {
      return res.status(403).json({
        message: "Tài khoản người đồng hành đang chờ quản trị viên phê duyệt.",
        vettingStatus: profile.vettingStatus,
      });
    }

    req.companionProfile = profile;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};
