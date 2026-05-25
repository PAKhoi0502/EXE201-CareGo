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
import bcrypt from "bcrypt";
import crypto from "crypto";

const OTP_EXPIRES_IN_MS = 10 * 60 * 1000;
const PENDING_REGISTER_EXPIRES_IN_MS = 30 * 60 * 1000;

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
        message: "name,email,password are required",
      });
    }
    // kiểm tra email đã tòn tại trong db chưa
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    //findOne: tìm 1 document trong collection User thỏa mãn điều kiện
    if (existingUser) {
      return res.status(400).json({
        message: "email already existing",
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
        emailOtpHash: otpPayload.emailOtpHash,
        emailOtpExpires: otpPayload.emailOtpExpires,
        expiresAt: new Date(Date.now() + PENDING_REGISTER_EXPIRES_IN_MS),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await sendOtpEmail({ to: normalizedEmail, name, otp: otpPayload.otp });
    return res.status(201).json({
      message: "register successfully, please verify email otp",
      email: normalizedEmail,
    });
  } catch (error) {
    return res.status(500).json({
      message: "interal server error",
      error: error.message,
    });
  }
};

//login
export const loginController = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    // console.log("tìm trong db", user);
    if (!user) {
      return res.status(400).json({ message: "invalid email or password" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "account is inactive" });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "email is not verified",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      return res.status(400).json({ message: "invalid password" });
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
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, //chỉ cho phép truy cập cookie từ server
      sameSite: "Strict", // ngăn chặn CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });
    // Signature: dùng để xác thực token, đảm bảo token không bị thay đổi
    return res.status(200).json({
      message: "login success",
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companionProfile:
          user.role === "companion"
            ? await CompanionProfile.findOne({ userId: user._id }).select(
                "vettingStatus fullName university major skills",
              )
            : null,
      },
    });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "internal sever error", error: error.message });
  }
};

export const verifyEmailOtpController = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const pending = await PendingRegistration.findOne({ email: normalizedEmail });
      if (!pending) {
        return res.status(404).json({ message: "user not found" });
      }

      if (!pending.emailOtpHash || !pending.emailOtpExpires || pending.emailOtpExpires < new Date()) {
        return res.status(400).json({ message: "otp expired, please request a new otp" });
      }

      const isMatched = await verifyOtp(otp, pending.emailOtpHash);
      if (!isMatched) {
        return res.status(400).json({ message: "invalid otp" });
      }

      const createdUser = await User.create({
        name: pending.name,
        email: pending.email,
        phone: pending.phone,
        password: pending.password,
        role: pending.role,
        isEmailVerified: true,
      });

      if (pending.role === "companion" && pending.companionProfile) {
        await CompanionProfile.create({
          ...pending.companionProfile,
          userId: createdUser._id,
          vettingStatus: "pending",
        });
      }

      await PendingRegistration.deleteOne({ _id: pending._id });

      return res.status(200).json({
        message: "email verified successfully",
        user: {
          id: createdUser._id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
        },
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({ message: "email already verified" });
    }

    if (!user.emailOtpHash || !user.emailOtpExpires || user.emailOtpExpires < new Date()) {
      return res.status(400).json({ message: "otp expired, please request a new otp" });
    }

    const isMatched = await verifyOtp(otp, user.emailOtpHash);
    if (!isMatched) {
      return res.status(400).json({ message: "invalid otp" });
    }

    user.isEmailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "email verified successfully" });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const resendEmailOtpController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const pending = await PendingRegistration.findOne({ email: normalizedEmail });
      if (!pending) {
        return res.status(404).json({ message: "user not found" });
      }

      const otpPayload = await createOtpPayload();
      pending.emailOtpHash = otpPayload.emailOtpHash;
      pending.emailOtpExpires = otpPayload.emailOtpExpires;
      pending.expiresAt = new Date(Date.now() + PENDING_REGISTER_EXPIRES_IN_MS);
      await pending.save();
      await sendOtpEmail({ to: pending.email, name: pending.name, otp: otpPayload.otp });

      return res.status(200).json({ message: "otp resent successfully", email: pending.email });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "email already verified" });
    }

    await attachEmailOtp(user);
    return res.status(200).json({ message: "otp resent successfully", email: user.email });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

