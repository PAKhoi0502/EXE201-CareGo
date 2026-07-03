import crypto from "node:crypto";

const version = "2026-07-03";

const documents = [
  {
    type: "CUSTOMER_TERMS",
    slug: "customer-terms",
    audience: "customer",
    version,
    title: "Điều khoản sử dụng dành cho khách hàng",
    summary: "Quy định việc đặt lịch, thanh toán và sử dụng dịch vụ chăm sóc đồng hành CareGo.",
    sections: [
      { title: "Phạm vi dịch vụ", paragraphs: ["CareGo là nền tảng kết nối khách hàng với người đồng hành. Dịch vụ không thay thế hoạt động khám, chẩn đoán, điều trị hoặc cấp cứu y tế."] },
      { title: "Thông tin tài khoản", paragraphs: ["Khách hàng cung cấp thông tin chính xác, bảo vệ thông tin đăng nhập và chịu trách nhiệm với hoạt động phát sinh từ tài khoản của mình."] },
      { title: "Đặt lịch", paragraphs: ["Khách hàng kiểm tra dịch vụ, thời gian, địa chỉ, người đồng hành, thời lượng và tổng tiền trước khi xác nhận booking."] },
      { title: "Thông tin người thân", paragraphs: ["Khách hàng chỉ cung cấp thông tin người thân khi có quyền hợp pháp hoặc đã được người đó cho phép, đồng thời chỉ nhập dữ liệu cần thiết cho việc chăm sóc an toàn."] },
      { title: "Thanh toán", paragraphs: ["Giá, phí nền tảng, khoản phạt nếu có và trạng thái thanh toán được hiển thị trong booking. Thu nhập của companion chỉ được ghi nhận khi giao dịch được xác nhận thành công."] },
      { title: "Hủy lịch và hoàn tiền", paragraphs: ["Việc hủy lịch, hoàn tiền hoặc phát sinh chi phí được xử lý theo trạng thái booking, thời điểm hủy và chính sách hiển thị tại thời điểm giao dịch."] },
      { title: "An toàn", paragraphs: ["Khách hàng phải thông báo các lưu ý sức khỏe quan trọng và liên hệ dịch vụ cấp cứu chuyên nghiệp khi có tình huống khẩn cấp."] },
      { title: "Đánh giá", paragraphs: ["Đánh giá phải phản ánh trải nghiệm thực tế, không chứa nội dung xúc phạm, sai sự thật hoặc tiết lộ trái phép dữ liệu cá nhân."] },
      { title: "Khiếu nại", paragraphs: ["Khách hàng có thể gửi yêu cầu hỗ trợ, khiếu nại và bằng chứng liên quan thông qua kênh hỗ trợ của CareGo."] },
      { title: "Thay đổi điều khoản", paragraphs: ["Khi thay đổi quan trọng ảnh hưởng đến quyền hoặc nghĩa vụ, CareGo sẽ công khai phiên bản mới và yêu cầu chấp thuận lại trước thao tác liên quan."] },
    ],
  },
  {
    type: "COMPANION_TERMS",
    slug: "companion-terms",
    audience: "companion",
    version,
    title: "Điều khoản và quy tắc dành cho người đồng hành",
    summary: "Quy định hồ sơ, an toàn ca làm, bảo mật, thu nhập và trách nhiệm của companion.",
    sections: [
      { title: "Điều kiện tham gia", paragraphs: ["Người đăng ký phải có năng lực hành vi phù hợp, cung cấp hồ sơ và giấy tờ xác minh trung thực, còn hiệu lực."] },
      { title: "Phê duyệt hồ sơ", paragraphs: ["CareGo có quyền yêu cầu bổ sung tài liệu, từ chối, tạm dừng hoặc thu hồi trạng thái phê duyệt khi hồ sơ không đáp ứng yêu cầu an toàn."] },
      { title: "Nhận và từ chối booking", paragraphs: ["Companion chủ động xem thông tin cần thiết trước khi nhận ca. Sau khi nhận, companion phải tuân thủ thời gian, địa điểm và quy trình đã xác nhận."] },
      { title: "Phạm vi hỗ trợ", paragraphs: ["Companion không tự chẩn đoán, kê đơn, thay đổi thuốc, thực hiện thủ thuật y tế hoặc cam kết kết quả điều trị ngoài phạm vi chuyên môn hợp pháp."] },
      { title: "Quy trình ca làm", paragraphs: ["Companion thực hiện check-in, GPS, checklist, ghi chú và ảnh báo cáo trung thực. Không được làm giả vị trí, thời gian hoặc bằng chứng hoàn thành."] },
      { title: "Bảo mật", paragraphs: ["Thông tin sức khỏe, địa chỉ, liên hệ, lịch trình và hình ảnh của khách hàng chỉ được dùng để thực hiện booking, không được sao chép hoặc chia sẻ trái phép."] },
      { title: "An toàn và sự cố", paragraphs: ["Companion ưu tiên an toàn, thông báo gia đình và CareGo khi có sự cố, đồng thời liên hệ dịch vụ cấp cứu chuyên nghiệp khi cần thiết."] },
      { title: "Thu nhập", paragraphs: ["Thu nhập được tính từ booking đã thanh toán sau khi trừ phí nền tảng và các khoản điều chỉnh hợp lệ được hiển thị trong hệ thống."] },
      { title: "Hủy, vắng mặt và vi phạm", paragraphs: ["Việc hủy ca sau khi đã nhận, không đến, tiết lộ dữ liệu hoặc làm giả báo cáo có thể dẫn đến hạn chế nhận booking, tạm khóa hoặc chấm dứt quyền companion."] },
      { title: "Đánh giá", paragraphs: ["Đánh giá của khách hàng được hiển thị theo booking thực tế và có thể được dùng để cải thiện chất lượng hoặc xem xét trạng thái tài khoản."] },
      { title: "Thay đổi quy tắc", paragraphs: ["Phiên bản mới sẽ được công khai; thay đổi quan trọng phải được companion chấp thuận trước khi tiếp tục nhận ca."] },
    ],
  },
  {
    type: "PRIVACY_POLICY",
    slug: "privacy-policy",
    audience: "all",
    version,
    title: "Chính sách bảo vệ dữ liệu cá nhân",
    summary: "Mô tả dữ liệu CareGo thu thập, mục đích xử lý, chia sẻ, lưu trữ và quyền của chủ thể dữ liệu.",
    sections: [
      { title: "Dữ liệu được xử lý", paragraphs: ["CareGo có thể xử lý thông tin tài khoản, liên hệ, CCCD của companion, hồ sơ người thân, thông tin sức khỏe, booking, thanh toán, đánh giá, hỗ trợ, ảnh và vị trí GPS."] },
      { title: "Mục đích", paragraphs: ["Dữ liệu được dùng để xác minh tài khoản, kết nối booking, bảo đảm an toàn, xử lý thanh toán, hỗ trợ, giải quyết tranh chấp, chống gian lận và tuân thủ nghĩa vụ pháp lý."] },
      { title: "Dữ liệu nhạy cảm", paragraphs: ["Thông tin sức khỏe, giấy tờ định danh và vị trí được giới hạn quyền truy cập, chỉ xử lý trong phạm vi cần thiết cho mục đích đã thông báo."] },
      { title: "Chia sẻ", paragraphs: ["Dữ liệu có thể được chia sẻ ở mức cần thiết với customer, companion của booking, nhà cung cấp thanh toán, lưu trữ ảnh, bản đồ, email và cơ quan có thẩm quyền theo pháp luật."] },
      { title: "Thời gian lưu", paragraphs: ["Dữ liệu được lưu trong thời gian cần thiết để cung cấp dịch vụ, xử lý tranh chấp, bảo đảm an toàn và đáp ứng nghĩa vụ pháp lý; sau đó được xóa hoặc ẩn danh phù hợp."] },
      { title: "Quyền của chủ thể dữ liệu", paragraphs: ["Chủ thể có thể yêu cầu biết, truy cập, chỉnh sửa, cung cấp, hạn chế xử lý, phản đối, rút lại sự đồng ý hoặc xóa dữ liệu trong phạm vi pháp luật cho phép."] },
      { title: "Bảo mật", paragraphs: ["CareGo áp dụng kiểm soát truy cập, xác thực, ghi nhận hoạt động và biện pháp kỹ thuật phù hợp; không hệ thống nào có thể loại bỏ hoàn toàn mọi rủi ro."] },
      { title: "Liên hệ", paragraphs: ["Yêu cầu về dữ liệu cá nhân được gửi qua kênh hỗ trợ CareGo. Người yêu cầu có thể cần xác minh danh tính trước khi được xử lý."] },
    ],
  },
  {
    type: "ELDER_DATA_AUTHORITY",
    slug: "elder-data-authority",
    audience: "customer",
    version,
    title: "Xác nhận quyền cung cấp dữ liệu người thân",
    summary: "Xác nhận của customer trước khi lưu thông tin nhận dạng, liên hệ và sức khỏe của người thân.",
    sections: [
      { title: "Quyền cung cấp", paragraphs: ["Customer xác nhận mình là chủ thể dữ liệu, người đại diện hợp pháp hoặc đã được người thân cho phép cung cấp dữ liệu cho CareGo."] },
      { title: "Phạm vi cần thiết", paragraphs: ["Customer chỉ nhập thông tin cần thiết để đặt lịch và hỗ trợ chăm sóc an toàn, đồng thời cập nhật khi thông tin không còn chính xác."] },
      { title: "Chia sẻ theo booking", paragraphs: ["Thông tin cần thiết có thể được cung cấp cho companion đã nhận booking và nhân sự CareGo có trách nhiệm xử lý hỗ trợ hoặc sự cố."] },
    ],
  },
];

const withHash = (document) => ({
  ...document,
  hash: crypto
    .createHash("sha256")
    .update(JSON.stringify({
      type: document.type,
      version: document.version,
      title: document.title,
      summary: document.summary,
      sections: document.sections,
    }))
    .digest("hex"),
});

export const LEGAL_DOCUMENTS = Object.fromEntries(documents.map((document) => {
  const resolved = withHash(document);
  return [resolved.type, resolved];
}));

export const LEGAL_FLOWS = {
  CUSTOMER_SIGNUP: ["CUSTOMER_TERMS", "PRIVACY_POLICY"],
  COMPANION_APPLICATION: ["COMPANION_TERMS", "PRIVACY_POLICY"],
  ELDER_PROFILE_CREATE: ["ELDER_DATA_AUTHORITY", "PRIVACY_POLICY"],
};

export const getLegalDocumentBySlug = (slug) =>
  Object.values(LEGAL_DOCUMENTS).find((document) => document.slug === slug) || null;

export const getLegalRequirements = (flow) =>
  (LEGAL_FLOWS[flow] || []).map((type) => LEGAL_DOCUMENTS[type]);
