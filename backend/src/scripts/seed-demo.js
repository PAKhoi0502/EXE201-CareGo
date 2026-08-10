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
  isCompanionScheduleAvailable,
  parseBookingAvailabilityWindow,
} from "../utils/companion-availability.js";
import { seedBlogData } from "./seed-blogs.js";
import { customersSeed, seedCustomerUsers } from "./seed-customers.js";
import { seedSupportData } from "./seed-support.js";
import { seedWithdrawalData } from "./seed-withdrawals.js";

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
];

export const bookingCustomerUserSeeds = [
  { key: "customerThuyDung", email: "ngthuydung91@gmail.com" },
  { key: "customerQuocDat", email: "tranqdat88@gmail.com" },
  { key: "customerNgocHan", email: "lengochan.92@gmail.com" },
  { key: "customerTrungKien", email: "phamtrungkien89@gmail.com" },
  { key: "customerMyHanh", email: "myhanh.vo93@gmail.com" },
  { key: "customerAnhTuan", email: "danganhtuan87@gmail.com" },
  { key: "customerKhanhLinh", email: "khanhlinh.bui94@gmail.com" },
  { key: "customerMinhQuan", email: "dominhquan90@gmail.com" },
  { key: "customerThanhThao", email: "hothanhthao.95@gmail.com" },
  { key: "customerDucHuy", email: "ngoduchuy1988@gmail.com" },
  { key: "customerBaoTram", email: "baotram.duong93@gmail.com" },
  { key: "customerHoangNam", email: "lyhoangnam86@gmail.com" },
  { key: "customerGiaLinh", email: "nguyengialinh.96@gmail.com" },
].map(({ key, email }) => {
  const customer = customersSeed.find((item) => item.email === email);
  if (!customer) {
    throw new Error(`Missing customer seed for booking account ${email}`);
  }
  return { key, ...customer, role: "customer" };
});

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
  ...bookingCustomerUserSeeds,
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

export const elderProfilesSeed = [
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
  {
    key: "elderThuyDung",
    customerKey: "customerThuyDung",
    fullName: "Nguyễn Văn Thành",
    age: 73,
    gender: "male",
    address: "Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    medicalNotes: "Huyết áp cao, cần theo dõi trước khi vận động.",
    chronicConditions: ["Huyết áp cao"],
    medicines: [{ name: "Amlodipine", dosage: "5mg", schedule: "Sau bữa sáng", note: "Theo đơn bác sĩ" }],
    emergencyContact: { name: "Nguyễn Thị Thùy Dung", phone: "0325847169", relationship: "Con gái" },
  },
  {
    key: "elderQuocDat",
    customerKey: "customerQuocDat",
    fullName: "Trần Thị Hồng",
    age: 70,
    gender: "female",
    address: "Chung cư Sunrise City, Quận 7, TP. HCM",
    medicalNotes: "Đau khớp gối, di chuyển chậm khi lên xuống cầu thang.",
    chronicConditions: ["Thoái hóa khớp gối"],
    medicines: [{ name: "Glucosamine", dosage: "500mg", schedule: "Sau bữa trưa", note: "Theo hướng dẫn gia đình" }],
    emergencyContact: { name: "Trần Quốc Đạt", phone: "0337264951", relationship: "Con trai" },
  },
  {
    key: "elderNgocHan",
    customerKey: "customerNgocHan",
    fullName: "Lê Văn Định",
    age: 77,
    gender: "male",
    address: "Chung cư Hà Đô Centrosa, Quận 10, TP. HCM",
    medicalNotes: "Cần kiểm soát đường huyết và ăn đúng giờ.",
    chronicConditions: ["Tiểu đường type 2"],
    medicines: [{ name: "Metformin", dosage: "500mg", schedule: "Sau bữa tối", note: "Không uống khi bỏ bữa" }],
    emergencyContact: { name: "Lê Ngọc Hân", phone: "0348152679", relationship: "Con gái" },
  },
  {
    key: "elderTrungKien",
    customerKey: "customerTrungKien",
    fullName: "Phạm Thị Nguyệt",
    age: 75,
    gender: "female",
    address: "Chung cư Orchard Garden, Quận Phú Nhuận, TP. HCM",
    medicalNotes: "Thị lực giảm, cần hỗ trợ đọc giấy tờ khi đi khám.",
    chronicConditions: ["Đục thủy tinh thể"],
    medicines: [{ name: "Nước mắt nhân tạo", dosage: "1 giọt", schedule: "Sáng và tối", note: "Dùng theo hướng dẫn bác sĩ" }],
    emergencyContact: { name: "Phạm Trung Kiên", phone: "0356429187", relationship: "Con trai" },
  },
  {
    key: "elderMyHanh",
    customerKey: "customerMyHanh",
    fullName: "Võ Văn Lộc",
    age: 72,
    gender: "male",
    address: "Chung cư Saigon Royal, Quận 4, TP. HCM",
    medicalNotes: "Mỡ máu cao, hạn chế thức ăn nhiều dầu mỡ.",
    chronicConditions: ["Rối loạn lipid máu"],
    medicines: [{ name: "Atorvastatin", dosage: "10mg", schedule: "Sau bữa tối", note: "Theo đơn bác sĩ" }],
    emergencyContact: { name: "Võ Thị Mỹ Hạnh", phone: "0369517428", relationship: "Con gái" },
  },
  {
    key: "elderAnhTuan",
    customerKey: "customerAnhTuan",
    fullName: "Đặng Thị Kim Liên",
    age: 69,
    gender: "female",
    address: "Khu dân cư Him Lam, Quận 7, TP. HCM",
    medicalNotes: "Cần nhắc uống thuốc huyết áp đều đặn.",
    chronicConditions: ["Huyết áp cao"],
    medicines: [{ name: "Losartan", dosage: "50mg", schedule: "Sau bữa sáng", note: "Theo đơn bác sĩ" }],
    emergencyContact: { name: "Đặng Anh Tuấn", phone: "0372846159", relationship: "Con trai" },
  },
  {
    key: "elderKhanhLinh",
    customerKey: "customerKhanhLinh",
    fullName: "Bùi Văn Hòa",
    age: 78,
    gender: "male",
    address: "Masteri Thảo Điền, TP. Thủ Đức, TP. HCM",
    medicalNotes: "Sức nghe giảm nhẹ, cần nói rõ và chậm.",
    chronicConditions: ["Suy giảm thính lực"],
    medicines: [],
    emergencyContact: { name: "Bùi Khánh Linh", phone: "0387169254", relationship: "Con gái" },
  },
  {
    key: "elderMinhQuan",
    customerKey: "customerMinhQuan",
    fullName: "Đỗ Thị Thu Cúc",
    age: 74,
    gender: "female",
    address: "Chung cư Xi Grand Court, Quận 10, TP. HCM",
    medicalNotes: "Có tiền sử chóng mặt khi thay đổi tư thế nhanh.",
    chronicConditions: ["Rối loạn tiền đình"],
    medicines: [{ name: "Betahistine", dosage: "16mg", schedule: "Sau bữa sáng", note: "Theo đơn bác sĩ" }],
    emergencyContact: { name: "Đỗ Minh Quân", phone: "0395284176", relationship: "Con trai" },
  },
  {
    key: "elderThanhThao",
    customerKey: "customerThanhThao",
    fullName: "Hồ Văn Minh",
    age: 71,
    gender: "male",
    address: "Vinhomes Central Park, Quận Bình Thạnh, TP. HCM",
    medicalNotes: "Đau lưng mạn tính, tránh mang vật nặng.",
    chronicConditions: ["Thoái hóa cột sống"],
    medicines: [{ name: "Calcium", dosage: "500mg", schedule: "Sau bữa trưa", note: "Theo hướng dẫn gia đình" }],
    emergencyContact: { name: "Hồ Thanh Thảo", phone: "0703826159", relationship: "Con gái" },
  },
  {
    key: "elderDucHuy",
    customerKey: "customerDucHuy",
    fullName: "Ngô Thị Bích",
    age: 76,
    gender: "female",
    address: "Chung cư Léman Luxury, Quận 3, TP. HCM",
    medicalNotes: "Nhịp tim đôi lúc không đều, cần nghỉ khi thấy mệt.",
    chronicConditions: ["Rối loạn nhịp tim"],
    medicines: [{ name: "Bisoprolol", dosage: "2.5mg", schedule: "Sau bữa sáng", note: "Theo đơn bác sĩ" }],
    emergencyContact: { name: "Ngô Đức Huy", phone: "0769152843", relationship: "Con trai" },
  },
  {
    key: "elderBaoTram",
    customerKey: "customerBaoTram",
    fullName: "Dương Văn Sơn",
    age: 73,
    gender: "male",
    address: "Chung cư Eco Green, Quận 7, TP. HCM",
    medicalNotes: "Cần hỗ trợ đi bộ quãng dài và theo dõi hô hấp.",
    chronicConditions: ["Hen phế quản nhẹ"],
    medicines: [{ name: "Salbutamol", dosage: "Theo chỉ định", schedule: "Khi cần", note: "Mang theo khi ra ngoài" }],
    emergencyContact: { name: "Dương Bảo Trâm", phone: "0774268195", relationship: "Con gái" },
  },
  {
    key: "elderHoangNam",
    customerKey: "customerHoangNam",
    fullName: "Lý Thị Thanh",
    age: 68,
    gender: "female",
    address: "The Sun Avenue, TP. Thủ Đức, TP. HCM",
    medicalNotes: "Cần nhắc ăn uống đúng giờ và theo dõi đường huyết.",
    chronicConditions: ["Tiền tiểu đường"],
    medicines: [],
    emergencyContact: { name: "Lý Hoàng Nam", phone: "0782639517", relationship: "Con trai" },
  },
  {
    key: "elderGiaLinh",
    customerKey: "customerGiaLinh",
    fullName: "Nguyễn Văn Tâm",
    age: 79,
    gender: "male",
    address: "Chung cư Richmond City, Quận Bình Thạnh, TP. HCM",
    medicalNotes: "Đi lại bằng gậy, cần hỗ trợ khi lên xuống xe.",
    chronicConditions: ["Thoái hóa khớp háng"],
    medicines: [{ name: "Vitamin D3", dosage: "1000 IU", schedule: "Sau bữa sáng", note: "Theo hướng dẫn bác sĩ" }],
    emergencyContact: { name: "Nguyễn Gia Linh", phone: "0798514263", relationship: "Cháu gái" },
  },
];

