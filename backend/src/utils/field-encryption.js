import crypto from "node:crypto";

const PREFIX = "enc:v1:";

const getKey = () => {
  const secret = process.env.CAREGO_DATA_ENCRYPTION_KEY || process.env.JWT_SECRET_KEY;
  if (!secret) {
    const error = new Error("Thiếu CAREGO_DATA_ENCRYPTION_KEY hoặc JWT_SECRET_KEY để bảo vệ dữ liệu nhạy cảm.");
    error.statusCode = 500;
    throw error;
  }
  return crypto.createHash("sha256").update(secret).digest();
};

export const isEncryptedValue = (value) => String(value || "").startsWith(PREFIX);

export const encryptSensitiveValue = (value) => {
  const plainText = String(value || "");
  if (!plainText || isEncryptedValue(plainText)) return plainText;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
};

export const decryptSensitiveValue = (value) => {
  const encryptedValue = String(value || "");
  if (!encryptedValue || !isEncryptedValue(encryptedValue)) return encryptedValue;

  const [ivValue, tagValue, payloadValue] = encryptedValue.slice(PREFIX.length).split(".");
  if (!ivValue || !tagValue || !payloadValue) throw new Error("Dữ liệu mã hóa không hợp lệ.");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(payloadValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

export const maskBankAccountNumber = (value) => {
  const accountNumber = String(value || "").replace(/\s+/g, "");
  if (accountNumber.length <= 4) return accountNumber;
  return `${"*".repeat(Math.min(accountNumber.length - 4, 8))}${accountNumber.slice(-4)}`;
};
