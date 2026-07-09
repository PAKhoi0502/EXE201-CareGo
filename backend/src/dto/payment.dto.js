const toPlainObject = (payment) => {
  if (!payment) return null;
  return typeof payment.toObject === "function" ? payment.toObject() : payment;
};

const pick = (source, fields) => Object.fromEntries(
  fields.map((field) => [field, source[field]]),
);

const COMMON_FIELDS = [
  "_id",
  "bookingId",
  "status",
  "paidAt",
  "createdAt",
  "updatedAt",
];

const CUSTOMER_FIELDS = [
  ...COMMON_FIELDS,
  "amount",
  "baseAmount",
  "penaltyAmount",
  "paidAmount",
  "method",
  "orderCode",
  "expiresAt",
];

const COMPANION_FIELDS = [
  ...COMMON_FIELDS,
  "companionEarning",
  "method",
];

const ADMIN_FIELDS = [
  ...COMMON_FIELDS,
  "customerId",
  "companionId",
  "amount",
  "baseAmount",
  "penaltyAmount",
  "paidAmount",
  "platformFee",
  "companionEarning",
  "method",
  "orderCode",
  "expiresAt",
];

const FIELDS_BY_ROLE = {
  customer: CUSTOMER_FIELDS,
  companion: COMPANION_FIELDS,
  admin: ADMIN_FIELDS,
};

export const toPaymentDto = (payment, role) => {
  const source = toPlainObject(payment);
  if (!source) return null;

  const fields = FIELDS_BY_ROLE[role];
  if (!fields) return null;
  return pick(source, fields);
};

export const PAYMENT_RESPONSE_FIELDS = {
  customer: CUSTOMER_FIELDS,
  companion: COMPANION_FIELDS,
  admin: ADMIN_FIELDS,
};
