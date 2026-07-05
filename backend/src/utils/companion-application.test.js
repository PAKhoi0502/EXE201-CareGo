import assert from "node:assert/strict";
import test from "node:test";
import {
  getCompanionApplicationProfileError,
  getRequiredCompanionDocumentFields,
  normalizeCompanionApplicantType,
} from "./companion-application.js";

const now = new Date("2026-07-05T00:00:00.000Z");
const baseProfile = {
  dateOfBirth: "2000-01-01",
  university: "Đại học Y Dược TP. HCM",
  major: "Điều dưỡng",
};

test("normalizes only supported companion applicant types", () => {
  assert.equal(normalizeCompanionApplicantType("graduate"), "graduate");
  assert.equal(normalizeCompanionApplicantType("unknown"), "");
});

test("requires identity images and the qualification document for each applicant type", () => {
  assert.deepEqual(getRequiredCompanionDocumentFields("student"), [
    "citizenIdFrontUrl",
    "citizenIdBackUrl",
    "studentCardUrl",
  ]);
  assert.equal(getRequiredCompanionDocumentFields("graduate").at(-1), "degreeCertificateUrl");
  assert.equal(getRequiredCompanionDocumentFields("healthcare_professional").at(-1), "professionalCertificateUrl");
  assert.equal(getRequiredCompanionDocumentFields("experienced_caregiver").at(-1), "experienceProofUrl");
  assert.equal(getRequiredCompanionDocumentFields("community_supporter").at(-1), "backgroundCheckUrl");
  assert.deepEqual(getRequiredCompanionDocumentFields(), ["citizenIdFrontUrl", "citizenIdBackUrl"]);
});

test("rejects applicants who are not yet 18", () => {
  const error = getCompanionApplicationProfileError({
    ...baseProfile,
    applicantType: "student",
    dateOfBirth: "2010-01-01",
  }, now);
  assert.match(error, /đủ 18 tuổi/);
});

test("requires education information for students and graduates", () => {
  const error = getCompanionApplicationProfileError({
    ...baseProfile,
    applicantType: "student",
    university: "",
  }, now);
  assert.match(error, /cơ sở đào tạo/);
});

test("requires a valid graduation year for graduates", () => {
  const invalidError = getCompanionApplicationProfileError({
    ...baseProfile,
    applicantType: "graduate",
    graduationYear: 2030,
  }, now);
  assert.match(invalidError, /năm tốt nghiệp/);

  const validError = getCompanionApplicationProfileError({
    ...baseProfile,
    applicantType: "graduate",
    graduationYear: 2024,
  }, now);
  assert.equal(validError, "");
});

test("requires experience and a description for experienced caregivers", () => {
  const error = getCompanionApplicationProfileError({
    applicantType: "experienced_caregiver",
    dateOfBirth: "1990-01-01",
    yearsOfExperience: 0,
    qualificationDescription: "",
  }, now);
  assert.match(error, /ít nhất 1 năm/);

  const validError = getCompanionApplicationProfileError({
    applicantType: "experienced_caregiver",
    dateOfBirth: "1990-01-01",
    yearsOfExperience: 3,
    qualificationDescription: "Ba năm hỗ trợ người cao tuổi tại nhà.",
  }, now);
  assert.equal(validError, "");
});

test("requires a suitability description for community supporters", () => {
  const error = getCompanionApplicationProfileError({
    applicantType: "community_supporter",
    dateOfBirth: "1995-01-01",
  }, now);
  assert.match(error, /mô tả kinh nghiệm/);
});
