import bcrypt from "bcrypt";
import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
import Booking from "../models/booking.models.js";
import CompanionProfile from "../models/companion-profile.models.js";
import ElderProfile from "../models/elder-profile.models.js";
import Payment from "../models/payment.models.js";
import Review from "../models/review.models.js";
import Service from "../models/service.models.js";
import ShiftLog from "../models/shift-log.models.js";
import User from "../models/user.models.js";
import { seedBlogData } from "./seed-blogs.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
dotenv.config();
const shouldConfirm = process.argv.includes("--yes");
const password = process.env.SEED_PASSWORD || "CareGo@123";
const rawPlatformFeeRate = Number(process.env.CAREGO_PLATFORM_FEE_RATE || 0.2);
const platformFeeRate = rawPlatformFeeRate > 1 ? rawPlatformFeeRate / 100 : rawPlatformFeeRate;

const servicesSeed = [
{
  name: "CareGo Hospital",
  code: "1",
  description: "Hỗ trợ người cao tuổi đi khám bệnh, làm thủ tục và lấy thuốc.",
  pricePerHour: 120000,
  defaultChecklist: [
    "Đã đến điểm đón",
    "Hỗ trợ làm thủ tục",
    "Lấy thuốc và ghi chú lời dặn",
  ],
},
{
  name: "CareGo Home",
  code: "2",
  description: "Chăm sóc tại nhà, nhắc thuốc, trò chuyện và theo dõi tình trạng.",
  pricePerHour: 80000,
  defaultChecklist: [
    "Đã đến nhà",
    "Nhắc thuốc theo đơn",
    "Ghi chú tình trạng sức khỏe",
  ],
},
{
  name: "CareGo Walk",
  code: "3",
  description: "Đồng hành đi dạo, đi siêu thị hoặc tham gia hoạt động ngoài trời.",
  pricePerHour: 70000,
  defaultChecklist: [
    "Bắt đầu đi dạo",
    "Theo dõi GPS",
    "Chụp ảnh xác nhận",
  ],
},
{
  name: "CareGo Test 2K",
  code: "TEST_2000",
  description: "Dịch vụ test giá 2.000 VND mỗi giờ.",
  pricePerHour: 2000,
  defaultChecklist: [
    "Bắt đầu test",
    "Hoàn thành test",
  ],
},
];

const usersSeed = [
  {
    key: "admin",
    name: "CareGo Admin",
    email: process.env.ADMIN_EMAIL || "admin@carego.cfd",
    phone: "0900000000",
    role: "admin",
  },
  {
    key: "customerVan",
    name: "Đoàn Thị Bích Vân",
    email: "doanthibichvan@gmail.com",
    phone: "0910000000",
    role: "customer",
  },
  {
    key: "customerMinhAn",
    name: "Nguyễn Minh An",
    email: "nguyenminhan@gmail.com",
    phone: "0901111111",
    role: "customer",
  },
  {
    key: "customerBao",
    name: "Trần Hoàng Bảo",
    email: "tranhoangbao@gmail.com",
    phone: "0902222222",
    role: "customer",
  },
  {
    key: "customerMaiPhuong",
    name: "Mai Phương",
    email: "maiphuong@gmail.com",
    phone: "0903333333",
    role: "customer",
  },
  {
    key: "customerThuHa",
    name: "Nguyễn Thu Hà",
    email: "nguyenthuha@gmail.com",
    phone: "0904444444",
    role: "customer",
  },
  {
    key: "customerQuocHuy",
    name: "Lê Quốc Huy",
    email: "lequochuy@gmail.com",
    phone: "0905555555",
    role: "customer",
  },
  {
    key: "customerNgocLan",
    name: "Phạm Ngọc Lan",
    email: "phamngoclan@gmail.com",
    phone: "0911111111",
    role: "customer",
  },
  {
    key: "customerMinhKhang",
    name: "Võ Minh Khang",
    email: "vominhkhang@gmail.com",
    phone: "0912222222",
    role: "customer",
  },
  {
    key: "customerThanhTruc",
    name: "Bùi Thanh Trúc",
    email: "buithanhtruc@gmail.com",
    phone: "0913333333",
    role: "customer",
  },
  {
    key: "customerGiaHan",
    name: "Đặng Gia Hân",
    email: "danggiahan@gmail.com",
    phone: "0914444444",
    role: "customer",
  },
  {
    key: "customerDucLong",
    name: "Hoàng Đức Long",
    email: "hoangduclong@gmail.com",
    phone: "0915555555",
    role: "customer",
  },
  {
    key: "companionKhoi",
    name: "Phạm Anh Khôi",
    email: "phamanhkhoi@carego.cfd",
    phone: "0906666666",
    role: "companion",
  },
  {
    key: "companionThanh",
    name: "Nguyễn Quang Thanh",
    email: "nguyenquangthanh@carego.cfd",
    phone: "0907777777",
    role: "companion",
  },
  {
    key: "companionTuan",
    name: "Phạm Minh Tuấn",
    email: "phamminhtuan@carego.cfd",
    phone: "0908888888",
    role: "companion",
  },
  {
    key: "companionHoangThanh",
    name: "Trần Ngọc Hoàng Thành",
    email: "tranngochoangthanh@carego.cfd",
    phone: "0909999999",
    role: "companion",
  },
];

