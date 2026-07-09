import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import Service from "../models/service.models.js";
import { createService, updateService } from "./service.controller.js";

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
  while (restorers.length > 0) restorers.pop()();
});

test("updateService rejects fields outside the DTO whitelist", { concurrency: false }, async () => {
  let updateCalled = false;
  mockMethod(Service, "findByIdAndUpdate", async () => {
    updateCalled = true;
    return null;
  });

  const res = createResponse();
  await updateService({ params: { id: "service-1" }, body: { name: "Chăm sóc", createdAt: new Date() } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(updateCalled, false);
  assert.match(res.body.message, /createdAt/);
});

test("updateService sends only validated data and enables Mongoose validators", { concurrency: false }, async () => {
  let receivedUpdate;
  let receivedOptions;
  const updatedService = { _id: "service-1", name: "Chăm sóc tại nhà", pricePerHour: 90000 };
  mockMethod(Service, "findByIdAndUpdate", async (_id, update, options) => {
    receivedUpdate = update;
    receivedOptions = options;
    return updatedService;
  });

  const res = createResponse();
  await updateService({
    params: { id: "service-1" },
    body: {
      name: "  Chăm sóc tại nhà  ",
      pricePerHour: 90000,
      defaultChecklist: ["  Đo huyết áp  "],
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(receivedUpdate, {
    name: "Chăm sóc tại nhà",
    pricePerHour: 90000,
    defaultChecklist: ["Đo huyết áp"],
  });
  assert.deepEqual(receivedOptions, { new: true, runValidators: true, context: "query" });
  assert.deepEqual(res.body.service, updatedService);
});

test("updateService rejects empty and invalid updates", { concurrency: false }, async () => {
  const emptyRes = createResponse();
  await updateService({ params: { id: "service-1" }, body: {} }, emptyRes);
  assert.equal(emptyRes.statusCode, 400);

  const invalidPriceRes = createResponse();
  await updateService({ params: { id: "service-1" }, body: { pricePerHour: -1 } }, invalidPriceRes);
  assert.equal(invalidPriceRes.statusCode, 400);
});

test("createService uses the same strict DTO", { concurrency: false }, async () => {
  let createdPayload;
  mockMethod(Service, "create", async (payload) => {
    createdPayload = payload;
    return { _id: "service-1", ...payload };
  });

  const res = createResponse();
  await createService({
    body: {
      name: "  Đồng hành đi viện ",
      code: " HOSPITAL_01 ",
      description: "  Hỗ trợ tại bệnh viện ",
      pricePerHour: 100000,
      defaultChecklist: ["  Chuẩn bị hồ sơ "],
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(createdPayload, {
    name: "Đồng hành đi viện",
    code: "HOSPITAL_01",
    description: "Hỗ trợ tại bệnh viện",
    pricePerHour: 100000,
    defaultChecklist: ["Chuẩn bị hồ sơ"],
  });
});
