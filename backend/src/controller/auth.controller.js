import {
  generateAccessToken,
  generateRefreshToken,
} from "../middlleware/jwt.js";
import jwt from "jsonwebtoken";
import CompanionProfile from "../models/companion-profile.models.js";
import PendingRegistration from "../models/pending-registration.models.js";
import User from "../models/user.models.js";
import { sendOtpEmail, sendPasswordResetEmail } from "../utils/email.js";
import { generateOtp, hashOtp, verifyOtp } from "../utils/otp.js";
import { createCustomerWelcomeNotification } from "../utils/notifications.js";
import { saveConsentReceipts, validateLegalAcceptances } from "../utils/legal-consent.js";
import { recordAuditLogLater } from "../utils/audit-log.js";
import { emitAdminCustomerCreatedAlert } from "../utils/admin-alerts.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

const OTP_EXPIRES_IN_MS = 10 * 60 * 1000;
const PENDING_REGISTER_EXPIRES_IN_MS = 30 * 60 * 1000;
const PASSWORD_RESET_RESPONSE = {
  message: "Nếu email đã được đăng ký, liên kết đặt lại mật khẩu đã được gửi.",
};
const REFRESH_TOKEN_COOKIE = "refreshToken";
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const COMPANION_PROFILE_FIELDS =
  "vettingStatus fullName phone phoneVerifiedAt workingShift applicantType dateOfBirth university major graduationYear yearsOfExperience qualificationDescription skills serviceAreas rejectionReason userId reviewedAt";

const recordAuthAudit = (req, user, action, outcome, statusCode) => {
  const routeByAction = {
    "auth.login": "login",
    "auth.logout": "logout",
    "auth.refresh": "refresh-token",
    "auth.signup.verify": "verify-email",
    "auth.email.verify": "verify-email",
  };
  recordAuditLogLater({
    actor: {
      userId: user?._id,
      name: user?.name,
      email: user?.email,
      role: user?.role,
    },
    source: "http",
    action,
    method: "POST",
    route: `/api/auth/${routeByAction[action] || "activity"}`,
    resourceType: "auth",
    resourceId: user?._id,
    outcome,
    statusCode,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
  });
};

const isStrongPassword = (value) =>
  typeof value === "string" &&
  value.length >= 8 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

const getCompanionContext = async (user) => {
  if (user.role === "companion") {
    return {
      companionProfile: await CompanionProfile.findOne({ userId: user._id }).select(
        COMPANION_PROFILE_FIELDS,
      ),
      companionApplication: null,
    };
  }

  if (user.role === "customer") {
    return {
      companionProfile: null,
      companionApplication: await CompanionProfile.findOne({
        applicantCustomerId: user._id,
      })
        .select(COMPANION_PROFILE_FIELDS)
        .populate("userId", "email"),
    };
  }

  return { companionProfile: null, companionApplication: null };
};

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: REFRESH_TOKEN_MAX_AGE_MS,
});

const getClearRefreshTokenCookieOptions = () => {
  const { maxAge, ...options } = getRefreshTokenCookieOptions();
  return options;
};

export const attachEmailOtp = async (user) => {
  const otp = generateOtp();
  user.emailOtpHash = await hashOtp(otp);
  user.emailOtpExpires = new Date(Date.now() + OTP_EXPIRES_IN_MS);
  await user.save();
  await sendOtpEmail({ to: user.email, name: user.name, otp });
};

const createOtpPayload = async () => {
  const otp = generateOtp();
  return {
    otp,
    emailOtpHash: await hashOtp(otp),
    emailOtpExpires: new Date(Date.now() + OTP_EXPIRES_IN_MS),
  };
};