const elderProfilesSeed = [
  {
    key: "elderA",
    customerKey: "customerMinhAn",
    fullName: "Nguyễn Thị Lan",
    age: 72,
    gender: "female",
    address: "Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    medicalNotes: "Huyết áp cao, cần nhắc uống thuốc đúng giờ.",
    chronicConditions: ["Huyết áp cao"],
    medicines: [
      {
        name: "Amlodipine",
        dosage: "5mg",
        schedule: "Sau bữa sáng",
        note: "Theo đơn bác sĩ",
      },
    ],
    emergencyContact: {
      name: "Nguyễn Minh An",
      phone: "0901111111",
      relationship: "Con trai",
    },
  },
  {
    key: "elderB",
    customerKey: "customerBao",
    fullName: "Trần Văn Phúc",
    age: 76,
    gender: "male",
    address: "Chung cư Sunrise City, Quận 7, TP. HCM",
    medicalNotes: "Cần hỗ trợ đi lại chậm rãi.",
    chronicConditions: ["Tiểu đường type 2"],
    medicines: [
      {
        name: "Metformin",
        dosage: "500mg",
        schedule: "Sau bữa tối",
        note: "Không uống khi bỏ bữa",
      },
    ],
    emergencyContact: {
      name: "Trần Hoàng Bảo",
      phone: "0902222222",
      relationship: "Con trai",
    },
  },
  {
    key: "elderVan",
    customerKey: "customerVan",
    fullName: "Đoàn Văn Bình",
    age: 74,
    gender: "male",
    address: "Chung cư Masteri An Phú, TP. Thủ Đức, TP. HCM",
    medicalNotes: "Cần người đồng hành khi đi khám và nhắc uống thuốc buổi sáng.",
    chronicConditions: ["Đau khớp gối"],
    medicines: [
      {
        name: "Glucosamine",
        dosage: "500mg",
        schedule: "Sau bữa sáng",
        note: "Theo hướng dẫn gia đình",
      },
    ],
    emergencyContact: {
      name: "Đoàn Thị Bích Vân",
      phone: "0910000000",
      relationship: "Con gái",
    },
  },
];

