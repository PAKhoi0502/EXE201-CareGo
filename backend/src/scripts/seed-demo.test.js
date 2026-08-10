import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingCustomerUserSeeds,
  companionProfilesSeed,
  elderProfilesSeed,
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
