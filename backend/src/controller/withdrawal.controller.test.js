import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import Payment from "../models/payment.models.js";
import WithdrawalCompanionLock from "../models/withdrawal-companion-lock.models.js";
import WithdrawalRequest from "../models/withdrawal-request.models.js";
import {
  createWithdrawalRequest,
  getAdminWithdrawalRequestDetail,
  getAdminWithdrawalRequests,
  getMyEarnings,
  updateWithdrawalStatus,
} from "./withdrawal.controller.js";

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

const createPopulateQuery = (value) => ({
  populate() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
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
  assert.equal(res.body.requests[0].bankAccountNumberFull, undefined);
  assert.equal(res.body.requests[0].bankAccountName, "Nguyen Van A");
  assert.equal(res.body.availableBalance, 380000);
});

test("getMyEarnings returns ledger entries and summary from paid payments", { concurrency: false }, async () => {
  const payments = [
    {
      _id: "payment-2",
      paidAt: new Date("2026-07-07T09:15:00.000Z"),
      transferredAt: new Date("2026-07-07T09:15:00.000Z"),
      confirmedAt: new Date("2026-07-07T09:15:03.000Z"),
      paidAtSource: "payos",
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
  assert.equal(res.body.entries[0].transferredAt.toISOString(), "2026-07-07T09:15:00.000Z");
  assert.equal(res.body.entries[0].confirmedAt.toISOString(), "2026-07-07T09:15:03.000Z");
  assert.equal(res.body.entries[0].paidAtSource, "payos");
  assert.equal(res.body.entries[0].payment.companionEarning, 180000);
  assert.equal(res.body.entries[0].booking.updatedAt.toISOString(), "2026-06-01T00:00:00.000Z");
});

test("getAdminWithdrawalRequests paginates before serializing the response", { concurrency: false }, async () => {
  let skipped = null;
  let limited = null;
  const requests = [{
    _id: "withdrawal-1",
    amount: 120000,
    status: "pending",
    bankAccountNumber: "1234567890",
    bankAccountName: "Nguyen Van A",
  }];

  mockMethod(WithdrawalRequest, "find", () => ({
    populate() { return this; },
    sort() { return this; },
    skip(value) { skipped = value; return this; },
    limit(value) { limited = value; return this; },
    lean: async () => requests,
  }));
  mockMethod(WithdrawalRequest, "countDocuments", async () => 26);
  mockMethod(WithdrawalRequest, "aggregate", async () => [{
    total: 500000,
    pending: 120000,
    approved: 80000,
    paid: 300000,
    rejected: 0,
  }]);

  const res = createResponse();
  await getAdminWithdrawalRequests({ query: { page: "2", limit: "25" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(skipped, 25);
  assert.equal(limited, 25);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 25, total: 26, totalPages: 2 });
  assert.equal(res.body.requests[0].bankAccountNumber, "******7890");
  assert.equal(res.body.requests[0].bankAccountNumberFull, undefined);
  assert.equal(res.body.summary.total, 500000);
});

test("getAdminWithdrawalRequestDetail is the only admin response exposing the full account number", { concurrency: false }, async () => {
  const request = {
    _id: "withdrawal-1",
    amount: 120000,
    status: "pending",
    bankAccountNumber: "1234567890",
    bankAccountName: "Nguyen Van A",
    companionId: { _id: "companion-1", name: "Nguyen Van A" },
  };
  mockMethod(WithdrawalRequest, "findById", () => ({
    populate() { return this; },
    lean: async () => request,
  }));

  const res = createResponse();
  await getAdminWithdrawalRequestDetail({ params: { id: "withdrawal-1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.withdrawal.bankAccountNumber, "******7890");
  assert.equal(res.body.withdrawal.bankAccountNumberFull, "1234567890");
});

test("updateWithdrawalStatus preserves adminNote when it is omitted", { concurrency: false }, async () => {
  let capturedUpdates = null;

  mockMethod(WithdrawalRequest, "findById", () => ({
    select: async () => ({ status: "pending" }),
  }));
  mockMethod(WithdrawalRequest, "findOneAndUpdate", (_filter, updates) => {
    capturedUpdates = updates;
    return createPopulateQuery({
      _id: "withdrawal-1",
      status: "approved",
      adminNote: "Ghi chú cần được giữ nguyên",
      bankAccountNumber: "",
      bankAccountName: "",
    });
  });

  const req = {
    user: { userId: "admin-1", role: "admin" },
    params: { id: "withdrawal-1" },
    body: { status: "approved" },
  };
  const res = createResponse();

  await updateWithdrawalStatus(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Object.hasOwn(capturedUpdates, "adminNote"), false);
  assert.equal(capturedUpdates.status, "approved");
  assert.equal(res.body.withdrawal.adminNote, "Ghi chú cần được giữ nguyên");
  assert.equal(res.body.withdrawal.bankAccountNumberFull, undefined);
});

test("updateWithdrawalStatus updates adminNote when it is explicitly provided", { concurrency: false }, async () => {
  let capturedUpdates = null;

  mockMethod(WithdrawalRequest, "findById", () => ({
    select: async () => ({ status: "pending" }),
  }));
  mockMethod(WithdrawalRequest, "findOneAndUpdate", (_filter, updates) => {
    capturedUpdates = updates;
    return createPopulateQuery({
      _id: "withdrawal-1",
      status: "pending",
      adminNote: updates.adminNote,
      bankAccountNumber: "",
      bankAccountName: "",
    });
  });

  const req = {
    user: { userId: "admin-1", role: "admin" },
    params: { id: "withdrawal-1" },
    body: { status: "pending", adminNote: "  Đã kiểm tra thông tin  " },
  };
  const res = createResponse();

  await updateWithdrawalStatus(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdates.adminNote, "Đã kiểm tra thông tin");
  assert.equal(Object.hasOwn(capturedUpdates, "status"), false);
});