//logout xóa refresh token
export const logoutController = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ message: "no refresh token provided" });
    }
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(400).json({ message: "invalid refresh token" });
    }
    console.log("user:", user);
    console.log("user id:", user._id);
    await User.findByIdAndUpdate(
      user._id,
      { refreshToken: null },
      { new: true },
    );
    res.clearCookie("refreshToken"); // xóa refresh token trên cookie
    return res
      .status(200)
      .json({ success: true, message: "logout successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

//nhiệm vụ của refresh token giúp người dùng lấy accesstoken mới khi accesstoken hết hạn mà ko cần phải đăng nhập lại
export const refreshTokenController = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: "no refresh token provided" });
  }

  try {
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(403).json({ message: "invalid refresh token" });
    }

    const decode = jwt.verify(refreshToken, process.env.JWT_SECRET_KEY_REFRESH);

    if (user._id.toString() !== decode.userId) {
      return res.status(403).json({ message: "invalid refresh token" });
    }

    // tạo accesstoken mới
    const newAccessToken = generateAccessToken(user, user.role);
    return res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  console.log("user from token:", req.user);
  const userId = req.user.userId;
  try {
    const user = await User.findById(userId).select(
      "-password -refreshToken -__V",
    ); // loại bỏ trường password và refreshToken khỏi kết quả
    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }
    const companionProfile =
      user.role === "companion"
        ? await CompanionProfile.findOne({ userId }).select(
            "vettingStatus fullName university major skills serviceAreas",
          )
        : null;

    return res.status(200).json({ user: user, companionProfile });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server erro", error: error.message });
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
        return res.status(400).json({ message: "name is required" });
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
    }).select("-password -refreshToken -__V");

    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    const companionProfile =
      user.role === "companion"
        ? await CompanionProfile.findOne({ userId }).select(
            "vettingStatus fullName university major skills serviceAreas",
          )
        : null;

    return res.status(200).json({ message: "profile updated", user, companionProfile });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const requestCurrentUserPasswordOtp = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "new password must be at least 6 characters" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    const isMatched = await bcrypt.compare(currentPassword, user.password);
    if (!isMatched) {
      return res.status(400).json({ message: "current password is incorrect" });
    }

    const otpPayload = await createOtpPayload();
    user.pendingPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChangeOtpHash = otpPayload.emailOtpHash;
    user.passwordChangeOtpExpires = otpPayload.emailOtpExpires;
    await user.save();

    await sendOtpEmail({ to: user.email, name: user.name, otp: otpPayload.otp });

    return res.status(200).json({
      message: "otp has been sent to your email",
      email: user.email,
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const changeCurrentUserPassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "otp is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    if (!user.pendingPasswordHash || !user.passwordChangeOtpHash || !user.passwordChangeOtpExpires) {
      return res.status(400).json({ message: "please request a password change otp first" });
    }

    if (user.passwordChangeOtpExpires < new Date()) {
      return res.status(400).json({ message: "otp expired, please request a new otp" });
    }

    const isMatched = await verifyOtp(otp, user.passwordChangeOtpHash);
    if (!isMatched) {
      return res.status(400).json({ message: "invalid otp" });
    }

    user.password = user.pendingPasswordHash;
    user.pendingPasswordHash = undefined;
    user.passwordChangeOtpHash = undefined;
    user.passwordChangeOtpExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "password changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

// forget password
export const forgetpasswordController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }
    //tạo token đặt lại mật khẩu
    const resetToken = crypto.randomBytes(32).toString("hex"); // tạo chuỗi ngẫu nhiên 32 bytes và chuyển thành chuỗi hex
    const resetTokenExpries = Date.now() + 5 * 60 * 1000; // token sẽ hết hạn sau 5 phút

    //lưu token và thời hạn sẽ hết hạn vào database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpries = resetTokenExpries;
    await user.save();
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    return res.status(200).json({
      message: "password reset link has been sent to your email",
      resetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "interal server error", error: err.message });
  }
};

//reset password token
export const resetPasswordController = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpries: { $gt: Date.now() }, //kiểm tra token chưa hết hạn $gt là lớn hơn
    });
    if (!user) {
      return res.status(400).json({ message: "invalid or expride token" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    //xóa token và thời gian hết hạn sau khi đặt lại mật khẩu
    user.resetPasswordToken = undefined;
    user.resetPasswordExpries = undefined;
    await user.save();
    return res
      .status(200)
      .json({ message: "password has been reset successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "interal server error", error: err.message });
  }
};
