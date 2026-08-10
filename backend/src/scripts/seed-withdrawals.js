import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
import Payment from "../models/payment.models.js";
import User from "../models/user.models.js";
import WithdrawalRequest from "../models/withdrawal-request.models.js";
import { encryptSensitiveValue } from "../utils/field-encryption.js";

dotenv.config();

export const withdrawalSeed = [
  {
    seedKey: "demo-withdrawal-minh-tuan",
    email: "phamminhtuan345678@carego.cfd",
    retainedBalance: 0,
    bankName: "Vietcombank",
    bankAccountNumber: "1029384756",
    bankAccountName: "PHAM MINH TUAN",
    requestedAt: "2026-07-06T09:10:00+07:00",
    processedAt: "2026-07-06T14:30:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-lan-anh",
    email: "nguyenlananh567890@carego.cfd",
    retainedBalance: 72000,
    bankName: "BIDV",
    bankAccountNumber: "3141592653",
    bankAccountName: "NGUYEN LAN ANH",
    requestedAt: "2026-07-07T08:45:00+07:00",
    processedAt: "2026-07-07T15:20:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-bao-tran",
    email: "dangbaotran901234@carego.cfd",
    retainedBalance: 0,
    bankName: "ACB",
    bankAccountNumber: "2794185360",
    bankAccountName: "DANG BAO TRAN",
    requestedAt: "2026-07-09T10:05:00+07:00",
    processedAt: "2026-07-09T16:10:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-anh-khoi",
    email: "phamanhkhoi123456@carego.cfd",
    retainedBalance: 120000,
    bankName: "Techcombank",
    bankAccountNumber: "1903847562",
    bankAccountName: "PHAM ANH KHOI",
    requestedAt: "2026-07-13T09:25:00+07:00",
    processedAt: "2026-07-13T14:50:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-quynh-trang",
    email: "lequynhtrang678901@carego.cfd",
    retainedBalance: 0,
    bankName: "MB Bank",
    bankAccountNumber: "6831092745",
    bankAccountName: "LE QUYNH TRANG",
    requestedAt: "2026-07-17T08:30:00+07:00",
    processedAt: "2026-07-17T13:40:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-quang-thanh",
    email: "nguyenquangthanh234567@carego.cfd",
    retainedBalance: 0,
    bankName: "VietinBank",
    bankAccountNumber: "1092837465",
    bankAccountName: "NGUYEN QUANG THANH",
    requestedAt: "2026-07-29T09:40:00+07:00",
    processedAt: "2026-07-29T15:05:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-hoang-thanh",
    email: "tranngochoangthanh456789@carego.cfd",
    retainedBalance: 0,
    bankName: "Sacombank",
    bankAccountNumber: "0609182734",
    bankAccountName: "TRAN NGOC HOANG THANH",
    requestedAt: "2026-08-02T10:15:00+07:00",
    processedAt: "2026-08-02T16:25:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-duc-manh",
    email: "phamducmanh789012@carego.cfd",
    retainedBalance: 0,
    bankName: "VPBank",
    bankAccountNumber: "5263718490",
    bankAccountName: "PHAM DUC MANH",
    requestedAt: "2026-08-04T08:50:00+07:00",
    processedAt: "2026-08-04T14:35:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-phuong-nam",
    email: "vophuongnam890123@carego.cfd",
    retainedBalance: 0,
    bankName: "TPBank",
    bankAccountNumber: "0306192847",
    bankAccountName: "VO PHUONG NAM",
    requestedAt: "2026-08-07T09:05:00+07:00",
    processedAt: "2026-08-07T15:15:00+07:00",
  },
  {
    seedKey: "demo-withdrawal-hai-yen",
    email: "buihaiyen012345@carego.cfd",
    retainedBalance: 80000,
    bankName: "Agribank",
    bankAccountNumber: "2307198465",
    bankAccountName: "BUI HAI YEN",
    requestedAt: "2026-08-09T08:30:00+07:00",
    processedAt: "2026-08-09T10:15:00+07:00",
  },
];

