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

const bookingDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });

const getFrontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

const getBookingId = (booking) => {
  if (!booking) return "";
  return (booking._id || booking.id || booking).toString();
};

const formatBookingDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chua xac dinh";
  return bookingDateFormatter.format(date);
};

const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Chua xac dinh";
  return moneyFormatter.format(amount);
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

export const sendCompanionBookingCreatedEmail = async ({
  to,
  name,
  booking,
  elder,
  service,
}) => {
  if (!to) return;

  const bookingId = getBookingId(booking);
  const bookingUrl = bookingId
    ? `${getFrontendUrl()}/companion/bookings/${bookingId}`
    : `${getFrontendUrl()}/companion/bookings`;
  const companionName = name || "ban";
  const serviceName = service?.name || "Dich vu cham soc";
  const elderName = elder?.fullName || elder?.name || "Nguoi than";
  const startTime = formatBookingDateTime(booking?.startTime);
  const duration = Number(booking?.durationHours || 0);
  const totalAmount = formatMoney(booking?.totalAmount);
  const address = booking?.address || "Chua co dia chi";

  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[DEV COMPANION BOOKING] ${to}: ${bookingUrl}`);
    return;
  }

  const detailRows = [
    ["Dich vu", serviceName],
    ["Nguoi than", elderName],
    ["Thoi gian bat dau", startTime],
    ["Thoi luong", duration ? `${duration} gio` : "Chua xac dinh"],
    ["Dia chi", address],
    ["Tong tien ca", totalAmount],
  ];

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "CareGo - Co booking moi",
    text: [
      `Xin chao ${companionName},`,
      "Ban vua nhan duoc mot booking moi tren CareGo.",
      `Dich vu: ${serviceName}`,
      `Nguoi than: ${elderName}`,
      `Thoi gian bat dau: ${startTime}`,
      `Thoi luong: ${duration ? `${duration} gio` : "Chua xac dinh"}`,
      `Dia chi: ${address}`,
      `Tong tien ca: ${totalAmount}`,
      `Xem chi tiet va phan hoi booking tai: ${bookingUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#12312f">
        <h2 style="margin:0 0 12px">CareGo - Co booking moi</h2>
        <p>Xin chao ${escapeHtml(companionName)},</p>
        <p>Ban vua nhan duoc mot booking moi tren CareGo. Vui long kiem tra va phan hoi lich cham soc.</p>
        <table style="border-collapse:collapse;margin:16px 0;width:100%;max-width:560px">
          <tbody>
            ${detailRows
              .map(
                ([label, value]) => `
                  <tr>
                    <td style="border:1px solid #d9f3ee;padding:10px;font-weight:700;background:#f5fbfa;width:150px">${escapeHtml(label)}</td>
                    <td style="border:1px solid #d9f3ee;padding:10px">${escapeHtml(value)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
        <p>
          <a href="${escapeHtml(bookingUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:700">
            Xem booking
          </a>
        </p>
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
