import bcrypt from "bcrypt";
import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
import Booking from "../models/booking.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import User from "../models/user.models.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
dotenv.config();

const password = process.env.SEED_PASSWORD || "CareGo@123";
const legacyCustomerSeedCount = 21;

export const legacyCustomerJoinedAtByEmail = {
  "hoanganh@gmail.com": "2026-06-02T03:18:21.000Z",
  "minhchau@gmail.com": "2026-06-05T08:42:36.000Z",
  "thanhbinh@gmail.com": "2026-06-08T02:27:49.000Z",
  "thuhuong@gmail.com": "2026-06-11T09:13:24.000Z",
  "quockhanh@gmail.com": "2026-06-14T04:56:31.000Z",
  "ngocmai@gmail.com": "2026-06-17T07:34:18.000Z",
  "ducanh@gmail.com": "2026-06-20T01:49:43.000Z",
  "thuylinh@gmail.com": "2026-06-23T10:21:37.000Z",
  "giabao@gmail.com": "2026-06-26T05:38:52.000Z",
  "thanhtam@gmail.com": "2026-06-29T08:16:29.000Z",
  "minhtuan@gmail.com": "2026-07-02T03:44:17.000Z",
  "kimoanh@gmail.com": "2026-07-06T09:27:41.000Z",
  "haidang@gmail.com": "2026-07-10T02:53:26.000Z",
  "baongoc@gmail.com": "2026-07-14T07:19:48.000Z",
  "quangvinh@gmail.com": "2026-07-18T04:36:33.000Z",
  "khanhvy@gmail.com": "2026-07-23T10:08:22.000Z",
  "thanhcong@gmail.com": "2026-07-28T05:47:39.000Z",
  "myduyen@gmail.com": "2026-08-01T03:26:51.000Z",
  "anhkhoa@gmail.com": "2026-08-03T08:14:27.000Z",
  "ngocdiep@gmail.com": "2026-08-05T02:41:36.000Z",
  "minhtri@gmail.com": "2026-08-07T09:32:18.000Z",
};

