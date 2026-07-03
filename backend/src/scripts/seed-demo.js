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
import {
  isWithinCompanionWorkingShift,
  parseBookingAvailabilityWindow,
} from "../utils/companion-availability.js";
import { seedBlogData } from "./seed-blogs.js";
import { seedCustomerUsers } from "./seed-customers.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
dotenv.config();
const shouldConfirm = process.argv.includes("--yes");
const password = process.env.SEED_PASSWORD || "CareGo@123";
const rawPlatformFeeRate = Number(process.env.CAREGO_PLATFORM_FEE_RATE || 0.2);
const platformFeeRate = rawPlatformFeeRate > 1 ? rawPlatformFeeRate / 100 : rawPlatformFeeRate;
const demoDocumentImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

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
    recoveryEmail: process.env.ADMIN_RECOVERY_EMAIL || process.env.ADMIN_EMAIL || "admin@carego.cfd",
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
    email: "phamanhkhoi123456@carego.cfd",
    legacyEmails: ["phamanhkhoi@carego.cfd"],
    recoveryEmail: "phamanhkhoi.demo@gmail.com",
    phone: "0906666666",
    role: "companion",
  },
  {
    key: "companionThanh",
    name: "Nguyễn Quang Thanh",
    email: "nguyenquangthanh234567@carego.cfd",
    legacyEmails: ["nguyenquangthanh@carego.cfd"],
    recoveryEmail: "nguyenquangthanh.demo@gmail.com",
    phone: "0907777777",
    role: "companion",
  },
  {
    key: "companionTuan",
    name: "Phạm Minh Tuấn",
    email: "phamminhtuan345678@carego.cfd",
    legacyEmails: ["phamminhtuan@carego.cfd"],
    recoveryEmail: "phamminhtuan.demo@gmail.com",
    phone: "0908888888",
    role: "companion",
  },
  {
    key: "companionHoangThanh",
    name: "Trần Ngọc Hoàng Thành",
    email: "tranngochoangthanh456789@carego.cfd",
    legacyEmails: ["tranngochoangthanh@carego.cfd"],
    recoveryEmail: "tranngochoangthanh.demo@gmail.com",
    phone: "0909999999",
    role: "companion",
  },
  {
    key: "companionLanAnh",
    name: "Nguyễn Lan Anh",
    email: "nguyenlananh567890@carego.cfd",
    recoveryEmail: "nguyenlananh@gmail.com",
    phone: "0862471358",
    role: "companion",
  },
  {
    key: "companionQuynhTrang",
    name: "Lê Quỳnh Trang",
    email: "lequynhtrang678901@carego.cfd",
    recoveryEmail: "lequynhtrang@gmail.com",
    phone: "0883517246",
    role: "companion",
  },
  {
    key: "companionDucManh",
    name: "Phạm Đức Mạnh",
    email: "phamducmanh789012@carego.cfd",
    recoveryEmail: "phamducmanh@gmail.com",
    phone: "0894628157",
    role: "companion",
  },
  {
    key: "companionPhuongNam",
    name: "Võ Phương Nam",
    email: "vophuongnam890123@carego.cfd",
    recoveryEmail: "vophuongnam@gmail.com",
    phone: "0865739261",
    role: "companion",
  },
  {
    key: "companionBaoTran",
    name: "Đặng Bảo Trân",
    email: "dangbaotran901234@carego.cfd",
    recoveryEmail: "dangbaotran@gmail.com",
    phone: "0886841372",
    role: "companion",
  },
  {
    key: "companionHaiYen",
    name: "Bùi Hải Yến",
    email: "buihaiyen012345@carego.cfd",
    recoveryEmail: "buihaiyen@gmail.com",
    phone: "0897952483",
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
    phoneVerifiedAt: new Date(),
    workingShift: "full_day",
    gender: "male",
    dateOfBirth: new Date("2003-01-15"),
    university: "Đại học FPT",
    major: "Công nghệ thông tin",
    skills: ["Theo dõi GPS", "Hỗ trợ đi khám", "Giao tiếp gia đình"],
    documents: {
      citizenId: "079203000004",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["TP. Thủ Đức", "Quận 9"],
  },
  {
    userKey: "companionThanh",
    fullName: "Nguyễn Quang Thanh",
    phone: "0907777777",
    phoneVerifiedAt: new Date(),
    workingShift: "morning",
    gender: "male",
    dateOfBirth: new Date("2002-05-20"),
    university: "Đại học Y Dược TP. HCM",
    major: "Y khoa",
    skills: ["Sơ cứu cơ bản", "Nhắc thuốc", "Hỗ trợ thủ tục bệnh viện"],
    documents: {
      citizenId: "079202000005",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận Bình Thạnh", "Quận 1"],
  },
  {
    userKey: "companionTuan",
    fullName: "Phạm Minh Tuấn",
    phone: "0908888888",
    phoneVerifiedAt: new Date(),
    workingShift: "afternoon",
    gender: "male",
    dateOfBirth: new Date("2001-11-08"),
    university: "Đại học Nguyễn Tất Thành",
    major: "Điều dưỡng",
    skills: ["Chăm sóc tại nhà", "Theo dõi sức khỏe", "Đồng hành đi dạo"],
    documents: {
      citizenId: "079201000006",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 7", "Nhà Bè"],
  },
  {
    userKey: "companionHoangThanh",
    fullName: "Trần Ngọc Hoàng Thành",
    phone: "0909999999",
    phoneVerifiedAt: new Date(),
    workingShift: "full_day",
    gender: "male",
    dateOfBirth: new Date("2003-08-25"),
    university: "Đại học Văn Lang",
    major: "Tâm lý học",
    skills: ["Trò chuyện", "Chăm sóc tinh thần", "Đọc sách cùng người cao tuổi"],
    documents: {
      citizenId: "079203000007",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 3", "Quận Phú Nhuận"],
  },
  {
    userKey: "companionLanAnh",
    fullName: "Nguyễn Lan Anh",
    phone: "0862471358",
    phoneVerifiedAt: new Date(),
    workingShift: "morning",
    gender: "female",
    dateOfBirth: new Date("2002-03-18"),
    university: "Đại học Y Dược TP. HCM",
    major: "Điều dưỡng",
    skills: ["Chăm sóc tại nhà", "Nhắc thuốc", "Theo dõi sức khỏe"],
    documents: {
      citizenId: "079202000008",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 5", "Quận 10"],
  },
  {
    userKey: "companionQuynhTrang",
    fullName: "Lê Quỳnh Trang",
    phone: "0883517246",
    phoneVerifiedAt: new Date(),
    workingShift: "afternoon",
    gender: "female",
    dateOfBirth: new Date("2003-07-12"),
    university: "Đại học Văn Lang",
    major: "Tâm lý học",
    skills: ["Trò chuyện", "Chăm sóc tinh thần", "Đồng hành đi dạo"],
    documents: {
      citizenId: "079203000009",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 3", "Quận Phú Nhuận"],
  },
  {
    userKey: "companionDucManh",
    fullName: "Phạm Đức Mạnh",
    phone: "0894628157",
    phoneVerifiedAt: new Date(),
    workingShift: "full_day",
    gender: "male",
    dateOfBirth: new Date("2001-09-24"),
    university: "Đại học Nguyễn Tất Thành",
    major: "Điều dưỡng",
    skills: ["Sơ cứu cơ bản", "Hỗ trợ đi khám", "Theo dõi GPS"],
    documents: {
      citizenId: "079201000010",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 4", "Quận 7"],
  },
  {
    userKey: "companionPhuongNam",
    fullName: "Võ Phương Nam",
    phone: "0865739261",
    phoneVerifiedAt: new Date(),
    workingShift: "afternoon",
    gender: "male",
    dateOfBirth: new Date("2002-12-05"),
    university: "Đại học FPT",
    major: "Công nghệ thông tin",
    skills: ["Theo dõi GPS", "Hỗ trợ di chuyển", "Giao tiếp gia đình"],
    documents: {
      citizenId: "079202000011",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["TP. Thủ Đức", "Quận Bình Thạnh"],
  },
  {
    userKey: "companionBaoTran",
    fullName: "Đặng Bảo Trân",
    phone: "0886841372",
    phoneVerifiedAt: new Date(),
    workingShift: "morning",
    gender: "female",
    dateOfBirth: new Date("2003-04-29"),
    university: "Đại học Khoa học Xã hội và Nhân văn TP. HCM",
    major: "Tâm lý học",
    skills: ["Trò chuyện", "Đọc sách", "Nhắc lịch sinh hoạt"],
    documents: {
      citizenId: "079203000012",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 1", "Quận 3"],
  },
  {
    userKey: "companionHaiYen",
    fullName: "Bùi Hải Yến",
    phone: "0897952483",
    phoneVerifiedAt: new Date(),
    workingShift: "full_day",
    gender: "female",
    dateOfBirth: new Date("2002-10-16"),
    university: "Đại học Y Dược TP. HCM",
    major: "Y tế công cộng",
    skills: ["Theo dõi sức khỏe", "Nhắc thuốc", "Hỗ trợ thủ tục bệnh viện"],
    documents: {
      citizenId: "079202000013",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: "",
    },
    vettingStatus: "approved",
    serviceAreas: ["Quận 6", "Quận 11"],
  },
];

const bookingSeed = [
  {
    seedKey: "demo-booking-hospital-pending",
    customerKey: "customerMinhAn",
    elderKey: "elderA",
    companionKey: "companionKhoi",
    serviceCode: "1",
    dayOffset: 1,
    startHour: 9,
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
    seedKey: "demo-booking-home-morning-accepted",
    customerKey: "customerMinhAn",
    elderKey: "elderA",
    companionKey: "companionThanh",
    serviceCode: "2",
    dayOffset: 2,
    startHour: 9,
    durationHours: 3,
    address: "Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    addressLocation: {
      lat: 10.8411,
      lng: 106.8431,
      displayName: "Vinhomes Grand Park",
    },
    note: "Nhắc thuốc và trò chuyện buổi sáng.",
    legacyNotes: ["Nhắc thuốc và trò chuyện buổi chiều."],
    status: "accepted",
  },
  {
    seedKey: "demo-booking-walk-afternoon-accepted",
    customerKey: "customerBao",
    elderKey: "elderB",
    companionKey: "companionTuan",
    serviceCode: "3",
    dayOffset: 1,
    startHour: 14,
    durationHours: 2,
    address: "Công viên ven sông, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7297,
      lng: 106.7217,
      displayName: "Công viên ven sông Quận 7",
    },
    note: "Đi dạo nhẹ, tránh nắng gắt.",
    status: "accepted",
  },
  {
    seedKey: "demo-booking-home-completed",
    customerKey: "customerBao",
    elderKey: "elderB",
    companionKey: "companionHoangThanh",
    serviceCode: "2",
    dayOffset: -4,
    startHour: 9,
    durationHours: 2,
    address: "Chung cư Sunrise City, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7403,
      lng: 106.7016,
      displayName: "Sunrise City Quận 7",
    },
    note: "Theo dõi huyết áp và nhắc thuốc.",
    status: "completed",
    completedDayOffset: -4,
    completedHour: 11,
  },
  {
    seedKey: "demo-booking-hospital-paid",
    customerKey: "customerVan",
    elderKey: "elderVan",
    companionKey: "companionKhoi",
    serviceCode: "1",
    dayOffset: -7,
    startHour: 9,
    durationHours: 3,
    address: "Phòng khám CarePlus Quận 7",
    addressLocation: {
      lat: 10.7308,
      lng: 106.7032,
      displayName: "CarePlus Quận 7",
    },
    note: "Tái khám định kỳ.",
    status: "paid",
    completedDayOffset: -7,
    completedHour: 12,
    review: {
      rating: 5,
      comment: "Người đồng hành đến đúng giờ, hỗ trợ rất kỹ và cập nhật đầy đủ.",
      tags: ["Đúng giờ", "Tận tâm"],
    },
  },
  {
    seedKey: "demo-booking-walk-cancelled",
    customerKey: "customerBao",
    elderKey: "elderB",
    companionKey: "companionThanh",
    serviceCode: "3",
    dayOffset: -2,
    startHour: 10,
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

const paidBookingSeed = [
  { companionKey: "companionKhoi", dayOffset: -7, startHour: 8, durationHours: 1 },
  { companionKey: "companionThanh", dayOffset: -7, startHour: 10, durationHours: 2 },
  { companionKey: "companionTuan", dayOffset: -6, startHour: 14, durationHours: 1 },
  { companionKey: "companionHoangThanh", dayOffset: -6, startHour: 15, durationHours: 2 },
  { companionKey: "companionLanAnh", dayOffset: -5, startHour: 8, durationHours: 2 },
  { companionKey: "companionQuynhTrang", dayOffset: -5, startHour: 14, durationHours: 1 },
  { companionKey: "companionDucManh", dayOffset: -4, startHour: 9, durationHours: 1 },
  { companionKey: "companionPhuongNam", dayOffset: -4, startHour: 15, durationHours: 2 },
  { companionKey: "companionBaoTran", dayOffset: -3, startHour: 8, durationHours: 2 },
  { companionKey: "companionHaiYen", dayOffset: -3, startHour: 14, durationHours: 1 },
  { companionKey: "companionKhoi", dayOffset: -2, startHour: 10, durationHours: 1 },
  { companionKey: "companionThanh", dayOffset: -2, startHour: 8, durationHours: 2 },
  { companionKey: "companionTuan", dayOffset: -1, startHour: 14, durationHours: 2 },
  { companionKey: "companionHoangThanh", dayOffset: -1, startHour: 9, durationHours: 1 },
  { companionKey: "companionLanAnh", dayOffset: 0, startHour: 7, durationHours: 1 },
];

const paidBookingReviews = [
  {
    rating: 5,
    comment: "Bạn hỗ trợ rất chu đáo, đến đúng giờ và cập nhật tình hình đầy đủ cho gia đình.",
    tags: ["Đúng giờ", "Tận tâm"],
  },
  {
    rating: 4,
    comment: "Quá trình hỗ trợ tốt, giao tiếp rõ ràng và xử lý công việc cẩn thận.",
    tags: ["Cẩn thận", "Giao tiếp tốt"],
  },
  {
    rating: 5,
    comment: "Gia đình rất yên tâm, bạn nhiệt tình và quan tâm đến sức khỏe của người lớn tuổi.",
    tags: ["Nhiệt tình", "Quan tâm"],
  },
  {
    rating: 4,
    comment: "Bạn hoàn thành đầy đủ các việc đã trao đổi và phản hồi gia đình khá nhanh.",
    tags: ["Đáng tin cậy", "Phản hồi nhanh"],
  },
  {
    rating: 5,
    comment: "Hỗ trợ nhẹ nhàng, kiên nhẫn và nhắc thuốc đúng lịch.",
    tags: ["Kiên nhẫn", "Tận tâm"],
  },
  {
    rating: 4,
    comment: "Người đồng hành thân thiện, trò chuyện vui vẻ và chăm sóc đúng yêu cầu.",
    tags: ["Thân thiện", "Chu đáo"],
  },
  {
    rating: 5,
    comment: "Bạn xử lý tình huống tốt, hỗ trợ di chuyển an toàn và đúng giờ.",
    tags: ["An toàn", "Đúng giờ"],
  },
  {
    rating: 3,
    comment: "Công việc được hoàn thành nhưng phần cập nhật cho gia đình đôi lúc còn chậm.",
    tags: ["Hoàn thành công việc"],
  },
  {
    rating: 5,
    comment: "Bạn rất gần gũi, biết lắng nghe và giúp người lớn tuổi cảm thấy thoải mái.",
    tags: ["Biết lắng nghe", "Thân thiện"],
  },
  {
    rating: 4,
    comment: "Hỗ trợ thủ tục nhanh, ghi chú lời dặn rõ ràng và bàn giao đầy đủ.",
    tags: ["Rõ ràng", "Cẩn thận"],
  },
];

const paidBookingCustomers = [
  {
    customerKey: "customerMinhAn",
    elderKey: "elderA",
    address: "Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    addressLocation: {
      lat: 10.8411,
      lng: 106.8431,
      displayName: "Vinhomes Grand Park",
    },
  },
  {
    customerKey: "customerBao",
    elderKey: "elderB",
    address: "Chung cư Sunrise City, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7403,
      lng: 106.7016,
      displayName: "Sunrise City Quận 7",
    },
  },
  {
    customerKey: "customerVan",
    elderKey: "elderVan",
    address: "Chung cư Masteri An Phú, TP. Thủ Đức, TP. HCM",
    addressLocation: {
      lat: 10.8025,
      lng: 106.7409,
      displayName: "Masteri An Phú",
    },
  },
];

bookingSeed.push(
  ...paidBookingSeed.map((item, index) => {
    const customer = paidBookingCustomers[index % paidBookingCustomers.length];
    return {
      seedKey: `demo-booking-completed-${String(index + 1).padStart(2, "0")}`,
      ...customer,
      ...item,
      serviceCode: String((index % 3) + 1),
      note: `Booking đã thanh toán bổ sung ${String(index + 1).padStart(2, "0")}`,
      status: "paid",
      completedDayOffset: item.dayOffset,
      completedHour: item.startHour + item.durationHours,
      review: paidBookingReviews[index],
    };
  }),
);

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
    const email = String(userData.email).trim().toLowerCase();
    const legacyEmails = (userData.legacyEmails || []).map((value) => String(value).trim().toLowerCase());
    const existingUser = await User.findOne({ email }) ||
      (legacyEmails.length ? await User.findOne({ email: { $in: legacyEmails } }) : null);
    const user = await User.findOneAndUpdate(
      existingUser ? { _id: existingUser._id } : { email },
      {
        $set: {
          name: userData.name,
          email,
          recoveryEmail: String(userData.recoveryEmail || email).trim().toLowerCase(),
          phone: userData.phone,
          password: hashedPassword,
          role: userData.role,
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
        },
        $unset: {
          pendingPasswordHash: "",
          passwordChangeOtpHash: "",
          passwordChangeOtpExpires: "",
          resetPasswordToken: "",
          resetPasswordExpries: "",
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
      {
        $set: { ...payload, userId },
        $unset: { applicantCustomerId: "" },
      },
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
        paidAt: status === "paid" ? booking.completedAt || new Date() : null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
};

const seedBookings = async ({ users, elders, services }) => {
  const now = new Date();
  const bookings = [];

  const atLocalHour = (dayOffset, hour) => {
    const value = new Date(now);
    value.setHours(hour, 0, 0, 0);
    value.setDate(value.getDate() + dayOffset);
    return value;
  };

  for (const item of bookingSeed) {
    const customerId = users[item.customerKey]._id;
    const elderProfileId = elders[item.elderKey]._id;
    const companionId = users[item.companionKey]._id;
    const service = services[item.serviceCode];
    const serviceId = service._id;
    const totalAmount = service.pricePerHour * item.durationHours;
    const startTime = atLocalHour(item.dayOffset, item.startHour);
    const completedAt = Number.isInteger(item.completedDayOffset) && Number.isInteger(item.completedHour)
      ? atLocalHour(item.completedDayOffset, item.completedHour)
      : null;
    const availabilityWindow = parseBookingAvailabilityWindow({
      startTime,
      durationHours: item.durationHours,
      now: startTime,
      requireFuture: false,
    });
    if (availabilityWindow.error) {
      throw new Error(`Invalid booking seed for ${item.companionKey}: ${availabilityWindow.error}`);
    }
    const companionProfile = companionProfilesSeed.find((profile) => profile.userKey === item.companionKey);
    if (!isWithinCompanionWorkingShift(companionProfile?.workingShift, startTime, item.durationHours)) {
      throw new Error(`Booking seed for ${item.companionKey} is outside the configured working shift`);
    }
    const payload = {
      seedKey: item.seedKey,
      customerId,
      elderProfileId,
      serviceId,
      companionId,
      startTime,
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
    const legacyCandidates = await Booking.find({
      customerId,
      elderProfileId,
      serviceId,
      companionId,
      seedKey: { $exists: false },
    }).select("_id note");
    const expectedNotes = [item.note, ...(item.legacyNotes || [])];
    const legacyBooking = legacyCandidates.find((booking) => expectedNotes.includes(booking.note))
      || (legacyCandidates.length === 1 ? legacyCandidates[0] : null);
    if (legacyCandidates.length > 1 && !legacyBooking) {
      throw new Error(`Cannot identify legacy booking for seed key ${item.seedKey}`);
    }
    const booking = await Booking.findOneAndUpdate(
      legacyBooking ? { _id: legacyBooking._id } : { seedKey: item.seedKey },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    await upsertShiftLog({ booking, service, status: item.status });

    if (["completed", "paid"].includes(item.status)) {
      await upsertPayment({ booking, status: item.status });
    }

    if (item.review && item.status !== "paid") {
      throw new Error(`Review seed requires a paid booking: ${item.seedKey}`);
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

const syncCompanionStats = async (users) => {
  const stats = {};

  for (const { userKey } of companionProfilesSeed) {
    const companionId = users[userKey]._id;
    const [ratingRows, completedBookings] = await Promise.all([
      Review.aggregate([
        { $match: { companionId } },
        {
          $group: {
            _id: "$companionId",
            ratingTotal: { $sum: "$rating" },
            ratingCount: { $sum: 1 },
          },
        },
      ]),
      Booking.countDocuments({
        companionId,
        status: { $in: ["completed", "paid"] },
      }),
    ]);
    const ratingTotal = Number(ratingRows[0]?.ratingTotal || 0);
    const ratingCount = Number(ratingRows[0]?.ratingCount || 0);
    const ratingAverage = ratingCount > 0
      ? Math.round((ratingTotal / ratingCount) * 10) / 10
      : 0;

    await CompanionProfile.updateOne(
      { userId: companionId },
      {
        $set: {
          ratingAverage,
          ratingCount,
          ratingTotal,
          completedBookings,
        },
      },
      { runValidators: true },
    );

    stats[userKey] = {
      ratingAverage,
      ratingCount,
      ratingTotal,
      completedBookings,
    };
  }

  return stats;
};

export const seedDemoData = async () => {
  const services = await upsertServices();
  const users = await seedUsers();
  const customerCount = await seedCustomerUsers();
  await seedCompanionProfiles(users);
  const elders = await seedElderProfiles(users);
  const bookings = await seedBookings({ users, elders, services });
  const companionStats = await syncCompanionStats(users);
  await seedBlogData();

  console.log("Database:", mongoose.connection.name);
  console.log("Seed mode: additive upsert");
  console.log("Seed password:", process.env.SEED_PASSWORD ? "from SEED_PASSWORD" : password);
  console.log("Accounts:", usersSeed.map((user) => `${user.role}:${user.email}`).join(", "));
  console.log("Services:", Object.keys(services).length);
  console.log("Additional customers:", customerCount);
  console.log("Bookings:", bookings.length);
  console.log("Companion reviews:", Object.values(companionStats).reduce((total, item) => total + item.ratingCount, 0));

  return { services, users, elders, bookings, customerCount, companionStats };
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
