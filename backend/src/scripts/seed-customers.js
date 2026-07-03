import bcrypt from "bcrypt";
import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
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
  { name: "Ngô Thảo Nhi", email: "thaonhi@gmail.com", phone: "0978136254" },
  { name: "Dương Quốc Việt", email: "quocviet@gmail.com", phone: "0982475613" },
  { name: "Lý Thanh Hà", email: "thanhha@gmail.com", phone: "0915382746" },
  { name: "Nguyễn Tuấn Kiệt", email: "tuankiet@gmail.com", phone: "0906248157" },
  { name: "Trần Ngọc Hân", email: "ngochan@gmail.com", phone: "0937524618" },
  { name: "Lê Đức Thịnh", email: "ducthinh@gmail.com", phone: "0943861725" },
  { name: "Phạm Quỳnh Như", email: "quynhnhu@gmail.com", phone: "0962715384" },
  { name: "Võ Minh Nhật", email: "minhnhat@gmail.com", phone: "0976382145" },
  { name: "Đặng Hoài An", email: "hoaian@gmail.com", phone: "0984517263" },
  { name: "Bùi Phương Thảo", email: "phuongthao@gmail.com", phone: "0912738465" },
  { name: "Đỗ Quốc Trung", email: "quoctrung@gmail.com", phone: "0908153726" },
  { name: "Hồ Ngọc Ánh", email: "ngocanh@gmail.com", phone: "0934267185" },
  { name: "Ngô Gia Huy", email: "giahuy@gmail.com", phone: "0947632518" },
  { name: "Dương Thu Trang", email: "thutrang@gmail.com", phone: "0961548273" },
];

export const seedCustomerUsers = async () => {
  const hashedPassword = await bcrypt.hash(password, 10);

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

  return customersSeed.length;
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

  const seededCount = await seedCustomerUsers();
  console.log("Database:", mongoose.connection.name);
  console.log("Customer seed mode: additive upsert");
  console.log("Customers:", seededCount);
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
