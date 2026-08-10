import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
import Booking from "../models/booking.models.js";
import SupportConversation from "../models/support-conversation.models.js";
import SupportMessage from "../models/support-message.models.js";
import User from "../models/user.models.js";

dotenv.config();

export const supportSeed = [
  {
    seedKey: "demo-support-shift-notes",
    customerEmail: "ngthuydung91@gmail.com",
    bookingSeedKey: "demo-booking-week8-01",
    subject: "Không xem được ghi chú sau ca chăm sóc",
    category: "booking",
    priority: "normal",
    status: "resolved",
    openedAt: "2026-07-01T08:35:00+07:00",
    messages: [
      {
        sender: "customer",
        text: "Sau khi ca chăm sóc hôm qua kết thúc, tôi không thấy phần ghi chú sức khỏe của người thân. Nhờ CareGo kiểm tra giúp.",
        sentAt: "2026-07-01T08:35:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "CareGo đã kiểm tra và đồng bộ lại nhật ký ca chăm sóc. Chị vui lòng tải lại trang chi tiết booking giúp em.",
        sentAt: "2026-07-01T09:10:00+07:00",
        isRead: true,
      },
      {
        sender: "customer",
        text: "Tôi đã xem được đầy đủ ghi chú rồi, cảm ơn đội ngũ hỗ trợ.",
        sentAt: "2026-07-01T09:24:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "Cảm ơn chị đã xác nhận. CareGo xin phép đóng yêu cầu hỗ trợ này.",
        sentAt: "2026-07-01T09:30:00+07:00",
        isRead: true,
      },
    ],
  },
  {
    seedKey: "demo-support-payment-status",
    customerEmail: "tranqdat88@gmail.com",
    bookingSeedKey: "demo-booking-week8-02",
    subject: "Cần kiểm tra trạng thái thanh toán booking",
    category: "payment",
    priority: "normal",
    status: "resolved",
    openedAt: "2026-07-03T08:20:00+07:00",
    messages: [
      {
        sender: "customer",
        text: "Booking ngày 2/7 đã thanh toán nhưng lịch sử giao dịch cập nhật hơi chậm. Nhờ bộ phận hỗ trợ kiểm tra giúp tôi.",
        sentAt: "2026-07-03T08:20:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "CareGo đã tiếp nhận và đang đối chiếu giao dịch với thông tin booking. Em sẽ cập nhật lại cho anh ngay khi kiểm tra xong.",
        sentAt: "2026-07-03T09:05:00+07:00",
        isRead: false,
      },
      {
        sender: "admin",
        text: "CareGo đã đối chiếu xong: giao dịch đã thanh toán thành công và lịch sử thanh toán đã được đồng bộ. Anh vui lòng tải lại trang chi tiết booking.",
        sentAt: "2026-07-03T11:30:00+07:00",
        isRead: false,
      },
    ],
  },
  {
    seedKey: "demo-support-update-phone",
    customerEmail: "lengochan.92@gmail.com",
    subject: "Hướng dẫn cập nhật số điện thoại tài khoản",
    category: "account",
    priority: "normal",
    status: "resolved",
    openedAt: "2026-07-06T09:15:00+07:00",
    messages: [
      {
        sender: "customer",
        text: "Tôi muốn đổi số điện thoại nhận liên hệ trong tài khoản nhưng chưa tìm thấy mục cập nhật. Nhờ CareGo hướng dẫn giúp.",
        sentAt: "2026-07-06T09:15:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "Anh/chị có thể cập nhật số điện thoại tại Hồ sơ cá nhân > Thông tin liên hệ. CareGo đã kiểm tra và tài khoản hiện đủ điều kiện cập nhật.",
        sentAt: "2026-07-06T10:00:00+07:00",
        isRead: false,
      },
    ],
  },
  {
    seedKey: "demo-support-companion-late",
    customerEmail: "phamtrungkien89@gmail.com",
    bookingSeedKey: "demo-booking-week9-01",
    subject: "Companion đến trễ so với lịch hẹn",
    category: "booking",
    priority: "urgent",
    status: "resolved",
    openedAt: "2026-07-06T13:20:00+07:00",
    messages: [
      {
        sender: "customer",
        text: "Companion đến trễ khoảng 15 phút so với lịch hẹn sáng nay. Gia đình muốn CareGo ghi nhận để các ca sau đúng giờ hơn.",
        sentAt: "2026-07-06T13:20:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "CareGo xin lỗi gia đình vì sự bất tiện này. Bên em đã liên hệ companion để xác minh và nhắc lại quy định về thời gian nhận ca.",
        sentAt: "2026-07-06T14:00:00+07:00",
        isRead: true,
      },
      {
        sender: "customer",
        text: "Companion đã giải thích và thời gian chăm sóc vẫn được đảm bảo đủ. Gia đình đồng ý khép lại phản ánh.",
        sentAt: "2026-07-06T14:15:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "Cảm ơn anh đã phản hồi. CareGo đã ghi nhận nội dung và hoàn tất xử lý yêu cầu.",
        sentAt: "2026-07-06T14:30:00+07:00",
        isRead: true,
      },
    ],
  },
  {
    seedKey: "demo-support-payment-invoice",
    customerEmail: "myhanh.vo93@gmail.com",
    bookingSeedKey: "demo-booking-week9-02",
    subject: "Cần hóa đơn chi tiết cho booking",
    category: "payment",
    priority: "normal",
    status: "resolved",
    openedAt: "2026-07-09T10:05:00+07:00",
    messages: [
      {
        sender: "customer",
        text: "Tôi cần thông tin chi tiết khoản thanh toán của booking ngày 8/7 để lưu cùng hồ sơ chăm sóc gia đình.",
        sentAt: "2026-07-09T10:05:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "CareGo đã bổ sung đầy đủ chi tiết khoản thanh toán trong booking. Chị vui lòng mở mục Lịch sử thanh toán để xem và lưu thông tin.",
        sentAt: "2026-07-09T11:20:00+07:00",
        isRead: false,
      },
    ],
  },
  {
    seedKey: "demo-support-checkin-photo",
    customerEmail: "danganhtuan87@gmail.com",
    bookingSeedKey: "demo-booking-week9-03",
    subject: "Không hiển thị ảnh check-in của companion",
    category: "booking",
    priority: "normal",
    status: "resolved",
    openedAt: "2026-07-11T08:40:00+07:00",
    messages: [
      {
        sender: "customer",
        text: "Trong chi tiết booking tôi chưa xem được ảnh check-in của companion, dù các thông tin khác vẫn hiển thị bình thường.",
        sentAt: "2026-07-11T08:40:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "Bên em đã tiếp nhận và đang kiểm tra dữ liệu ảnh của ca chăm sóc. Anh vui lòng chưa xóa bộ nhớ ứng dụng trong lúc đối soát.",
        sentAt: "2026-07-11T09:15:00+07:00",
        isRead: true,
      },
      {
        sender: "customer",
        text: "Tôi đã thử tải lại nhưng ảnh vẫn chưa xuất hiện. Nhờ CareGo tiếp tục kiểm tra giúp.",
        sentAt: "2026-07-11T10:05:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "CareGo đã khôi phục ảnh check-in bị lỗi đồng bộ. Anh vui lòng tải lại trang chi tiết booking; dữ liệu ca chăm sóc đã hiển thị đầy đủ.",
        sentAt: "2026-07-11T11:10:00+07:00",
        isRead: false,
      },
    ],
  },
  {
    seedKey: "demo-support-safety-feedback",
    customerEmail: "khanhlinh.bui94@gmail.com",
    bookingSeedKey: "demo-booking-week9-04",
    subject: "Phản ánh an toàn khi hỗ trợ di chuyển",
    category: "safety",
    priority: "urgent",
    status: "resolved",
    openedAt: "2026-07-12T15:30:00+07:00",
    messages: [
      {
        sender: "customer",
        text: "Khi đưa người thân lên xe, companion thao tác hơi vội làm gia đình lo lắng. Không có chấn thương nhưng mong CareGo kiểm tra lại quy trình an toàn.",
        sentAt: "2026-07-12T15:30:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "CareGo đã ưu tiên tiếp nhận phản ánh và liên hệ companion ngay. Bên em xác nhận người được chăm sóc hiện không có dấu hiệu bất thường.",
        sentAt: "2026-07-12T15:45:00+07:00",
        isRead: true,
      },
      {
        sender: "customer",
        text: "Gia đình đã kiểm tra lại và sức khỏe người thân vẫn ổn định. Mong companion được nhắc kỹ hơn về thao tác hỗ trợ.",
        sentAt: "2026-07-12T16:00:00+07:00",
        isRead: true,
      },
      {
        sender: "admin",
        text: "Bên em đã hoàn tất trao đổi, yêu cầu companion ôn lại quy trình hỗ trợ di chuyển và ghi nhận phản ánh vào hồ sơ chất lượng.",
        sentAt: "2026-07-12T16:20:00+07:00",
        isRead: true,
      },
    ],
  },
];