export const customersSeed = [
  { name: "Nguyễn Hoàng Anh", email: "hoanganh@gmail.com", phone: "0979502094" },
  { name: "Trần Minh Châu", email: "minhchau@gmail.com", phone: "0983647152" },
  { name: "Lê Thanh Bình", email: "thanhbinh@gmail.com", phone: "0917254836" },
  { name: "Phạm Thu Hương", email: "thuhuong@gmail.com", phone: "0908462715" },
  { name: "Võ Quốc Khánh", email: "quockhanh@gmail.com", phone: "0935718246" },
  { name: "Đặng Ngọc Mai", email: "ngocmai@gmail.com", phone: "0946827351" },
  { name: "Bùi Đức Anh", email: "ducanh@gmail.com", phone: "0964138275" },
  { name: "Đỗ Thùy Linh", email: "thuylinh@gmail.com", phone: "0972851364" },
  { name: "Hồ Gia Bảo", email: "giabao@gmail.com", phone: "0987162534" },
  { name: "Ngô Thanh Tâm", email: "thanhtam@gmail.com", phone: "0913648275" },
  { name: "Dương Minh Tuấn", email: "minhtuan@gmail.com", phone: "0905724618" },
  { name: "Lý Kim Oanh", email: "kimoanh@gmail.com", phone: "0938172645" },
  { name: "Nguyễn Hải Đăng", email: "haidang@gmail.com", phone: "0942517836" },
  { name: "Trần Bảo Ngọc", email: "baongoc@gmail.com", phone: "0967384251" },
  { name: "Lê Quang Vinh", email: "quangvinh@gmail.com", phone: "0974628153" },
  { name: "Phạm Khánh Vy", email: "khanhvy@gmail.com", phone: "0981257364" },
  { name: "Võ Thành Công", email: "thanhcong@gmail.com", phone: "0918463725" },
  { name: "Đặng Mỹ Duyên", email: "myduyen@gmail.com", phone: "0907382516" },
  { name: "Bùi Anh Khoa", email: "anhkhoa@gmail.com", phone: "0932648175" },
  { name: "Đỗ Ngọc Diệp", email: "ngocdiep@gmail.com", phone: "0947152836" },
  { name: "Hồ Minh Trí", email: "minhtri@gmail.com", phone: "0965827413" },
  // Synthetic demo profiles with plausible, non-sequential public-facing data.
  {
    name: "Nguyễn Thị Thùy Dung",
    email: "ngthuydung91@gmail.com",
    phone: "0325847169",
    joinedAt: "2025-08-12T02:15:00.000Z",
  },
  {
    name: "Trần Quốc Đạt",
    email: "tranqdat88@gmail.com",
    phone: "0337264951",
    joinedAt: "2025-08-21T08:40:00.000Z",
  },
  {
    name: "Lê Ngọc Hân",
    email: "lengochan.92@gmail.com",
    phone: "0348152679",
    joinedAt: "2025-09-03T04:25:00.000Z",
  },
  {
    name: "Phạm Trung Kiên",
    email: "phamtrungkien89@gmail.com",
    phone: "0356429187",
    joinedAt: "2025-09-17T11:10:00.000Z",
  },
  {
    name: "Võ Thị Mỹ Hạnh",
    email: "myhanh.vo93@gmail.com",
    phone: "0369517428",
    joinedAt: "2025-09-29T03:50:00.000Z",
  },
  {
    name: "Đặng Anh Tuấn",
    email: "danganhtuan87@gmail.com",
    phone: "0372846159",
    joinedAt: "2025-10-08T09:35:00.000Z",
  },
  {
    name: "Bùi Khánh Linh",
    email: "khanhlinh.bui94@gmail.com",
    phone: "0387169254",
    joinedAt: "2025-10-19T06:20:00.000Z",
  },
  {
    name: "Đỗ Minh Quân",
    email: "dominhquan90@gmail.com",
    phone: "0395284176",
    joinedAt: "2025-10-31T01:45:00.000Z",
  },
  {
    name: "Hồ Thanh Thảo",
    email: "hothanhthao.95@gmail.com",
    phone: "0703826159",
    joinedAt: "2025-11-09T10:05:00.000Z",
  },
  {
    name: "Ngô Đức Huy",
    email: "ngoduchuy1988@gmail.com",
    phone: "0769152843",
    joinedAt: "2025-11-18T05:30:00.000Z",
  },
  {
    name: "Dương Bảo Trâm",
    email: "baotram.duong93@gmail.com",
    phone: "0774268195",
    joinedAt: "2025-11-27T12:15:00.000Z",
  },
  {
    name: "Lý Hoàng Nam",
    email: "lyhoangnam86@gmail.com",
    phone: "0782639517",
    joinedAt: "2025-12-06T02:55:00.000Z",
  },
  {
    name: "Nguyễn Gia Linh",
    email: "nguyengialinh.96@gmail.com",
    phone: "0798514263",
    joinedAt: "2025-12-14T07:20:00.000Z",
  },
  {
    name: "Trần Nhật Minh",
    email: "nhatminh.tran91@gmail.com",
    phone: "0813759264",
    joinedAt: "2025-12-23T03:10:00.000Z",
  },
  {
    name: "Lê Thảo Vy",
    email: "thaovy.le94@gmail.com",
    phone: "0826941735",
    joinedAt: "2026-01-04T09:45:00.000Z",
  },
  {
    name: "Phạm Quang Hưng",
    email: "phamquanghung89@gmail.com",
    phone: "0835276419",
    joinedAt: "2026-01-13T04:35:00.000Z",
  },
  {
    name: "Võ Ngọc Ánh",
    email: "ngocanh.vo95@gmail.com",
    phone: "0849163527",
    joinedAt: "2026-01-22T11:25:00.000Z",
  },
  {
    name: "Đặng Tuấn Phong",
    email: "dang.tuanphong90@gmail.com",
    phone: "0852647193",
    joinedAt: "2026-02-02T01:40:00.000Z",
  },
  {
    name: "Bùi Mai Anh",
    email: "maianh.bui97@gmail.com",
    phone: "0867381945",
    joinedAt: "2026-02-11T08:10:00.000Z",
  },
  {
    name: "Đỗ Quốc Bảo",
    email: "doquocbao1987@gmail.com",
    phone: "0884129675",
    joinedAt: "2026-02-19T05:55:00.000Z",
  },
  {
    name: "Hồ Phương Nhi",
    email: "phuongnhi.ho96@gmail.com",
    phone: "0893751248",
    joinedAt: "2026-02-28T10:30:00.000Z",
  },
  {
    name: "Ngô Thành Đạt",
    email: "ngothanhdat92@gmail.com",
    phone: "0906842715",
    joinedAt: "2026-03-07T02:20:00.000Z",
  },
  {
    name: "Dương Khả Hân",
    email: "khahan.duong98@gmail.com",
    phone: "0915278463",
    joinedAt: "2026-03-15T07:50:00.000Z",
  },
  {
    name: "Lý Minh Hoàng",
    email: "lyminhhoang89@gmail.com",
    phone: "0937184256",
    joinedAt: "2026-03-24T04:05:00.000Z",
  },
  {
    name: "Nguyễn Thu Trang",
    email: "thutrang.nguyen93@gmail.com",
    phone: "0943267851",
    joinedAt: "2026-04-01T09:20:00.000Z",
  },
  {
    name: "Trần Đình Phúc",
    email: "trandinhphuc88@gmail.com",
    phone: "0968154372",
    joinedAt: "2026-04-10T03:45:00.000Z",
  },
  {
    name: "Lê Hải Yến",
    email: "haiyen.le95@gmail.com",
    phone: "0973648251",
    joinedAt: "2026-04-18T11:05:00.000Z",
  },
  {
    name: "Phạm Đức Thịnh",
    email: "phamducthinh91@gmail.com",
    phone: "0985271364",
    joinedAt: "2026-04-27T06:35:00.000Z",
  },
  {
    name: "Võ Kim Ngân",
    email: "kimngan.vo97@gmail.com",
    phone: "0329614758",
    joinedAt: "2026-05-05T01:25:00.000Z",
  },
  {
    name: "Đặng Minh Khôi",
    email: "dangminhkhoi90@gmail.com",
    phone: "0334187692",
    joinedAt: "2026-05-13T08:55:00.000Z",
  },
  {
    name: "Bùi Ngọc Thảo",
    email: "ngocthao.bui94@gmail.com",
    phone: "0346725189",
    joinedAt: "2026-05-21T04:15:00.000Z",
  },
  {
    name: "Đỗ Anh Dũng",
    email: "doanhdung1986@gmail.com",
    phone: "0358194267",
    joinedAt: "2026-05-30T10:40:00.000Z",
  },
  {
    name: "Hồ Quỳnh Như",
    email: "quynhnhu.ho98@gmail.com",
    phone: "0362749518",
    joinedAt: "2026-06-06T02:35:00.000Z",
  },
  {
    name: "Ngô Quang Vũ",
    email: "ngoquangvu89@gmail.com",
    phone: "0379513864",
    joinedAt: "2026-06-13T07:15:00.000Z",
  },
  {
    name: "Dương Tường Vi",
    email: "tuongvi.duong96@gmail.com",
    phone: "0384627195",
    joinedAt: "2026-06-19T05:20:00.000Z",
  },
  {
    name: "Lý Quốc Cường",
    email: "lyquoccuong87@gmail.com",
    phone: "0398152746",
    joinedAt: "2026-06-25T11:30:00.000Z",
  },
  {
    name: "Nguyễn Bích Ngọc",
    email: "bichngoc.nguyen95@gmail.com",
    phone: "0706419285",
    joinedAt: "2026-06-30T03:05:00.000Z",
  },
].map((customer) => ({
  ...customer,
  joinedAt: customer.joinedAt || legacyCustomerJoinedAtByEmail[customer.email],
}));

