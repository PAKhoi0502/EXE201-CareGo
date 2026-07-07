import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
import { seedBookingData } from "./seed-demo.js";

dotenv.config();
const shouldConfirm = process.argv.includes("--yes");

const run = async () => {
  if (!shouldConfirm) {
    throw new Error("This script adds or updates booking demo data. Run with --yes to confirm.");
  }

  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is required");
  }

  await mongoose.connect(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DB_NAME || "carego",
  });

  const { bookings, companionStats } = await seedBookingData();
  console.log("Database:", mongoose.connection.name);
  console.log("Seed mode: booking-only additive upsert");
  console.log("Bookings:", bookings.length);
  console.log("Companion reviews:", Object.values(companionStats).reduce((total, item) => total + item.ratingCount, 0));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
