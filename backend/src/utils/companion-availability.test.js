import assert from "node:assert/strict";
import test from "node:test";
import {
  findActiveBookingOutsideWorkingShift,
  isCompanionScheduleAvailable,
  normalizeUnavailableDates,
  normalizeWorkingDays,
} from "./companion-availability.js";

const at = (day, hour) => new Date(2026, 6, day, hour, 0, 0, 0);

test("finds an active booking outside the requested working shift", () => {
  const bookings = [{ startTime: at(6, 8), durationHours: 2 }];

  const conflict = findActiveBookingOutsideWorkingShift(bookings, "afternoon", at(5, 12));

  assert.equal(conflict, bookings[0]);
});

test("allows a working shift that contains every active booking", () => {
  const bookings = [
    { startTime: at(6, 8), durationHours: 2 },
    { startTime: at(7, 10), durationHours: 3 },
  ];

  const conflict = findActiveBookingOutsideWorkingShift(bookings, "morning", at(5, 12));

  assert.equal(conflict, undefined);
});

test("ignores a booking whose service time has already ended", () => {
  const bookings = [{ startTime: at(5, 8), durationHours: 2 }];

  const conflict = findActiveBookingOutsideWorkingShift(bookings, "afternoon", at(5, 12));

  assert.equal(conflict, undefined);
});

test("normalizes only valid working days and unique unavailable dates", () => {
  assert.deepEqual(normalizeWorkingDays([1, 5, 5, 9, "2"]), [1, 2, 5]);
  assert.deepEqual(normalizeUnavailableDates(["2026-07-07", "x", "2026-07-07", "2026-07-08"]), [
    "2026-07-07",
    "2026-07-08",
  ]);
});

test("rejects bookings outside weekly availability or temporary days off", () => {
  const profile = {
    workingShift: "full_day",
    workingDays: [1, 2, 3, 4, 5],
    unavailableDates: ["2026-07-07"],
    acceptingBookings: true,
  };

  assert.equal(isCompanionScheduleAvailable(profile, new Date("2026-07-07T08:00:00"), 2), false);
  assert.equal(isCompanionScheduleAvailable(profile, new Date("2026-07-12T08:00:00"), 2), false);
  assert.equal(isCompanionScheduleAvailable(profile, new Date("2026-07-08T08:00:00"), 2), true);
});

test("rejects new bookings when the companion temporarily pauses accepting bookings", () => {
  const profile = {
    workingShift: "full_day",
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    acceptingBookings: false,
  };

  assert.equal(isCompanionScheduleAvailable(profile, new Date("2026-07-08T08:00:00"), 2), false);
});
