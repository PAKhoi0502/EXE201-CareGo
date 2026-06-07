import { getPayOSPaymentLink, verifyPayOSWebhook } from "../config/payos.js";
import Booking from "../models/booking.models.js";
import Payment from "../models/payment.models.js";

const getPayOSPaymentQuery = ({ orderCode, paymentLinkId }) => {
  const filters = [];

  if (orderCode !== undefined && orderCode !== null) {
    filters.push({ orderCode: Number(orderCode) });
  }

  if (paymentLinkId) {
    filters.push({ paymentLinkId });
  }

  return filters.length > 0 ? { $or: filters } : null;
};

const getPaymentPaidAt = (paymentLink) => {
  const transactionDate = paymentLink?.transactions?.findLast?.((transaction) => transaction.transactionDateTime)?.transactionDateTime;
  return transactionDate ? new Date(transactionDate) : new Date();
};

const updatePaidPayment = async ({ payment, booking, rawWebhook, paidAt }) => {
  payment.rawWebhook = rawWebhook;

  if (payment.status !== "paid") {
    payment.status = "paid";
    payment.paidAt = payment.paidAt || paidAt || new Date();
  }
  await payment.save();

  if (booking.status !== "paid") {
    booking.status = "paid";
    await booking.save();
  }
};

const syncPaymentStatusFromPayOSLink = async ({ payment, booking, paymentLink }) => {
  payment.rawWebhook = {
    source: "payos-sync",
    syncedAt: new Date(),
    paymentLink,
  };

  const status = String(paymentLink?.status || "").toUpperCase();
  if (status === "PAID") {
    const paidAmount = Number(payment.paidAmount || payment.amount || 0);
    const amountPaid = Number(paymentLink.amountPaid ?? paymentLink.amount ?? 0);
    const orderAmount = Number(paymentLink.amount ?? 0);

    if (paidAmount > 0 && amountPaid !== paidAmount && orderAmount !== paidAmount) {
      payment.status = "failed";
      await payment.save();
      const error = new Error("payment amount mismatch");
      error.statusCode = 400;
      throw error;
    }

    await updatePaidPayment({
      payment,
      booking,
      rawWebhook: payment.rawWebhook,
      paidAt: getPaymentPaidAt(paymentLink),
    });
    return;
  }

  if (status === "CANCELLED") {
    payment.status = "cancelled";
  } else if (status === "EXPIRED") {
    payment.status = "expired";
  } else if (status === "FAILED") {
    payment.status = "failed";
  } else if (payment.status !== "paid") {
    payment.status = "pending";
  }

  await payment.save();
};

export const handlePayOSWebhook = async (req, res) => {
  try {
    const webhookData = await verifyPayOSWebhook(req.body);
    const paymentQuery = getPayOSPaymentQuery(webhookData);

    if (!paymentQuery) {
      return res.status(400).json({ success: false, message: "invalid webhook payment reference" });
    }

    const payment = await Payment.findOne(paymentQuery);
    if (!payment) {
      return res.status(404).json({ success: false, message: "payment not found" });
    }

    payment.rawWebhook = req.body;

    if (!req.body?.success || req.body?.code !== "00" || webhookData.code !== "00") {
      await payment.save();
      return res.status(200).json({ success: true, message: "webhook ignored" });
    }

    const paidAmount = Number(payment.paidAmount || payment.amount || 0);
    const webhookAmount = Number(webhookData.amount || 0);
    if (paidAmount > 0 && webhookAmount !== paidAmount) {
      payment.status = "failed";
      await payment.save();
      return res.status(400).json({ success: false, message: "payment amount mismatch" });
    }

    const booking = await Booking.findById(payment.bookingId);
    if (!booking) {
      await payment.save();
      return res.status(404).json({ success: false, message: "booking not found" });
    }

    await updatePaidPayment({ payment, booking, rawWebhook: req.body, paidAt: new Date() });

    return res.status(200).json({
      success: true,
      message: "payment webhook processed",
      paymentStatus: payment.status,
      bookingStatus: booking.status,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: "invalid payos webhook",
      error: error.message,
    });
  }
};

export const syncPayOSPayment = async (req, res) => {
  try {
    const orderCode = Number(req.body?.orderCode);
    const bookingId = req.body?.bookingId;

    if (!Number.isFinite(orderCode)) {
      return res.status(400).json({ success: false, message: "invalid order code" });
    }

    const payment = await Payment.findOne({ orderCode });
    if (!payment || (bookingId && payment.bookingId.toString() !== bookingId)) {
      return res.status(404).json({ success: false, message: "payment not found" });
    }

    const booking = await Booking.findById(payment.bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "booking not found" });
    }

    if (req.user.role === "customer" && booking.customerId.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: "permission denied" });
    }

    if (payment.status !== "paid") {
      const paymentLink = await getPayOSPaymentLink(orderCode);
      await syncPaymentStatusFromPayOSLink({ payment, booking, paymentLink });
    }

    return res.status(200).json({
      success: true,
      message: "payment synced",
      paymentStatus: payment.status,
      bookingStatus: booking.status,
      payment,
      booking,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: "payment sync failed",
      error: error.message,
    });
  }
};
