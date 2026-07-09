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
];

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
    const email = customer.email.trim().toLowerCase();
    const sequence = String(index + 1).padStart(2, "0");
    const previousEmail = `${email.split("@")[0]}.carego${sequence}@gmail.com`;
    const legacyEmail = `customer${sequence}@carego.test`;
    const existingUser = await User.findOne({ email: { $in: [email, previousEmail, legacyEmail] } });
    await User.findOneAndUpdate(
      existingUser ? { _id: existingUser._id } : { email },
      {
        $set: {
          ...customer,
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
