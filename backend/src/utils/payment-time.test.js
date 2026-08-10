import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPaymentConfirmationTimes,
  getPayOSTransferredAt,
  parsePayOSDateTime,
} from "./payment-time.js";

test("parsePayOSDateTime treats timezone-less PayOS timestamps as Vietnam time", () => {
  assert.equal(
    parsePayOSDateTime("2026-07-08 15:00:00").toISOString(),
    "2026-07-08T08:00:00.000Z",
  );
  assert.equal(
    parsePayOSDateTime("2026-07-08T08:00:00.000Z").toISOString(),
    "2026-07-08T08:00:00.000Z",
  );
  assert.equal(parsePayOSDateTime("not-a-date"), null);
  assert.equal(parsePayOSDateTime("2026-02-31 15:00:00"), null);
});

test("getPayOSTransferredAt reads webhook and payment-link transaction times", () => {
  assert.equal(
    getPayOSTransferredAt({ transactionDateTime: "2026-07-08 15:00:00" }).toISOString(),
    "2026-07-08T08:00:00.000Z",
  );
  assert.equal(
    getPayOSTransferredAt({
      transactions: [
        { transactionDateTime: "invalid" },
        { transactionDateTime: "2026-07-08 16:30:00" },
      ],
    }).toISOString(),
    "2026-07-08T09:30:00.000Z",
  );
  assert.equal(getPayOSTransferredAt({ transactions: [] }), null);
});

test("applyPaymentConfirmationTimes keeps fallback and upgrades it with PayOS time", () => {
  const confirmedAt = new Date("2026-07-08T08:00:03.000Z");
  const payment = {};

  applyPaymentConfirmationTimes(payment, { confirmedAt });
  assert.equal(payment.confirmedAt.toISOString(), confirmedAt.toISOString());
  assert.equal(payment.paidAt.toISOString(), confirmedAt.toISOString());
  assert.equal(payment.transferredAt, undefined);
  assert.equal(payment.paidAtSource, "server_fallback");

  applyPaymentConfirmationTimes(payment, {
    confirmedAt: new Date("2026-07-08T08:01:00.000Z"),
    transferredAt: new Date("2026-07-08T08:00:00.000Z"),
  });
  assert.equal(payment.confirmedAt.toISOString(), confirmedAt.toISOString());
  assert.equal(payment.transferredAt.toISOString(), "2026-07-08T08:00:00.000Z");
  assert.equal(payment.paidAt.toISOString(), "2026-07-08T08:00:00.000Z");
  assert.equal(payment.paidAtSource, "payos");
});