const companionProfilesSeed = [
  {
    userKey: "companionKhoi",
    fullName: "Phạm Anh Khôi",
    phone: "0906666666",
    gender: "male",
    dateOfBirth: new Date("2003-01-15"),
    university: "Đại học FPT",
    major: "Công nghệ thông tin",
    skills: ["Theo dõi GPS", "Hỗ trợ đi khám", "Giao tiếp gia đình"],
    documents: {
      citizenId: "079203000004",
      citizenIdFrontUrl: "",
      citizenIdBackUrl: "",
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["TP. Thủ Đức", "Quận 9"],
    ratingAverage: 4.9,
    ratingCount: 15,
    completedBookings: 22,
  },
  {
    userKey: "companionThanh",
    fullName: "Nguyễn Quang Thanh",
    phone: "0907777777",
    gender: "male",
    dateOfBirth: new Date("2002-05-20"),
    university: "Đại học Y Dược TP. HCM",
    major: "Y khoa",
    skills: ["Sơ cứu cơ bản", "Nhắc thuốc", "Hỗ trợ thủ tục bệnh viện"],
    documents: {
      citizenId: "079202000005",
      citizenIdFrontUrl: "",
      citizenIdBackUrl: "",
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận Bình Thạnh", "Quận 1"],
    ratingAverage: 4.7,
    ratingCount: 11,
    completedBookings: 16,
  },
  {
    userKey: "companionTuan",
    fullName: "Phạm Minh Tuấn",
    phone: "0908888888",
    gender: "male",
    dateOfBirth: new Date("2001-11-08"),
    university: "Đại học Nguyễn Tất Thành",
    major: "Điều dưỡng",
    skills: ["Chăm sóc tại nhà", "Theo dõi sức khỏe", "Đồng hành đi dạo"],
    documents: {
      citizenId: "079201000006",
      citizenIdFrontUrl: "",
      citizenIdBackUrl: "",
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 7", "Nhà Bè"],
    ratingAverage: 4.5,
    ratingCount: 9,
    completedBookings: 13,
  },
  {
    userKey: "companionHoangThanh",
    fullName: "Trần Ngọc Hoàng Thành",
    phone: "0909999999",
    gender: "male",
    dateOfBirth: new Date("2003-08-25"),
    university: "Đại học Văn Lang",
    major: "Tâm lý học",
    skills: ["Trò chuyện", "Chăm sóc tinh thần", "Đọc sách cùng người cao tuổi"],
    documents: {
      citizenId: "079203000007",
      citizenIdFrontUrl: "",
      citizenIdBackUrl: "",
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 3", "Quận Phú Nhuận"],
    ratingAverage: 4.6,
    ratingCount: 7,
    completedBookings: 9,
  },
];

const bookingSeed = [
  {
    customerKey: "customerMinhAn",
    elderKey: "elderA",
    companionKey: "companionKhoi",
    serviceCode: "1",
    startsInHours: 30,
    durationHours: 2,
    address: "Bệnh viện Đại học Y Dược TP. HCM",
    addressLocation: {
      lat: 10.7553,
      lng: 106.6636,
      displayName: "Bệnh viện Đại học Y Dược TP. HCM",
    },
    note: "Hỗ trợ lấy số thứ tự và ghi chú lời dặn của bác sĩ.",
    status: "pending",
  },
  {
    customerKey: "customerMinhAn",
    elderKey: "elderA",
    companionKey: "companionThanh",
    serviceCode: "2",
    startsInHours: 54,
    durationHours: 3,
    address: "Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    addressLocation: {
      lat: 10.8411,
      lng: 106.8431,
      displayName: "Vinhomes Grand Park",
    },
    note: "Nhắc thuốc và trò chuyện buổi chiều.",
    status: "accepted",
  },
  {
    customerKey: "customerBao",
    elderKey: "elderB",
    companionKey: "companionTuan",
    serviceCode: "3",
    startsInHours: -1,
    durationHours: 2,
    address: "Công viên ven sông, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7297,
      lng: 106.7217,
      displayName: "Công viên ven sông Quận 7",
    },
    note: "Đi dạo nhẹ, tránh nắng gắt.",
    status: "in_progress",
  },
  {
    customerKey: "customerBao",
    elderKey: "elderB",
    companionKey: "companionHoangThanh",
    serviceCode: "2",
    startsInHours: -96,
    durationHours: 2,
    address: "Chung cư Sunrise City, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7403,
      lng: 106.7016,
      displayName: "Sunrise City Quận 7",
    },
    note: "Theo dõi huyết áp và nhắc thuốc.",
    status: "completed",
    completedOffsetHours: -94,
  },
  {
    customerKey: "customerVan",
    elderKey: "elderVan",
    companionKey: "companionKhoi",
    serviceCode: "1",
    startsInHours: -168,
    durationHours: 3,
    address: "Phòng khám CarePlus Quận 7",
    addressLocation: {
      lat: 10.7308,
      lng: 106.7032,
      displayName: "CarePlus Quận 7",
    },
    note: "Tái khám định kỳ.",
    status: "paid",
    completedOffsetHours: -165,
    review: {
      rating: 5,
      comment: "Người đồng hành đến đúng giờ, hỗ trợ rất kỹ và cập nhật đầy đủ.",
      tags: ["Đúng giờ", "Tận tâm"],
    },
  },
  {
    customerKey: "customerBao",
    elderKey: "elderB",
    companionKey: "companionThanh",
    serviceCode: "3",
    startsInHours: -48,
    durationHours: 1,
    address: "Crescent Mall, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7294,
      lng: 106.7184,
      displayName: "Crescent Mall",
    },
    note: "Khách hủy vì thay đổi lịch gia đình.",
    status: "cancelled",
  },
];

