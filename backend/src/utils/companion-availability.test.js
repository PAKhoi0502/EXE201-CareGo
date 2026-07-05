import assert from "node:assert/strict";
import test from "node:test";
import { findActiveBookingOutsideWorkingShift } from "./companion-availability.js";

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
