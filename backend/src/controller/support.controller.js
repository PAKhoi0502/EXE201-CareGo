import mongoose from "mongoose";
import Booking from "../models/booking.models.js";
import SupportConversation, {
  SUPPORT_CONVERSATION_SUBJECT_MAX_LENGTH,
} from "../models/support-conversation.models.js";
import SupportMessage, { SUPPORT_MESSAGE_MAX_LENGTH } from "../models/support-message.models.js";
import User from "../models/user.models.js";
import { emitSupportConversation, emitSupportMessage } from "../socket/support.socket.js";
import { emitAdminSupportConversationAlert } from "../utils/admin-alerts.js";

const getUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;
const isAdmin = (req) => req.user?.role === "admin";
const SUPPORT_STATUSES = ["waiting", "active", "resolved"];
const SUPPORT_PRIORITIES = ["normal", "urgent"];
const SUPPORT_MESSAGE_DEFAULT_LIMIT = 50;
const SUPPORT_MESSAGE_MAX_LIMIT = 100;
const SUPPORT_STATUS_TRANSITIONS = {
  waiting: ["waiting", "active", "resolved"],
  active: ["active", "resolved"],
  resolved: ["resolved"],
};

const normalizeMessageText = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeSubjectText = (value) => (typeof value === "string" ? value.trim() : "");
const toIdString = (value) => String(value?._id || value || "");
const createHttpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const getHttpErrorResponse = (error) =>
  Number.isInteger(error?.statusCode)
    ? { statusCode: error.statusCode, message: error.message }
    : null;

const getSubjectTextError = (text) => {
  if (!text) {
    return { statusCode: 400, message: "Vui lòng nhập chủ đề và nội dung cần hỗ trợ." };
  }

  if (text.length > SUPPORT_CONVERSATION_SUBJECT_MAX_LENGTH) {
    return {
      statusCode: 413,
      message: `Chủ đề tối đa ${SUPPORT_CONVERSATION_SUBJECT_MAX_LENGTH} ký tự.`,
      maxLength: SUPPORT_CONVERSATION_SUBJECT_MAX_LENGTH,
    };
  }

  return null;
};

const getMessageTextError = (text) => {
  if (!text) {
    return { statusCode: 400, message: "Vui lòng nhập nội dung tin nhắn." };
  }

  if (text.length > SUPPORT_MESSAGE_MAX_LENGTH) {
    return {
      statusCode: 413,
      message: `Tin nhắn tối đa ${SUPPORT_MESSAGE_MAX_LENGTH} ký tự.`,
      maxLength: SUPPORT_MESSAGE_MAX_LENGTH,
    };
  }

  return null;
};

const getValidationErrorResponse = (error) => {
  if (error?.name !== "ValidationError") {
    return null;
  }

  const errors = Object.values(error.errors || {});
  const subjectTooLong = errors.some((item) => item?.path === "subject" && item?.kind === "maxlength");
  const messageTooLong = errors.some((item) => item?.path === "message" && item?.kind === "maxlength");
  if (subjectTooLong) {
    return {
      statusCode: 413,
      message: `Chủ đề tối đa ${SUPPORT_CONVERSATION_SUBJECT_MAX_LENGTH} ký tự.`,
      maxLength: SUPPORT_CONVERSATION_SUBJECT_MAX_LENGTH,
    };
  }

  return {
    statusCode: messageTooLong ? 413 : 400,
    message: messageTooLong
      ? `Tin nhắn tối đa ${SUPPORT_MESSAGE_MAX_LENGTH} ký tự.`
      : "Dữ liệu hỗ trợ không hợp lệ.",
    maxLength: messageTooLong ? SUPPORT_MESSAGE_MAX_LENGTH : undefined,
  };
};

const getCastErrorResponse = (error) => {
  if (error?.name !== "CastError") {
    return null;
  }

  return {
    statusCode: 400,
    message: "Dữ liệu định danh không hợp lệ.",
  };
};

const getRequestErrorResponse = (error) =>
  getValidationErrorResponse(error) ||
  getCastErrorResponse(error) ||
  getHttpErrorResponse(error);

const populateConversation = (query) =>
  query
    .populate("userId", "name email phone role avatar")
    .populate("assignedAdminId", "name email role avatar")
    .populate("bookingId", "status");

