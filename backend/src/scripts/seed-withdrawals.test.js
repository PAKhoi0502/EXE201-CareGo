import assert from "node:assert/strict";
import test from "node:test";
import { withdrawalSeed } from "./seed-withdrawals.js";

test("withdrawal seed leaves small balances for only three companions", () => {
  const retained = withdrawalSeed.filter((item) => item.retainedBalance > 0);

  assert.equal(withdrawalSeed.length, 10);
  assert.equal(new Set(withdrawalSeed.map((item) => item.seedKey)).size, 10);
  assert.equal(new Set(withdrawalSeed.map((item) => item.email)).size, 10);
  assert.deepEqual(
    retained.map((item) => item.retainedBalance).sort((first, second) => first - second),
    [72000, 80000, 120000],
  );
  assert.equal(retained.reduce((total, item) => total + item.retainedBalance, 0), 272000);
});

test("withdrawal seed timestamps represent completed processing", () => {
  for (const item of withdrawalSeed) {
    const requestedAt = new Date(item.requestedAt);
    const processedAt = new Date(item.processedAt);

    assert.equal(Number.isNaN(requestedAt.getTime()), false);
    assert.equal(Number.isNaN(processedAt.getTime()), false);
    assert.ok(processedAt >= requestedAt, `Invalid processing time for ${item.seedKey}`);
  }
});
