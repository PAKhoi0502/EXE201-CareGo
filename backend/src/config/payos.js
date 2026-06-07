import { PayOS } from "@payos/node";

let payOSClient;

const requirePayOSEnv = (keys) => {
  const missingKeys = keys.filter((key) => !process.env[key]);
  if (missingKeys.length > 0) {
    const error = new Error(`Missing PayOS config: ${missingKeys.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }
};

export const getPayOSClient = () => {
  requirePayOSEnv(["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"]);

  if (!payOSClient) {
    payOSClient = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID,
      apiKey: process.env.PAYOS_API_KEY,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY,
    });
  }

  return payOSClient;
};

export const createPayOSPaymentLink = (paymentData) =>
  getPayOSClient().paymentRequests.create(paymentData);

export const getPayOSPaymentLink = (orderCode) =>
  getPayOSClient().paymentRequests.get(orderCode);

export const verifyPayOSWebhook = (webhookBody) =>
  getPayOSClient().webhooks.verify(webhookBody);

export const getPayOSPaymentExpireMinutes = () => {
  const minutes = Number(process.env.PAYOS_PAYMENT_EXPIRE_MINUTES || 15);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 15;
  }

  return minutes;
};

export const buildPayOSRedirectUrl = (baseUrl, params, label) => {
  if (!baseUrl) {
    const error = new Error(`Missing PayOS ${label}`);
    error.statusCode = 500;
    throw error;
  }

  try {
    const url = new URL(baseUrl);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  } catch {
    const error = new Error(`Invalid PayOS ${label}`);
    error.statusCode = 500;
    throw error;
  }
};
