import bcrypt from "bcrypt";
import crypto from "node:crypto";
import Booking from "../models/booking.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import Review from "../models/review.models.js";
import User from "../models/user.models.js";
import { sendCompanionAccountEmail } from "../utils/email.js";
import { disconnectUserSockets, getUserOnlineStatuses } from "../socket/location.socket.js";
import { generateOtp, hashOtp, verifyOtp } from "../utils/otp.js";
import {
  getBookingEndTime,
  isTimeOverlapped,
  isWithinCompanionWorkingShift,
  normalizeWorkingShift,
  parseBookingAvailabilityWindow,
  parseInstantBookingAvailabilityWindow,
} from "../utils/companion-availability.js";

const PHONE_OTP_EXPIRES_IN_MS = 10 * 60 * 1000;
const TEMPORARY_PASSWORD_EXPIRES_IN_MS = 24 * 60 * 60 * 1000;
const COMPANION_LOGIN_DOMAIN = "carego.cfd";
const COMPANION_EMAIL_RETRY_LIMIT = 20;
const CONFIRMED_BOOKING_STATUSES = ["accepted", "in_progress"];
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

const normalizeLoginName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const randomCharacter = (characters) => characters[crypto.randomInt(0, characters.length)];

const shuffleSecurely = (characters) => {
  const values = [...characters];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = crypto.randomInt(0, index + 1);
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }
  return values.join("");
};

const generateTemporaryPassword = () => {
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "@#$%&*!";
  const allCharacters = `${lowercase}${uppercase}${digits}${symbols}`;
  const requiredCharacters = [
    randomCharacter(lowercase),
    randomCharacter(uppercase),
    randomCharacter(digits),
    randomCharacter(symbols),
  ];

  while (requiredCharacters.length < 10) {
    requiredCharacters.push(randomCharacter(allCharacters));
  }

  return shuffleSecurely(requiredCharacters);
};

const createCompanionAccount = async (profile) => {
  const applicant = await User.findOne({
    _id: profile.applicantCustomerId,
    role: "customer",
    isActive: true,
    isEmailVerified: true,
  }).select("_id name email phone");
  if (!applicant) {
    const error = new Error("Không tìm thấy tài khoản customer hợp lệ của người đăng ký.");
    error.statusCode = 409;
    throw error;
  }

  const loginName = normalizeLoginName(profile.fullName);
  if (!loginName) {
    const error = new Error("Không thể tạo tên đăng nhập từ họ tên companion.");
    error.statusCode = 400;
    throw error;
  }

  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
  const temporaryPasswordExpiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_EXPIRES_IN_MS);
  let companionUser = null;

  for (let attempt = 0; attempt < COMPANION_EMAIL_RETRY_LIMIT; attempt += 1) {
    const suffix = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
    const accountEmail = `${loginName}${suffix}@${COMPANION_LOGIN_DOMAIN}`;

    try {
      companionUser = await User.create({
        name: profile.fullName,
        email: accountEmail,
        recoveryEmail: applicant.email,
        phone: profile.phone || applicant.phone || "",
        password: hashedPassword,
        role: "companion",
        isActive: true,
        isEmailVerified: true,
        mustChangePassword: true,
        temporaryPasswordExpiresAt,
      });
      break;
    } catch (error) {
      if (error?.code !== 11000 || attempt === COMPANION_EMAIL_RETRY_LIMIT - 1) {
        throw error;
      }
    }
  }

  companionUser.$locals.accountEmailRecipient = applicant.email;
  companionUser.$locals.accountEmailName = applicant.name || profile.fullName;
  companionUser.$locals.temporaryPassword = temporaryPassword;
  companionUser.$locals.temporaryPasswordExpiresAt = temporaryPasswordExpiresAt;

  return companionUser;
};

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
const toIdString = (value) => {
  if (!value) return "";
  return String(value?._id || value);
};