export const seedSupportData = async () => {
  await Promise.all([SupportConversation.init(), SupportMessage.init()]);
  const session = await mongoose.connection.startSession();
  let summary;

  try {
    await session.withTransaction(async () => {
      const admin = await User.findOne({ role: "admin", isActive: true })
        .session(session)
        .select("_id");
      if (!admin) throw new Error("An active admin is required for support seed data");

      const conversationSeedKeys = supportSeed.map((item) => item.seedKey);
      const messageSeedKeys = supportSeed.flatMap((item) =>
        item.messages.map((_, index) => `${item.seedKey}-message-${String(index + 1).padStart(2, "0")}`),
      );
      await SupportMessage.deleteMany(
        { seedKey: { $regex: /^demo-support-/, $nin: messageSeedKeys } },
        { session },
      );
      await SupportConversation.deleteMany(
        { seedKey: { $regex: /^demo-support-/, $nin: conversationSeedKeys } },
        { session },
      );

      const conversations = [];
      let messageCount = 0;
      for (const item of supportSeed) {
        const customer = await User.findOne({ email: item.customerEmail, role: "customer", isActive: true })
          .session(session)
          .select("_id name");
        if (!customer) throw new Error(`Missing active customer ${item.customerEmail}`);

        let bookingId = null;
        if (item.bookingSeedKey) {
          const booking = await Booking.findOne({
            seedKey: item.bookingSeedKey,
            customerId: customer._id,
          })
            .session(session)
            .select("_id");
          if (!booking) throw new Error(`Booking ${item.bookingSeedKey} does not belong to ${item.customerEmail}`);
          bookingId = booking._id;
        }

        const openedAt = new Date(item.openedAt);
        const normalizedMessages = item.messages.map((message, index) => ({
          ...message,
          sentAt: new Date(message.sentAt),
          seedKey: `${item.seedKey}-message-${String(index + 1).padStart(2, "0")}`,
        }));
        if (
          Number.isNaN(openedAt.getTime()) ||
          normalizedMessages.length === 0 ||
          normalizedMessages.some((message) => Number.isNaN(message.sentAt.getTime()))
        ) {
          throw new Error(`Invalid support timestamps for ${item.seedKey}`);
        }
        for (let index = 1; index < normalizedMessages.length; index += 1) {
          if (normalizedMessages[index].sentAt < normalizedMessages[index - 1].sentAt) {
            throw new Error(`Support messages are out of order for ${item.seedKey}`);
          }
        }

        const lastMessage = normalizedMessages.at(-1);
        const assignedAdminId = item.status === "waiting" ? null : admin._id;
        const conversation = await SupportConversation.findOneAndUpdate(
          { seedKey: item.seedKey },
          {
            $set: {
              seedKey: item.seedKey,
              userId: customer._id,
              assignedAdminId,
              bookingId,
              subject: item.subject,
              category: item.category,
              status: item.status,
              priority: item.priority,
              lastMessage: lastMessage.text,
              lastMessageAt: lastMessage.sentAt,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, session },
        );
        await SupportConversation.collection.updateOne(
          { _id: conversation._id },
          { $set: { createdAt: openedAt, updatedAt: lastMessage.sentAt } },
          { session },
        );

        for (const message of normalizedMessages) {
          const senderId = message.sender === "admin" ? admin._id : customer._id;
          const supportMessage = await SupportMessage.findOneAndUpdate(
            { seedKey: message.seedKey },
            {
              $set: {
                seedKey: message.seedKey,
                conversationId: conversation._id,
                senderId,
                message: message.text,
                isRead: message.isRead,
              },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, session },
          );
          await SupportMessage.collection.updateOne(
            { _id: supportMessage._id },
            { $set: { createdAt: message.sentAt, updatedAt: message.sentAt } },
            { session },
          );
          messageCount += 1;
        }

        conversations.push({
          id: conversation._id,
          seedKey: item.seedKey,
          status: item.status,
          priority: item.priority,
        });
      }

      summary = {
        conversations,
        messageCount,
        statusCounts: {
          waiting: conversations.filter((item) => item.status === "waiting").length,
          active: conversations.filter((item) => item.status === "active").length,
          resolved: conversations.filter((item) => item.status === "resolved").length,
        },
        urgentCount: conversations.filter((item) => item.priority === "urgent").length,
      };
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }

  return summary;
};

const run = async () => {
  if (!process.argv.includes("--yes")) {
    throw new Error("This script adds or updates support seed data. Run with --yes to confirm.");
  }
  if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is required");

  await mongoose.connect(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DB_NAME || "carego",
  });
  const summary = await seedSupportData();
  console.log("Database:", mongoose.connection.name);
  console.log("Support seed mode: additive upsert");
  console.log("Conversations:", summary.conversations.length);
  console.log("Messages:", summary.messageCount);
  console.log("Statuses:", summary.statusCounts);
  console.log("Urgent:", summary.urgentCount);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