const obsoleteCustomersSeed = [
  { email: "thaonhi@gmail.com", sequence: "22" },
  { email: "quocviet@gmail.com", sequence: "23" },
  { email: "thanhha@gmail.com", sequence: "24" },
  { email: "tuankiet@gmail.com", sequence: "25" },
  { email: "ngochan@gmail.com", sequence: "26" },
  { email: "ducthinh@gmail.com", sequence: "27" },
  { email: "quynhnhu@gmail.com", sequence: "28" },
  { email: "minhnhat@gmail.com", sequence: "29" },
  { email: "hoaian@gmail.com", sequence: "30" },
  { email: "phuongthao@gmail.com", sequence: "31" },
  { email: "quoctrung@gmail.com", sequence: "32" },
  { email: "ngocanh@gmail.com", sequence: "33" },
  { email: "giahuy@gmail.com", sequence: "34" },
  { email: "thutrang@gmail.com", sequence: "35" },
];

const buildCustomerEmailCandidates = ({ email, sequence }) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0];
  return [
    normalizedEmail,
    `${localPart}.carego${sequence}@gmail.com`,
    `customer${sequence}@carego.test`,
  ];
};

export const cleanupObsoleteCustomerUsers = async () => {
  const cleanup = {
    deletedCount: 0,
    skipped: [],
  };

  for (const obsoleteCustomer of obsoleteCustomersSeed) {
    const emailCandidates = buildCustomerEmailCandidates(obsoleteCustomer);
    const users = await User.find({ role: "customer", email: { $in: emailCandidates } }).select("_id email");

    for (const user of users) {
      const [bookingCount, elderCount] = await Promise.all([
        Booking.countDocuments({ customerId: user._id }),
        ElderProfile.countDocuments({ customerId: user._id }),
      ]);

      if (bookingCount > 0 || elderCount > 0) {
        cleanup.skipped.push({
          email: user.email,
          bookingCount,
          elderCount,
        });
        continue;
      }

      const result = await User.deleteOne({ _id: user._id, role: "customer" });
      cleanup.deletedCount += result.deletedCount || 0;
    }
  }

  return cleanup;
};

