export const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  banking: "Chuyển khoản",
  momo: "MoMo",
  vnpay: "VNPay",
  prototype: "Thanh toán thử nghiệm",
  payos: "PayOS",
};

export const getPaymentTimestampItems = (payment) => {
  if (!payment) return [];

  const timestamps = [];
  if (payment.transferredAt) {
    timestamps.push({
      key: "transferredAt",
      label: "Ngân hàng ghi nhận lúc",
      value: payment.transferredAt,
    });
  }
  if (payment.confirmedAt) {
    timestamps.push({
      key: "confirmedAt",
      label: "Hệ thống xác nhận lúc",
      value: payment.confirmedAt,
    });
  }

  if (!timestamps.length && payment.paidAt) {
    timestamps.push({
      key: "paidAt",
      label: "Thanh toán lúc",
      value: payment.paidAt,
    });
  }

  return timestamps;
};

export const getPrimaryPaymentTimestamp = (payment) =>
  getPaymentTimestampItems(payment)[0] || null;
