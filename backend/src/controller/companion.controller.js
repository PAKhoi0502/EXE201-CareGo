import bcrypt from "bcrypt";
import CompanionProfile from "../models/companion-profile.models.js";
import PendingRegistration from "../models/pending-registration.models.js";
import Review from "../models/review.models.js";
import User from "../models/user.models.js";
import { sendOtpEmail } from "../utils/email.js";
import { disconnectUserSockets, getUserOnlineStatuses } from "../socket/location.socket.js";
import { generateOtp, hashOtp } from "../utils/otp.js";

const OTP_EXPIRES_IN_MS = 10 * 60 * 1000;
const PENDING_REGISTER_EXPIRES_IN_MS = 30 * 60 * 1000;
const COMPANION_DOCUMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const REQUIRED_APPROVAL_DOCUMENT_FIELDS = [
  "citizenIdFrontUrl",
  "citizenIdBackUrl",
];
const COMPANION_VETTING_STATUS_TRANSITIONS = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  suspended: ["approved"],
  rejected: [],
};
const REAPPROVAL_PROFILE_STATUSES = ["approved", "rejected"];
const REAPPROVAL_TEXT_FIELDS = ["fullName", "university", "major"];
const REAPPROVAL_LIST_FIELDS = ["skills", "serviceAreas"];

const normalizeTextList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeVettingStatus = (status) => String(status || "").trim().toLowerCase();

const canTransitionVettingStatus = (currentStatus, nextStatus) =>
  currentStatus === nextStatus ||
  Boolean(COMPANION_VETTING_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus));

const getRequestUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;

const normalizeRejectionReason = (value) => String(value || "").trim();

const normalizeComparableText = (value) => String(value || "").trim();

const areTextListsEqual = (first = [], second = []) => {
  const firstList = normalizeTextList(first);
  const secondList = normalizeTextList(second);
  return firstList.length === secondList.length &&
    firstList.every((item, index) => item === secondList[index]);
};

const hasReapprovalProfileChanges = (currentProfile, profileUpdates) => {
  if (!REAPPROVAL_PROFILE_STATUSES.includes(normalizeVettingStatus(currentProfile?.vettingStatus))) {
    return false;
  }

  const hasTextChange = REAPPROVAL_TEXT_FIELDS.some(
    (field) =>
      Object.hasOwn(profileUpdates, field) &&
      normalizeComparableText(profileUpdates[field]) !== normalizeComparableText(currentProfile?.[field]),
  );
  if (hasTextChange) {
    return true;
  }

  return REAPPROVAL_LIST_FIELDS.some(
    (field) =>
      Object.hasOwn(profileUpdates, field) &&
      !areTextListsEqual(profileUpdates[field], currentProfile?.[field]),
  );
};

const normalizeCompanionDocuments = (documents = {}) => ({
  citizenId: String(documents?.citizenId || "").trim(),
  citizenIdFrontUrl: String(documents?.citizenIdFrontUrl || "").trim(),
  citizenIdBackUrl: String(documents?.citizenIdBackUrl || "").trim(),
  studentCardUrl: String(documents?.studentCardUrl || "").trim(),
  backgroundCheckUrl: String(documents?.backgroundCheckUrl || "").trim(),
});

const isValidImageDataUrl = (value) => {
  const match = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return false;

  const base64Payload = match[1];
  if (base64Payload.length % 4 !== 0) return false;

  const byteLength = Buffer.from(base64Payload, "base64").length;
  return byteLength > 0 && byteLength <= COMPANION_DOCUMENT_IMAGE_MAX_BYTES;
};

const getCloudinaryPathname = (url) => {
  try {
    const parsedUrl = new URL(String(url || "").trim());
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "res.cloudinary.com") {
      return "";
    }

    return decodeURIComponent(parsedUrl.pathname);
  } catch {
    return "";
  }
};

const isTrustedCloudinaryImageUrl = (url) => {
  const pathname = getCloudinaryPathname(url);
  if (!pathname) return false;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (cloudName) {
    return pathname.startsWith(`/${cloudName}/image/upload/`);
  }

  return /^\/[^/]+\/image\/upload\//.test(pathname);
};

const isValidCompanionDocumentImage = (value) => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return false;

  return isValidImageDataUrl(trimmedValue) || isTrustedCloudinaryImageUrl(trimmedValue);
};

const getMissingApprovalDocuments = (documents = {}) =>
  REQUIRED_APPROVAL_DOCUMENT_FIELDS.filter(
    (field) => !isValidCompanionDocumentImage(documents?.[field]),
  );

const buildApprovalDocumentError = (fields) => ({
  message: "valid citizen ID front and back images are required for companion approval",
  fields,
});