//signup
export const signupController = async (req, res) => {
  //logic xử lý đăng ký người dùng sẽ được đặt ở đây
  //account, email , password, confirm password
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu.",
      });
    }
    const consentValidation = validateLegalAcceptances({
      acceptances: req.body.legalAcceptances,
      flow: "CUSTOMER_SIGNUP",
      req,
    });
    if (consentValidation.error) {
      return res.status(400).json({ message: consentValidation.error, code: "LEGAL_ACCEPTANCE_REQUIRED" });
    }
    // kiểm tra email đã tòn tại trong db chưa
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    //findOne: tìm 1 document trong collection User thỏa mãn điều kiện
    if (existingUser) {
      return res.status(400).json({
        message: "Email đã được sử dụng.",
      });
    }
    //phải mã hóa password trước khi lưu vào database
    const hashedPassword = await bcrypt.hash(password, 10); // 10 là số lần băm, càng cao thì càng an toàn nhưng tốn thời gian hơn

    const otpPayload = await createOtpPayload();
    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        name,
        email: normalizedEmail,
        phone: phone || "",
        password: hashedPassword,
        role: "customer",
        legalAcceptances: consentValidation.acceptances,
        emailOtpHash: otpPayload.emailOtpHash,
        emailOtpExpires: otpPayload.emailOtpExpires,
        expiresAt: new Date(Date.now() + PENDING_REGISTER_EXPIRES_IN_MS),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await sendOtpEmail({ to: normalizedEmail, name, otp: otpPayload.otp });
    return res.status(201).json({
      message: "Đăng ký thành công. Vui lòng xác thực email bằng mã OTP.",
      email: normalizedEmail,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

//login
export const loginController = async (req, res) => {
  const { email, password } = req.body;
  try {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    // console.log("tìm trong db", user);
    if (!user) {
      return res.status(400).json({ message: "Email hoặc mật khẩu không đúng." });
    }
    if (!user.isActive) {
      recordAuthAudit(req, user, "auth.login", "failure", 403);
      return res.status(403).json({ message: "Tài khoản đã bị vô hiệu hóa." });
    }
    if (!user.isEmailVerified) {
      recordAuthAudit(req, user, "auth.login", "failure", 403);
      return res.status(403).json({
        message: "Email chưa được xác thực.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      recordAuthAudit(req, user, "auth.login", "failure", 400);
      return res.status(400).json({ message: "Mật khẩu không đúng." });
    }
    if (
      user.mustChangePassword &&
      user.temporaryPasswordExpiresAt &&
      user.temporaryPasswordExpiresAt <= new Date()
    ) {
      recordAuthAudit(req, user, "auth.login", "failure", 403);
      return res.status(403).json({
        message: "Mật khẩu tạm thời đã hết hạn. Vui lòng sử dụng chức năng quên mật khẩu.",
        code: "TEMPORARY_PASSWORD_EXPIRED",
      });
    }

    //tạo JWT access token
    const accessToken = generateAccessToken(user, user.role);
    const refreshToken = generateRefreshToken(user);
    // console.log("accesstoken:", accessToken);
    // console.log("refreshToken:", refreshToken);
    //lưu refresh token vào database
    user.refreshToken = refreshToken;
    await User.findByIdAndUpdate(
      user._id,
      { refreshToken: refreshToken },
      { new: true },
    );
    // {new:true} để trả về document đã được cập nhật
    //lưu refresh token vào cookies
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getRefreshTokenCookieOptions());
    const { companionProfile, companionApplication } = await getCompanionContext(user);
    recordAuthAudit(req, user, "auth.login", "success", 200);
    // Signature: dùng để xác thực token, đảm bảo token không bị thay đổi
    return res.status(200).json({
      message: "Đăng nhập thành công.",
      accessToken: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        mustChangePassword: user.mustChangePassword,
        temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt,
        companionProfile,
        companionApplication,
      },
    });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const verifyEmailOtpController = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Vui lòng nhập email và mã OTP." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const pending = await PendingRegistration.findOne({ email: normalizedEmail });
      if (!pending) {
        return res.status(404).json({ message: "Không tìm thấy tài khoản." });
      }

      if (!pending.emailOtpHash || !pending.emailOtpExpires || pending.emailOtpExpires < new Date()) {
        return res.status(400).json({ message: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." });
      }

      const isMatched = await verifyOtp(otp, pending.emailOtpHash);
      if (!isMatched) {
        return res.status(400).json({ message: "Mã OTP không đúng." });
      }

      if (!pending.legalAcceptances?.length) {
        return res.status(409).json({
          message: "Điều khoản đăng ký đã thay đổi. Vui lòng quay lại đăng ký và xác nhận phiên bản hiện tại.",
          code: "LEGAL_ACCEPTANCE_REQUIRED",
        });
      }

      const createdUser = await User.create({
        name: pending.name,
        email: pending.email,
        recoveryEmail: pending.email,
        phone: pending.phone,
        password: pending.password,
        role: pending.role,
        isEmailVerified: true,
      });

      try {
        await saveConsentReceipts({
          userId: createdUser._id,
          acceptances: pending.legalAcceptances.map((acceptance) => acceptance.toObject?.() || acceptance),
        });
      } catch (consentError) {
        await User.deleteOne({ _id: createdUser._id });
        throw consentError;
      }

      if (pending.role === "companion" && pending.companionProfile) {
        await CompanionProfile.create({
          ...pending.companionProfile,
          userId: createdUser._id,
          vettingStatus: "pending",
        });
      }

      await PendingRegistration.deleteOne({ _id: pending._id });

      if (createdUser.role === "customer") {
        await createCustomerWelcomeNotification(createdUser);
        emitAdminCustomerCreatedAlert(createdUser);
      }

      recordAuthAudit(req, createdUser, "auth.signup.verify", "success", 200);

      return res.status(200).json({
        message: "Xác thực email thành công.",
        user: {
          id: createdUser._id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
        },
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({ message: "Email đã được xác thực trước đó." });
    }

    if (!user.emailOtpHash || !user.emailOtpExpires || user.emailOtpExpires < new Date()) {
      return res.status(400).json({ message: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." });
    }

    const isMatched = await verifyOtp(otp, user.emailOtpHash);
    if (!isMatched) {
      return res.status(400).json({ message: "Mã OTP không đúng." });
    }

    user.isEmailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    await user.save();

    recordAuthAudit(req, user, "auth.email.verify", "success", 200);

    return res.status(200).json({ message: "Xác thực email thành công." });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const resendEmailOtpController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const pending = await PendingRegistration.findOne({ email: normalizedEmail });
      if (!pending) {
        return res.status(404).json({ message: "Không tìm thấy tài khoản." });
      }

      const otpPayload = await createOtpPayload();
      pending.emailOtpHash = otpPayload.emailOtpHash;
      pending.emailOtpExpires = otpPayload.emailOtpExpires;
      pending.expiresAt = new Date(Date.now() + PENDING_REGISTER_EXPIRES_IN_MS);
      await pending.save();
      await sendOtpEmail({ to: pending.email, name: pending.name, otp: otpPayload.otp });

      return res.status(200).json({ message: "Đã gửi lại mã OTP.", email: pending.email });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email đã được xác thực trước đó." });
    }

    await attachEmailOtp(user);
    return res.status(200).json({ message: "Đã gửi lại mã OTP.", email: user.email });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

//logout xóa refresh token
export const logoutController = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    let user = null;

    if (refreshToken) {
      user = await User.findOne({ refreshToken });
      if (user) {
        await User.findByIdAndUpdate(
          user._id,
          { refreshToken: null },
          { new: true },
        );
      }
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE, getClearRefreshTokenCookieOptions());
    if (user) {
      recordAuthAudit(req, user, "auth.logout", "success", 200);
    }
    return res
      .status(200)
      .json({ success: true, message: "Đăng xuất thành công." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

//nhiệm vụ của refresh token giúp người dùng lấy accesstoken mới khi accesstoken hết hạn mà ko cần phải đăng nhập lại
export const refreshTokenController = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!refreshToken) {
    return res.status(401).json({ message: "Không tìm thấy mã làm mới phiên đăng nhập." });
  }

  try {
    const user = await User.findOne({ refreshToken });
    if (!user) {
      res.clearCookie(REFRESH_TOKEN_COOKIE, getClearRefreshTokenCookieOptions());
      return res.status(403).json({ message: "Phiên đăng nhập không hợp lệ." });
    }

    if (!user.isActive) {
      recordAuthAudit(req, user, "auth.refresh", "failure", 403);
      return res.status(403).json({ message: "Tài khoản đã bị vô hiệu hóa." });
    }

    if (!user.isEmailVerified) {
      recordAuthAudit(req, user, "auth.refresh", "failure", 403);
      return res.status(403).json({
        message: "Email chưa được xác thực.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    const decode = jwt.verify(refreshToken, process.env.JWT_SECRET_KEY_REFRESH);

    if (user._id.toString() !== decode.userId) {
      recordAuthAudit(req, user, "auth.refresh", "failure", 403);
      res.clearCookie(REFRESH_TOKEN_COOKIE, getClearRefreshTokenCookieOptions());
      return res.status(403).json({ message: "Phiên đăng nhập không hợp lệ." });
    }

    // tạo accesstoken mới
    const newAccessToken = generateAccessToken(user, user.role);
    recordAuthAudit(req, user, "auth.refresh", "success", 200);
    return res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.clearCookie(REFRESH_TOKEN_COOKIE, getClearRefreshTokenCookieOptions());
      return res.status(403).json({ message: "Phiên đăng nhập không hợp lệ." });
    }

    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  const userId = req.user.userId;
  try {
    const user = await User.findById(userId).select(
      "-password -refreshToken -__v",
    ); // loại bỏ trường password và refreshToken khỏi kết quả
    if (!user) {
      return res.status(400).json({ message: "Không tìm thấy tài khoản." });
    }
    const { companionProfile, companionApplication } = await getCompanionContext(user);

    return res.status(200).json({ user, companionProfile, companionApplication });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const updateCurrentUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, avatarUrl } = req.body;

    const updates = {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(400).json({ message: "Vui lòng nhập họ tên." });
      }
      updates.name = cleanName;
    }
    if (phone !== undefined) {
      updates.phone = String(phone).trim();
    }
    if (avatarUrl !== undefined) {
      updates.avatar = {
        url: String(avatarUrl).trim(),
        alt: "user avatar",
      };
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("-password -refreshToken -__v");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    const { companionProfile, companionApplication } = await getCompanionContext(user);

    return res.status(200).json({ message: "Cập nhật hồ sơ thành công.", user, companionProfile, companionApplication });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const requestCurrentUserPasswordOtp = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới." });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    const isMatched = await bcrypt.compare(currentPassword, user.password);
    if (!isMatched) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
    }

    const otpPayload = await createOtpPayload();
    user.pendingPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChangeOtpHash = otpPayload.emailOtpHash;
    user.passwordChangeOtpExpires = otpPayload.emailOtpExpires;
    await user.save();

    const destinationEmail = user.recoveryEmail || user.email;
    await sendOtpEmail({ to: destinationEmail, name: user.name, otp: otpPayload.otp });

    return res.status(200).json({
      message: "Mã OTP đã được gửi đến email của bạn.",
      email: destinationEmail,
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const changeCurrentUserPassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "Vui lòng nhập mã OTP." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    if (!user.pendingPasswordHash || !user.passwordChangeOtpHash || !user.passwordChangeOtpExpires) {
      return res.status(400).json({ message: "Vui lòng yêu cầu mã OTP đổi mật khẩu trước." });
    }

    if (user.passwordChangeOtpExpires < new Date()) {
      return res.status(400).json({ message: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." });
    }

    const isMatched = await verifyOtp(otp, user.passwordChangeOtpHash);
    if (!isMatched) {
      return res.status(400).json({ message: "Mã OTP không đúng." });
    }

    user.password = user.pendingPasswordHash;
    user.pendingPasswordHash = undefined;
    user.passwordChangeOtpHash = undefined;
    user.passwordChangeOtpExpires = undefined;
    user.mustChangePassword = false;
    user.temporaryPasswordExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: "Đổi mật khẩu thành công." });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const changeInitialPassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Vui lòng nhập mật khẩu tạm thời và mật khẩu mới." });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu xác nhận không khớp." });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: "Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm chữ thường, chữ hoa, số và ký tự đặc biệt.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    if (!user.mustChangePassword) {
      return res.status(400).json({ message: "Tài khoản này không cần đổi mật khẩu lần đầu." });
    }

    if (user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= new Date()) {
      return res.status(403).json({
        message: "Mật khẩu tạm thời đã hết hạn. Vui lòng sử dụng chức năng quên mật khẩu.",
        code: "TEMPORARY_PASSWORD_EXPIRED",
      });
    }

    const isMatched = await bcrypt.compare(currentPassword, user.password);
    if (!isMatched) {
      return res.status(400).json({ message: "Mật khẩu tạm thời không đúng." });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "Mật khẩu mới phải khác mật khẩu tạm thời." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.temporaryPasswordExpiresAt = null;
    user.pendingPasswordHash = undefined;
    user.passwordChangeOtpHash = undefined;
    user.passwordChangeOtpExpires = undefined;
    await user.save();

    const nextUser = await User.findById(userId).select("-password -refreshToken -__v");
    const { companionProfile, companionApplication } = await getCompanionContext(nextUser);

    return res.status(200).json({
      message: "Đổi mật khẩu lần đầu thành công.",
      user: nextUser,
      companionProfile,
      companionApplication,
    });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

// forget password
export const forgetpasswordController = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Vui lòng nhập email." });
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      //tạo token đặt lại mật khẩu
      const resetToken = crypto.randomBytes(32).toString("hex"); // tạo chuỗi ngẫu nhiên 32 bytes và chuyển thành chuỗi hex
      const resetTokenExpries = Date.now() + 5 * 60 * 1000; // token sẽ hết hạn sau 5 phút

      //lưu token và thời hạn sẽ hết hạn vào database
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpries = resetTokenExpries;
      await user.save();
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      try {
        await sendPasswordResetEmail({
          to: user.recoveryEmail || user.email,
          name: user.name,
          resetUrl,
        });
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
    }

    return res.status(200).json(PASSWORD_RESET_RESPONSE);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: err.message });
  }
};

//reset password token
export const resetPasswordController = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Vui lòng nhập mật khẩu." });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự." });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpries: { $gt: Date.now() }, //kiểm tra token chưa hết hạn $gt là lớn hơn
    });
    if (!user) {
      return res.status(400).json({ message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    //xóa token và thời gian hết hạn sau khi đặt lại mật khẩu
    user.resetPasswordToken = undefined;
    user.resetPasswordExpries = undefined;
    user.mustChangePassword = false;
    user.temporaryPasswordExpiresAt = null;
    user.pendingPasswordHash = undefined;
    user.passwordChangeOtpHash = undefined;
    user.passwordChangeOtpExpires = undefined;
    await user.save();
    return res
      .status(200)
      .json({ message: "Đặt lại mật khẩu thành công." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};
