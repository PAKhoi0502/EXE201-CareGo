import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import User from "../models/user.models.js";
import Booking from "../models/booking.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import Payment from "../models/payment.models.js";
import Service from "../models/service.models.js";
import {
  buildAdminBookingFilter,
  buildAdminReportBookingFilter,
  buildReportCompanions,
  buildReportCancellations,
  buildReportCustomers,
  buildReportDaily,
  buildReportMonthly,
  buildReportPaymentAnalysis,
  buildReportReviews,
  buildReportSummary,
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
  let bookingSummaryPipeline = null;
  let paymentSummaryPipeline = null;
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
  mockMethod(Booking, "aggregate", async (pipeline) => {
    bookingSummaryPipeline = pipeline;
    return [{ total: 31, running: 4, gpsReady: 20 }];
  });
  mockMethod(Payment, "aggregate", async (pipeline) => {
    paymentSummaryPipeline = pipeline;
    return [{ paidRevenue: 1000, penaltyRevenue: 50, platformFee: 100 }];
  });
  mockMethod(Payment, "find", () => ({ sort() { return this; }, lean: async () => [] }));
  mockMethod(Service, "find", () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => [],
  }));

  const res = createResponse();
  await getAdminBookings({ query: { page: "2", limit: "10", status: "paid" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(skipped, 10);
  assert.equal(limited, 10);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 10, total: 31, totalPages: 4 });
  assert.equal(res.body.summary.careGoRevenue, 150);
  assert.deepEqual(bookingSummaryPipeline[0], { $match: { status: "paid" } });
  assert.equal(paymentSummaryPipeline.some((stage) => stage.$lookup?.from === Booking.collection.collectionName), true);
  assert.deepEqual(
    paymentSummaryPipeline.find((stage) => stage.$match?.booking)?.$match,
    { booking: { $elemMatch: { status: "paid" } } },
  );
});

test("admin booking search includes an exact MongoDB booking id", { concurrency: false }, async () => {
  const bookingId = "507f1f77bcf86cd799439011";
  const emptyQuery = () => ({ select() { return this; }, lean: async () => [] });

  mockMethod(User, "find", emptyQuery);
  mockMethod(ElderProfile, "find", emptyQuery);
  mockMethod(Service, "find", emptyQuery);

  const { filter } = await buildAdminBookingFilter({ search: bookingId });
  const idCondition = filter.$or.find((condition) => condition._id && !condition._id.$in);

  assert.equal(idCondition._id.toString(), bookingId);
});

