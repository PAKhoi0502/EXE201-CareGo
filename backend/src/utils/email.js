import nodemailer from "nodemailer";

const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendOtpEmail = async ({ to, name, otp }) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[DEV OTP] ${to}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "CareGo - Ma xac thuc email",
    text: `Xin chao ${name}, ma OTP CareGo cua ban la ${otp}. Ma co hieu luc trong 10 phut.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>CareGo - Xac thuc email</h2>
        <p>Xin chao ${name},</p>
        <p>Ma OTP cua ban la:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p>
        <p>Ma co hieu luc trong 10 phut.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[DEV RESET PASSWORD] ${to}: ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "CareGo - Dat lai mat khau",
    text: `Xin chao ${name}, vui long mo link sau de dat lai mat khau CareGo: ${resetUrl}. Link co hieu luc trong 10 phut.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>CareGo - Dat lai mat khau</h2>
        <p>Xin chao ${name},</p>
        <p>Ban vua yeu cau dat lai mat khau CareGo.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none">Dat lai mat khau</a></p>
        <p>Link co hieu luc trong 10 phut.</p>
      </div>
    `,
  });
};