const findAllowedConversation = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return null;
  }

  const filter = { _id: req.params.id };
  if (!isAdmin(req)) filter.userId = getUserId(req);
  return populateConversation(SupportConversation.findOne(filter));
};

const findAllowedBookingId = async ({ bookingId, userId }) => {
  if (!bookingId) {
    return { bookingId: null };
  }

  if (!mongoose.isValidObjectId(bookingId)) {
    return {
      error: {
        statusCode: 400,
        message: "Mã lịch chăm sóc không hợp lệ.",
      },
    };
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    $or: [
      { customerId: userId },
      { companionId: userId },
    ],
  }).select("_id");

  if (!booking) {
    return {
      error: {
        statusCode: 404,
        message: "Không tìm thấy lịch chăm sóc thuộc tài khoản của bạn.",
      },
    };
  }

  return { bookingId: booking._id };
};

const findAssignableAdminId = async (assignedAdminId) => {
  if (assignedAdminId === null || assignedAdminId === "") {
    return { adminId: null };
  }

  if (!mongoose.isValidObjectId(assignedAdminId)) {
    return {
      error: {
        statusCode: 400,
        message: "Mã quản trị viên được chỉ định không hợp lệ.",
      },
    };
  }

  const admin = await User.findOne({
    _id: assignedAdminId,
    role: "admin",
    isActive: true,
  }).select("_id");

  if (!admin) {
    return {
      error: {
        statusCode: 400,
        message: "Quản trị viên được chỉ định phải là tài khoản đang hoạt động.",
      },
    };
  }

  return { adminId: admin._id };
};

const isSupportStatusTransitionAllowed = (currentStatus, nextStatus) =>
  Boolean(SUPPORT_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus));

const getPaginationLimit = (value, defaultLimit, maxLimit) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(maxLimit, Math.floor(parsed));
};

const getSupportMessageCursorFilter = async ({ conversationId, before }) => {
  if (!before) {
    return { filter: {} };
  }

  if (!mongoose.isValidObjectId(before)) {
    return {
      error: {
        statusCode: 400,
        message: "Mốc phân trang tin nhắn không hợp lệ.",
      },
    };
  }

  const cursorMessage = await SupportMessage.findOne({
    _id: before,
    conversationId,
  }).select("_id createdAt");

  if (!cursorMessage) {
    return {
      error: {
        statusCode: 400,
        message: "Mốc phân trang tin nhắn không thuộc cuộc trò chuyện này.",
      },
    };
  }

  return {
    filter: {
      $or: [
        { createdAt: { $lt: cursorMessage.createdAt } },
        { createdAt: cursorMessage.createdAt, _id: { $lt: cursorMessage._id } },
      ],
    },
  };
};

export const createSupportConversation = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { subject, category = "other", priority = "normal", bookingId, message } = req.body;
    const subjectText = normalizeSubjectText(subject);
    const messageText = normalizeMessageText(message);

    const subjectError = getSubjectTextError(subjectText);
    if (subjectError) {
      return res.status(subjectError.statusCode).json(subjectError);
    }

    const messageError = getMessageTextError(messageText);
    if (messageError) {
      return res.status(messageError.statusCode).json(messageError);
    }

    const bookingResult = await findAllowedBookingId({ bookingId, userId });
    if (bookingResult.error) {
      return res.status(bookingResult.error.statusCode).json(bookingResult.error);
    }

    const conversation = await SupportConversation.create({
      userId,
      subject: subjectText,
      category,
      priority,
      bookingId: bookingResult.bookingId,
      lastMessage: messageText,
      lastMessageAt: new Date(),
    });

    const supportMessage = await SupportMessage.create({
      conversationId: conversation._id,
      senderId: userId,
      message: messageText,
    });

    const populatedConversation = await populateConversation(
      SupportConversation.findById(conversation._id),
    );
    const populatedMessage = await SupportMessage.findById(supportMessage._id).populate(
      "senderId",
      "name role avatar",
    );

    emitSupportConversation("support:new-conversation", populatedConversation);
    emitAdminSupportConversationAlert(populatedConversation);
    return res.status(201).json({ conversation: populatedConversation, message: populatedMessage });
  } catch (error) {
    const requestError = getRequestErrorResponse(error);
    if (requestError) {
      return res.status(requestError.statusCode).json(requestError);
    }

    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};

