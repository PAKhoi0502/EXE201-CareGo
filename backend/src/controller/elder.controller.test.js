import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElderDto } from "../dto/elder.dto.js";
import ElderProfile from "../models/elder-profile.models.js";
import {
  deleteElderProfile,
  getMyElderProfiles,
  updateElderProfile,
} from "./elder.controller.js";

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

test("elder DTO rejects ownership and internal fields", () => {
  const result = createElderDto.safeParse({
    fullName: "Bà Lan",
    age: 72,
    gender: "female",
    address: "Quận 7, TP.HCM",
    customerId: "another-customer",
    isArchived: true,
  });

  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].code, "unrecognized_keys");
});

test("elder DTO validates age and emergency phone", () => {
  const invalidAge = createElderDto.safeParse({
    fullName: "Bà Lan",
    age: 131,
    address: "Quận 7, TP.HCM",
  });
  const invalidPhone = createElderDto.safeParse({
    fullName: "Bà Lan",
    age: 72,
    address: "Quận 7, TP.HCM",
    emergencyContact: { phone: "not-a-phone" },
  });

  assert.equal(invalidAge.success, false);
  assert.equal(invalidPhone.success, false);
});

test("updateElderProfile rejects mass assignment before querying MongoDB", { concurrency: false }, async () => {
  let databaseCalled = false;
  mockMethod(ElderProfile, "findOneAndUpdate", async () => {
    databaseCalled = true;
    return null;
  });

  const res = createResponse();
  await updateElderProfile({
    user: { userId: "customer-1" },
    params: { id: "elder-1" },
    body: { customerId: "customer-2" },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(databaseCalled, false);
  assert.match(res.body.message, /customerId/);
});

test("updateElderProfile uses ownership filter, allowlisted data, and validators", { concurrency: false }, async () => {
  let capturedFilter;
  let capturedUpdate;
  let capturedOptions;
  const elder = { _id: "elder-1", fullName: "Bà Lan", age: 73 };

  mockMethod(ElderProfile, "findOneAndUpdate", async (filter, update, options) => {
    capturedFilter = filter;
    capturedUpdate = update;
    capturedOptions = options;
    return elder;
  });

  const res = createResponse();
  await updateElderProfile({
    user: { userId: "customer-1" },
    params: { id: "elder-1" },
    body: { fullName: "  Bà Lan  ", age: 73 },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedFilter, {
    _id: "elder-1",
    customerId: "customer-1",
    isArchived: { $ne: true },
  });
  assert.deepEqual(capturedUpdate, { $set: { fullName: "Bà Lan", age: 73 } });
  assert.deepEqual(capturedOptions, { new: true, runValidators: true });
  assert.deepEqual(res.body.elder, elder);
});

test("getMyElderProfiles hides archived profiles", { concurrency: false }, async () => {
  let capturedFilter;
  mockMethod(ElderProfile, "find", (filter) => {
    capturedFilter = filter;
    return {
      async sort() {
        return [];
      },
    };
  });

  const res = createResponse();
  await getMyElderProfiles({ user: { userId: "customer-1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedFilter, {
    customerId: "customer-1",
    isArchived: { $ne: true },
  });
});

test("deleteElderProfile archives instead of removing the referenced document", { concurrency: false }, async () => {
  let capturedFilter;
  let capturedUpdate;
  let capturedOptions;

  mockMethod(ElderProfile, "findOneAndUpdate", async (filter, update, options) => {
    capturedFilter = filter;
    capturedUpdate = update;
    capturedOptions = options;
    return { _id: "elder-1" };
  });

  const res = createResponse();
  await deleteElderProfile({
    user: { userId: "customer-1" },
    params: { id: "elder-1" },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedFilter, {
    _id: "elder-1",
    customerId: "customer-1",
    isArchived: { $ne: true },
  });
  assert.equal(capturedUpdate.$set.isArchived, true);
  assert.equal(capturedUpdate.$set.archivedAt instanceof Date, true);
  assert.deepEqual(capturedOptions, { new: true, runValidators: true });
});
