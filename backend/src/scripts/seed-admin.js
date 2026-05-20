import bcrypt from "bcrypt";
import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/user.models.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
dotenv.config();

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "CareGo Admin";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  await mongoose.connect(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DB_NAME || "carego",
  });
  console.log("Connected database:", mongoose.connection.name);
  console.log("Users collection:", User.collection.name);

  const existingAdmin = await User.findOne({ email });
  if (existingAdmin) {
    existingAdmin.role = "admin";
    existingAdmin.isActive = true;
    existingAdmin.isEmailVerified = true;
    await existingAdmin.save();
    console.log("Admin already exists, role updated:", email);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email,
    password: hashedPassword,
    role: "admin",
    isEmailVerified: true,
  });

  console.log("Admin created:", email);
};

seedAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