export const getCompanions = async (req, res) => {
  try {
    const companions = await CompanionProfile.find({
      vettingStatus: "approved",
    })
      .populate({
        path: "userId",
        select: "name email phone avatar isActive",
        match: { role: "companion", isActive: true, isEmailVerified: true },
      })
      .sort({ ratingAverage: -1, completedBookings: -1 });

    return res.status(200).json({ companions: companions.filter((companion) => companion.userId) });
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
    }).populate({
      path: "userId",
      select: "name email phone avatar isActive",
      match: { role: "companion", isActive: true, isEmailVerified: true },
    });
    if (!companion || !companion.userId) {
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
    const activeCompanionUsers = await User.find({
      _id: { $in: companions.map((item) => item.userId).filter(Boolean) },
      role: "companion",
      isActive: true,
      isEmailVerified: true,
    }).select("_id");
    const allowedIds = new Set(activeCompanionUsers.map((item) => String(item._id)));
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

    const normalizedDocuments = normalizeCompanionDocuments(documents);
    const missingDocuments = getMissingApprovalDocuments(normalizedDocuments);
    if (missingDocuments.length > 0) {
      return res.status(400).json(buildApprovalDocumentError(missingDocuments));
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
          documents: normalizedDocuments,
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

    const normalizedDocuments = normalizeCompanionDocuments(documents);
    const hasApprovalDocuments = getMissingApprovalDocuments(normalizedDocuments).length === 0;
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
      documents: normalizedDocuments,
      serviceAreas,
      vettingStatus: hasApprovalDocuments ? "approved" : "pending",
      reviewedBy: hasApprovalDocuments ? getRequestUserId(req) : null,
      reviewedAt: hasApprovalDocuments ? new Date() : null,
      rejectionReason: "",
    });

    return res.status(201).json({
      message: hasApprovalDocuments
        ? "companion account created"
        : "companion account created and pending document approval",
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
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ companions });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const updateMyCompanionProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, phone, university, major, skills, serviceAreas } = req.body;

    const profileUpdates = {};
    if (fullName !== undefined) {
      const cleanFullName = String(fullName).trim();
      if (!cleanFullName) {
        return res.status(400).json({ message: "fullName is required" });
      }
      profileUpdates.fullName = cleanFullName;
    }
    if (phone !== undefined) {
      profileUpdates.phone = String(phone).trim();
    }
    if (university !== undefined) {
      profileUpdates.university = String(university).trim();
    }
    if (major !== undefined) {
      profileUpdates.major = String(major).trim();
    }
    if (skills !== undefined) {
      profileUpdates.skills = normalizeTextList(skills);
    }
    if (serviceAreas !== undefined) {
      profileUpdates.serviceAreas = normalizeTextList(serviceAreas);
    }

    const currentProfile = await CompanionProfile.findOne({ userId })
      .select("vettingStatus fullName university major skills serviceAreas")
      .lean();

    if (!currentProfile) {
      return res.status(404).json({ message: "companion profile not found" });
    }

    if (hasReapprovalProfileChanges(currentProfile, profileUpdates)) {
      profileUpdates.vettingStatus = "pending";
      profileUpdates.reviewedBy = null;
      profileUpdates.reviewedAt = null;
      profileUpdates.rejectionReason = "";
    }

    const profile = await CompanionProfile.findOneAndUpdate(
      { userId },
      profileUpdates,
      { new: true, runValidators: true },
    ).select(
      "vettingStatus fullName phone university major skills serviceAreas ratingAverage ratingCount completedBookings",
    );

    if (!profile) {
      return res.status(404).json({ message: "companion profile not found" });
    }

    const userUpdates = {};
    if (phone !== undefined) {
      userUpdates.phone = profileUpdates.phone;
    }

    const user = Object.keys(userUpdates).length
      ? await User.findByIdAndUpdate(userId, userUpdates, {
          new: true,
          runValidators: true,
        }).select("-password -refreshToken -__V")
      : await User.findById(userId).select("-password -refreshToken -__V");

    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    if (currentProfile.vettingStatus === "approved" && profile.vettingStatus !== "approved") {
      disconnectUserSockets(userId, "companion profile requires approval again");
    }

    return res.status(200).json({
      message: "companion profile updated",
      user,
      companionProfile: profile,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const adminUpdateCompanion = async (req, res) => {
  try {
    const currentProfile = await CompanionProfile.findById(req.params.id).lean();
    if (!currentProfile) {
      return res.status(404).json({ message: "companion not found" });
    }

    const updates = { ...req.body };
    const hasStatusUpdate = Object.hasOwn(updates, "vettingStatus");
    const rejectionReason = normalizeRejectionReason(
      updates.rejectionReason ?? updates.reason ?? updates.adminNote,
    );
    delete updates.reviewedBy;
    delete updates.reviewedAt;
    delete updates.rejectionReason;
    delete updates.reason;
    delete updates.adminNote;

    const currentVettingStatus = normalizeVettingStatus(currentProfile.vettingStatus);
    const nextVettingStatus = hasStatusUpdate
      ? normalizeVettingStatus(updates.vettingStatus)
      : currentVettingStatus;
    const isStatusChange = hasStatusUpdate && currentVettingStatus !== nextVettingStatus;

    if (
      hasStatusUpdate &&
      !Object.hasOwn(COMPANION_VETTING_STATUS_TRANSITIONS, nextVettingStatus)
    ) {
      return res.status(400).json({ message: "invalid vettingStatus" });
    }

    if (hasStatusUpdate && !canTransitionVettingStatus(currentVettingStatus, nextVettingStatus)) {
      return res.status(409).json({ message: "companion status transition is not allowed" });
    }

    if (hasStatusUpdate) {
      updates.vettingStatus = nextVettingStatus;
    }

    if (isStatusChange && nextVettingStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({ message: "rejectionReason is required when rejecting companion profile" });
    }

    if (isStatusChange) {
      updates.reviewedBy = getRequestUserId(req);
      updates.reviewedAt = new Date();
      updates.rejectionReason = nextVettingStatus === "rejected" ? rejectionReason : "";
    }

    const mergedDocuments = normalizeCompanionDocuments({
      ...(currentProfile.documents || {}),
      ...(updates.documents || {}),
    });
    if (updates.documents !== undefined) {
      updates.documents = mergedDocuments;
    }

    if (nextVettingStatus === "approved") {
      const missingDocuments = getMissingApprovalDocuments(mergedDocuments);
      if (missingDocuments.length > 0) {
        return res.status(400).json(buildApprovalDocumentError(missingDocuments));
      }
    }

    const profileQuery = { _id: req.params.id };
    if (hasStatusUpdate) {
      profileQuery.vettingStatus = currentProfile.vettingStatus;
    }

    const profile = await CompanionProfile.findOneAndUpdate(
      profileQuery,
      updates,
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("userId", "name email phone avatar isActive")
      .populate("reviewedBy", "name email");
    if (!profile) {
      return res.status(409).json({ message: "companion status changed, please retry" });
    }

    if (isStatusChange && nextVettingStatus !== "approved") {
      disconnectUserSockets(profile.userId?._id || profile.userId, "companion approval status changed");
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
    const nextVettingStatus = normalizeVettingStatus(vettingStatus);
    const rejectionReason = normalizeRejectionReason(
      req.body?.rejectionReason ?? req.body?.reason ?? req.body?.adminNote,
    );
    if (!Object.hasOwn(COMPANION_VETTING_STATUS_TRANSITIONS, nextVettingStatus)) {
      return res.status(400).json({ message: "invalid vettingStatus" });
    }

    const profile = await CompanionProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: "companion not found" });
    }

    const currentVettingStatus = normalizeVettingStatus(profile.vettingStatus);
    const isStatusChange = currentVettingStatus !== nextVettingStatus;
    if (!canTransitionVettingStatus(currentVettingStatus, nextVettingStatus)) {
      return res.status(409).json({ message: "companion status transition is not allowed" });
    }

    if (isStatusChange && nextVettingStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({ message: "rejectionReason is required when rejecting companion profile" });
    }

    if (nextVettingStatus === "approved") {
      const missingDocuments = getMissingApprovalDocuments(profile.documents);
      if (missingDocuments.length > 0) {
        return res.status(400).json(buildApprovalDocumentError(missingDocuments));
      }
    }

    const updatedProfile = await CompanionProfile.findOneAndUpdate(
      { _id: profile._id, vettingStatus: profile.vettingStatus },
      {
        vettingStatus: nextVettingStatus,
        ...(isStatusChange
          ? {
              reviewedBy: getRequestUserId(req),
              reviewedAt: new Date(),
              rejectionReason: nextVettingStatus === "rejected" ? rejectionReason : "",
            }
          : {}),
      },
      { new: true, runValidators: true },
    )
      .populate("userId", "name email phone avatar isActive")
      .populate("reviewedBy", "name email");
    if (!updatedProfile) {
      return res.status(409).json({ message: "companion status changed, please retry" });
    }

    if (isStatusChange && nextVettingStatus !== "approved") {
      disconnectUserSockets(updatedProfile.userId?._id || updatedProfile.userId, "companion approval status changed");
    }

    return res
      .status(200)
      .json({ message: "companion status updated", companion: updatedProfile });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};
