import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import Payment from "../models/payment.models.js";
import WithdrawalCompanionLock from "../models/withdrawal-companion-lock.models.js";
import WithdrawalRequest from "../models/withdrawal-request.models.js";
import { createWithdrawalRequest, getMyEarnings } from "./withdrawal.controller.js";

const originalEncryptionKey = process.env.CAREGO_DATA_ENCRYPTION_KEY;
const originalJwtSecret = process.env.JWT_SECRET_KEY;
const restorers = [];

const mockMethod = (target, key, value) => {
  const original = target[key];
  restorers.push(() => {
    target[key] = original;
  });
  target[key] = value;
};

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

const createLeanQuery = (value) => ({
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  populate() {
    return this;
  },
  lean: async () => value,
});

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()();
  }
  process.env.CAREGO_DATA_ENCRYPTION_KEY = originalEncryptionKey;
  process.env.JWT_SECRET_KEY = originalJwtSecret;
});

test("createWithdrawalRequest stores encrypted bank data and returns masked history", { concurrency: false }, async () => {
  process.env.CAREGO_DATA_ENCRYPTION_KEY = "carego-test-secret";
  process.env.JWT_SECRET_KEY = "carego-test-secret";

  const requests = [];

  mockMethod(WithdrawalCompanionLock, "create", async () => ({ _id: "companion-1" }));
  mockMethod(WithdrawalCompanionLock, "findOneAndUpdate", () => ({
    select: async () => null,
  }));
  mockMethod(WithdrawalCompanionLock, "deleteOne", async () => ({ deletedCount: 1 }));
  mockMethod(WithdrawalRequest, "create", async (payload) => {
    requests.push({
      _id: `withdrawal-${requests.length + 1}`,
      createdAt: new Date("2026-07-07T08:30:00.000Z"),
      updatedAt: new Date("2026-07-07T08:30:00.000Z"),
      ...payload,
    });
    return requests.at(-1);
  });
  mockMethod(WithdrawalRequest, "find", () => createLeanQuery([...requests]));
  mockMethod(Payment, "aggregate", async () => [{ totalEarned: 500000 }]);

  const req = {
    user: { userId: "companion-1", role: "companion" },
    body: {
      amount: 120000,
      bankName: "Vietcombank",
      bankAccountNumber: "1234567890",
      bankAccountName: "Nguyen Van A",
      note: "Rút tuần này",
    },
  };
  const res = createResponse();

  await createWithdrawalRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(requests.length, 1);
  assert.match(requests[0].bankAccountNumber, /^enc:v1:/);
  assert.match(requests[0].bankAccountName, /^enc:v1:/);
  assert.equal(res.body.requests[0].bankAccountNumberMasked, "******7890");
  assert.equal(res.body.requests[0].bankAccountNumber, "******7890");
  assert.equal(res.body.requests[0].bankAccountNumberFull, "1234567890");
  assert.equal(res.body.requests[0].bankAccountName, "Nguyen Van A");
  assert.equal(res.body.availableBalance, 380000);
});

test("getMyEarnings returns ledger entries and summary from paid payments", { concurrency: false }, async () => {
  const payments = [
    {
      _id: "payment-2",
      paidAt: new Date("2026-07-07T09:15:00.000Z"),
      companionEarning: 180000,
      baseAmount: 220000,
      paidAmount: 220000,
      platformFee: 40000,
      penaltyAmount: 0,
      method: "payos",
      status: "paid",
      bookingId: {
        _id: "booking-2",
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        serviceId: { name: "Chăm sóc theo giờ" },
        elderProfileId: { fullName: "Bà Lan" },
        customerId: { name: "Khách B", email: "b@example.com" },
      },
    },
    {
      _id: "payment-1",
      paidAt: new Date("2026-07-05T11:00:00.000Z"),
      companionEarning: 120000,
      baseAmount: 150000,
      paidAmount: 150000,
      platformFee: 30000,
      penaltyAmount: 0,
      method: "payos",
      status: "paid",
      bookingId: {
        _id: "booking-1",
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        serviceId: { name: "Tắm rửa" },
        elderProfileId: { fullName: "Ông Minh" },
        customerId: { name: "Khách A", email: "a@example.com" },
      },
    },
  ];

  mockMethod(Payment, "find", () => createLeanQuery(payments));
  mockMethod(Payment, "countDocuments", async () => payments.length);
  mockMethod(Payment, "aggregate", async () => [{
    total: 300000,
    today: 180000,
    week: 300000,
    month: 300000,
  }]);

  const req = {
    user: { userId: "companion-1", role: "companion" },
    query: { page: "1", limit: "50" },
  };
  const res = createResponse();

  await getMyEarnings(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary.total, 300000);
  assert.equal(res.body.summary.today, 180000);
  assert.equal(res.body.entries.length, 2);
  assert.equal(res.body.entries[0].paidAt.toISOString(), "2026-07-07T09:15:00.000Z");
  assert.equal(res.body.entries[0].payment.companionEarning, 180000);
  assert.equal(res.body.entries[0].booking.updatedAt.toISOString(), "2026-06-01T00:00:00.000Z");
});