const upsertServices = async () => {
  const services = {};

  for (const serviceData of servicesSeed) {
    const service = await Service.findOneAndUpdate(
      { code: serviceData.code },
      { $set: { ...serviceData, isActive: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    services[service.code] = service;
  }

  return services;
};

const seedUsers = async () => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const users = {};

  for (const userData of usersSeed) {
    const email = userData.email.toLowerCase();
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name: userData.name,
          email,
          phone: userData.phone,
          password: hashedPassword,
          role: userData.role,
          isActive: true,
          isEmailVerified: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    users[userData.key] = user;
  }

  return users;
};

const seedCompanionProfiles = async (users) => {
  for (const profileData of companionProfilesSeed) {
    const { userKey, ...payload } = profileData;
    const userId = users[userKey]._id;
    await CompanionProfile.findOneAndUpdate(
      { userId },
      { $set: { ...payload, userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
  }
};

const seedElderProfiles = async (users) => {
  const elders = {};

  for (const elderData of elderProfilesSeed) {
    const customerId = users[elderData.customerKey]._id;
    const payload = {
      fullName: elderData.fullName,
      customerId,
      age: elderData.age,
      gender: elderData.gender,
      address: elderData.address,
      medicalNotes: elderData.medicalNotes,
      chronicConditions: elderData.chronicConditions,
      medicines: elderData.medicines,
      emergencyContact: elderData.emergencyContact,
    };
    const elder = await ElderProfile.findOneAndUpdate(
      { customerId, fullName: elderData.fullName },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    elders[elderData.key] = elder;
  }

  return elders;
};

const upsertShiftLog = async ({ booking, service, status }) => {
  const checklist = (service.defaultChecklist || []).map((label, index) => ({
    label,
    done: ["in_progress", "completed", "paid"].includes(status) ? index < 2 : status === "accepted" && index === 0,
  }));
  const isActiveOrDone = ["in_progress", "completed", "paid"].includes(status);

  await ShiftLog.findOneAndUpdate(
    { bookingId: booking._id },
    {
      $set: {
        bookingId: booking._id,
        checklist,
        locations: isActiveOrDone
          ? [
              {
                lat: booking.addressLocation?.lat,
                lng: booking.addressLocation?.lng,
                note: "Đã cập nhật vị trí",
                recordedAt: new Date(),
              },
            ]
          : [],
        companionNote: ["completed", "paid"].includes(status) ? "Ca chăm sóc đã hoàn thành đúng yêu cầu." : "",
        healthMetrics: ["completed", "paid"].includes(status)
          ? { bloodPressure: "120/80", heartRate: 78, mood: "Ổn định" }
          : undefined,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
};

const upsertPayment = async ({ booking, status }) => {
  const baseAmount = Number(booking.totalAmount || 0);
  const platformFee = Number(booking.platformFee || 0);

  await Payment.findOneAndUpdate(
    { bookingId: booking._id },
    {
      $set: {
        bookingId: booking._id,
        customerId: booking.customerId,
        companionId: booking.companionId,
        amount: baseAmount,
        platformFee,
        companionEarning: Math.max(baseAmount - platformFee, 0),
        baseAmount,
        paidAmount: status === "paid" ? baseAmount : 0,
        method: "prototype",
        status: status === "paid" ? "paid" : "pending",
        paidAt: status === "paid" ? new Date() : null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
};

const seedBookings = async ({ users, elders, services }) => {
  const now = Date.now();
  const bookings = [];

  for (const item of bookingSeed) {
    const customerId = users[item.customerKey]._id;
    const elderProfileId = elders[item.elderKey]._id;
    const companionId = users[item.companionKey]._id;
    const service = services[item.serviceCode];
    const serviceId = service._id;
    const totalAmount = service.pricePerHour * item.durationHours;
    const completedAt = item.completedOffsetHours
      ? new Date(now + item.completedOffsetHours * 60 * 60 * 1000)
      : null;
    const payload = {
      customerId,
      elderProfileId,
      serviceId,
      companionId,
      startTime: new Date(now + item.startsInHours * 60 * 60 * 1000),
      durationHours: item.durationHours,
      address: item.address,
      addressLocation: item.addressLocation,
      note: item.note,
      status: item.status,
      completedAt,
      paymentDueAt: completedAt && ["completed", "paid"].includes(item.status)
        ? new Date(completedAt.getTime() + 3 * 24 * 60 * 60 * 1000)
        : null,
      totalAmount,
      platformFee: Math.round(totalAmount * platformFeeRate),
    };
    const booking = await Booking.findOneAndUpdate(
      { customerId, elderProfileId, serviceId, companionId, note: item.note },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    await upsertShiftLog({ booking, service, status: item.status });

    if (["completed", "paid"].includes(item.status)) {
      await upsertPayment({ booking, status: item.status });
    }

    if (item.review) {
      await Review.findOneAndUpdate(
        { bookingId: booking._id },
        {
          $set: {
            bookingId: booking._id,
            customerId: booking.customerId,
            companionId: booking.companionId,
            ...item.review,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
      );
    }

    bookings.push(booking);
  }

  return bookings;
};

export const seedDemoData = async () => {
  const services = await upsertServices();
  const users = await seedUsers();
  await seedCompanionProfiles(users);
  const elders = await seedElderProfiles(users);
  const bookings = await seedBookings({ users, elders, services });
  await seedBlogData();

  console.log("Database:", mongoose.connection.name);
  console.log("Seed mode: additive upsert");
  console.log("Seed password:", process.env.SEED_PASSWORD ? "from SEED_PASSWORD" : password);
  console.log("Accounts:", usersSeed.map((user) => `${user.role}:${user.email}`).join(", "));
  console.log("Services:", Object.keys(services).length);
  console.log("Bookings:", bookings.length);

  return { services, users, elders, bookings };
};

const run = async () => {
  if (!shouldConfirm) {
    throw new Error("This script adds or updates demo data. Run with --yes to confirm.");
  }

  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is required");
  }

  await mongoose.connect(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DB_NAME || "carego",
  });
  await seedDemoData();
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
