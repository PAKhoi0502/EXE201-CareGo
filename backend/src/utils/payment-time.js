const PAYOS_LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;

export const parsePayOSDateTime = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === "number") {
    const numericDate = new Date(value);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate;
  }

  const rawValue = String(value).trim();
  if (!rawValue) return null;

  const localMatch = rawValue.match(PAYOS_LOCAL_DATE_TIME_PATTERN);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4]);
    const minute = Number(localMatch[5]);
    const second = Number(localMatch[6]);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (
      month < 1 || month > 12
      || day < 1 || day > daysInMonth
      || hour > 23 || minute > 59 || second > 59
    ) {
      return null;
    }
  }
  const normalizedValue = localMatch
    ? `${localMatch[1]}-${localMatch[2]}-${localMatch[3]}T${localMatch[4]}:${localMatch[5]}:${localMatch[6]}.${(localMatch[7] || "0").padEnd(3, "0")}+07:00`
    : rawValue;
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const getPayOSTransferredAt = (paymentData) => {
  const directTransactionTime = parsePayOSDateTime(paymentData?.transactionDateTime);
  if (directTransactionTime) return directTransactionTime;

  const transactions = Array.isArray(paymentData?.transactions)
    ? paymentData.transactions
    : [];

  for (let index = transactions.length - 1; index >= 0; index -= 1) {
    const transactionTime = parsePayOSDateTime(transactions[index]?.transactionDateTime);
    if (transactionTime) return transactionTime;
  }

  return null;
};

export const applyPaymentConfirmationTimes = (
  payment,
  {
    transferredAt = null,
    confirmedAt = new Date(),
    fallbackSource = "server_fallback",
  } = {},
) => {
  const normalizedConfirmedAt = parsePayOSDateTime(confirmedAt);
  const normalizedTransferredAt = parsePayOSDateTime(transferredAt);

  if (!payment.confirmedAt && normalizedConfirmedAt) {
    payment.confirmedAt = normalizedConfirmedAt;
  }

  if (!payment.transferredAt && normalizedTransferredAt) {
    payment.transferredAt = normalizedTransferredAt;
  }

  const storedTransferredAt = parsePayOSDateTime(payment.transferredAt);
  if (storedTransferredAt) {
    payment.transferredAt = storedTransferredAt;
    payment.paidAt = storedTransferredAt;
    payment.paidAtSource = "payos";
    return payment;
  }

  if (!payment.paidAt && payment.confirmedAt) {
    payment.paidAt = payment.confirmedAt;
  }
  if (!payment.paidAtSource) {
    payment.paidAtSource = fallbackSource;
  }

  return payment;
};
