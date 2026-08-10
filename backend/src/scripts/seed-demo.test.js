import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeedPaymentTimes,
  getSeedPaymentTiming,
  legacyDemoCustomerJoinedAtByKey,
  bookingCustomerUserSeeds,
  companionProfilesSeed,
  elderProfilesSeed,
  getRealisticBookingNote,
  getProjectWeekBookingScenario,
  paidBookingCustomers,
  projectWeekBookingSeed,
} from "./seed-demo.js";
import { customersSeed, legacyCustomerJoinedAtByEmail } from "./seed-customers.js";
import { isCompanionScheduleAvailable } from "../utils/companion-availability.js";

const addedBookingSeed = projectWeekBookingSeed.filter(
  (item) => item.date >= "2026-06-29" && item.date <= "2026-08-09",
);

test("legacy customer registrations are spread with decreasing monthly volume", () => {
  const registrationDates = [
    ...Object.values(legacyCustomerJoinedAtByEmail),
    ...Object.values(legacyDemoCustomerJoinedAtByKey),
  ];
  const monthlyCounts = registrationDates.reduce((counts, value) => {
    const month = String(value).slice(0, 7);
    counts[month] = (counts[month] || 0) + 1;
    return counts;
  }, {});

  assert.equal(registrationDates.length, 32);
  assert.deepEqual(monthlyCounts, {
    "2026-06": 17,
    "2026-07": 10,
    "2026-08": 5,
  });
  assert.equal(customersSeed.slice(0, 21).every((customer) => customer.joinedAt), true);
  assert.equal(registrationDates.every((value) => Number.isFinite(new Date(value).getTime())), true);
  assert.equal([...registrationDates].sort()[0].startsWith("2026-06-01"), true);
  assert.equal([...registrationDates].sort().at(-1).startsWith("2026-08-07"), true);
});

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
  const paidTimes = buildSeedPaymentTimes({
    booking: { completedAt },
    status: "paid",
    paymentDelayMinutes: 73,
    paymentDelaySeconds: 19,
  });

  assert.equal(paidTimes.paidAt.toISOString(), "2026-07-08T09:13:19.000Z");
  assert.equal(paidTimes.confirmedAt.toISOString(), "2026-07-08T09:13:19.000Z");
  assert.equal(paidTimes.transferredAt, null);
  assert.equal(paidTimes.paidAtSource, "seed");

  assert.deepEqual(buildSeedPaymentTimes({ booking: {}, status: "completed" }), {
    paidAt: null,
    transferredAt: null,
    confirmedAt: null,
    paidAtSource: null,
  });
});

test("seed payment timing is deterministic and avoids exact-hour timestamps", () => {
  const timings = Array.from({ length: 25 }, (_, index) => getSeedPaymentTiming(index));

  assert.deepEqual(getSeedPaymentTiming(7), getSeedPaymentTiming(7));
  assert.equal(timings.every((item) => item.creationDelayMinutes > 0), true);
  assert.equal(timings.every((item) => item.confirmationDelayMinutes > item.creationDelayMinutes), true);
  assert.equal(timings.every((item) => item.seconds > 0), true);
  assert.ok(new Set(timings.map((item) => item.confirmationDelayMinutes)).size > 10);
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
  const cancellationCountsByMonth = projectWeekBookingSeed.reduce((counts, item, index) => {
    if (getProjectWeekBookingScenario(item.seedKey, index).status === "cancelled") {
      const month = item.date.slice(0, 7);
      counts[month] = (counts[month] || 0) + 1;
    }
    return counts;
  }, {});

  assert.deepEqual(statusCounts, { paid: 20, cancelled: 8 });
  assert.deepEqual(cancellationCountsByMonth, {
    "2026-06": 4,
    "2026-07": 2,
    "2026-08": 2,
  });
  assert.deepEqual(paymentStatuses, new Set());
  assert.equal(
    scenarios.filter((item) => item.status === "paid" && item.paymentStatus === "paid").length,
    20,
  );
  assert.equal(scenarios.filter((item) => item.incident).length, 2);
});
