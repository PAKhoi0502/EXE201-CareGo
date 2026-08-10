const DAY_MS = 24 * 60 * 60 * 1000;

export const BLOG_ACTIVITY_WINDOWS = [
  { key: "june_peak", startDate: "2026-06-01", endDate: "2026-06-28", dailyWeight: 1, commentDailyWeight: 1 },
  { key: "june_tail", startDate: "2026-06-29", endDate: "2026-06-30", dailyWeight: 0.28, commentDailyWeight: 0.1 },
  { key: "july_early", startDate: "2026-07-01", endDate: "2026-07-10", dailyWeight: 0.18, commentDailyWeight: 0.03 },
  { key: "july_mid", startDate: "2026-07-11", endDate: "2026-07-20", dailyWeight: 0.15, commentDailyWeight: 0.02 },
  { key: "july_late", startDate: "2026-07-21", endDate: "2026-07-31", dailyWeight: 0.1, commentDailyWeight: 0.01 },
  { key: "august_early", startDate: "2026-08-01", endDate: "2026-08-09", dailyWeight: 0.05, commentDailyWeight: 0.01 },
];

export const blogInteractionProfiles = {
  "khi-nao-can-nguoi-dong-hanh-di-kham": {
    commentCount: 19,
    topic: "việc chuẩn bị cho người lớn tuổi đi khám",
  },
  "5-luu-y-khi-dat-lich-cham-soc-ba-me": {
    commentCount: 17,
    topic: "checklist đặt lịch chăm sóc cho ba mẹ",
  },
  "quy-tac-an-toan-cho-nguoi-dong-hanh": {
    commentCount: 18,
    topic: "các quy tắc an toàn trong ca đồng hành",
  },
  "sinh-vien-y-duoc-ho-tro-nguoi-cao-tuoi": {
    commentCount: 16,
    topic: "vai trò của sinh viên Y Dược khi hỗ trợ người cao tuổi",
  },
  "vi-sao-dich-vu-cham-soc-tai-nha-ngay-cang-pho-bien": {
    commentCount: 7,
    topic: "dịch vụ chăm sóc tại nhà",
  },
  "5-dau-hieu-nguoi-than-can-duoc-cham-soc-chuyen-nghiep": {
    commentCount: 6,
    topic: "các dấu hiệu cần hỗ trợ chăm sóc chuyên nghiệp",
  },
  "carego-khi-viec-cham-soc-khong-con-la-ganh-nang": {
    commentCount: 5,
    topic: "cách gia đình san sẻ việc chăm sóc",
  },
  "carego-ban-dong-hanh-tai-benh-vien": {
    commentCount: 3,
    topic: "dịch vụ đồng hành tại bệnh viện",
  },
  "carego-giai-phap-cham-soc-nguoi-cao-tuoi-theo-gio-thoi-4-0": {
    commentCount: 2,
    topic: "giải pháp chăm sóc người cao tuổi theo giờ",
  },
  "ban-ron-van-yeu-thuong-carego-mang-lai-su-an-tam-cho-gia-dinh-hien-dai": {
    commentCount: 1,
    topic: "việc giữ kết nối với ba mẹ khi gia đình bận rộn",
  },
};

