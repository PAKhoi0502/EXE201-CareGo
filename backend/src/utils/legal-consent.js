import crypto from "node:crypto";
import ConsentReceipt from "../models/consent-receipt.models.js";
import { getLegalRequirements } from "../legal/legal-documents.js";

const hashIpAddress = (value) => {
  const ipAddress = String(value || "").trim();
  if (!ipAddress) return "";
  const salt = process.env.CONSENT_AUDIT_SALT || process.env.JWT_SECRET_KEY || "carego-consent";
  return crypto.createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex");
};

export const validateLegalAcceptances = ({ acceptances, flow, req }) => {
  const requiredDocuments = getLegalRequirements(flow);
  if (!requiredDocuments.length) {
    return { error: "Luồng xác nhận điều khoản không hợp lệ." };
  }

  const submitted = Array.isArray(acceptances) ? acceptances : [];
  const acceptedAt = new Date();
  const ipHash = hashIpAddress(req?.ip || req?.socket?.remoteAddress);
  const userAgent = String(req?.get?.("user-agent") || "").slice(0, 500);
  const normalized = [];

  for (const document of requiredDocuments) {
    const acceptance = submitted.find((item) => item?.documentType === document.type);
    if (!acceptance?.accepted) {
      return { error: `Bạn cần đồng ý với ${document.title}.` };
    }
    if (acceptance.documentVersion !== document.version) {
      return { error: `${document.title} đã có phiên bản mới. Vui lòng xem và xác nhận lại.` };
    }

    normalized.push({
      documentType: document.type,
      documentVersion: document.version,
      documentHash: document.hash,
      acceptedAt,
      source: flow,
      audience: flow === "COMPANION_APPLICATION" ? "companion" : "customer",
      ipHash,
      userAgent,
    });
  }

  return { acceptances: normalized };
};

export const saveConsentReceipts = async ({
  userId,
  acceptances,
  contextType = "",
  contextId = null,
}) => {
  if (!userId || !Array.isArray(acceptances) || !acceptances.length) {
    throw new Error("Không có dữ liệu chấp thuận hợp lệ để lưu.");
  }

  await Promise.all(acceptances.map((acceptance) => ConsentReceipt.findOneAndUpdate(
    {
      userId,
      documentType: acceptance.documentType,
      documentVersion: acceptance.documentVersion,
      source: acceptance.source,
      contextId,
    },
    {
      $set: {
        ...acceptance,
        userId,
        contextType,
        contextId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  )));
};