export const seedCustomerUsers = async () => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const cleanup = await cleanupObsoleteCustomerUsers();

  for (const [index, customer] of customersSeed.entries()) {
    const { joinedAt, ...customerProfile } = customer;
    const email = customer.email.trim().toLowerCase();
    const sequence = String(index + 1).padStart(2, "0");
    const previousEmail = `${email.split("@")[0]}.carego${sequence}@gmail.com`;
    const legacyEmail = `customer${sequence}@carego.test`;
    const emailCandidates = index < legacyCustomerSeedCount
      ? [email, previousEmail, legacyEmail]
      : [email];
    const existingUser = await User.findOne({ email: { $in: emailCandidates } });
    const user = await User.findOneAndUpdate(
      existingUser ? { _id: existingUser._id } : { email },
      {
        $set: {
          ...customerProfile,
          email,
          recoveryEmail: email,
          password: hashedPassword,
          role: "customer",
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
        },
        $unset: {
          pendingPasswordHash: "",
          passwordChangeOtpHash: "",
          passwordChangeOtpExpires: "",
          resetPasswordToken: "",
          resetPasswordExpries: "",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    if (joinedAt) {
      const joinedAtDate = new Date(joinedAt);
      if (Number.isNaN(joinedAtDate.getTime())) {
        throw new Error(`Invalid joinedAt for ${email}`);
      }
      await User.collection.updateOne(
        { _id: user._id },
        { $set: { createdAt: joinedAtDate } },
      );
    }
  }

  return {
    seededCount: customersSeed.length,
    cleanup,
  };
};

const run = async () => {
  if (!process.argv.includes("--yes")) {
    throw new Error("This script adds or updates customer seed data. Run with --yes to confirm.");
  }

  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is required");
  }

  await mongoose.connect(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DB_NAME || "carego",
  });

  const { seededCount, cleanup } = await seedCustomerUsers();
  console.log("Database:", mongoose.connection.name);
  console.log("Customer seed mode: additive upsert");
  console.log("Customers:", seededCount);
  console.log("Obsolete customers deleted:", cleanup.deletedCount);
  if (cleanup.skipped.length > 0) {
    console.log("Obsolete customers skipped:", cleanup.skipped.map((item) =>
      `${item.email} (${item.bookingCount} bookings, ${item.elderCount} elders)`
    ).join(", "));
  }
  console.log("Seed password:", process.env.SEED_PASSWORD ? "from SEED_PASSWORD" : password);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