const commentTemplates = [
  (topic) => `Bài viết giải thích ${topic} khá rõ, gia đình mình đọc xong dễ hình dung hơn nhiều.`,
  (topic) => `Mình đang tìm hiểu ${topic}, phần hướng dẫn trong bài rất sát với điều nhà mình cần.`,
  (topic) => `Thông tin về ${topic} được trình bày ngắn gọn và dễ áp dụng cho người mới sử dụng dịch vụ.`,
  (topic) => `Nhà mình từng khá lúng túng với ${topic}, đọc bài này mới thấy cần chuẩn bị kỹ từ đầu.`,
  (topic) => `Mình thích cách bài viết nói về ${topic} một cách thực tế, không làm mọi thứ trở nên quá phức tạp.`,
  (topic) => `Phần lưu ý về ${topic} rất hữu ích, nhất là với gia đình thường bận vào giờ hành chính.`,
  (topic) => `Ba mẹ mình cũng đang cần hỗ trợ tương tự, mình sẽ gửi bài về ${topic} cho cả nhà cùng xem.`,
  (topic) => `Đọc xong phần ${topic} mình thấy yên tâm hơn vì quy trình và trách nhiệm được nói khá rõ.`,
  (topic) => `Bài viết có nhiều chi tiết nhỏ về ${topic} mà trước đây gia đình mình thường bỏ sót.`,
  (topic) => `Nội dung về ${topic} đúng với tình huống nhà mình, đặc biệt là phần phối hợp với người thân.`,
  (topic) => `Mình đánh giá cao những hướng dẫn cụ thể về ${topic}, đọc nhanh nhưng vẫn đủ thông tin cần thiết.`,
  (topic) => `Nếu có thêm một checklist tải về cho ${topic} thì sẽ càng tiện, còn nội dung hiện tại đã rất dễ hiểu.`,
  (topic) => `Gia đình mình đã từng trải qua trường hợp gần giống bài viết, phần ${topic} được chia sẻ rất đúng thực tế.`,
  (topic) => `Bài này giúp mình hiểu rõ hơn phạm vi hỗ trợ trong ${topic}, tránh kỳ vọng sai khi đặt dịch vụ.`,
  (topic) => `Cách giải thích về ${topic} gần gũi và có trách nhiệm, mình sẽ lưu lại để tham khảo khi cần.`,
  (topic) => `Mình quan tâm nhất đến yếu tố an toàn trong ${topic}, bài viết đã trả lời được khá nhiều thắc mắc.`,
  (topic) => `Nội dung ${topic} phù hợp cho cả người lớn tuổi lẫn con cháu cùng đọc trước khi thống nhất sử dụng dịch vụ.`,
  (topic) => `Mình vừa chia sẻ bài về ${topic} cho anh chị em trong nhà để mọi người cùng bàn trước khi đặt lịch.`,
  (topic) => `Phần ví dụ về ${topic} khá gần với trải nghiệm của gia đình mình và giúp mọi người dễ thống nhất hơn.`,
];

const toDateKeyValue = (dateKey) => new Date(`${dateKey}T00:00:00.000Z`);

const addDaysToDateKey = (dateKey, days) => {
  const date = toDateKeyValue(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const countDays = (startDate, endDate) =>
  Math.floor((toDateKeyValue(endDate) - toDateKeyValue(startDate)) / DAY_MS) + 1;

export const getBlogPublishedDateKey = (displayDate) => {
  const [day, month, year] = String(displayDate || "").split("/").map(Number);
  if (!year || !month || !day) return "2026-06-01";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const deterministicUnit = (eventIndex, postIndex, salt) => {
  let value = Math.imul(eventIndex + 1, 0x9e3779b1)
    ^ Math.imul(postIndex + 1, 0x85ebca6b)
    ^ Math.imul(salt + 1, 0xc2b2ae35);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 4294967296;
};

export const getSeedActivityDate = ({ eventIndex, postIndex, publishedDate, type = "view" }) => {
  const publishedDateKey = getBlogPublishedDateKey(publishedDate);
  const eligibleWindows = BLOG_ACTIVITY_WINDOWS
    .map((window) => {
      const startDate = window.startDate < publishedDateKey ? publishedDateKey : window.startDate;
      if (startDate > window.endDate) return null;
      const days = countDays(startDate, window.endDate);
      const dailyWeight = type === "comment" ? window.commentDailyWeight : window.dailyWeight;
      return { ...window, startDate, days, weight: days * dailyWeight };
    })
    .filter(Boolean);

  if (!eligibleWindows.length) {
    throw new Error(`Không có khoảng hoạt động hợp lệ cho ngày xuất bản ${publishedDate}.`);
  }

  const typeSalt = type === "comment" ? 41 : 17;
  const totalWeight = eligibleWindows.reduce((sum, window) => sum + window.weight, 0);
  let selectedWeight = deterministicUnit(eventIndex, postIndex, typeSalt) * totalWeight;
  let selectedWindow = eligibleWindows.at(-1);
  for (const window of eligibleWindows) {
    if (selectedWeight < window.weight) {
      selectedWindow = window;
      break;
    }
    selectedWeight -= window.weight;
  }

  const dayOffset = Math.min(
    selectedWindow.days - 1,
    Math.floor(deterministicUnit(eventIndex, postIndex, typeSalt + 1) * selectedWindow.days),
  );
  const dateKey = addDaysToDateKey(selectedWindow.startDate, dayOffset);
  const hour = 7 + Math.floor(deterministicUnit(eventIndex, postIndex, typeSalt + 2) * 15);
  const minute = 1 + Math.floor(deterministicUnit(eventIndex, postIndex, typeSalt + 3) * 58);
  const second = 5 + Math.floor(deterministicUnit(eventIndex, postIndex, typeSalt + 4) * 50);

  return new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+07:00`,
  );
};

export const getSeedCommentContent = (slug, commentIndex) => {
  const profile = blogInteractionProfiles[slug];
  if (!profile) {
    throw new Error(`Thiếu cấu hình tương tác cho bài blog ${slug}.`);
  }
  return commentTemplates[commentIndex % commentTemplates.length](profile.topic);
};
