import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import Booking from "../models/booking.models.js";
import BookingCompanionLock from "../models/booking-companion-lock.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import Notification from "../models/notification.models.js";
import { updateBookingStatus } from "./booking.controller.js";

const restorers = [];

const mockMethod = (target, key, value) => {
  const original = target[key];
  restorers.push(() => {
    target[key] = original;
  });
  target[key] = value;
};

const createSelectQuery = (value) => ({
  select: async () => value,
});

const createResponse = () => {
  const response = {
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
  };

  return response;
};

const createDeferred = () => {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()();
  }
});

test("updateBookingStatus blocks a concurrent companion acceptance on the same lock", { concurrency: false }, async () => {
  const activeLocks = new Map();
  const firstUpdateReached = createDeferred();
  const releaseFirstUpdate = createDeferred();
  let updateCallCount = 0;

  const booking = {
    _id: "booking-1",
    customerId: "customer-1",
    companionId: "companion-1",
    status: "pending",
    bookingMode: "scheduled",
    startTime: new Date("2026-07-09T08:00:00.000Z"),
    durationHours: 2,
  };

  mockMethod(BookingCompanionLock, "create", async ({ _id, ownerToken, expiresAt }) => {
    if (activeLocks.has(_id)) {
      const error = new Error("duplicate");
      error.code = 11000;
      throw error;
    }

    activeLocks.set(_id, { ownerToken, expiresAt });
    return { _id, ownerToken, expiresAt };
  });
  mockMethod(BookingCompanionLock, "findOneAndUpdate", () => ({
    select: async () => null,
  }));
  mockMethod(BookingCompanionLock, "deleteOne", async ({ _id, ownerToken }) => {
    const lock = activeLocks.get(_id);
    if (lock?.ownerToken === ownerToken) {
      activeLocks.delete(_id);
    }
    return { deletedCount: 1 };
  });

  mockMethod(Booking, "findById", async () => ({ ...booking }));
  mockMethod(Booking, "find", () => createSelectQuery([]));
  mockMethod(Booking, "findOneAndUpdate", async () => {
    updateCallCount += 1;
    if (updateCallCount === 1) {
      firstUpdateReached.resolve();
      await releaseFirstUpdate.promise;
    }

    return {
      ...booking,
      status: "accepted",
    };
  });
  mockMethod(CompanionProfile, "findOne", () => createSelectQuery({
    phoneVerifiedAt: new Date("2026-07-01T09:00:00.000Z"),
    workingShift: "full_day",
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    acceptingBookings: true,
  }));
  mockMethod(Notification, "create", async (payload) => ({
    _id: "notification-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...payload,
    toObject() {
      return this;
    },
  }));

  const req = {
    params: { id: "booking-1" },
    user: { userId: "companion-1", role: "companion" },
    body: { status: "accepted" },
  };

  const firstRes = createResponse();
  const firstPromise = updateBookingStatus(req, firstRes);
  await firstUpdateReached.promise;

  const secondRes = createResponse();
  await updateBookingStatus(req, secondRes);

  assert.equal(secondRes.statusCode, 409);
  assert.ok(secondRes.body.message);

  releaseFirstUpdate.resolve();
  await firstPromise;

  assert.equal(firstRes.statusCode, 200);
  assert.equal(firstRes.body.booking.status, "accepted");
  assert.equal(activeLocks.size, 0);
});
