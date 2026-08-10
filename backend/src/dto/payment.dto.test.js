import assert from "node:assert/strict";
import test from "node:test";
import Payment from "../models/payment.models.js";
import { PAYMENT_RESPONSE_FIELDS, toPaymentDto } from "./payment.dto.js";

const payment = {
  _id: "payment-1",
  bookingId: "booking-1",
  customerId: "customer-1",
  companionId: "companion-1",
  amount: 250000,
  baseAmount: 200000,
  penaltyAmount: 50000,
  paidAmount: 250000,
  platformFee: 40000,
  companionEarning: 160000,
  method: "payos",
  status: "paid",
  orderCode: 123456,
  paymentLinkId: "provider-payment-link",
  checkoutUrl: "https://pay.example/secret-link",
  qrCode: "secret-qr-data",
  rawWebhook: { accountNumber: "0123456789", reference: "provider-reference" },
  paidAt: new Date("2026-07-08T08:00:00.000Z"),
  transferredAt: new Date("2026-07-08T08:00:00.000Z"),
  confirmedAt: new Date("2026-07-08T08:00:03.000Z"),
  paidAtSource: "payos",
  expiresAt: new Date("2026-07-08T08:15:00.000Z"),
  createdAt: new Date("2026-07-08T07:50:00.000Z"),
  updatedAt: new Date("2026-07-08T08:00:00.000Z"),
};

const sensitiveFields = ["rawWebhook", "paymentLinkId", "checkoutUrl", "qrCode"];

test("payment DTOs expose only the fields allowed for each role", () => {
  for (const role of ["customer", "companion", "admin"]) {
    const dto = toPaymentDto(payment, role);
    assert.deepEqual(Object.keys(dto), PAYMENT_RESPONSE_FIELDS[role]);
    sensitiveFields.forEach((field) => assert.equal(field in dto, false));
  }

  assert.equal("platformFee" in toPaymentDto(payment, "customer"), false);
  assert.equal("companionEarning" in toPaymentDto(payment, "customer"), false);
  assert.equal("orderCode" in toPaymentDto(payment, "companion"), false);
  assert.equal("customerId" in toPaymentDto(payment, "companion"), false);
  assert.equal(toPaymentDto(payment, "unknown"), null);
});

test("provider payment fields are excluded from Mongoose queries by default", () => {
  sensitiveFields.forEach((field) => {
    assert.equal(Payment.schema.path(field).options.select, false, `${field} must use select: false`);
  });
});

test("payment model distinguishes provider transfer and system confirmation times", () => {
  assert.equal(Payment.schema.path("transferredAt").instance, "Date");
  assert.equal(Payment.schema.path("confirmedAt").instance, "Date");
  assert.deepEqual(Payment.schema.path("paidAtSource").options.enum, [
    "payos",
    "server_fallback",
    "manual",
    "seed",
  ]);
});