export const getMySupportConversations = async (req, res) => {
  try {
    const conversations = await populateConversation(
      SupportConversation.find({ userId: getUserId(req) }).sort({ lastMessageAt: -1 }),
    );
    return res.status(200).json({ conversations });
  } catch (error) {
    const requestError = getRequestErrorResponse(error);
    if (requestError) {
      return res.status(requestError.statusCode).json(requestError);
    }

    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};

export const getAdminSupportConversations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.priority && req.query.priority !== "all") filter.priority = req.query.priority;

    const [conversations, summaryRows] = await Promise.all([
      populateConversation(
        SupportConversation.find(filter).sort({ priority: -1, lastMessageAt: -1 }),
      ),
      SupportConversation.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            waiting: { $sum: { $cond: [{ $eq: ["$status", "waiting"] }, 1, 0] } },
            urgent: { $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] } },
          },
        },
      ]),
    ]);
    const summary = summaryRows[0] || { total: 0, waiting: 0, urgent: 0 };

    return res.status(200).json({
      conversations,
      summary: {
        total: summary.total,
        waiting: summary.waiting,
        urgent: summary.urgent,
      },
    });
  } catch (error) {
    const requestError = getRequestErrorResponse(error);
    if (requestError) {
      return res.status(requestError.statusCode).json(requestError);
    }

    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};

export const getSupportMessages = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });
    }

    const conversation = await findAllowedConversation(req);
    if (!conversation) return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });

    const limit = getPaginationLimit(
      req.query.limit,
      SUPPORT_MESSAGE_DEFAULT_LIMIT,
      SUPPORT_MESSAGE_MAX_LIMIT,
    );
    const cursor = await getSupportMessageCursorFilter({
      conversationId: conversation._id,
      before: req.query.before,
    });
    if (cursor.error) {
      return res.status(cursor.error.statusCode).json(cursor.error);
    }

    const page = await SupportMessage.find({
      conversationId: conversation._id,
      ...cursor.filter,
    })
      .populate("senderId", "name role avatar")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = page.length > limit;
    const messages = (hasMore ? page.slice(0, limit) : page).reverse();
    const nextBefore = hasMore && messages[0]?._id ? String(messages[0]._id) : null;

    await SupportMessage.updateMany(
      { conversationId: conversation._id, senderId: { $ne: getUserId(req) }, isRead: false },
      { isRead: true },
    );

    return res.status(200).json({
      conversation,
      messages,
      pagination: {
        limit,
        hasMore,
        nextBefore,
      },
    });
  } catch (error) {
    const requestError = getRequestErrorResponse(error);
    if (requestError) {
      return res.status(requestError.statusCode).json(requestError);
    }

    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};

export const sendSupportMessage = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });
    }

    const text = normalizeMessageText(req.body?.message);
    const textError = getMessageTextError(text);
    if (textError) return res.status(textError.statusCode).json(textError);

    const userId = getUserId(req);
    let conversationId = null;
    let messageId = null;

    await session.withTransaction(async () => {
      const filter = { _id: req.params.id };
      if (!isAdmin(req)) filter.userId = userId;

      const conversation = await SupportConversation.findOne(filter).session(session);
      if (!conversation) {
        throw createHttpError(404, "Không tìm thấy cuộc trò chuyện.");
      }

      if (conversation.status === "resolved") {
        throw createHttpError(400, "Cuộc trò chuyện đã được giải quyết.");
      }

      const [createdMessage] = await SupportMessage.create(
        [{
          conversationId: conversation._id,
          senderId: userId,
          message: text,
        }],
        { session },
      );

      const updates = {
        lastMessage: text,
        lastMessageAt: new Date(),
      };
      if (isAdmin(req) && !conversation.assignedAdminId) {
        updates.assignedAdminId = userId;
        updates.status = "active";
      }

      const updatedConversation = await SupportConversation.findByIdAndUpdate(
        conversation._id,
        updates,
        { new: true, session },
      );

      conversationId = updatedConversation._id;
      messageId = createdMessage._id;
    });

    const populatedMessage = await SupportMessage.findById(messageId).populate(
      "senderId",
      "name role avatar",
    );
    const populatedConversation = await populateConversation(
      SupportConversation.findById(conversationId),
    );

    emitSupportMessage(conversationId, populatedMessage, populatedConversation);
    return res.status(201).json({ message: populatedMessage, conversation: populatedConversation });
  } catch (error) {
    const requestError = getRequestErrorResponse(error);
    if (requestError) {
      return res.status(requestError.statusCode).json(requestError);
    }

    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  } finally {
    await session.endSession();
  }
};

