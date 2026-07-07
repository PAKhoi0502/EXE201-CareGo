import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  isEncryptedValue,
  maskBankAccountNumber,
} from "./field-encryption.js";

test("encrypts and decrypts sensitive values with the configured key", () => {
  const originalKey = process.env.CAREGO_DATA_ENCRYPTION_KEY;
  process.env.CAREGO_DATA_ENCRYPTION_KEY = "carego-test-secret";

  try {
    const encrypted = encryptSensitiveValue("1234567890");
    assert.equal(isEncryptedValue(encrypted), true);
    assert.equal(decryptSensitiveValue(encrypted), "1234567890");
  } finally {
    process.env.CAREGO_DATA_ENCRYPTION_KEY = originalKey;
  }
});

test("keeps blank values and legacy plaintext values readable", () => {
  const originalKey = process.env.CAREGO_DATA_ENCRYPTION_KEY;
  process.env.CAREGO_DATA_ENCRYPTION_KEY = "carego-test-secret";

  try {
    assert.equal(encryptSensitiveValue(""), "");
    assert.equal(decryptSensitiveValue("legacy-plain-text"), "legacy-plain-text");
  } finally {
    process.env.CAREGO_DATA_ENCRYPTION_KEY = originalKey;
  }
});

test("masks bank account numbers before returning them to list views", () => {
  assert.equal(maskBankAccountNumber("123456789012"), "********9012");
  assert.equal(maskBankAccountNumber("1234"), "1234");
});
