import {
  generateAccessToken,
  generateRefreshToken,
} from "../middlleware/jwt.js";
import jwt from "jsonwebtoken";
import User from "../models/user.models.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

//signup
export const signupController = async (req, res) => {
  //logic xử lý đăng ký người dùng sẽ được đặt ở đây
  //account, email , password, confirm password
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name,email,password are required",
      });
    }
    // kiểm tra email đã tòn tại trong db chưa
    const existingUser = await User.findOne({ email });
    console.log(existingUser);
    //findOne: tìm 1 document trong collection User thỏa mãn điều kiện
    if (existingUser) {
      return res.status(400).json({
        message: "email already existing",
      });
    }
    console.log(name, email, password);
    //phải mã hóa password trước khi lưu vào database
    const hashedPassword = await bcrypt.hash(password, 10); // 10 là số lần băm, càng cao thì càng an toàn nhưng tốn thời gian hơn

    const newUser = new User({
      name: name,
      email: email,
      password: hashedPassword,
    });
    await newUser.save();
    return res.status(201).json({
      message: "register success fully",
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
      },
    });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "internal sever error", error: error.message });
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
    return res.status(200).json({ user: user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "internal server erro", error: error.message });
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
    const resetUrl = `http://localhost:3000/api/auth/reset-password/${resetToken}`;

    //gửi email chứa link đặt lại mật khẩu
    // sử dụng dịch vụ email như SendGrid, Mailgun, AWS SES,...
    //Nội dung email có thể là link đến trang đặt lại mật khẩu kèm theo token
    console.log(`reset your password by clicking the link ${resetUrl}`);
    return res.status(200).json({
      message: "password reset link has been seent your emai" + `${resetUrl}`,
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