const getPaidEarningsSummary = async (companionId, session) => {
  const rows = await Payment.aggregate([
    { $match: { companionId, status: "paid" } },
    {
      $group: {
        _id: "$companionId",
        totalEarned: { $sum: { $ifNull: ["$companionEarning", 0] } },
        lastPaidAt: { $max: "$paidAt" },
      },
    },
  ]).session(session);
  return {
    totalEarned: Number(rows[0]?.totalEarned || 0),
    lastPaidAt: rows[0]?.lastPaidAt || null,
  };
};

export const seedWithdrawalData = async () => {
  await WithdrawalRequest.init();
  const session = await mongoose.connection.startSession();
  let summary;

  try {
    await session.withTransaction(async () => {
      const admin = await User.findOne({ role: "admin", isActive: true })
        .session(session)
        .select("_id");
      if (!admin) throw new Error("An active admin is required to process withdrawal seed data");

      const seedKeys = withdrawalSeed.map((item) => item.seedKey);
      await WithdrawalRequest.deleteMany(
        { seedKey: { $regex: /^demo-withdrawal-/, $nin: seedKeys } },
        { session },
      );

      const withdrawals = [];
      for (const item of withdrawalSeed) {
        const companion = await User.findOne({ email: item.email, role: "companion", isActive: true })
          .session(session)
          .select("_id name");
        if (!companion) throw new Error(`Missing active companion ${item.email}`);

        const nonSeedWithdrawals = await WithdrawalRequest.find({
          companionId: companion._id,
          status: { $in: ["pending", "approved", "paid"] },
        })
          .session(session)
          .select("+seedKey amount status");
        if (nonSeedWithdrawals.some((withdrawal) => !withdrawal.seedKey?.startsWith("demo-withdrawal-"))) {
          throw new Error(`Companion ${item.email} has a non-seed withdrawal; seed aborted`);
        }

        const { totalEarned, lastPaidAt } = await getPaidEarningsSummary(companion._id, session);
        const amount = totalEarned - item.retainedBalance;
        if (!Number.isInteger(amount) || amount < 1000) {
          throw new Error(`Invalid seeded withdrawal amount for ${item.email}`);
        }

        const requestedAt = new Date(item.requestedAt);
        const processedAt = new Date(item.processedAt);
        if (Number.isNaN(requestedAt.getTime()) || Number.isNaN(processedAt.getTime()) || processedAt < requestedAt) {
          throw new Error(`Invalid withdrawal timestamps for ${item.email}`);
        }
        if (!lastPaidAt || requestedAt < lastPaidAt) {
          throw new Error(`Withdrawal precedes the latest paid earning for ${item.email}`);
        }

        const withdrawal = await WithdrawalRequest.findOneAndUpdate(
          { seedKey: item.seedKey },
          {
            $set: {
              seedKey: item.seedKey,
              companionId: companion._id,
              amount,
              bankName: item.bankName,
              bankAccountNumber: encryptSensitiveValue(item.bankAccountNumber),
              bankAccountName: encryptSensitiveValue(item.bankAccountName),
              note: "Rút thu nhập CareGo đến ngày 09/08/2026.",
              adminNote: "Đã hoàn tất đối soát và chuyển khoản.",
              status: "paid",
              processedAt,
              processedBy: admin._id,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, session },
        );
        await WithdrawalRequest.collection.updateOne(
          { _id: withdrawal._id },
          { $set: { createdAt: requestedAt, updatedAt: processedAt } },
          { session },
        );
        withdrawals.push({
          companionId: companion._id,
          name: companion.name,
          amount,
          retainedBalance: item.retainedBalance,
        });
      }

      summary = {
        withdrawals,
        totalWithdrawn: withdrawals.reduce((total, item) => total + item.amount, 0),
        totalRetained: withdrawals.reduce((total, item) => total + item.retainedBalance, 0),
      };
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }

  return summary;
};

const run = async () => {
  if (!process.argv.includes("--yes")) {
    throw new Error("This script adds or updates withdrawal seed data. Run with --yes to confirm.");
  }
  if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is required");

  await mongoose.connect(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DB_NAME || "carego",
  });
  const summary = await seedWithdrawalData();
  console.log("Database:", mongoose.connection.name);
  console.log("Withdrawal seed mode: paid additive upsert");
  console.log("Withdrawals:", summary.withdrawals.length);
  console.log("Total withdrawn:", summary.totalWithdrawn);
  console.log("Total retained:", summary.totalRetained);
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
