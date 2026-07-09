import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import User from "../models/user.models.js";
import Booking from "../models/booking.models.js";
import Payment from "../models/payment.models.js";
import Service from "../models/service.models.js";
import {
  buildReportDaily,
  buildReportMonthly,
  getAdminBookings,
  getAdminUsers,
  parseReportRange,
  toVietnamDateInputValue,
  updateUserStatus,
} from "./admin.controller.js";

const restorers = [];

const mockMethod = (target, key, value) => {
  const original = target[key];
  restorers.push(() => {
    target[key] = original;
  });
  target[key] = value;
};

const createResponse = () => ({
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
});

const expectedFields = [
  "_id",
  "name",
  "email",
  "phone",
  "avatar",
  "role",
  "isActive",
  "isEmailVerified",
  "createdAt",
  "updatedAt",
];

const assertSafeAdminUserProjection = (projection) => {
  const selectedFields = String(projection || "").split(/\s+/).filter(Boolean);
  assert.deepEqual(selectedFields, expectedFields);

  [
    "password",
    "refreshToken",
    "emailOtpHash",
    "emailOtpExpires",
    "passwordChangeOtpHash",
    "passwordChangeOtpExpires",
    "pendingPasswordHash",
    "resetPasswordToken",
    "resetPasswordExpries",
  ].forEach((field) => assert.equal(selectedFields.includes(field), false));
};

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()();
  }
});

test("getAdminUsers selects only fields safe for the admin UI", { concurrency: false }, async () => {
  let selectedFields = "";
  let skipped = null;
  let limited = null;
  const users = [{ _id: "user-1", name: "Khách hàng", email: "user@example.com" }];

  mockMethod(User, "find", () => ({
    select(projection) {
      selectedFields = projection;
      return this;
    },
    sort() {
      return this;
    },
    skip(value) {
      skipped = value;
      return this;
    },
    limit(value) {
      limited = value;
      return this;
    },
    async lean() {
      return users;
    },
  }));
  mockMethod(User, "countDocuments", async () => 51);
  mockMethod(User, "aggregate", async () => [{ total: 51, active: 45, suspended: 6, verified: 40 }]);

  const res = createResponse();
  await getAdminUsers({ query: { page: "2", limit: "25", role: "customer" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.users, users);
  assert.equal(skipped, 25);
  assert.equal(limited, 25);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 25, total: 51, totalPages: 3 });
  assert.deepEqual(res.body.summary, { total: 51, active: 45, suspended: 6, verified: 40 });
  assertSafeAdminUserProjection(selectedFields);
});

test("updateUserStatus returns the same safe admin user projection", { concurrency: false }, async () => {
  let selectedFields = "";
  const user = { _id: "user-1", name: "Khách hàng", isActive: true };

  mockMethod(User, "findByIdAndUpdate", () => ({
    async select(projection) {
      selectedFields = projection;
      return user;
    },
  }));

  const req = {
    params: { id: "user-1" },
    body: { isActive: true },
  };
  const res = createResponse();
  await updateUserStatus(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.user, user);
  assertSafeAdminUserProjection(selectedFields);
});

test("getAdminBookings limits the database query and returns pagination metadata", { concurrency: false }, async () => {
  let skipped = null;
  let limited = null;
  const bookings = [{ _id: "booking-1", status: "pending" }];
  const createBookingQuery = () => ({
    populate() { return this; },
    sort() { return this; },
    skip(value) { skipped = value; return this; },
    limit(value) { limited = value; return this; },
    lean: async () => bookings,
  });

  mockMethod(Booking, "find", createBookingQuery);
  mockMethod(Booking, "countDocuments", async () => 31);
  mockMethod(Booking, "aggregate", async () => [{ total: 31, running: 4, gpsReady: 20 }]);
  mockMethod(Payment, "aggregate", async () => [{ paidRevenue: 1000, penaltyRevenue: 50, platformFee: 100 }]);
  mockMethod(Payment, "find", () => ({ sort() { return this; }, lean: async () => [] }));
  mockMethod(Service, "find", () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => [],
  }));

  const res = createResponse();
  await getAdminBookings({ query: { page: "2", limit: "10" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(skipped, 10);
  assert.equal(limited, 10);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 10, total: 31, totalPages: 4 });
  assert.equal(res.body.summary.careGoRevenue, 150);
});

test("report range uses full calendar days in Vietnam", () => {
  const range = parseReportRange({ from: "2026-07-08", to: "2026-07-08" });

  assert.equal(range.error, undefined);
  assert.equal(range.start.toISOString(), "2026-07-07T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-08T16:59:59.999Z");
  assert.equal(toVietnamDateInputValue(range.start), "2026-07-08");
  assert.equal(toVietnamDateInputValue(range.end), "2026-07-08");
});

test("daily report groups bookings around midnight by Vietnam date", () => {
  const range = parseReportRange({ from: "2026-07-08", to: "2026-07-08" });
  const paidPayment = {
    status: "paid",
    platformFee: 100,
    penaltyAmount: 20,
    companionEarning: 880,
  };
  const daily = buildReportDaily([
    { startTime: new Date("2026-07-07T17:30:00.000Z"), payment: paidPayment },
    { startTime: new Date("2026-07-08T16:30:00.000Z"), payment: paidPayment },
    { startTime: new Date("2026-07-08T17:15:00.000Z"), payment: paidPayment },
  ], range);

  assert.equal(daily.length, 1);
  assert.equal(daily[0].key, "2026-07-08");
  assert.equal(daily[0].count, 2);
  assert.equal(daily[0].caregoRevenue, 240);
  assert.equal(daily[0].companionEarning, 1760);
});

test("monthly report uses the Vietnam month at the UTC month boundary", () => {
  const monthly = buildReportMonthly([
    {
      startTime: new Date("2026-06-30T17:30:00.000Z"),
      payment: { status: "paid", amount: 1000, penaltyAmount: 0 },
    },
  ], new Date("2026-07-15T00:00:00.000Z"));

  assert.equal(monthly.find((item) => item.key === "2026-07")?.count, 1);
  assert.equal(monthly.find((item) => item.key === "2026-06")?.count, 0);
});

test("report range rejects invalid Vietnam calendar dates", () => {
  const range = parseReportRange({ from: "2026-02-31", to: "2026-03-01" });
  assert.ok(range.error);
});