export const companionProfilesSeed = [
  {
    userKey: "companionKhoi",
    fullName: "Phạm Anh Khôi",
    phone: "0906666666",
    phoneVerifiedAt: new Date(),
    workingShift: "full_day",
    gender: "male",
    dateOfBirth: new Date("2003-01-15"),
    applicantType: "student",
    university: "Đại học FPT",
    major: "Công nghệ thông tin",
    skills: ["Theo dõi GPS", "Hỗ trợ đi khám", "Giao tiếp gia đình"],
    documents: {
      citizenId: "079203000004",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: demoDocumentImage,
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
    applicantType: "healthcare_professional",
    yearsOfExperience: 2,
    university: "Đại học Y Dược TP. HCM",
    major: "Y khoa",
    skills: ["Sơ cứu cơ bản", "Nhắc thuốc", "Hỗ trợ thủ tục bệnh viện"],
    documents: {
      citizenId: "079202000005",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      professionalCertificateUrl: demoDocumentImage,
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
    applicantType: "graduate",
    graduationYear: 2024,
    university: "Đại học Nguyễn Tất Thành",
    major: "Điều dưỡng",
    skills: ["Chăm sóc tại nhà", "Theo dõi sức khỏe", "Đồng hành đi dạo"],
    documents: {
      citizenId: "079201000006",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      degreeCertificateUrl: demoDocumentImage,
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
    applicantType: "student",
    university: "Đại học Văn Lang",
    major: "Tâm lý học",
    skills: ["Trò chuyện", "Chăm sóc tinh thần", "Đọc sách cùng người cao tuổi"],
    documents: {
      citizenId: "079203000007",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: demoDocumentImage,
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
    applicantType: "healthcare_professional",
    yearsOfExperience: 2,
    university: "Đại học Y Dược TP. HCM",
    major: "Điều dưỡng",
    skills: ["Chăm sóc tại nhà", "Nhắc thuốc", "Theo dõi sức khỏe"],
    documents: {
      citizenId: "079202000008",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      professionalCertificateUrl: demoDocumentImage,
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
    applicantType: "graduate",
    graduationYear: 2025,
    university: "Đại học Văn Lang",
    major: "Tâm lý học",
    skills: ["Trò chuyện", "Chăm sóc tinh thần", "Đồng hành đi dạo"],
    documents: {
      citizenId: "079203000009",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      degreeCertificateUrl: demoDocumentImage,
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
    applicantType: "experienced_caregiver",
    university: "",
    major: "",
    yearsOfExperience: 3,
    qualificationDescription: "Có ba năm hỗ trợ chăm sóc người cao tuổi tại gia đình và cộng đồng.",
    skills: ["Sơ cứu cơ bản", "Hỗ trợ đi khám", "Theo dõi GPS"],
    documents: {
      citizenId: "079201000010",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      experienceProofUrl: demoDocumentImage,
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
    applicantType: "community_supporter",
    university: "",
    major: "",
    qualificationDescription: "Có kinh nghiệm hoạt động tình nguyện và hỗ trợ người cao tuổi trong khu dân cư.",
    skills: ["Theo dõi GPS", "Hỗ trợ di chuyển", "Giao tiếp gia đình"],
    documents: {
      citizenId: "079202000011",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      backgroundCheckUrl: demoDocumentImage,
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
    applicantType: "student",
    university: "Đại học Khoa học Xã hội và Nhân văn TP. HCM",
    major: "Tâm lý học",
    skills: ["Trò chuyện", "Đọc sách", "Nhắc lịch sinh hoạt"],
    documents: {
      citizenId: "079203000012",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: demoDocumentImage,
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
    applicantType: "healthcare_professional",
    yearsOfExperience: 2,
    university: "Đại học Y Dược TP. HCM",
    major: "Y tế công cộng",
    skills: ["Theo dõi sức khỏe", "Nhắc thuốc", "Hỗ trợ thủ tục bệnh viện"],
    documents: {
      citizenId: "079202000013",
      citizenIdFrontUrl: demoDocumentImage,
      citizenIdBackUrl: demoDocumentImage,
      studentCardUrl: "",
      professionalCertificateUrl: demoDocumentImage,
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
    dayOffset: -29,
    startHour: 9,
    durationHours: 2,
    address: "Bệnh viện Đại học Y Dược TP. HCM",
    addressLocation: {
      lat: 10.7553,
      lng: 106.6636,
      displayName: "Bệnh viện Đại học Y Dược TP. HCM",
    },
    note: "Hỗ trợ lấy số thứ tự, ghi chú lời dặn của bác sĩ và bàn giao đầy đủ cho gia đình.",
    status: "paid",
    completedDayOffset: -29,
    completedHour: 11,
  },
  {
    seedKey: "demo-booking-home-morning-accepted",
    customerKey: "customerMinhAn",
    elderKey: "elderA",
    companionKey: "companionThanh",
    serviceCode: "2",
    dayOffset: -28,
    startHour: 9,
    durationHours: 3,
    address: "Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    addressLocation: {
      lat: 10.8411,
      lng: 106.8431,
      displayName: "Vinhomes Grand Park",
    },
    note: "Nhắc thuốc, trò chuyện buổi sáng và cập nhật tình hình cho gia đình.",
    legacyNotes: ["Nhắc thuốc và trò chuyện buổi chiều."],
    status: "paid",
    completedDayOffset: -28,
    completedHour: 12,
  },
  {
    seedKey: "demo-booking-walk-afternoon-accepted",
    customerKey: "customerBao",
    elderKey: "elderB",
    companionKey: "companionTuan",
    serviceCode: "3",
    dayOffset: -27,
    startHour: 14,
    durationHours: 2,
    address: "Công viên ven sông, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7297,
      lng: 106.7217,
      displayName: "Công viên ven sông Quận 7",
    },
    note: "Đã hoàn thành buổi đi dạo nhẹ và bảo đảm an toàn cho người cao tuổi.",
    status: "paid",
    completedDayOffset: -27,
    completedHour: 16,
  },
  {
    seedKey: "demo-booking-home-completed",
    customerKey: "customerBao",
    elderKey: "elderB",
    companionKey: "companionHoangThanh",
    serviceCode: "2",
    dayOffset: -26,
    startHour: 9,
    durationHours: 2,
    address: "Chung cư Sunrise City, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7403,
      lng: 106.7016,
      displayName: "Sunrise City Quận 7",
    },
    note: "Theo dõi huyết áp và nhắc thuốc.",
    status: "paid",
    completedDayOffset: -26,
    completedHour: 11,
  },
  {
    seedKey: "demo-booking-hospital-paid",
    customerKey: "customerVan",
    elderKey: "elderVan",
    companionKey: "companionKhoi",
    serviceCode: "1",
    dayOffset: -25,
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
    completedDayOffset: -25,
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
    dayOffset: -24,
    startHour: 10,
    durationHours: 1,
    address: "Crescent Mall, Quận 7, TP. HCM",
    addressLocation: {
      lat: 10.7294,
      lng: 106.7184,
      displayName: "Crescent Mall",
    },
    note: "Đã hoàn thành buổi đồng hành đi dạo và bàn giao người cao tuổi an toàn.",
    status: "paid",
    completedDayOffset: -24,
    completedHour: 11,
  },
];

const paidBookingSeed = [
  { companionKey: "companionKhoi", dayOffset: -29, startHour: 8, durationHours: 1 },
  { companionKey: "companionThanh", dayOffset: -27, startHour: 10, durationHours: 2 },
  { companionKey: "companionTuan", dayOffset: -26, startHour: 14, durationHours: 1 },
  { companionKey: "companionHoangThanh", dayOffset: -23, startHour: 15, durationHours: 2 },
  { companionKey: "companionLanAnh", dayOffset: -22, startHour: 8, durationHours: 2 },
  { companionKey: "companionQuynhTrang", dayOffset: -22, startHour: 14, durationHours: 1 },
  { companionKey: "companionDucManh", dayOffset: -21, startHour: 9, durationHours: 1 },
  { companionKey: "companionPhuongNam", dayOffset: -20, startHour: 15, durationHours: 2 },
  { companionKey: "companionBaoTran", dayOffset: -19, startHour: 8, durationHours: 2 },
  { companionKey: "companionHaiYen", dayOffset: -14, startHour: 14, durationHours: 1 },
  { companionKey: "companionKhoi", dayOffset: -18, startHour: 10, durationHours: 1 },
  { companionKey: "companionThanh", dayOffset: -18, startHour: 8, durationHours: 2 },
  { companionKey: "companionTuan", dayOffset: -17, startHour: 14, durationHours: 2 },
  { companionKey: "companionHoangThanh", dayOffset: -16, startHour: 9, durationHours: 1 },
  { companionKey: "companionLanAnh", dayOffset: -15, startHour: 7, durationHours: 1 },
  { companionKey: "companionQuynhTrang", dayOffset: -13, startHour: 15, durationHours: 2 },
  { companionKey: "companionDucManh", dayOffset: -19, startHour: 14, durationHours: 2 },
  { companionKey: "companionPhuongNam", dayOffset: -14, startHour: 14, durationHours: 1 },
  { companionKey: "companionBaoTran", dayOffset: -13, startHour: 10, durationHours: 1 },
  { companionKey: "companionHaiYen", dayOffset: -12, startHour: 9, durationHours: 2 },
  { companionKey: "companionTuan", dayOffset: -11, startHour: 15, durationHours: 2 },
  { companionKey: "companionHoangThanh", dayOffset: -10, startHour: 8, durationHours: 2 },
  { companionKey: "companionLanAnh", dayOffset: -10, startHour: 9, durationHours: 2 },
  { companionKey: "companionQuynhTrang", dayOffset: -9, startHour: 14, durationHours: 2 },
  { companionKey: "companionDucManh", dayOffset: -8, startHour: 8, durationHours: 2 },
  { companionKey: "companionPhuongNam", dayOffset: -8, startHour: 16, durationHours: 1 },
  { companionKey: "companionBaoTran", dayOffset: -7, startHour: 8, durationHours: 1 },
  { companionKey: "companionHaiYen", dayOffset: -7, startHour: 14, durationHours: 2 },
  { companionKey: "companionLanAnh", dayOffset: -6, startHour: 10, durationHours: 2 },
  { companionKey: "companionQuynhTrang", dayOffset: -5, startHour: 15, durationHours: 1 },
  { companionKey: "companionDucManh", dayOffset: -4, startHour: 9, durationHours: 2 },
  { companionKey: "companionPhuongNam", dayOffset: -3, startHour: 14, durationHours: 2 },
  { companionKey: "companionBaoTran", dayOffset: -2, startHour: 10, durationHours: 2 },
  { companionKey: "companionHaiYen", dayOffset: -1, startHour: 8, durationHours: 1 },
  { companionKey: "companionHaiYen", dayOffset: 0, startHour: 8, durationHours: 2 },
  { companionKey: "companionThanh", dayOffset: -25, startHour: 8, durationHours: 1 },
  { companionKey: "companionTuan", dayOffset: -12, startHour: 14, durationHours: 2 },
  { companionKey: "companionHoangThanh", dayOffset: -2, startHour: 9, durationHours: 1 },
  { companionKey: "companionLanAnh", dayOffset: -23, startHour: 8, durationHours: 2 },
  { companionKey: "companionQuynhTrang", dayOffset: -23, startHour: 14, durationHours: 1 },
  { companionKey: "companionKhoi", dayOffset: -11, startHour: 8, durationHours: 2 },
  { companionKey: "companionThanh", dayOffset: -11, startHour: 10, durationHours: 2 },
  { companionKey: "companionHoangThanh", dayOffset: -5, startHour: 8, durationHours: 2 },
  { companionKey: "companionLanAnh", dayOffset: -5, startHour: 10, durationHours: 2 },
  { companionKey: "companionDucManh", dayOffset: -27, startHour: 9, durationHours: 2 },
  { companionKey: "companionBaoTran", dayOffset: -14, startHour: 8, durationHours: 2 },
  { companionKey: "companionTuan", dayOffset: -19, startHour: 16, durationHours: 2 },
  { companionKey: "companionQuynhTrang", dayOffset: -19, startHour: 13, durationHours: 1 },
  { companionKey: "companionPhuongNam", dayOffset: -7, startHour: 13, durationHours: 2 },
  { companionKey: "companionHaiYen", dayOffset: -7, startHour: 7, durationHours: 1 },
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

const realisticBookingNotesByService = {
  1: [
    "Hỗ trợ làm thủ tục khám, nhận thuốc và ghi lại lời dặn của bác sĩ cho gia đình.",
    "Đồng hành tái khám định kỳ và cập nhật kết quả sau buổi khám cho người nhà.",
    "Hỗ trợ di chuyển trong bệnh viện, lấy số thứ tự và nhận thuốc sau khi khám.",
  ],
  2: [
    "Nhắc thuốc đúng giờ, theo dõi huyết áp và cập nhật tình trạng cho gia đình.",
    "Trò chuyện, hỗ trợ bữa ăn nhẹ và nhắc người lớn tuổi uống thuốc theo đơn.",
    "Theo dõi sức khỏe tại nhà và hỗ trợ các sinh hoạt nhẹ trong thời gian chăm sóc.",
  ],
  3: [
    "Đồng hành đi dạo nhẹ, theo dõi sức khỏe và đưa người lớn tuổi về nhà an toàn.",
    "Hỗ trợ vận động ngoài trời theo nhịp phù hợp và nghỉ ngơi khi cần.",
    "Cùng người lớn tuổi đi dạo, trò chuyện và cập nhật hành trình cho gia đình.",
  ],
};

export const getRealisticBookingNote = (serviceCode, index = 0) => {
  const notes = realisticBookingNotesByService[String(serviceCode)] || realisticBookingNotesByService[2];
  return notes[Math.abs(Number(index) || 0) % notes.length];
};

export const paidBookingCustomers = [
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
  {
    customerKey: "customerThuyDung",
    elderKey: "elderThuyDung",
    address: "Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    addressLocation: { lat: 10.8411, lng: 106.8431, displayName: "Vinhomes Grand Park" },
  },
  {
    customerKey: "customerQuocDat",
    elderKey: "elderQuocDat",
    address: "Chung cư Sunrise City, Quận 7, TP. HCM",
    addressLocation: { lat: 10.7403, lng: 106.7016, displayName: "Sunrise City Quận 7" },
  },
  {
    customerKey: "customerNgocHan",
    elderKey: "elderNgocHan",
    address: "Chung cư Hà Đô Centrosa, Quận 10, TP. HCM",
    addressLocation: { lat: 10.777, lng: 106.6775, displayName: "Hà Đô Centrosa" },
  },
  {
    customerKey: "customerTrungKien",
    elderKey: "elderTrungKien",
    address: "Chung cư Orchard Garden, Quận Phú Nhuận, TP. HCM",
    addressLocation: { lat: 10.8082, lng: 106.6707, displayName: "Orchard Garden" },
  },
  {
    customerKey: "customerMyHanh",
    elderKey: "elderMyHanh",
    address: "Chung cư Saigon Royal, Quận 4, TP. HCM",
    addressLocation: { lat: 10.7685, lng: 106.7005, displayName: "Saigon Royal" },
  },
  {
    customerKey: "customerAnhTuan",
    elderKey: "elderAnhTuan",
    address: "Khu dân cư Him Lam, Quận 7, TP. HCM",
    addressLocation: { lat: 10.7421, lng: 106.6979, displayName: "Khu dân cư Him Lam" },
  },
  {
    customerKey: "customerKhanhLinh",
    elderKey: "elderKhanhLinh",
    address: "Masteri Thảo Điền, TP. Thủ Đức, TP. HCM",
    addressLocation: { lat: 10.8029, lng: 106.7332, displayName: "Masteri Thảo Điền" },
  },
  {
    customerKey: "customerMinhQuan",
    elderKey: "elderMinhQuan",
    address: "Chung cư Xi Grand Court, Quận 10, TP. HCM",
    addressLocation: { lat: 10.7655, lng: 106.6673, displayName: "Xi Grand Court" },
  },
  {
    customerKey: "customerThanhThao",
    elderKey: "elderThanhThao",
    address: "Vinhomes Central Park, Quận Bình Thạnh, TP. HCM",
    addressLocation: { lat: 10.7952, lng: 106.7206, displayName: "Vinhomes Central Park" },
  },
  {
    customerKey: "customerDucHuy",
    elderKey: "elderDucHuy",
    address: "Chung cư Léman Luxury, Quận 3, TP. HCM",
    addressLocation: { lat: 10.7797, lng: 106.6888, displayName: "Léman Luxury" },
  },
  {
    customerKey: "customerBaoTram",
    elderKey: "elderBaoTram",
    address: "Chung cư Eco Green, Quận 7, TP. HCM",
    addressLocation: { lat: 10.7316, lng: 106.7216, displayName: "Eco Green Sài Gòn" },
  },
  {
    customerKey: "customerHoangNam",
    elderKey: "elderHoangNam",
    address: "The Sun Avenue, TP. Thủ Đức, TP. HCM",
    addressLocation: { lat: 10.7889, lng: 106.7496, displayName: "The Sun Avenue" },
  },
  {
    customerKey: "customerGiaLinh",
    elderKey: "elderGiaLinh",
    address: "Chung cư Richmond City, Quận Bình Thạnh, TP. HCM",
    addressLocation: { lat: 10.8169, lng: 106.7026, displayName: "Richmond City" },
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
      note: getRealisticBookingNote(String((index % 3) + 1), index),
      status: "paid",
      completedDayOffset: item.dayOffset,
      completedHour: item.startHour + item.durationHours,
      review: paidBookingReviews[index],
    };
  }),
);

export const projectWeekBookingSeed = [
  {
    seedKey: "demo-booking-week5-01",
    customerIndex: 0,
    companionKey: "companionKhoi",
    serviceCode: "1",
    date: "2026-06-08",
    startHour: 8,
    durationHours: 3,
    address: "Benh vien Dai hoc Y Duoc TP. HCM",
    addressLocation: { lat: 10.7553, lng: 106.6636, displayName: "Benh vien Dai hoc Y Duoc TP. HCM" },
  },
  {
    seedKey: "demo-booking-week5-02",
    customerIndex: 1,
    companionKey: "companionTuan",
    serviceCode: "3",
    date: "2026-06-09",
    startHour: 14,
    durationHours: 4,
    address: "Cong vien ven song, Quan 7, TP. HCM",
    addressLocation: { lat: 10.7297, lng: 106.7217, displayName: "Cong vien ven song Quan 7" },
  },
  {
    seedKey: "demo-booking-week5-03",
    customerIndex: 2,
    companionKey: "companionThanh",
    serviceCode: "1",
    date: "2026-06-10",
    startHour: 9,
    durationHours: 4,
    address: "Phong kham CarePlus Quan 7",
    addressLocation: { lat: 10.7308, lng: 106.7032, displayName: "CarePlus Quan 7" },
  },
  {
    seedKey: "demo-booking-week5-04",
    customerIndex: 0,
    companionKey: "companionQuynhTrang",
    serviceCode: "3",
    date: "2026-06-11",
    startHour: 13,
    durationHours: 3,
    address: "Cong vien Gia Dinh, Quan Phu Nhuan, TP. HCM",
    addressLocation: { lat: 10.8133, lng: 106.6717, displayName: "Cong vien Gia Dinh" },
  },
  {
    seedKey: "demo-booking-week5-05",
    customerIndex: 1,
    companionKey: "companionLanAnh",
    serviceCode: "1",
    date: "2026-06-12",
    startHour: 7,
    durationHours: 3,
    address: "Benh vien FV, Quan 7, TP. HCM",
    addressLocation: { lat: 10.7326, lng: 106.7198, displayName: "Benh vien FV" },
  },
  {
    seedKey: "demo-booking-week5-06",
    customerIndex: 2,
    companionKey: "companionDucManh",
    serviceCode: "2",
    date: "2026-06-13",
    startHour: 8,
    durationHours: 4,
    address: "Chung cu Masteri An Phu, TP. Thu Duc, TP. HCM",
    addressLocation: { lat: 10.8025, lng: 106.7409, displayName: "Masteri An Phu" },
  },
  {
    seedKey: "demo-booking-week5-07",
    customerIndex: 0,
    companionKey: "companionPhuongNam",
    serviceCode: "1",
    date: "2026-06-14",
    startHour: 15,
    durationHours: 3,
    address: "Benh vien Vinmec Central Park, Binh Thanh, TP. HCM",
    addressLocation: { lat: 10.7946, lng: 106.7219, displayName: "Vinmec Central Park" },
  },
  {
    seedKey: "demo-booking-week6-01",
    customerIndex: 1,
    companionKey: "companionBaoTran",
    serviceCode: "3",
    date: "2026-06-15",
    startHour: 8,
    durationHours: 4,
    address: "Crescent Mall, Quan 7, TP. HCM",
    addressLocation: { lat: 10.7294, lng: 106.7184, displayName: "Crescent Mall" },
  },
  {
    seedKey: "demo-booking-week6-02",
    customerIndex: 2,
    companionKey: "companionHaiYen",
    serviceCode: "1",
    date: "2026-06-18",
    startHour: 13,
    durationHours: 4,
    address: "Benh vien Cho Ray, Quan 5, TP. HCM",
    addressLocation: { lat: 10.7569, lng: 106.6608, displayName: "Benh vien Cho Ray" },
  },
  {
    seedKey: "demo-booking-week6-03",
    customerIndex: 0,
    companionKey: "companionTuan",
    serviceCode: "3",
    date: "2026-06-21",
    startHour: 14,
    durationHours: 3,
    address: "Cong vien Tao Dan, Quan 1, TP. HCM",
    addressLocation: { lat: 10.7766, lng: 106.6933, displayName: "Cong vien Tao Dan" },
  },
  {
    seedKey: "demo-booking-week7-01",
    customerIndex: 1,
    companionKey: "companionKhoi",
    serviceCode: "1",
    date: "2026-06-22",
    startHour: 9,
    durationHours: 3,
    address: "Benh vien Mat TP. HCM, Quan 3",
    addressLocation: { lat: 10.7785, lng: 106.6864, displayName: "Benh vien Mat TP. HCM" },
  },
  {
    seedKey: "demo-booking-week7-02",
    customerIndex: 2,
    companionKey: "companionHoangThanh",
    serviceCode: "3",
    date: "2026-06-23",
    startHour: 14,
    durationHours: 4,
    address: "Pho di bo Nguyen Hue, Quan 1, TP. HCM",
    addressLocation: { lat: 10.7743, lng: 106.7041, displayName: "Pho di bo Nguyen Hue" },
  },
  {
    seedKey: "demo-booking-week7-03",
    customerIndex: 0,
    companionKey: "companionThanh",
    serviceCode: "1",
    date: "2026-06-25",
    startHour: 8,
    durationHours: 4,
    address: "Benh vien Thong Nhat, Quan Tan Binh, TP. HCM",
    addressLocation: { lat: 10.7913, lng: 106.6537, displayName: "Benh vien Thong Nhat" },
  },
  {
    seedKey: "demo-booking-week7-04",
    customerIndex: 1,
    companionKey: "companionQuynhTrang",
    serviceCode: "3",
    date: "2026-06-27",
    startHour: 13,
    durationHours: 3,
    address: "Cong vien Le Van Tam, Quan 1, TP. HCM",
    addressLocation: { lat: 10.7873, lng: 106.6947, displayName: "Cong vien Le Van Tam" },
  },
  {
    seedKey: "demo-booking-week7-05",
    customerIndex: 2,
    companionKey: "companionPhuongNam",
    serviceCode: "1",
    date: "2026-06-28",
    startHour: 15,
    durationHours: 3,
    address: "Benh vien Gia Dinh, Binh Thanh, TP. HCM",
    addressLocation: { lat: 10.8036, lng: 106.6944, displayName: "Benh vien Gia Dinh" },
  },
  {
    seedKey: "demo-booking-week8-01",
    customerIndex: 3,
    companionKey: "companionKhoi",
    serviceCode: "2",
    date: "2026-06-30",
    startHour: 8,
    durationHours: 3,
    address: "Vinhomes Grand Park, TP. Thủ Đức, TP. HCM",
    addressLocation: { lat: 10.8411, lng: 106.8431, displayName: "Vinhomes Grand Park" },
  },
  {
    seedKey: "demo-booking-week8-02",
    customerIndex: 4,
    companionKey: "companionDucManh",
    serviceCode: "2",
    date: "2026-07-02",
    startHour: 14,
    durationHours: 4,
    address: "Chung cư Sunrise City, Quận 7, TP. HCM",
    addressLocation: { lat: 10.7403, lng: 106.7016, displayName: "Sunrise City Quận 7" },
  },
  {
    seedKey: "demo-booking-week8-03",
    customerIndex: 5,
    companionKey: "companionTuan",
    serviceCode: "3",
    date: "2026-07-05",
    startHour: 14,
    durationHours: 3,
    address: "Hồ Bán Nguyệt, Quận 7, TP. HCM",
    addressLocation: { lat: 10.7297, lng: 106.7187, displayName: "Hồ Bán Nguyệt" },
  },
  {
    seedKey: "demo-booking-week9-01",
    customerIndex: 6,
    companionKey: "companionLanAnh",
    serviceCode: "1",
    date: "2026-07-06",
    startHour: 8,
    durationHours: 4,
    address: "Bệnh viện Nhân dân 115, Quận 10, TP. HCM",
    addressLocation: { lat: 10.7748, lng: 106.6674, displayName: "Bệnh viện Nhân dân 115" },
  },
  {
    seedKey: "demo-booking-week9-02",
    customerIndex: 7,
    companionKey: "companionBaoTran",
    serviceCode: "1",
    date: "2026-07-08",
    startHour: 8,
    durationHours: 3,
    address: "Bệnh viện Mắt TP. HCM, Quận 3",
    addressLocation: { lat: 10.7785, lng: 106.6864, displayName: "Bệnh viện Mắt TP. HCM" },
  },
  {
    seedKey: "demo-booking-week9-03",
    customerIndex: 8,
    companionKey: "companionPhuongNam",
    serviceCode: "3",
    date: "2026-07-10",
    startHour: 14,
    durationHours: 3,
    address: "Vinhomes Central Park, Quận Bình Thạnh, TP. HCM",
    addressLocation: { lat: 10.7952, lng: 106.7206, displayName: "Vinhomes Central Park" },
  },
  {
    seedKey: "demo-booking-week9-04",
    customerIndex: 9,
    companionKey: "companionKhoi",
    serviceCode: "1",
    date: "2026-07-12",
    startHour: 9,
    durationHours: 4,
    address: "Bệnh viện Lê Văn Thịnh, TP. Thủ Đức, TP. HCM",
    addressLocation: { lat: 10.7771, lng: 106.7654, displayName: "Bệnh viện Lê Văn Thịnh" },
  },
  {
    seedKey: "demo-booking-week10-01",
    customerIndex: 10,
    companionKey: "companionQuynhTrang",
    serviceCode: "1",
    date: "2026-07-16",
    startHour: 13,
    durationHours: 4,
    address: "Bệnh viện Hoàn Mỹ Sài Gòn, Quận Phú Nhuận, TP. HCM",
    addressLocation: { lat: 10.8007, lng: 106.6797, displayName: "Bệnh viện Hoàn Mỹ Sài Gòn" },
  },
  {
    seedKey: "demo-booking-week12-01",
    customerIndex: 11,
    companionKey: "companionThanh",
    serviceCode: "1",
    date: "2026-07-28",
    startHour: 8,
    durationHours: 4,
    address: "Bệnh viện Nhân dân Gia Định, Quận Bình Thạnh, TP. HCM",
    addressLocation: { lat: 10.8036, lng: 106.6944, displayName: "Bệnh viện Nhân dân Gia Định" },
  },
  {
    seedKey: "demo-booking-week12-02",
    customerIndex: 12,
    companionKey: "companionHoangThanh",
    serviceCode: "3",
    date: "2026-08-01",
    startHour: 15,
    durationHours: 3,
    address: "Công viên Lê Văn Tám, Quận 3, TP. HCM",
    addressLocation: { lat: 10.7873, lng: 106.6947, displayName: "Công viên Lê Văn Tám" },
  },
  {
    seedKey: "demo-booking-week13-01",
    customerIndex: 13,
    companionKey: "companionDucManh",
    serviceCode: "2",
    date: "2026-08-03",
    startHour: 8,
    durationHours: 4,
    address: "Chung cư Eco Green, Quận 7, TP. HCM",
    addressLocation: { lat: 10.7316, lng: 106.7216, displayName: "Eco Green Sài Gòn" },
  },
  {
    seedKey: "demo-booking-week13-02",
    customerIndex: 14,
    companionKey: "companionPhuongNam",
    serviceCode: "2",
    date: "2026-08-06",
    startHour: 14,
    durationHours: 3,
    address: "The Sun Avenue, TP. Thủ Đức, TP. HCM",
    addressLocation: { lat: 10.7889, lng: 106.7496, displayName: "The Sun Avenue" },
  },
  {
    seedKey: "demo-booking-week13-03",
    customerIndex: 15,
    companionKey: "companionHaiYen",
    serviceCode: "1",
    date: "2026-08-08",
    startHour: 9,
    durationHours: 4,
    address: "Bệnh viện Quận 6, Quận 6, TP. HCM",
    addressLocation: { lat: 10.746, lng: 106.635, displayName: "Bệnh viện Quận 6" },
  },
];

const projectWeekBookingScenarios = {
  "demo-booking-week5-06": {
    status: "cancelled",
    cancellationReason: "customer_request",
    cancellationDetails: "Gia đình thay đổi lịch chăm sóc và sẽ đặt lại vào ngày phù hợp hơn.",
    cancelledByRole: "customer",
  },
  "demo-booking-week7-04": {
    status: "cancelled",
    cancellationReason: "companion_unavailable",
    cancellationDetails: "Companion báo không thể tiếp tục nhận ca do có việc đột xuất.",
    cancelledByRole: "companion",
  },
  "demo-booking-week9-03": {
    status: "completed",
    paymentStatus: "pending",
  },
  "demo-booking-week10-01": {
    status: "completed",
    paymentStatus: "expired",
  },
  "demo-booking-week12-02": {
    status: "cancelled",
    cancellationReason: "incident",
    cancellationDetails: "Ca được hủy sau khi companion báo sự cố di chuyển và admin xác nhận phương án xử lý.",
    cancelledByRole: "admin",
    incident: {
      status: "cancelled",
      reason: "transport",
      details: "Phương tiện gặp sự cố nên companion không thể đến điểm hẹn đúng giờ.",
      resolution: "cancel",
      adminNote: "Đã liên hệ gia đình và thống nhất hủy ca.",
    },
  },
  "demo-booking-week13-02": {
    status: "completed",
    paymentStatus: "failed",
  },
  "demo-booking-week8-02": {
    status: "paid",
    incident: {
      status: "resolved",
      reason: "health",
      details: "Người cao tuổi cảm thấy mệt nhẹ trong lúc chăm sóc tại nhà.",
      resolution: "resume",
      adminNote: "Gia đình xác nhận sức khỏe đã ổn định và ca có thể tiếp tục.",
    },
  },
};

export const getProjectWeekBookingScenario = (seedKey, index = 0) => ({
  status: "paid",
  paymentStatus: "paid",
  paymentDelayHours: (Math.abs(Number(index) || 0) % 4) + 1,
  ...(projectWeekBookingScenarios[seedKey] || {}),
});

bookingSeed.splice(
  0,
  bookingSeed.length,
  ...projectWeekBookingSeed.map((item, index) => {
    const customer = paidBookingCustomers[item.customerIndex % paidBookingCustomers.length];
    const scenario = getProjectWeekBookingScenario(item.seedKey, index);
    return {
      seedKey: item.seedKey,
      ...customer,
      companionKey: item.companionKey,
      serviceCode: item.serviceCode,
      date: item.date,
      startHour: item.startHour,
      durationHours: item.durationHours,
      address: item.address,
      addressLocation: item.addressLocation,
      note: getRealisticBookingNote(item.serviceCode, index),
      ...scenario,
      review: scenario.status === "paid" ? paidBookingReviews[index % paidBookingReviews.length] : null,
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
    if (!existingUser && userData.joinedAt) {
      await User.updateOne(
        { _id: user._id },
        { $set: { createdAt: new Date(userData.joinedAt) } },
        { timestamps: false },
      );
    }
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

const resolveBookingDependencies = async () => {
  const requiredUserKeys = [...new Set(bookingSeed.flatMap((item) => [item.customerKey, item.companionKey]))];
  const requiredServiceCodes = [...new Set(bookingSeed.map((item) => item.serviceCode))];
  const requiredElderKeys = [...new Set(bookingSeed.map((item) => item.elderKey))];
  const users = {};
  const services = {};
  const elders = {};
  const missing = [];

  for (const userKey of requiredUserKeys) {
    const userData = usersSeed.find((item) => item.key === userKey);
    const emails = [userData?.email, ...(userData?.legacyEmails || [])]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    const user = userData ? await User.findOne({ email: { $in: emails } }) : null;
    if (user) {
      users[userKey] = user;
    } else {
      missing.push(`user:${userKey}`);
    }
  }

  const serviceRows = await Service.find({ code: { $in: requiredServiceCodes } });
  for (const service of serviceRows) {
    services[service.code] = service;
  }
  for (const serviceCode of requiredServiceCodes) {
    if (!services[serviceCode]) {
      missing.push(`service:${serviceCode}`);
    }
  }

  for (const elderKey of requiredElderKeys) {
    const elderData = elderProfilesSeed.find((item) => item.key === elderKey);
    const customer = elderData ? users[elderData.customerKey] : null;
    const elder = customer
      ? await ElderProfile.findOne({ customerId: customer._id, fullName: elderData.fullName })
      : null;
    if (elder) {
      elders[elderKey] = elder;
    } else {
      missing.push(`elder:${elderKey}`);
    }
  }

  const companionKeys = [...new Set(bookingSeed.map((item) => item.companionKey))];
  const companionIds = companionKeys.map((key) => users[key]?._id).filter(Boolean);
  const companionProfiles = await CompanionProfile.find({ userId: { $in: companionIds } }).select("userId");
  const companionProfileIds = new Set(companionProfiles.map((profile) => String(profile.userId)));
  for (const companionKey of companionKeys) {
    const companionId = users[companionKey]?._id;
    if (companionId && !companionProfileIds.has(String(companionId))) {
      missing.push(`companionProfile:${companionKey}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing booking seed dependencies: ${missing.join(", ")}. Run npm run seed:demo first.`);
  }

  return { users, services, elders };
};

const upsertShiftLog = async ({ booking, service, status }) => {
  const checklist = (service.defaultChecklist || []).map((label, index) => ({
    label,
    done: ["completed", "paid"].includes(status)
      ? true
      : status === "in_progress"
        ? index < 2
        : status === "accepted" && index === 0,
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
                recordedAt: booking.checkInAt || booking.startTime,
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

export const buildSeedPaymentTimes = ({ booking, status, paymentDelayHours = 0 }) => {
  if (status !== "paid") {
    return {
      paidAt: null,
      transferredAt: null,
      confirmedAt: null,
      paidAtSource: null,
    };
  }

  const completedAt = booking.completedAt || new Date();
  const confirmedAt = new Date(completedAt.getTime() + Number(paymentDelayHours || 0) * 60 * 60 * 1000);
  return {
    paidAt: confirmedAt,
    transferredAt: null,
    confirmedAt,
    paidAtSource: "seed",
  };
};

const upsertPayment = async ({ booking, status, paymentStatus, paymentDelayHours }) => {
  const baseAmount = Number(booking.totalAmount || 0);
  const platformFee = Number(booking.platformFee || 0);
  const paymentTimes = buildSeedPaymentTimes({ booking, status, paymentDelayHours });
  const normalizedPaymentStatus = status === "paid" ? "paid" : paymentStatus || "pending";

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
        paidAmount: normalizedPaymentStatus === "paid" ? baseAmount : 0,
        method: "prototype",
        status: normalizedPaymentStatus,
        ...paymentTimes,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
};

const setSeedDocumentTimestamps = async (Model, filter, createdAt, updatedAt = createdAt) => {
  await Model.collection.updateOne(
    filter,
    { $set: { createdAt, updatedAt } },
  );
};

const pruneObsoleteDemoBookings = async () => {
  const seedKeys = bookingSeed.map((item) => item.seedKey);
  const obsoleteBookings = await Booking.find({
    seedKey: { $regex: /^demo-booking-/, $nin: seedKeys },
  }).select("_id");
  const obsoleteIds = obsoleteBookings.map((booking) => booking._id);

  if (!obsoleteIds.length) return;

  await Promise.all([
    ShiftLog.deleteMany({ bookingId: { $in: obsoleteIds } }),
    Payment.deleteMany({ bookingId: { $in: obsoleteIds } }),
    Review.deleteMany({ bookingId: { $in: obsoleteIds } }),
  ]);
  await Booking.deleteMany({ _id: { $in: obsoleteIds } });
};

const seedBookings = async ({ users, elders, services }) => {
  const now = new Date();
  const bookings = [];

  const atLocalHour = ({ date, dayOffset, hour }) => {
    if (date) {
      const [year, month, day] = String(date).split("-").map(Number);
      return new Date(year, month - 1, day, hour, 0, 0, 0);
    }

    const value = new Date(now);
    value.setHours(hour, 0, 0, 0);
    value.setDate(value.getDate() + dayOffset);
    return value;
  };

  await pruneObsoleteDemoBookings();

  for (const [seedIndex, item] of bookingSeed.entries()) {
    const customerId = users[item.customerKey]._id;
    const elderProfileId = elders[item.elderKey]._id;
    const companionId = users[item.companionKey]._id;
    const service = services[item.serviceCode];
    const serviceId = service._id;
    const totalAmount = service.pricePerHour * item.durationHours;
    const startTime = atLocalHour({ date: item.date, dayOffset: item.dayOffset, hour: item.startHour });
    const completedAt = Number.isInteger(item.completedHour)
      ? atLocalHour({
          date: item.completedDate || item.date,
          dayOffset: Number.isInteger(item.completedDayOffset) ? item.completedDayOffset : item.dayOffset,
          hour: item.completedHour,
        })
      : ["completed", "paid"].includes(item.status)
        ? new Date(startTime.getTime() + item.durationHours * 60 * 60 * 1000)
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
    if (!isCompanionScheduleAvailable(companionProfile, startTime, item.durationHours)) {
      throw new Error(`Booking seed for ${item.companionKey} is outside the configured availability`);
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
      acceptedAt: ["completed", "paid"].includes(item.status)
        ? new Date(startTime.getTime() - 12 * 60 * 60 * 1000)
        : null,
      checkInAt: ["completed", "paid"].includes(item.status)
        ? new Date(startTime.getTime() - 5 * 60 * 1000)
        : null,
      checkOutAt: completedAt,
      completedAt,
      paymentDueAt: completedAt && ["completed", "paid"].includes(item.status)
        ? new Date(completedAt.getTime() + 3 * 24 * 60 * 60 * 1000)
        : null,
      totalAmount,
      platformFee: Math.round(totalAmount * platformFeeRate),
      cancellation: item.status === "cancelled"
        ? {
            reason: item.cancellationReason || "other",
            details: item.cancellationDetails || "",
            cancelledAt: new Date(startTime.getTime() - 6 * 60 * 60 * 1000),
            cancelledBy: item.cancelledByRole === "customer"
              ? customerId
              : item.cancelledByRole === "companion"
                ? companionId
                : null,
            cancelledByRole: item.cancelledByRole || "system",
          }
        : {
            reason: "",
            details: "",
            cancelledAt: null,
            cancelledBy: null,
            cancelledByRole: "",
          },
      incident: item.incident
        ? {
            ...item.incident,
            reportedAt: new Date(startTime.getTime() + 60 * 60 * 1000),
            reportedBy: companionId,
            resolvedAt: new Date(startTime.getTime() + 75 * 60 * 1000),
            resolvedBy: null,
            previousCompanionId: null,
          }
        : {
            status: "none",
            reason: "",
            details: "",
            reportedAt: null,
            reportedBy: null,
            resolvedAt: null,
            resolvedBy: null,
            resolution: "",
            adminNote: "",
            previousCompanionId: null,
          },
    };
    const existingSeedBooking = await Booking.findOne({ seedKey: item.seedKey }).select("_id");
    let legacyBooking = null;
    if (!existingSeedBooking) {
      const legacyCandidates = await Booking.find({
        customerId,
        elderProfileId,
        serviceId,
        companionId,
        seedKey: { $exists: false },
      }).select("_id note");
      const expectedNotes = [item.note, ...(item.legacyNotes || [])];
      legacyBooking = legacyCandidates.find((booking) => expectedNotes.includes(booking.note)) || null;
    }
    const booking = await Booking.findOneAndUpdate(
      existingSeedBooking
        ? { _id: existingSeedBooking._id }
        : legacyBooking
          ? { _id: legacyBooking._id }
          : { seedKey: item.seedKey },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    await upsertShiftLog({ booking, service, status: item.status });

    if (["completed", "paid"].includes(item.status)) {
      await upsertPayment({
        booking,
        status: item.status,
        paymentStatus: item.paymentStatus,
        paymentDelayHours: item.paymentDelayHours,
      });
    } else {
      await Payment.deleteOne({ bookingId: booking._id });
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
    } else {
      await Review.deleteOne({ bookingId: booking._id });
    }

    const bookingCreatedAt = new Date(startTime.getTime() - ((seedIndex % 4) + 2) * 24 * 60 * 60 * 1000);
    const bookingUpdatedAt = completedAt || bookingCreatedAt;
    await setSeedDocumentTimestamps(Booking, { _id: booking._id }, bookingCreatedAt, bookingUpdatedAt);
    await setSeedDocumentTimestamps(ShiftLog, { bookingId: booking._id }, startTime, bookingUpdatedAt);
    if (["completed", "paid"].includes(item.status)) {
      const paymentUpdatedAt = item.status === "paid"
        ? new Date(bookingUpdatedAt.getTime() + Number(item.paymentDelayHours || 0) * 60 * 60 * 1000)
        : bookingUpdatedAt;
      await setSeedDocumentTimestamps(Payment, { bookingId: booking._id }, bookingUpdatedAt, paymentUpdatedAt);
    }
    if (item.review) {
      const reviewCreatedAt = new Date(bookingUpdatedAt.getTime() + ((seedIndex % 5) + 1) * 60 * 60 * 1000);
      await setSeedDocumentTimestamps(Review, { bookingId: booking._id }, reviewCreatedAt, reviewCreatedAt);
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

export const seedBookingData = async () => {
  const { users, services, elders } = await resolveBookingDependencies();
  const bookings = await seedBookings({ users, elders, services });
  const companionStats = await syncCompanionStats(users);

  return { bookings, companionStats };
};

export const seedDemoData = async () => {
  const services = await upsertServices();
  const users = await seedUsers();
  const customerSeedResult = await seedCustomerUsers();
  const customerCount = customerSeedResult.seededCount;
  await seedCompanionProfiles(users);
  const elders = await seedElderProfiles(users);
  const bookings = await seedBookings({ users, elders, services });
  const companionStats = await syncCompanionStats(users);
  const withdrawalSummary = await seedWithdrawalData();
  const supportSummary = await seedSupportData();
  await seedBlogData();

  console.log("Database:", mongoose.connection.name);
  console.log("Seed mode: additive upsert");
  console.log("Seed password:", process.env.SEED_PASSWORD ? "from SEED_PASSWORD" : password);
  console.log("Accounts:", usersSeed.map((user) => `${user.role}:${user.email}`).join(", "));
  console.log("Services:", Object.keys(services).length);
  console.log("Additional customers:", customerCount);
  console.log("Obsolete customers deleted:", customerSeedResult.cleanup.deletedCount);
  if (customerSeedResult.cleanup.skipped.length > 0) {
    console.log("Obsolete customers skipped:", customerSeedResult.cleanup.skipped.map((item) =>
      `${item.email} (${item.bookingCount} bookings, ${item.elderCount} elders)`
    ).join(", "));
  }
  console.log("Bookings:", bookings.length);
  console.log("Companion reviews:", Object.values(companionStats).reduce((total, item) => total + item.ratingCount, 0));
  console.log("Withdrawals:", withdrawalSummary.withdrawals.length);
  console.log("Total withdrawn:", withdrawalSummary.totalWithdrawn);
  console.log("Support conversations:", supportSummary.conversations.length);
  console.log("Support messages:", supportSummary.messageCount);

  return {
    services,
    users,
    elders,
    bookings,
    customerCount,
    customerCleanup: customerSeedResult.cleanup,
    companionStats,
    withdrawalSummary,
    supportSummary,
  };
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
