import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import Booking from "../models/booking.models.js";
import Payment from "../models/payment.models.js";
import { syncPayOSPayment } from "./payment.controller.js";

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

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()();
  }
});

test("syncPayOSPayment returns a customer-safe payment DTO", { concurrency: false }, async () => {
  const payment = {
    _id: "payment-1",
    bookingId: { toString: () => "booking-1" },
    customerId: "customer-1",
    companionId: "companion-1",
    amount: 200000,
    baseAmount: 200000,
    paidAmount: 200000,
    platformFee: 40000,
    companionEarning: 160000,
    status: "paid",
    method: "payos",
    transferredAt: new Date("2026-07-08T08:00:00.000Z"),
    confirmedAt: new Date("2026-07-08T08:00:03.000Z"),
    paidAt: new Date("2026-07-08T08:00:00.000Z"),
    paidAtSource: "payos",
    orderCode: 123456,
    paymentLinkId: "provider-link-id",
    checkoutUrl: "https://pay.example/private",
    qrCode: "private-qr",
    rawWebhook: { accountNumber: "0123456789" },
  };
  const booking = {
    _id: "booking-1",
    customerId: { toString: () => "customer-1" },
    status: "paid",
  };

  mockMethod(Payment, "findOne", async () => payment);
  mockMethod(Booking, "findById", async () => booking);

  const res = createResponse();
  await syncPayOSPayment({
    body: { orderCode: 123456, bookingId: "booking-1" },
    user: { userId: "customer-1", role: "customer" },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.payment.status, "paid");
  [
    "rawWebhook",
    "paymentLinkId",
    "checkoutUrl",
    "qrCode",
    "platformFee",
    "companionEarning",
    "customerId",
    "companionId",
  ].forEach((field) => assert.equal(field in res.body.payment, false));
});
