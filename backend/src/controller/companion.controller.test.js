import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import CompanionProfile from "../models/companion-profile.models.js";
import User from "../models/user.models.js";
import { decryptSensitiveValue } from "../utils/field-encryption.js";
import {
  requestMyCompanionPhoneOtp,
  resubmitCompanionApplication,
  verifyMyCompanionPhoneOtp,
} from "./companion.controller.js";

const originalEncryptionKey = process.env.CAREGO_DATA_ENCRYPTION_KEY;
const originalJwtSecret = process.env.JWT_SECRET_KEY;
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

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()();
  }
  process.env.CAREGO_DATA_ENCRYPTION_KEY = originalEncryptionKey;
  process.env.JWT_SECRET_KEY = originalJwtSecret;
});

test("resubmitCompanionApplication moves a rejected profile back to pending and re-encrypts documents", { concurrency: false }, async () => {
  process.env.CAREGO_DATA_ENCRYPTION_KEY = "carego-test-secret";
  process.env.JWT_SECRET_KEY = "carego-test-secret";

  const profile = {
    _id: "profile-1",
    applicantCustomerId: "customer-1",
    vettingStatus: "rejected",
    userId: null,
    reviewedBy: "admin-1",
    reviewedAt: new Date("2026-07-01T09:00:00.000Z"),
    rejectionReason: "Thiếu giấy tờ",
    documents: {},
    set(updates) {
      Object.assign(this, updates);
    },
    async save() {
      this.saved = true;
    },
    toObject() {
      return {
        _id: this._id,
        applicantCustomerId: this.applicantCustomerId,
        vettingStatus: this.vettingStatus,
        reviewedBy: this.reviewedBy,
        reviewedAt: this.reviewedAt,
        rejectionReason: this.rejectionReason,
        documents: this.documents,
        fullName: this.fullName,
        phone: this.phone,
        workingShift: this.workingShift,
      };
    },
  };

  mockMethod(CompanionProfile, "findOne", () => createSelectQuery(profile));
  mockMethod(User, "findById", () => createSelectQuery({
    _id: "customer-1",
    name: "Khách hàng A",
    email: "customer@example.com",
  }));

  const req = {
    user: { userId: "customer-1", role: "customer" },
    body: {
      fullName: "Nguyễn Văn A",
      phone: "0900000001",
      gender: "male",
      dateOfBirth: "1998-05-10",
      applicantType: "student",
      university: "Đại học Y",
      major: "Điều dưỡng",
      graduationYear: "",
      yearsOfExperience: "",
      qualificationDescription: "",
      skills: ["Chăm sóc", "Theo dõi thuốc"],
      serviceAreas: ["Quận 1", "Quận 3"],
      workingShift: "morning",
      documents: {
        citizenIdFrontUrl: "cloudinary-auth:carego/companion-documents/front",
        citizenIdBackUrl: "cloudinary-auth:carego/companion-documents/back",
        studentCardUrl: "cloudinary-auth:carego/companion-documents/student",
      },
    },
  };
  const res = createResponse();

  await resubmitCompanionApplication(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(profile.saved, true);
  assert.equal(profile.vettingStatus, "pending");
  assert.equal(profile.reviewedBy, null);
  assert.equal(profile.reviewedAt, null);
  assert.equal(profile.rejectionReason, "");
  assert.notEqual(profile.documents.citizenIdFrontUrl, req.body.documents.citizenIdFrontUrl);
  assert.equal(
    decryptSensitiveValue(profile.documents.citizenIdFrontUrl),
    req.body.documents.citizenIdFrontUrl,
  );
  assert.equal(res.body.companionApplication.documents, undefined);
});

test("companion phone OTP request and verify work together on the same profile", { concurrency: false }, async () => {
  const profile = {
    _id: "profile-otp",
    userId: "companion-1",
    phone: "",
    phoneVerifiedAt: null,
    phoneVerificationOtpHash: "",
    phoneVerificationOtpExpires: null,
    async save() {
      this.saved = true;
    },
  };

  mockMethod(CompanionProfile, "findOne", () => createSelectQuery(profile));
  mockMethod(User, "findByIdAndUpdate", (userId, updates) =>
    createSelectQuery({
      _id: userId,
      phone: updates.phone ?? profile.phone,
      name: "Companion User",
      email: "companion@example.com",
    }));

  const requestReq = {
    user: { userId: "companion-1", role: "companion" },
    body: { phone: "0988123456" },
  };
  const requestRes = createResponse();

  await requestMyCompanionPhoneOtp(requestReq, requestRes);

  assert.equal(requestRes.statusCode, 200);
  assert.equal(profile.phone, "0988123456");
  assert.equal(typeof requestRes.body.mockOtp, "string");
  assert.equal(requestRes.body.mockOtp.length, 6);
  assert.ok(profile.phoneVerificationOtpHash);
  assert.ok(profile.phoneVerificationOtpExpires instanceof Date);

  const verifyReq = {
    user: { userId: "companion-1", role: "companion" },
    body: { otp: requestRes.body.mockOtp },
  };
  const verifyRes = createResponse();

  await verifyMyCompanionPhoneOtp(verifyReq, verifyRes);

  assert.equal(verifyRes.statusCode, 200);
  assert.ok(profile.phoneVerifiedAt instanceof Date);
  assert.equal(profile.phoneVerificationOtpHash, "");
  assert.equal(profile.phoneVerificationOtpExpires, null);
  assert.equal(verifyRes.body.user.phone, "0988123456");
  assert.equal(verifyRes.body.companionProfile.phone, "0988123456");
});
