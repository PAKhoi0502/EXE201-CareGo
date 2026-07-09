import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import User from "../models/user.models.js";
import { USER_SELF_PROJECTION } from "../dto/user.dto.js";
import { PASSWORD_POLICY_MESSAGE } from "../utils/password-policy.js";
import { hashOtp } from "../utils/otp.js";
import {
  changeCurrentUserPassword,
  getCurrentUser,
  requestCurrentUserPasswordOtp,
  resetPasswordController,
  signupController,
} from "./auth.controller.js";

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
  cookies: [],
  clearedCookies: [],
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  cookie(name, value, options) {
    this.cookies.push({ name, value, options });
    return this;
  },
  clearCookie(name, options) {
    this.clearedCookies.push({ name, options });
    return this;
  },
});

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()();
  }
});

test("sensitive user fields are excluded by default", () => {
  [
    "password",
    "refreshToken",
    "emailOtpHash",
    "emailOtpExpires",
    "passwordChangeOtpHash",
    "passwordChangeOtpExpires",
    "pendingPasswordHash",
    "resetPasswordToken",
    "resetPasswordExpries",
  ].forEach((field) => {
    assert.equal(User.schema.path(field).options.select, false, `${field} must use select: false`);
  });
});

test("getCurrentUser uses an allowlist and strips sensitive fields from its response", { concurrency: false }, async () => {
  let selectedFields = "";
  const databaseUser = {
    _id: "user-1",
    name: "Khách hàng",
    email: "customer@example.com",
    phone: "0900000000",
    role: "admin",
    password: "password-hash",
    refreshToken: "refresh-token",
    resetPasswordToken: "reset-token",
    emailOtpHash: "otp-hash",
    pendingPasswordHash: "pending-password-hash",
  };

  mockMethod(User, "findById", () => ({
    async select(projection) {
      selectedFields = projection;
      return databaseUser;
    },
  }));

  const res = createResponse();
  await getCurrentUser({ user: { userId: "user-1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(selectedFields, USER_SELF_PROJECTION);
  assert.deepEqual(Object.keys(res.body.user), USER_SELF_PROJECTION.split(" "));
  assert.equal("password" in res.body.user, false);
  assert.equal("refreshToken" in res.body.user, false);
  assert.equal("resetPasswordToken" in res.body.user, false);
  assert.equal("emailOtpHash" in res.body.user, false);
  assert.equal("pendingPasswordHash" in res.body.user, false);
});

test("signup rejects weak passwords before querying users", { concurrency: false }, async () => {
  let queriedUser = false;
  mockMethod(User, "findOne", () => {
    queriedUser = true;
    throw new Error("User.findOne should not be called for weak passwords");
  });

  const res = createResponse();
  await signupController({
    body: {
      name: "Khách hàng",
      email: "customer@example.com",
      password: "123456",
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, PASSWORD_POLICY_MESSAGE);
  assert.equal(queriedUser, false);
});

test("requestCurrentUserPasswordOtp rejects weak new passwords before loading the user", { concurrency: false }, async () => {
  let loadedUser = false;
  mockMethod(User, "findById", () => {
    loadedUser = true;
    throw new Error("User.findById should not be called for weak passwords");
  });

  const res = createResponse();
  await requestCurrentUserPasswordOtp({
    user: { userId: "user-1" },
    body: {
      currentPassword: "Current1!",
      newPassword: "123456",
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, PASSWORD_POLICY_MESSAGE);
  assert.equal(loadedUser, false);
});

test("changeCurrentUserPassword rotates the refresh token after OTP verification", { concurrency: false }, async () => {
  const originalRefreshSecret = process.env.JWT_SECRET_KEY_REFRESH;
  process.env.JWT_SECRET_KEY_REFRESH = "test-refresh-secret";

  try {
    let selectedFields = "";
    let saved = false;
    const user = {
      _id: "user-1",
      pendingPasswordHash: "new-password-hash",
      passwordChangeOtpHash: await hashOtp("123456"),
      passwordChangeOtpExpires: new Date(Date.now() + 60_000),
      async save() {
        saved = true;
      },
    };

    mockMethod(User, "findById", (id) => {
      assert.equal(id, "user-1");
      return {
        async select(projection) {
          selectedFields = projection;
          return user;
        },
      };
    });

    const res = createResponse();
    await changeCurrentUserPassword({
      user: { userId: "user-1" },
      body: { otp: "123456" },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.match(selectedFields, /\+pendingPasswordHash/);
    assert.equal(user.password, "new-password-hash");
    assert.equal(user.pendingPasswordHash, undefined);
    assert.equal(user.passwordChangeOtpHash, undefined);
    assert.equal(user.passwordChangeOtpExpires, undefined);
    assert.equal(saved, true);
    assert.equal(typeof user.refreshToken, "string");
    assert.equal(res.cookies.length, 1);
    assert.equal(res.cookies[0].name, "refreshToken");
    assert.equal(res.cookies[0].value, user.refreshToken);
    assert.equal(res.cookies[0].options.httpOnly, true);
  } finally {
    if (originalRefreshSecret === undefined) {
      delete process.env.JWT_SECRET_KEY_REFRESH;
    } else {
      process.env.JWT_SECRET_KEY_REFRESH = originalRefreshSecret;
    }
  }
});

test("resetPasswordController rejects weak passwords before loading the reset token", { concurrency: false }, async () => {
  let loadedUser = false;
  mockMethod(User, "findOne", () => {
    loadedUser = true;
    throw new Error("User.findOne should not be called for weak passwords");
  });

  const res = createResponse();
  await resetPasswordController({
    params: { token: "reset-token" },
    body: { password: "123456" },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, PASSWORD_POLICY_MESSAGE);
  assert.equal(loadedUser, false);
});

test("resetPasswordController revokes the stored refresh token and clears the cookie", { concurrency: false }, async () => {
  let selectedFields = "";
  let saved = false;
  const user = {
    _id: "user-1",
    password: "old-password-hash",
    resetPasswordToken: "reset-token",
    resetPasswordExpries: new Date(Date.now() + 60_000),
    refreshToken: "old-refresh-token",
    async save() {
      saved = true;
    },
  };

  mockMethod(User, "findOne", (query) => {
    assert.equal(query.resetPasswordToken, "reset-token");
    return {
      async select(projection) {
        selectedFields = projection;
        return user;
      },
    };
  });

  const res = createResponse();
  await resetPasswordController({
    params: { token: "reset-token" },
    body: { password: "Strong1!" },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(selectedFields, "+resetPasswordToken +resetPasswordExpries");
  assert.equal(user.resetPasswordToken, undefined);
  assert.equal(user.resetPasswordExpries, undefined);
  assert.equal(user.refreshToken, null);
  assert.notEqual(user.password, "Strong1!");
  assert.equal(saved, true);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.clearedCookies[0].name, "refreshToken");
});
