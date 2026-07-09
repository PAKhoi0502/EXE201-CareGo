import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import Booking from "../models/booking.models.js";
import BookingCompanionLock from "../models/booking-companion-lock.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import Notification from "../models/notification.models.js";
import Service from "../models/service.models.js";
import User from "../models/user.models.js";
import {
  buildBookingIdempotencyFingerprint,
  getMyBookings,
  normalizeBookingIdempotencyKey,
  updateBookingStatus,
} from "./booking.controller.js";

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

test("booking idempotency fingerprint is stable and changes with the request", () => {
  const payload = {
    elderProfileId: "elder-1",
    serviceId: "service-1",
    companionId: "companion-1",
    startTime: "2026-07-10T08:00:00.000Z",
    durationHours: 2,
    address: "  Quận 7, TP.HCM  ",
    addressLocation: { lat: 10.73, lng: 106.72, displayName: "Quận 7" },
    note: "Đi chậm",
    bookingMode: "scheduled",
  };

  const first = buildBookingIdempotencyFingerprint(payload);
  const sameRequest = buildBookingIdempotencyFingerprint({ ...payload, address: "Quận 7, TP.HCM" });
  const changedRequest = buildBookingIdempotencyFingerprint({ ...payload, durationHours: 3 });

  assert.equal(first, sameRequest);
  assert.notEqual(first, changedRequest);
  assert.equal(normalizeBookingIdempotencyKey("  booking-key-123456  "), "booking-key-123456");
});

test("booking model enforces one idempotency key per customer without affecting legacy rows", () => {
  const [fields, options] = Booking.schema.indexes().find(([indexFields]) =>
    indexFields.customerId === 1 && indexFields.idempotencyKey === 1,
  );

  assert.deepEqual(fields, { customerId: 1, idempotencyKey: 1 });
  assert.equal(options.unique, true);
  assert.deepEqual(options.partialFilterExpression, { idempotencyKey: { $type: "string" } });
  assert.equal(Booking.schema.path("idempotencyKey").options.select, false);
  assert.equal(Booking.schema.path("idempotencyFingerprint").options.select, false);
});

test("getMyBookings paginates, filters and searches customer bookings", { concurrency: false }, async () => {
  let countFilter = null;
  let findFilter = null;
  let capturedSort = null;
  let capturedSkip = null;
  let capturedLimit = null;

  mockMethod(ElderProfile, "find", () => ({
    distinct: async (field) => {
      assert.equal(field, "_id");
      return ["elder-1"];
    },
  }));
  mockMethod(Service, "find", () => ({
    distinct: async (field) => {
      assert.equal(field, "_id");
      return ["service-1"];
    },
  }));
  mockMethod(User, "find", () => ({
    distinct: async (field) => {
      assert.equal(field, "_id");
      return ["companion-1"];
    },
  }));
  mockMethod(Booking, "countDocuments", async (filter) => {
    countFilter = filter;
    return 12;
  });
  mockMethod(Booking, "find", (filter) => {
    findFilter = filter;
    return {
      populate() {
        return this;
      },
      sort(sort) {
        capturedSort = sort;
        return this;
      },
      skip(skip) {
        capturedSkip = skip;
        return this;
      },
      async limit(limit) {
        capturedLimit = limit;
        return [{ _id: "booking-1" }];
      },
    };
  });

  const res = createResponse();
  await getMyBookings({
    user: { userId: "customer-1", role: "customer" },
    query: {
      as: "customer",
      page: "2",
      limit: "5",
      status: "pending",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      search: "mẹ",
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(findFilter, countFilter);
  assert.equal(findFilter.customerId, "customer-1");
  assert.equal(findFilter.status, "pending");
  assert.ok(findFilter.startTime.$gte instanceof Date);
  assert.ok(findFilter.startTime.$lte instanceof Date);
  assert.ok(findFilter.$or.some((condition) => condition.elderProfileId?.$in.includes("elder-1")));
  assert.ok(findFilter.$or.some((condition) => condition.serviceId?.$in.includes("service-1")));
  assert.ok(findFilter.$or.some((condition) => condition.companionId?.$in.includes("companion-1")));
  assert.deepEqual(capturedSort, { createdAt: -1 });
  assert.equal(capturedSkip, 5);
  assert.equal(capturedLimit, 5);
  assert.deepEqual(res.body.bookings, [{ _id: "booking-1" }]);
  assert.deepEqual(res.body.pagination, {
    page: 2,
    limit: 5,
    total: 12,
    totalPages: 3,
  });
});

test("getMyBookings rejects invalid status filters before querying bookings", { concurrency: false }, async () => {
  let queriedBookings = false;
  mockMethod(Booking, "find", () => {
    queriedBookings = true;
    throw new Error("Booking.find should not be called for invalid status");
  });
  mockMethod(Booking, "countDocuments", () => {
    queriedBookings = true;
    throw new Error("Booking.countDocuments should not be called for invalid status");
  });

  const res = createResponse();
  await getMyBookings({
    user: { userId: "customer-1", role: "customer" },
    query: { as: "customer", status: "unknown" },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(queriedBookings, false);
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
