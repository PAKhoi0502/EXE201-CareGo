import SupportConversation from "../models/support-conversation.models.js";
import SupportMessage from "../models/support-message.models.js";
import { emitSupportConversation, emitSupportMessage } from "../socket/support.socket.js";

const getUserId = (req) => req.user?.userId || req.user?.id || req.user?._id;
const isAdmin = (req) => req.user?.role === "admin";

const populateConversation = (query) =>
  query
    .populate("userId", "name email phone role avatar")
    .populate("assignedAdminId", "name email role avatar")
    .populate("bookingId", "status");

const findAllowedConversation = async (req) => {
  const filter = { _id: req.params.id };
  if (!isAdmin(req)) filter.userId = getUserId(req);
  return populateConversation(SupportConversation.findOne(filter));
};

export const createSupportConversation = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { subject, category = "other", priority = "normal", bookingId, message } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ message: "Vui lòng nhập chủ đề và nội dung cần hỗ trợ." });
    }

    const conversation = await SupportConversation.create({
      userId,
      subject: subject.trim(),
      category,
      priority,
      bookingId: bookingId || null,
      lastMessage: message.trim(),
      lastMessageAt: new Date(),
    });

    const supportMessage = await SupportMessage.create({
      conversationId: conversation._id,
      senderId: userId,
      message: message.trim(),
    });

    const populatedConversation = await populateConversation(
      SupportConversation.findById(conversation._id),
    );
    const populatedMessage = await SupportMessage.findById(supportMessage._id).populate(
      "senderId",
      "name role avatar",
    );

    emitSupportConversation("support:new-conversation", populatedConversation);
    return res.status(201).json({ conversation: populatedConversation, message: populatedMessage });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMySupportConversations = async (req, res) => {
  try {
    const conversations = await populateConversation(
      SupportConversation.find({ userId: getUserId(req) }).sort({ lastMessageAt: -1 }),
    );
    return res.status(200).json({ conversations });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAdminSupportConversations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.priority && req.query.priority !== "all") filter.priority = req.query.priority;

    const conversations = await populateConversation(
      SupportConversation.find(filter).sort({ priority: -1, lastMessageAt: -1 }),
    );
    return res.status(200).json({ conversations });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSupportMessages = async (req, res) => {
  try {
    const conversation = await findAllowedConversation(req);
    if (!conversation) return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });

    const messages = await SupportMessage.find({ conversationId: conversation._id })
      .populate("senderId", "name role avatar")
      .sort({ createdAt: 1 });

    await SupportMessage.updateMany(
      { conversationId: conversation._id, senderId: { $ne: getUserId(req) }, isRead: false },
      { isRead: true },
    );

    return res.status(200).json({ conversation, messages });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const sendSupportMessage = async (req, res) => {
  try {
    const conversation = await findAllowedConversation(req);
    if (!conversation) return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });
    if (conversation.status === "resolved") {
      return res.status(400).json({ message: "Cuộc trò chuyện đã được giải quyết." });
    }

    const text = req.body.message?.trim();
    if (!text) return res.status(400).json({ message: "Vui lòng nhập nội dung tin nhắn." });

    if (isAdmin(req) && !conversation.assignedAdminId) {
      conversation.assignedAdminId = getUserId(req);
      conversation.status = "active";
    }
    conversation.lastMessage = text;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const message = await SupportMessage.create({
      conversationId: conversation._id,
      senderId: getUserId(req),
      message: text,
    });
    const populatedMessage = await SupportMessage.findById(message._id).populate(
      "senderId",
      "name role avatar",
    );
    const populatedConversation = await populateConversation(
      SupportConversation.findById(conversation._id),
    );

    emitSupportMessage(conversation._id, populatedMessage, populatedConversation);
    return res.status(201).json({ message: populatedMessage, conversation: populatedConversation });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateSupportConversation = async (req, res) => {
  try {
    const conversation = await SupportConversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện." });

    const updates = {};
    if (["waiting", "active", "resolved"].includes(req.body.status)) updates.status = req.body.status;
    if (["normal", "urgent"].includes(req.body.priority)) updates.priority = req.body.priority;
    if (req.body.assignToMe) updates.assignedAdminId = getUserId(req);
    if (req.body.assignedAdminId !== undefined) updates.assignedAdminId = req.body.assignedAdminId || null;

    const updated = await populateConversation(
      SupportConversation.findByIdAndUpdate(req.params.id, updates, { new: true }),
    );
    emitSupportConversation("support:conversation-updated", updated);
    return res.status(200).json({ conversation: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
