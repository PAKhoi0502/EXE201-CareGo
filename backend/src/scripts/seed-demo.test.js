import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeedPaymentTimes,
  bookingCustomerUserSeeds,
  companionProfilesSeed,
  elderProfilesSeed,
  getRealisticBookingNote,
  getProjectWeekBookingScenario,
  paidBookingCustomers,
  projectWeekBookingSeed,
} from "./seed-demo.js";
import { isCompanionScheduleAvailable } from "../utils/companion-availability.js";

const addedBookingSeed = projectWeekBookingSeed.filter(
  (item) => item.date >= "2026-06-29" && item.date <= "2026-08-09",
);

test("booking seed follows the requested weekly distribution through 2026-08-09", () => {
  const ranges = [
    ["2026-06-29", "2026-07-05"],
    ["2026-07-06", "2026-07-12"],
    ["2026-07-13", "2026-07-19"],
    ["2026-07-20", "2026-07-26"],
    ["2026-07-27", "2026-08-02"],
    ["2026-08-03", "2026-08-09"],
  ];
  const distribution = ranges.map(([from, to]) =>
    addedBookingSeed.filter((item) => item.date >= from && item.date <= to).length,
  );

  assert.equal(addedBookingSeed.length, 13);
  assert.deepEqual(distribution, [3, 4, 1, 0, 2, 3]);
  assert.equal(new Set(addedBookingSeed.map((item) => item.seedKey)).size, 13);
});

test("each added booking has a valid customer, elder and companion schedule", () => {
  const customerKeys = new Set();

  for (const item of addedBookingSeed) {
    const dependency = paidBookingCustomers[item.customerIndex];
    const customer = bookingCustomerUserSeeds.find((entry) => entry.key === dependency?.customerKey);
    const elder = elderProfilesSeed.find((entry) => entry.key === dependency?.elderKey);
    const companion = companionProfilesSeed.find((entry) => entry.userKey === item.companionKey);
    const [year, month, day] = item.date.split("-").map(Number);
    const startTime = new Date(year, month - 1, day, item.startHour, 0, 0, 0);

    assert.ok(customer, `Missing customer for ${item.seedKey}`);
    assert.ok(elder, `Missing elder for ${item.seedKey}`);
    assert.equal(elder.customerKey, customer.key);
    assert.ok(companion, `Missing companion for ${item.seedKey}`);
    assert.equal(
      isCompanionScheduleAvailable(companion, startTime, item.durationHours),
      true,
      `Unavailable companion for ${item.seedKey}`,
    );
    customerKeys.add(customer.key);
  }

  assert.equal(customerKeys.size, 13);
});

test("paid seed payments are marked as seed confirmations, not bank transfers", () => {
  const completedAt = new Date("2026-07-08T08:00:00.000Z");
  const paidTimes = buildSeedPaymentTimes({ booking: { completedAt }, status: "paid" });

  assert.equal(paidTimes.paidAt.toISOString(), completedAt.toISOString());
  assert.equal(paidTimes.confirmedAt.toISOString(), completedAt.toISOString());
  assert.equal(paidTimes.transferredAt, null);
  assert.equal(paidTimes.paidAtSource, "seed");

  assert.deepEqual(buildSeedPaymentTimes({ booking: {}, status: "completed" }), {
    paidAt: null,
    transferredAt: null,
    confirmedAt: null,
    paidAtSource: null,
  });
});

test("booking seed notes are realistic and do not expose internal seed keys", () => {
  for (const [index, serviceCode] of ["1", "2", "3"].entries()) {
    const note = getRealisticBookingNote(serviceCode, index);
    assert.ok(note.length > 20);
    assert.equal(/demo|seedKey|demo-booking/i.test(note), false);
  }

  assert.match(getRealisticBookingNote("1", 0), /khám|bệnh viện/i);
  assert.match(getRealisticBookingNote("2", 0), /thuốc|sức khỏe|tại nhà/i);
  assert.match(getRealisticBookingNote("3", 0), /đi dạo|ngoài trời/i);
});

test("project-week seed has realistic operational and payment states", () => {
  const scenarios = projectWeekBookingSeed.map((item, index) =>
    getProjectWeekBookingScenario(item.seedKey, index),
  );
  const statusCounts = scenarios.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
  const paymentStatuses = new Set(
    scenarios.filter((item) => item.status === "completed").map((item) => item.paymentStatus),
  );

  assert.deepEqual(statusCounts, { paid: 22, cancelled: 3, completed: 3 });
  assert.deepEqual(paymentStatuses, new Set(["pending", "expired", "failed"]));
  assert.equal(scenarios.filter((item) => item.incident).length, 2);
});
