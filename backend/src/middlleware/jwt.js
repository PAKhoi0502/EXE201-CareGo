import jwt from "jsonwebtoken";

export const generateAccessToken = (user, role) =>
  jwt.sign({ userId: user._id, role: role }, process.env.JWT_SECRET_KEY, {
    expiresIn: "3d",
  });
export const generateRefreshToken = (user) =>
  jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY_REFRESH, {
    expiresIn: "7d",
  });

// thời gian sống của token có thể tùy chỉnh theo yêu cầu của ứng dụng
//thường thì accessToken có thời gian ngắn hơn refresh Token
//Access token: dùng để xác thực người dùng khi họ gửi yêu cầu đến server
//refresh token: dùng để lấy accesstoken mới khi accesstoken hết hạn mà không cần phải đăng nhập lại