test("admin booking search resolves a PayOS order code to its booking", { concurrency: false }, async () => {
  const bookingId = "507f1f77bcf86cd799439011";
  const emptyQuery = () => ({ select() { return this; }, lean: async () => [] });

  mockMethod(User, "find", emptyQuery);
  mockMethod(ElderProfile, "find", emptyQuery);
  mockMethod(Service, "find", emptyQuery);
  mockMethod(Payment, "find", (filter) => ({
    select() { return this; },
    async lean() {
      assert.deepEqual(filter, { orderCode: 123456 });
      return [{ bookingId }];
    },
  }));

  const { filter } = await buildAdminBookingFilter({ search: "123456" });
  const paymentCondition = filter.$or.find((condition) => condition._id?.$in);

  assert.deepEqual(paymentCondition, { _id: { $in: [bookingId] } });
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

test("daily and monthly reports cover the complete selected 90-day range", () => {
  const range = parseReportRange({ from: "2026-05-13", to: "2026-08-10" });
  const daily = buildReportDaily([], range);
  const monthly = buildReportMonthly([], range);

  assert.equal(range.calendarDays, 90);
  assert.equal(daily.length, 90);
  assert.deepEqual(monthly.map((item) => item.key), ["2026-05", "2026-06", "2026-07", "2026-08"]);
});

test("payment-date reports group by effective payment time instead of booking time", () => {
  const range = parseReportRange({ from: "2026-08-10", to: "2026-08-10" });
  const booking = {
    startTime: new Date("2026-07-01T01:00:00.000Z"),
    payment: {
      status: "paid",
      paidAt: new Date("2026-08-10T02:00:00.000Z"),
      platformFee: 100,
      companionEarning: 400,
    },
  };

  const [day] = buildReportDaily([booking], range, "payment");
  assert.equal(day.count, 1);
  assert.equal(day.caregoRevenue, 100);
  assert.equal(buildAdminReportBookingFilter({ query: { dateBasis: "payment" }, range }).filter.startTime, undefined);
  assert.ok(buildAdminReportBookingFilter({ query: { dateBasis: "created" }, range }).filter.createdAt);
});

test("admin report filter accepts status and exact entity ids", () => {
  const range = parseReportRange({ from: "2026-08-01", to: "2026-08-10" });
  const ids = {
    bookingId: "507f1f77bcf86cd799439011",
    serviceId: "507f1f77bcf86cd799439012",
    companionId: "507f1f77bcf86cd799439013",
    customerId: "507f1f77bcf86cd799439014",
  };
  const { filter, error } = buildAdminReportBookingFilter({
    query: { ...ids, status: "paid" },
    range,
  });

  assert.equal(error, undefined);
  assert.equal(filter.status, "paid");
  assert.equal(filter._id.toString(), ids.bookingId);
  ["serviceId", "companionId", "customerId"].forEach((field) => {
    assert.equal(filter[field].toString(), ids[field]);
  });
});

test("report summary and companion rows include cancellation, reviews and utilization", () => {
  const range = parseReportRange({ from: "2026-08-10", to: "2026-08-10" });
  const companionId = "507f1f77bcf86cd799439013";
  const bookings = [
    {
      _id: "booking-paid",
      companionId,
      status: "paid",
      durationHours: 4,
      totalAmount: 1000,
      payment: { status: "paid", baseAmount: 1000, paidAmount: 1000, companionEarning: 800 },
    },
    {
      _id: "booking-cancelled",
      companionId,
      status: "cancelled",
      durationHours: 2,
      totalAmount: 500,
      payment: null,
    },
  ];
  const reviews = [{ bookingId: "booking-paid", companionId, rating: 5, tags: ["Tận tâm"] }];
  const companionProfiles = [{
    userId: companionId,
    workingShift: "full_day",
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
  }, {
    userId: "507f1f77bcf86cd799439099",
    workingShift: "full_day",
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
  }];

  const summary = buildReportSummary({ bookings, reviews, companionProfiles, range });
  const [companion] = buildReportCompanions(bookings, { companionProfiles, reviews, range });

  assert.equal(summary.cancellationRate, 50);
  assert.equal(summary.averageBookingValue, 1000);
  assert.equal(summary.ratingAverage, 5);
  assert.equal(summary.reviewCoverage, 100);
  assert.equal(summary.utilizationRate, 25);
  assert.equal(companion.assignedHours, 4);
  assert.equal(companion.availableHours, 8);
  assert.equal(companion.utilizationRate, 50);
  assert.equal(companion.completionHoursRate, 100);
  assert.equal(companion.ratingAverage, 5);
});

test("detailed report analysis returns actionable payment, cancellation, review and customer rows", () => {
  const paidBooking = {
    _id: "booking-paid",
    customerId: { _id: "customer-1", name: "Khách A", email: "a@example.com" },
    companionId: { _id: "companion-1", name: "Companion A" },
    serviceId: { name: "CareGo Home" },
    status: "paid",
    startTime: new Date("2026-08-08T01:00:00.000Z"),
    completedAt: new Date("2026-08-08T03:00:00.000Z"),
    payment: {
      status: "paid",
      paidAmount: 500000,
      paidAt: new Date("2026-08-08T05:00:00.000Z"),
      paidAtSource: "server_fallback",
    },
  };
  const cancelledBooking = {
    _id: "booking-cancelled",
    customerId: { _id: "customer-1", name: "Khách A", email: "a@example.com" },
    companionId: { _id: "companion-2", name: "Companion B" },
    serviceId: { name: "CareGo Walk" },
    status: "cancelled",
    startTime: new Date("2026-08-09T01:00:00.000Z"),
    cancellation: {
      reason: "customer_request",
      details: "Gia đình đổi lịch",
      cancelledAt: new Date("2026-08-08T08:00:00.000Z"),
      cancelledByRole: "customer",
    },
  };
  const overdueBooking = {
    _id: "booking-overdue",
    customerId: { _id: "customer-2", name: "Khách B" },
    companionId: { _id: "companion-1", name: "Companion A" },
    serviceId: { name: "CareGo Hospital" },
    status: "completed",
    startTime: new Date("2026-08-01T01:00:00.000Z"),
    paymentDueAt: new Date("2026-08-05T01:00:00.000Z"),
    totalAmount: 300000,
    payment: { status: "failed", amount: 300000 },
  };
  const bookings = [paidBooking, cancelledBooking, overdueBooking];
  const review = {
    bookingId: "booking-paid",
    rating: 3,
    comment: "Cập nhật hơi chậm",
    tags: ["Hoàn thành công việc"],
    createdAt: new Date("2026-08-08T06:00:00.000Z"),
  };

  const paymentAnalysis = buildReportPaymentAnalysis(bookings, new Date("2026-08-10T00:00:00.000Z"));
  const cancellations = buildReportCancellations(bookings);
  const reviews = buildReportReviews([review], 1, bookings);
  const customers = buildReportCustomers(bookings);

  assert.equal(paymentAnalysis.averagePaymentDelayHours, 2);
  assert.equal(paymentAnalysis.overdueCount, 1);
  assert.equal(cancellations.details[0].reason, "customer_request");
  assert.equal(reviews.lowRatings[0].comment, "Cập nhật hơi chậm");
  assert.equal(customers.uniqueCustomers, 2);
  assert.equal(customers.repeatCustomers, 1);
});

test("report range rejects ranges longer than one year", () => {
  const range = parseReportRange({ from: "2025-01-01", to: "2026-08-10" });
  assert.match(range.error, /366/);
});

test("report range rejects invalid Vietnam calendar dates", () => {
  const range = parseReportRange({ from: "2026-02-31", to: "2026-03-01" });
  assert.ok(range.error);
});
