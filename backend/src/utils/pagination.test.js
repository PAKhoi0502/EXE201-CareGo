import assert from "node:assert/strict";
import test from "node:test";
import { buildPagination, parsePagination } from "./pagination.js";

test("parsePagination uses safe defaults and calculates the offset", () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 25, skip: 0 });
  assert.deepEqual(parsePagination({ page: "3", limit: "20" }), {
    page: 3,
    limit: 20,
    skip: 40,
  });
});

test("parsePagination rejects invalid and excessive values", () => {
  assert.ok(parsePagination({ page: "0" }).error);
  assert.ok(parsePagination({ page: "1.5" }).error);
  assert.ok(parsePagination({ limit: "101" }).error);
  assert.ok(parsePagination({ limit: "20rows" }).error);
});

test("buildPagination always returns at least one page", () => {
  assert.deepEqual(buildPagination({ page: 1, limit: 25 }, 0), {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  assert.equal(buildPagination({ page: 2, limit: 25 }, 51).totalPages, 3);
});
