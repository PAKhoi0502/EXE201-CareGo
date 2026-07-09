import assert from "node:assert/strict";
import test from "node:test";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "./password-policy.js";

test("password policy requires length, lower, upper, number and special character", () => {
  assert.equal(isStrongPassword("Aa1!aaaa"), true);
  assert.equal(isStrongPassword("Aa1!aaa"), false);
  assert.equal(isStrongPassword("AA1!AAAA"), false);
  assert.equal(isStrongPassword("aa1!aaaa"), false);
  assert.equal(isStrongPassword("Aaa!aaaa"), false);
  assert.equal(isStrongPassword("Aa11aaaa"), false);
  assert.equal(isStrongPassword(null), false);
});

test("password policy exposes the user-facing rule message", () => {
  assert.match(PASSWORD_POLICY_MESSAGE, /8 ký tự/);
  assert.match(PASSWORD_POLICY_MESSAGE, /chữ hoa/);
  assert.match(PASSWORD_POLICY_MESSAGE, /ký tự đặc biệt/);
});
