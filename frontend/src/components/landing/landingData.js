export const trustItems = [
  {
    value: "GPS",
    label: "Theo dõi vị trí người thân và người đồng hành trong ca chăm sóc.",
  },
  {
    value: "SOS",
    label: "Nút hỗ trợ nhanh khi gia đình hoặc người đồng hành cần trợ giúp.",
  },
  {
    value: "3 lớp",
    label: "Kiểm duyệt CCCD, phỏng vấn kỹ năng mềm và hồ sơ lý lịch.",
  },
];

export const services = [
  {
    code: "01",
    icon: "hospital",
    title: "CareGo Hospital",
    description:
      "Hỗ trợ người cao tuổi đi khám bệnh, làm thủ tục, xếp hàng, lấy thuốc và ghi chú lời dặn của bác sĩ.",
    points: ["Đưa đón đi viện", "Hỗ trợ thủ tục", "Cập nhật ghi chú sau khám"],
  },
  {
    code: "02",
    icon: "home",
    title: "CareGo Home",
    description:
      "Người đồng hành đến nhà trò chuyện, nhắc uống thuốc theo đơn, theo dõi tình trạng và ghi chú ca làm.",
    points: ["Nhắc thuốc đúng giờ", "Trò chuyện, đọc báo", "Ghi chú sức khỏe"],
  },
  {
    code: "03",
    icon: "walk",
    title: "CareGo Walk",
    description:
      "Đồng hành cùng người cao tuổi đi dạo, tham gia câu lạc bộ, đi siêu thị hoặc hoạt động nhẹ ngoài trời.",
    points: ["Theo dõi GPS", "Ảnh xác nhận", "Báo cáo sau ca"],
  },
];

export const steps = [
  ["Chọn dịch vụ", "Người dùng chọn loại hỗ trợ như đi khám, chăm sóc tại nhà hoặc đi dạo."],
  ["Điền thông tin", "Nhập địa chỉ, thời gian, tình trạng người thân và yêu cầu cần hỗ trợ."],
  ["Chọn người đồng hành", "Xem hồ sơ, chuyên ngành, đánh giá, kỹ năng và chọn người phù hợp."],
  ["Theo dõi và thanh toán", "Theo dõi GPS, xem ảnh xác nhận, đọc ghi chú ca làm và thanh toán."],
];

export const safetyItems = [
  [
    "Xác thực người đồng hành",
    "Kiểm tra CCCD, thẻ sinh viên, ưu tiên sinh viên ngành Y, Dược, Điều dưỡng, Tâm lý.",
  ],
  [
    "Theo dõi thời gian thực",
    "Gia đình có thể xem GPS, ảnh xác nhận và ghi chú trong quá trình thực hiện dịch vụ.",
  ],
  [
    "Quy tắc 3 không",
    "Không tự ý cho thuốc ngoài đơn, không thu tiền ngoài app, không đổi lộ trình nếu chưa báo người thân.",
  ],
];

export const homeStats = [
  ["< 3 phút", "Tạo lịch chăm sóc"],
  ["24/7", "Theo dõi trạng thái"],
  ["2-3 ngày", "Xử lý ví người đồng hành"],
];