const getUnavailableCompanionIds = async ({ companionIds, start, end, bookingMode, now = new Date() }) => {
  if (!companionIds.length) return new Set();

  const availabilityFilter = [{ status: { $in: CONFIRMED_BOOKING_STATUSES } }];
  if (bookingMode === "instant") {
    availabilityFilter.push({
      status: "pending",
      bookingMode: "instant",
      offerExpiresAt: { $gt: now },
    });
  }
  const bookings = await Booking.find({
    companionId: { $in: companionIds },
    $or: availabilityFilter,
    startTime: { $lt: end },
  }).select("companionId startTime durationHours");

  return new Set(
    bookings
      .filter((booking) =>
        isTimeOverlapped(start, end, new Date(booking.startTime), getBookingEndTime(booking)),
      )
      .map((booking) => String(booking.companionId)),
  );
};

const getCompanionProfileForAuth = async (userId) =>
  CompanionProfile.findOne({ userId }).select(
    "vettingStatus fullName phone phoneVerifiedAt workingShift university major skills serviceAreas ratingAverage ratingCount completedBookings",
  );

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
  message: "Cần có ảnh CCCD mặt trước và mặt sau hợp lệ để duyệt hồ sơ người đồng hành.",
  fields,
});

export const getCompanions = async (req, res) => {
  try {
    const bookingMode = req.query?.bookingMode === "instant" ? "instant" : "scheduled";
    const hasAvailabilityQuery = req.query?.startTime || req.query?.durationHours;
    const availabilityWindow = hasAvailabilityQuery
      ? bookingMode === "instant"
        ? parseInstantBookingAvailabilityWindow({
            startTime: req.query.startTime,
            durationHours: req.query.durationHours,
          })
        : parseBookingAvailabilityWindow({
            startTime: req.query.startTime,
            durationHours: req.query.durationHours,
            requireFuture: true,
          })
      : null;
    if (availabilityWindow?.error) {
      return res.status(400).json({ message: availabilityWindow.error });
    }

    const companionFilter = {
      vettingStatus: "approved",
      phoneVerifiedAt: { $ne: null },
    };
    if (req.user?.role === "customer") {
      companionFilter.applicantCustomerId = { $ne: getRequestUserId(req) };
    }

    const companions = await CompanionProfile.find(companionFilter)
      .select("userId fullName gender university major skills workingShift serviceAreas ratingAverage ratingCount completedBookings")
      .populate({
        path: "userId",
        select: "name avatar isActive",
        match: { role: "companion", isActive: true, isEmailVerified: true },
      })
      .sort({ ratingAverage: -1, completedBookings: -1 });

    const activeCompanions = companions.filter((companion) => companion.userId);
    if (!availabilityWindow) {
      return res.status(200).json({ companions: activeCompanions });
    }

    const onlineStatuses = bookingMode === "instant" ? getUserOnlineStatuses() : {};
    const shiftMatchedCompanions = activeCompanions.filter((companion) => {
      const companionId = String(companion.userId._id || companion.userId);
      return (
        (bookingMode !== "instant" || onlineStatuses[companionId]?.isOnline) &&
        isWithinCompanionWorkingShift(
          companion.workingShift,
          availabilityWindow.start,
          availabilityWindow.durationHours,
        )
      );
    });
    const unavailableIds = await getUnavailableCompanionIds({
      companionIds: shiftMatchedCompanions.map((companion) => companion.userId._id || companion.userId),
      start: availabilityWindow.start,
      end: availabilityWindow.end,
      bookingMode,
    });
    const availableCompanions = shiftMatchedCompanions.filter(
      (companion) => !unavailableIds.has(String(companion.userId._id || companion.userId)),
    );

    return res.status(200).json({
      companions: availableCompanions,
      availability: {
        bookingMode,
        startTime: availabilityWindow.start,
        endTime: availabilityWindow.end,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getCompanionById = async (req, res) => {
  try {
    const companion = await CompanionProfile.findOne({
      _id: req.params.id,
      vettingStatus: "approved",
      phoneVerifiedAt: { $ne: null },
    }).select("+applicantCustomerId userId fullName gender university major skills workingShift serviceAreas ratingAverage ratingCount completedBookings").populate({
      path: "userId",
      select: "name avatar isActive",
      match: { role: "companion", isActive: true, isEmailVerified: true },
    });
    if (!companion || !companion.userId) {
      return res.status(404).json({ message: "Không tìm thấy người đồng hành." });
    }
    if (
      req.user?.role === "customer" &&
      toIdString(companion.applicantCustomerId) === getRequestUserId(req)
    ) {
      return res.status(404).json({ message: "Không tìm thấy người đồng hành." });
    }
    const companionPayload = companion.toObject();
    delete companionPayload.applicantCustomerId;

    return res.status(200).json({ companion: companionPayload });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getCompanionOnlineStatuses = async (req, res) => {
  try {
    const companions = await CompanionProfile.find({
      vettingStatus: "approved",
      phoneVerifiedAt: { $ne: null },
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
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
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
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const applyForCompanion = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const {
      name,
      phone,
      fullName,
      gender,
      dateOfBirth,
      university,
      major,
      skills,
      documents,
      serviceAreas,
      workingShift,
    } = req.body;

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }
    if (currentUser.role !== "customer") {
      return res.status(403).json({ message: "Chỉ tài khoản customer mới có thể đăng ký companion." });
    }

    const existingProfile = await CompanionProfile.findOne({
      $or: [{ applicantCustomerId: userId }, { userId }],
    });
    if (existingProfile) {
      return res.status(409).json({ message: "Hồ sơ người đồng hành đã tồn tại." });
    }

    const cleanFullName = String(fullName || name || currentUser.name || "").trim();
    if (!cleanFullName) {
      return res.status(400).json({ message: "Vui lòng nhập họ tên đầy đủ." });
    }

    const normalizedDocuments = normalizeCompanionDocuments(documents);
    const missingDocuments = getMissingApprovalDocuments(normalizedDocuments);
    if (missingDocuments.length > 0) {
      return res.status(400).json(buildApprovalDocumentError(missingDocuments));
    }

    const companionProfile = await CompanionProfile.create({
      applicantCustomerId: userId,
      fullName: cleanFullName,
      phone: String(phone || currentUser.phone || "").trim(),
      gender,
      dateOfBirth,
      university,
      major,
      skills: normalizeTextList(skills),
      documents: normalizedDocuments,
      serviceAreas: normalizeTextList(serviceAreas),
      workingShift: normalizeWorkingShift(workingShift),
      vettingStatus: "pending",
    });

    const user = await User.findById(userId).select("-password -refreshToken -__V");
    const companionApplication = companionProfile.toObject();
    delete companionApplication.applicantCustomerId;

    return res.status(201).json({
      message: "Hồ sơ người đồng hành đã được gửi và đang chờ quản trị viên phê duyệt.",
      user,
      companionApplication,
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
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
      workingShift,
    } = req.body;

    if (!name || !email || !password || !fullName) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ tên hiển thị, họ tên, email và mật khẩu." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã được sử dụng." });
    }

    const normalizedDocuments = normalizeCompanionDocuments(documents);
    const hasApprovalDocuments = getMissingApprovalDocuments(normalizedDocuments).length === 0;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: normalizedEmail,
      recoveryEmail: normalizedEmail,
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
      workingShift: normalizeWorkingShift(workingShift),
      vettingStatus: hasApprovalDocuments ? "approved" : "pending",
      reviewedBy: hasApprovalDocuments ? getRequestUserId(req) : null,
      reviewedAt: hasApprovalDocuments ? new Date() : null,
      rejectionReason: "",
    });

    return res.status(201).json({
      message: hasApprovalDocuments
        ? "Tạo tài khoản người đồng hành thành công."
        : "Đã tạo tài khoản người đồng hành và đang chờ duyệt giấy tờ.",
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
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const adminGetCompanions = async (req, res) => {
  try {
    const companions = await CompanionProfile.find().select("+applicantCustomerId")
      .populate("userId", "name email phone avatar isActive")
      .populate("applicantCustomerId", "name email phone")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ companions });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const updateMyCompanionProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, phone, university, major, skills, serviceAreas, workingShift } = req.body;

    const profileUpdates = {};
    if (fullName !== undefined) {
      const cleanFullName = String(fullName).trim();
      if (!cleanFullName) {
        return res.status(400).json({ message: "Vui lòng nhập họ tên đầy đủ." });
      }
      profileUpdates.fullName = cleanFullName;
    }
    if (phone !== undefined) {
      profileUpdates.phone = String(phone).trim();
    }
    if (workingShift !== undefined) {
      profileUpdates.workingShift = normalizeWorkingShift(workingShift);
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
      .select("vettingStatus fullName phone university major skills serviceAreas")
      .lean();

    if (!currentProfile) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người đồng hành." });
    }

    if (hasReapprovalProfileChanges(currentProfile, profileUpdates)) {
      profileUpdates.vettingStatus = "pending";
      profileUpdates.reviewedBy = null;
      profileUpdates.reviewedAt = null;
      profileUpdates.rejectionReason = "";
    }

    if (
      Object.hasOwn(profileUpdates, "phone") &&
      normalizeComparableText(profileUpdates.phone) !== normalizeComparableText(currentProfile.phone)
    ) {
      profileUpdates.phoneVerifiedAt = null;
      profileUpdates.phoneVerificationOtpHash = "";
      profileUpdates.phoneVerificationOtpExpires = null;
    }

    const profile = await CompanionProfile.findOneAndUpdate(
      { userId },
      profileUpdates,
      { new: true, runValidators: true },
    ).select(
      "vettingStatus fullName phone phoneVerifiedAt workingShift university major skills serviceAreas ratingAverage ratingCount completedBookings",
    );

    if (!profile) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người đồng hành." });
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
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    if (currentProfile.vettingStatus === "approved" && profile.vettingStatus !== "approved") {
      disconnectUserSockets(userId, "companion profile requires approval again");
    }

    return res.status(200).json({
      message: "Cập nhật hồ sơ người đồng hành thành công.",
      user,
      companionProfile: profile,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const requestMyCompanionPhoneOtp = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const phone = String(req.body?.phone || "").trim();
    if (!phone) {
      return res.status(400).json({ message: "Vui lòng nhập số điện thoại để xác minh." });
    }

    const profile = await CompanionProfile.findOne({ userId }).select(
      "+phoneVerificationOtpHash +phoneVerificationOtpExpires phone",
    );
    if (!profile) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người đồng hành." });
    }

    const otp = generateOtp();
    profile.phone = phone;
    profile.phoneVerifiedAt = null;
    profile.phoneVerificationOtpHash = await hashOtp(otp);
    profile.phoneVerificationOtpExpires = new Date(Date.now() + PHONE_OTP_EXPIRES_IN_MS);
    await profile.save();
    await User.findByIdAndUpdate(userId, { phone });

    return res.status(200).json({
      message: "Đã tạo mã OTP xác minh số điện thoại.",
      mockOtp: otp,
      expiresAt: profile.phoneVerificationOtpExpires,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const verifyMyCompanionPhoneOtp = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const otp = String(req.body?.otp || "").trim();
    if (!otp) {
      return res.status(400).json({ message: "Vui lòng nhập mã OTP." });
    }

    const profile = await CompanionProfile.findOne({ userId }).select(
      "+phoneVerificationOtpHash +phoneVerificationOtpExpires phone",
    );
    if (!profile) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người đồng hành." });
    }

    if (!profile.phoneVerificationOtpHash || !profile.phoneVerificationOtpExpires) {
      return res.status(400).json({ message: "Vui lòng yêu cầu mã OTP trước khi xác minh." });
    }

    if (profile.phoneVerificationOtpExpires < new Date()) {
      return res.status(400).json({ message: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." });
    }

    const isMatched = await verifyOtp(otp, profile.phoneVerificationOtpHash);
    if (!isMatched) {
      return res.status(400).json({ message: "Mã OTP không đúng." });
    }

    profile.phoneVerifiedAt = new Date();
    profile.phoneVerificationOtpHash = "";
    profile.phoneVerificationOtpExpires = null;
    await profile.save();

    const user = await User.findByIdAndUpdate(
      userId,
      { phone: profile.phone },
      { new: true, runValidators: true },
    ).select("-password -refreshToken -__V");
    const companionProfile = await getCompanionProfileForAuth(userId);

    return res.status(200).json({
      message: "Xác minh số điện thoại thành công.",
      user,
      companionProfile,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const adminUpdateCompanion = async (req, res) => {
  try {
    const currentProfile = await CompanionProfile.findById(req.params.id).lean();
    if (!currentProfile) {
      return res.status(404).json({ message: "Không tìm thấy người đồng hành." });
    }

    const updates = { ...req.body };
    const hasStatusUpdate = Object.hasOwn(updates, "vettingStatus");
    if (
      hasStatusUpdate &&
      normalizeVettingStatus(updates.vettingStatus) !== normalizeVettingStatus(currentProfile.vettingStatus)
    ) {
      return res.status(400).json({
        message: "Vui lòng sử dụng chức năng cập nhật trạng thái để duyệt hoặc khóa companion.",
      });
    }
    const rejectionReason = normalizeRejectionReason(
      updates.rejectionReason ?? updates.reason ?? updates.adminNote,
    );
    delete updates.reviewedBy;
    delete updates.reviewedAt;
    delete updates.rejectionReason;
    delete updates.reason;
    delete updates.adminNote;

    if (Object.hasOwn(updates, "phone")) {
      updates.phone = String(updates.phone || "").trim();
      if (normalizeComparableText(updates.phone) !== normalizeComparableText(currentProfile.phone)) {
        updates.phoneVerifiedAt = null;
        updates.phoneVerificationOtpHash = "";
        updates.phoneVerificationOtpExpires = null;
      }
    }
    if (Object.hasOwn(updates, "workingShift")) {
      updates.workingShift = normalizeWorkingShift(updates.workingShift);
    }
    if (Object.hasOwn(updates, "skills")) {
      updates.skills = normalizeTextList(updates.skills);
    }
    if (Object.hasOwn(updates, "serviceAreas")) {
      updates.serviceAreas = normalizeTextList(updates.serviceAreas);
    }
    if (Object.hasOwn(updates, "fullName")) {
      updates.fullName = String(updates.fullName || "").trim();
      if (!updates.fullName) {
        return res.status(400).json({ message: "Vui lòng nhập họ tên đầy đủ." });
      }
    }

    const currentVettingStatus = normalizeVettingStatus(currentProfile.vettingStatus);
    const nextVettingStatus = hasStatusUpdate
      ? normalizeVettingStatus(updates.vettingStatus)
      : currentVettingStatus;
    const isStatusChange = hasStatusUpdate && currentVettingStatus !== nextVettingStatus;

    if (
      hasStatusUpdate &&
      !Object.hasOwn(COMPANION_VETTING_STATUS_TRANSITIONS, nextVettingStatus)
    ) {
      return res.status(400).json({ message: "Trạng thái kiểm duyệt không hợp lệ." });
    }

    if (hasStatusUpdate && !canTransitionVettingStatus(currentVettingStatus, nextVettingStatus)) {
      return res.status(409).json({ message: "Không thể chuyển hồ sơ người đồng hành sang trạng thái này." });
    }

    if (hasStatusUpdate) {
      updates.vettingStatus = nextVettingStatus;
    }

    if (isStatusChange && nextVettingStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({ message: "Vui lòng nhập lý do khi từ chối hồ sơ người đồng hành." });
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
      return res.status(409).json({ message: "Trạng thái hồ sơ đã thay đổi. Vui lòng thử lại." });
    }

    if (Object.hasOwn(updates, "phone")) {
      await User.findByIdAndUpdate(profile.userId?._id || profile.userId, { phone: profile.phone }, { runValidators: true });
    }

    if (isStatusChange && nextVettingStatus !== "approved") {
      disconnectUserSockets(profile.userId?._id || profile.userId, "companion approval status changed");
    }

    return res
      .status(200)
      .json({ message: "Cập nhật người đồng hành thành công.", companion: profile });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const adminUpdateCompanionStatus = async (req, res) => {
  let provisionedUser = null;
  let provisioningCommitted = false;

  try {
    const { vettingStatus } = req.body;
    const nextVettingStatus = normalizeVettingStatus(vettingStatus);
    const rejectionReason = normalizeRejectionReason(
      req.body?.rejectionReason ?? req.body?.reason ?? req.body?.adminNote,
    );
    if (!Object.hasOwn(COMPANION_VETTING_STATUS_TRANSITIONS, nextVettingStatus)) {
      return res.status(400).json({ message: "Trạng thái kiểm duyệt không hợp lệ." });
    }

    const profile = await CompanionProfile.findById(req.params.id).select("+applicantCustomerId");
    if (!profile) {
      return res.status(404).json({ message: "Không tìm thấy người đồng hành." });
    }

    const currentVettingStatus = normalizeVettingStatus(profile.vettingStatus);
    const isStatusChange = currentVettingStatus !== nextVettingStatus;
    if (!canTransitionVettingStatus(currentVettingStatus, nextVettingStatus)) {
      return res.status(409).json({ message: "Không thể chuyển hồ sơ người đồng hành sang trạng thái này." });
    }

    if (isStatusChange && nextVettingStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({ message: "Vui lòng nhập lý do khi từ chối hồ sơ người đồng hành." });
    }

    if (nextVettingStatus === "approved") {
      const missingDocuments = getMissingApprovalDocuments(profile.documents);
      if (missingDocuments.length > 0) {
        return res.status(400).json(buildApprovalDocumentError(missingDocuments));
      }
    }

    if (isStatusChange && nextVettingStatus === "approved" && !profile.userId) {
      if (!profile.applicantCustomerId) {
        return res.status(409).json({
          message: "Hồ sơ chưa liên kết với customer đăng ký nên không thể cấp tài khoản companion.",
        });
      }
      provisionedUser = await createCompanionAccount(profile);
    }

    const updatedProfile = await CompanionProfile.findOneAndUpdate(
      { _id: profile._id, vettingStatus: profile.vettingStatus },
      {
        vettingStatus: nextVettingStatus,
        ...(provisionedUser ? { userId: provisionedUser._id } : {}),
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
      if (provisionedUser) {
        await User.deleteOne({ _id: provisionedUser._id, mustChangePassword: true });
        provisionedUser = null;
      }
      return res.status(409).json({ message: "Trạng thái hồ sơ đã thay đổi. Vui lòng thử lại." });
    }

    if (provisionedUser) {
      try {
        await sendCompanionAccountEmail({
          to: provisionedUser.$locals.accountEmailRecipient,
          name: provisionedUser.$locals.accountEmailName,
          accountEmail: provisionedUser.email,
          temporaryPassword: provisionedUser.$locals.temporaryPassword,
          expiresAt: provisionedUser.$locals.temporaryPasswordExpiresAt,
        });
      } catch (emailError) {
        await Promise.all([
          CompanionProfile.updateOne(
            { _id: updatedProfile._id, userId: provisionedUser._id },
            {
              $set: {
                vettingStatus: profile.vettingStatus,
                reviewedBy: profile.reviewedBy || null,
                reviewedAt: profile.reviewedAt || null,
                rejectionReason: profile.rejectionReason || "",
              },
              $unset: { userId: "" },
            },
          ).catch(() => {}),
          User.deleteOne({ _id: provisionedUser._id, mustChangePassword: true }).catch(() => {}),
        ]);
        provisionedUser = null;
        return res.status(502).json({
          message: "Không gửi được email cấp tài khoản companion. Hồ sơ chưa được duyệt, vui lòng thử lại.",
          error: emailError.message,
        });
      }
    }
    provisioningCommitted = Boolean(provisionedUser);

    if (isStatusChange && nextVettingStatus !== "approved") {
      disconnectUserSockets(updatedProfile.userId?._id || updatedProfile.userId, "companion approval status changed");
    }

    return res
      .status(200)
      .json({
        message: provisionedUser
          ? "Duyệt hồ sơ thành công. Tài khoản companion đã được gửi đến email cá nhân của người đăng ký."
          : "Cập nhật trạng thái người đồng hành thành công.",
        companion: updatedProfile,
      });
  } catch (error) {
    if (provisionedUser && !provisioningCommitted) {
      await User.deleteOne({ _id: provisionedUser._id, mustChangePassword: true }).catch(() => {});
    }
    const statusCode = error.statusCode || 500;
    return res
      .status(statusCode)
      .json({
        message: error.statusCode ? error.message : "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
        error: error.message,
      });
  }
};