export const updateSupportConversation = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });
    }

    if (req.body.assignToMe && req.body.assignedAdminId !== undefined) {
      return res.status(400).json({ message: "Không thể vừa nhận xử lý vừa chỉ định quản trị viên khác." });
    }

    if (req.body.assignToMe && req.body.status !== undefined && req.body.status !== "active") {
      return res.status(400).json({ message: "Nhận xử lý chỉ có thể chuyển yêu cầu sang trạng thái đang xử lý." });
    }

    const conversation = await SupportConversation.findById(req.params.id).select(
      "_id status priority assignedAdminId updatedAt",
    );
    if (!conversation) return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });

    const userId = getUserId(req);
    const currentAssignedAdminId = toIdString(conversation.assignedAdminId);
    const hasStatus = req.body.status !== undefined;
    const hasPriority = req.body.priority !== undefined;
    const hasAssignedAdmin = req.body.assignedAdminId !== undefined;
    const updates = {};

    if (hasStatus) {
      if (!SUPPORT_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ message: "Trạng thái hỗ trợ không hợp lệ." });
      }

      if (!isSupportStatusTransitionAllowed(conversation.status, req.body.status)) {
        return res.status(409).json({ message: "Không thể chuyển trạng thái hỗ trợ theo chiều này." });
      }

      if (currentAssignedAdminId && currentAssignedAdminId !== userId && !hasAssignedAdmin && !req.body.assignToMe) {
        return res.status(409).json({ message: "Yêu cầu hỗ trợ đang được quản trị viên khác xử lý." });
      }

      updates.status = req.body.status;
    }

    if (hasPriority) {
      if (!SUPPORT_PRIORITIES.includes(req.body.priority)) {
        return res.status(400).json({ message: "Mức ưu tiên hỗ trợ không hợp lệ." });
      }

      updates.priority = req.body.priority;
    }

    if (req.body.assignToMe) {
      if (conversation.status === "resolved") {
        return res.status(409).json({ message: "Yêu cầu hỗ trợ đã được giải quyết nên không thể nhận xử lý." });
      }

      if (currentAssignedAdminId && currentAssignedAdminId !== userId) {
        return res.status(409).json({ message: "Yêu cầu hỗ trợ đã được quản trị viên khác nhận xử lý." });
      }

      updates.assignedAdminId = userId;
      updates.status = "active";
    }

    if (hasAssignedAdmin) {
      if (conversation.status === "resolved") {
        return res.status(409).json({ message: "Yêu cầu hỗ trợ đã được giải quyết nên không thể đổi người xử lý." });
      }

      const assignee = await findAssignableAdminId(req.body.assignedAdminId);
      if (assignee.error) {
        return res.status(assignee.error.statusCode).json(assignee.error);
      }

      updates.assignedAdminId = assignee.adminId;
      if (assignee.adminId && conversation.status === "waiting" && !hasStatus) {
        updates.status = "active";
      }
      if (!assignee.adminId && conversation.status === "active" && !hasStatus) {
        updates.status = "waiting";
      }
    }

    if (updates.status && ["active", "resolved"].includes(updates.status) && !updates.assignedAdminId && !currentAssignedAdminId) {
      updates.assignedAdminId = userId;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Không có dữ liệu hỗ trợ hợp lệ để cập nhật." });
    }

    const updated = await populateConversation(
      SupportConversation.findOneAndUpdate(
        {
          _id: conversation._id,
          updatedAt: conversation.updatedAt,
        },
        updates,
        { new: true, runValidators: true },
      ),
    );
    if (!updated) {
      return res.status(409).json({ message: "Yêu cầu hỗ trợ đã được quản trị viên khác cập nhật. Vui lòng tải lại." });
    }

    emitSupportConversation("support:conversation-updated", updated);
    return res.status(200).json({ conversation: updated });
  } catch (error) {
    const requestError = getRequestErrorResponse(error);
    if (requestError) {
      return res.status(requestError.statusCode).json(requestError);
    }

    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." });
  }
};
