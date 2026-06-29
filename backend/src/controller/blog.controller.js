import BlogComment from "../models/blog-comment.models.js";
import BlogPost from "../models/blog-post.models.js";
import BlogView from "../models/blog-view.models.js";
import { getClientIp, getPositiveEnvNumber } from "../middlleware/rate-limit.middleware.js";

const BLOG_ACTION_COOLDOWN_CLEANUP_MS = 5 * 60 * 1000;
const BLOG_VIEW_COOLDOWN_MS = getPositiveEnvNumber(
  ["CAREGO_BLOG_VIEW_DEDUPE_WINDOW_MS", "BLOG_VIEW_DEDUPE_WINDOW_MS"],
  30 * 60 * 1000,
);
const BLOG_RATING_COOLDOWN_MS = getPositiveEnvNumber(
  ["CAREGO_BLOG_RATING_DEDUPE_WINDOW_MS", "BLOG_RATING_DEDUPE_WINDOW_MS"],
  6 * 60 * 60 * 1000,
);
const BLOG_COMMENT_COOLDOWN_MS = getPositiveEnvNumber(
  ["CAREGO_BLOG_COMMENT_DEDUPE_WINDOW_MS", "BLOG_COMMENT_DEDUPE_WINDOW_MS"],
  10 * 60 * 1000,
);
const BLOG_STATS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const blogActionCooldowns = new Map();

const normalizeVisitorPart = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 160) || "unknown";

const getBlogVisitorKey = (req, action) =>
  `${action}:${normalizeVisitorPart(req.params?.slug)}:${getClientIp(req)}:${normalizeVisitorPart(req.get?.("user-agent"))}`;

const getActiveBlogActionCooldown = (key) => {
  const now = Date.now();
  const expiresAt = blogActionCooldowns.get(key);
  if (!expiresAt) return null;
  if (expiresAt <= now) {
    blogActionCooldowns.delete(key);
    return null;
  }

  return {
    expiresAt,
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  };
};

const startBlogActionCooldown = (key, windowMs) => {
  blogActionCooldowns.set(key, Date.now() + windowMs);
};

const blogActionCooldownCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of blogActionCooldowns.entries()) {
    if (expiresAt <= now) {
      blogActionCooldowns.delete(key);
    }
  }
}, BLOG_ACTION_COOLDOWN_CLEANUP_MS);

blogActionCooldownCleanup.unref?.();

const defaultBlogPosts = [
  {
    slug: "khi-nao-can-nguoi-dong-hanh-di-kham",
    category: "Đi khám",
    readTime: "5 phút đọc",
    date: "04/06/2026",
    title: "Khi nào người cao tuổi cần người đồng hành đi khám?",
    excerpt:
      "Những dấu hiệu gia đình nên cân nhắc đặt người đồng hành để buổi khám diễn ra an toàn, đúng lịch và có ghi chú đầy đủ.",
    highlight: "Phù hợp cho gia đình bận giờ hành chính",
    content: [
      {
        heading: "Không chỉ là đưa đón",
        body:
          "Một buổi đi khám thường có nhiều bước nhỏ: lấy số, chờ gọi tên, di chuyển giữa các phòng, mua thuốc và ghi nhớ lời dặn. Người đồng hành giúp gia đình giảm áp lực bằng cách hỗ trợ theo quy trình rõ ràng.",
      },
      {
        heading: "Khi nào nên đặt người đồng hành?",
        body:
          "Gia đình nên cân nhắc khi người thân đi lại chậm, dễ quên thông tin bác sĩ dặn, cần hỗ trợ xếp hàng hoặc con cái không thể nghỉ làm để đi cùng.",
      },
      {
        heading: "CareGo hỗ trợ theo dõi như thế nào?",
        body:
          "Thông tin lịch hẹn, GPS, ảnh xác nhận và ghi chú sau ca được cập nhật để gia đình nắm tình hình mà không cần gọi hỏi liên tục.",
      },
    ],
  },
  {
    slug: "5-luu-y-khi-dat-lich-cham-soc-ba-me",
    category: "Gia đình",
    readTime: "4 phút đọc",
    date: "04/06/2026",
    title: "5 lưu ý khi đặt lịch chăm sóc ba mẹ theo giờ",
    excerpt:
      "Chuẩn bị thông tin sức khỏe, địa chỉ, số liên hệ khẩn cấp và yêu cầu đặc biệt giúp ca chăm sóc diễn ra mượt hơn.",
    highlight: "Checklist nhanh trước khi đặt lịch",
    content: [
      {
        heading: "Chuẩn bị thông tin càng rõ càng tốt",
        body:
          "Gia đình nên ghi rõ tên người thân, tuổi, địa chỉ đón, tình trạng đi lại, bệnh nền nếu có và yêu cầu cần hỗ trợ.",
      },
      {
        heading: "Luôn có số liên hệ khẩn cấp",
        body:
          "Một số điện thoại của con cái hoặc người thân gần nhất là cần thiết trong trường hợp cần xác nhận thay đổi lộ trình hoặc tình trạng sức khỏe.",
      },
      {
        heading: "Nên đọc báo cáo sau ca",
        body:
          "Báo cáo sau ca ghi lại nội dung hỗ trợ, ảnh xác nhận và ghi chú quan trọng để gia đình theo dõi sức khỏe.",
      },
    ],
  },
  {
    slug: "quy-tac-an-toan-cho-nguoi-dong-hanh",
    category: "An toàn",
    readTime: "6 phút đọc",
    date: "04/06/2026",
    title: "Quy tắc an toàn cho người đồng hành CareGo",
    excerpt:
      "Người đồng hành cần tuân thủ nguyên tắc không tự ý cho thuốc, không thu tiền ngoài app và không đổi lộ trình khi chưa xác nhận.",
    highlight: "Nền tảng của sự tin cậy",
    content: [
      {
        heading: "An toàn bắt đầu từ quy trình",
        body:
          "CareGo thiết kế luồng nhận ca, check-in, cập nhật checklist và báo cáo sau ca để người đồng hành làm việc theo từng bước cụ thể.",
      },
      {
        heading: "Quy tắc 3 không",
        body:
          "Không tự ý cho thuốc ngoài đơn, không thu tiền ngoài ứng dụng và không thay đổi điểm đến nếu chưa báo người thân.",
      },
      {
        heading: "Minh bạch khi kết thúc ca",
        body:
          "Sau ca làm, người đồng hành cần cập nhật ảnh, ghi chú và trạng thái hoàn thành để gia đình có dữ liệu đánh giá chất lượng hỗ trợ.",
      },
    ],
  },
  {
    slug: "sinh-vien-y-duoc-ho-tro-nguoi-cao-tuoi",
    category: "Người đồng hành",
    readTime: "5 phút đọc",
    date: "04/06/2026",
    title: "Sinh viên Y Dược có thể hỗ trợ người cao tuổi như thế nào?",
    excerpt:
      "Từ nhắc lịch, hỗ trợ di chuyển đến ghi chú thông tin khám bệnh, sinh viên ngành sức khỏe có nhiều lợi thế khi đồng hành cùng người cao tuổi.",
    highlight: "Cơ hội làm việc có ý nghĩa",
    content: [
      {
        heading: "Lợi thế từ kiến thức nền",
        body:
          "Sinh viên Y Dược, Điều dưỡng hoặc Tâm lý thường quen với môi trường chăm sóc và giao tiếp với người cần hỗ trợ.",
      },
      {
        heading: "Không thay thế nhân viên y tế",
        body:
          "Người đồng hành không tự chẩn đoán, không kê thuốc và không thực hiện thủ thuật y tế. Vai trò chính là hỗ trợ di chuyển, ghi chú và báo cáo lại cho gia đình.",
      },
      {
        heading: "Tạo thu nhập linh hoạt",
        body:
          "CareGo phù hợp với sinh viên muốn có công việc theo ca, có quy trình rõ ràng và tạo giá trị cho cộng đồng.",
      },
    ],
  },
  {
    slug: "vi-sao-dich-vu-cham-soc-tai-nha-ngay-cang-pho-bien",
    category: "Chăm sóc tại nhà",
    readTime: "6 phút đọc",
    date: "29/06/2026",
    title: "Vì sao dịch vụ chăm sóc tại nhà ngày càng trở thành lựa chọn của nhiều gia đình?",
    imageUrl: "/Blog 1.png",
    excerpt:
      "Nhịp sống hiện đại khiến quỹ thời gian dành cho gia đình ngày càng hạn hẹp. Dịch vụ chăm sóc tại nhà trở thành giải pháp tiện lợi, nhân văn và đáng tin cậy.",
    highlight:
      "Chăm sóc tại nhà giúp người thân được hỗ trợ trong môi trường quen thuộc, còn gia đình có thêm sự an tâm trong cuộc sống bận rộn.",
    content: [
      {
        heading: "Nhịp sống hiện đại và nhu cầu chăm sóc người thân",
        body:
          "Nhịp sống hiện đại mang đến nhiều cơ hội phát triển, nhưng cũng khiến quỹ thời gian dành cho gia đình ngày càng hạn hẹp. Nhiều người phải cân bằng giữa công việc, học tập và trách nhiệm chăm sóc người thân. Chính vì vậy, dịch vụ chăm sóc tại nhà đang dần trở thành một giải pháp được nhiều gia đình lựa chọn.",
      },
      {
        heading: "Chăm sóc tại nhà - giải pháp vừa tiện lợi vừa nhân văn",
        body:
          "Đối với người cao tuổi, việc được sinh hoạt trong môi trường quen thuộc giúp họ cảm thấy thoải mái và an tâm hơn. Với người đang hồi phục sau điều trị, việc có người hỗ trợ theo dõi sức khỏe và sinh hoạt hằng ngày cũng góp phần cải thiện quá trình phục hồi.\n\nKhông chỉ vậy, các bậc phụ huynh hay những người thường xuyên đi công tác cũng có thể yên tâm hơn khi biết rằng người thân của mình luôn được quan tâm đúng cách.",
      },
      {
        heading: "Điều quan trọng không chỉ là có người chăm sóc",
        body:
          "Một dịch vụ chăm sóc chất lượng cần đảm bảo nhiều yếu tố như:\n\n- Đội ngũ có kỹ năng và thái độ chuyên nghiệp.\n- Thông tin minh bạch, rõ ràng.\n- Quy trình kết nối nhanh chóng.\n- Luôn đặt sự an toàn và sức khỏe của khách hàng lên hàng đầu.\n\nKhi những yếu tố này được đáp ứng, người sử dụng dịch vụ không chỉ nhận được sự hỗ trợ về mặt thể chất mà còn có được sự an tâm về tinh thần.",
      },
      {
        heading: "CareGo - đồng hành cùng mọi gia đình",
        body:
          "CareGo được xây dựng với mong muốn giúp việc tìm kiếm người chăm sóc trở nên đơn giản và đáng tin cậy hơn. Thông qua nền tảng kết nối, người dùng có thể dễ dàng tiếp cận các dịch vụ phù hợp với nhu cầu của mình, tiết kiệm thời gian và giảm bớt áp lực trong cuộc sống.\n\nChúng tôi tin rằng, mỗi hành động chăm sóc đều mang một giá trị lớn. Đó không chỉ là sự hỗ trợ trong cuộc sống hằng ngày mà còn là sự quan tâm, sẻ chia và yêu thương dành cho những người thân yêu.",
      },
      {
        heading: "Kết luận",
        body:
          "Cuộc sống sẽ nhẹ nhàng hơn khi chúng ta biết tìm đến những giải pháp phù hợp. Với CareGo, việc chăm sóc không còn là nỗi lo, mà trở thành một hành trình được đồng hành bởi những con người tận tâm và chuyên nghiệp.",
      },
    ],
  },
  {
    slug: "5-dau-hieu-nguoi-than-can-duoc-cham-soc-chuyen-nghiep",
    category: "Chăm sóc chuyên nghiệp",
    readTime: "6 phút đọc",
    date: "29/06/2026",
    title: "5 dấu hiệu cho thấy người thân của bạn cần được chăm sóc chuyên nghiệp",
    imageUrl: "/blog 2.png",
    excerpt:
      "Nhận biết đúng thời điểm cần đến sự hỗ trợ chuyên nghiệp sẽ giúp người thân được chăm sóc tốt hơn và giảm bớt áp lực cho cả gia đình.",
    highlight:
      "Yêu thương không chỉ là luôn ở cạnh, mà còn là biết chọn giải pháp phù hợp để người thân được chăm sóc an toàn và chu đáo.",
    content: [
      {
        heading: "Khi nào gia đình nên tìm hỗ trợ chuyên nghiệp?",
        body:
          "Chăm sóc người thân là điều mà ai cũng mong muốn tự mình thực hiện. Tuy nhiên, không phải lúc nào chúng ta cũng có đủ thời gian, kiến thức hoặc điều kiện để đáp ứng mọi nhu cầu. Nhận biết đúng thời điểm cần đến sự hỗ trợ chuyên nghiệp sẽ giúp người thân được chăm sóc tốt hơn và giảm bớt áp lực cho cả gia đình.",
      },
      {
        heading: "1. Gặp khó khăn trong sinh hoạt hằng ngày",
        body:
          "Nếu người thân bắt đầu gặp khó khăn khi đi lại, tắm rửa, thay quần áo hoặc chuẩn bị bữa ăn, đó là dấu hiệu họ cần có người hỗ trợ thường xuyên để đảm bảo an toàn và duy trì chất lượng cuộc sống.",
      },
      {
        heading: "2. Cần theo dõi sức khỏe liên tục",
        body:
          "Đối với người cao tuổi hoặc người đang phục hồi sau phẫu thuật, việc theo dõi tình trạng sức khỏe, nhắc nhở dùng thuốc và hỗ trợ các hoạt động hằng ngày là rất quan trọng. Một người chăm sóc có kinh nghiệm sẽ giúp giảm thiểu những rủi ro không mong muốn.",
      },
      {
        heading: "3. Gia đình quá bận rộn",
        body:
          "Áp lực công việc khiến nhiều người không thể ở bên người thân như mong muốn. Việc tìm kiếm một dịch vụ chăm sóc đáng tin cậy không có nghĩa là thay thế tình yêu của gia đình, mà là bổ sung sự hỗ trợ cần thiết để mọi người đều yên tâm.",
      },
      {
        heading: "4. Người thân thường xuyên cảm thấy cô đơn",
        body:
          "Sự quan tâm không chỉ đến từ việc chăm sóc sức khỏe mà còn đến từ những cuộc trò chuyện và sự đồng hành mỗi ngày. Có người bên cạnh lắng nghe và hỗ trợ sẽ giúp người cao tuổi hoặc người bệnh cảm thấy vui vẻ, tích cực hơn.",
      },
      {
        heading: "5. Bạn luôn lo lắng khi phải rời khỏi nhà",
        body:
          "Nếu mỗi lần đi làm hoặc đi công tác, bạn đều thấp thỏm vì không biết người thân ở nhà có ổn không, đó là lúc nên cân nhắc tìm một giải pháp chăm sóc phù hợp. Sự an tâm của gia đình cũng là một phần quan trọng trong việc chăm sóc.",
      },
      {
        heading: "CareGo - đồng hành cùng gia đình bạn",
        body:
          "CareGo được xây dựng để kết nối những gia đình có nhu cầu với đội ngũ chăm sóc tận tâm và chuyên nghiệp. Chúng tôi mong muốn giúp việc tìm kiếm người chăm sóc trở nên nhanh chóng, minh bạch và đáng tin cậy, để mỗi gia đình có thêm thời gian dành cho nhau mà vẫn đảm bảo người thân luôn được quan tâm chu đáo.",
      },
      {
        heading: "Lời kết",
        body:
          "Yêu thương không chỉ được thể hiện bằng việc luôn ở bên cạnh, mà còn bằng cách lựa chọn giải pháp tốt nhất cho người mình yêu quý. Khi cần sự hỗ trợ, hãy để CareGo trở thành người bạn đồng hành đáng tin cậy của gia đình bạn.",
      },
    ],
  },
];

export const ensureDefaultBlogPosts = async () => {
  await Promise.all(
    defaultBlogPosts.map((post) =>
      BlogPost.findOneAndUpdate(
        { slug: post.slug },
        { $set: post },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );
};

const getIdKey = (value) => value?._id?.toString?.() || value?.toString?.() || String(value);

const serializeComment = (comment) => {
  const data = comment.toObject ? comment.toObject() : comment;
  return {
    _id: data._id,
    name: data.name,
    content: data.content,
    rating: data.rating,
    createdAt: data.createdAt,
  };
};

const getLegacyComments = (post) => {
  const data = post.toObject ? post.toObject() : post;
  return (data.comments || []).map(serializeComment);
};

const getBlogComments = async (post) => {
  const comments = await BlogComment.find({ postId: post._id, isVisible: true })
    .sort({ createdAt: -1 })
    .lean();
  return [...comments.map(serializeComment), ...getLegacyComments(post)].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
};

const getCollectionCommentCountMap = async (postIds) => {
  if (!postIds.length) return new Map();
  const rows = await BlogComment.aggregate([
    { $match: { postId: { $in: postIds }, isVisible: true } },
    { $group: { _id: "$postId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [getIdKey(row._id), row.count]));
};

const getLegacyCommentCountMap = async (postIds) => {
  if (!postIds.length) return new Map();
  const rows = await BlogPost.aggregate([
    { $match: { _id: { $in: postIds } } },
    {
      $project: {
        count: { $size: { $ifNull: ["$comments", []] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [getIdKey(row._id), row.count]));
};

const getCommentCountMap = async (postIds) => {
  const [collectionCounts, legacyCounts] = await Promise.all([
    getCollectionCommentCountMap(postIds),
    getLegacyCommentCountMap(postIds),
  ]);

  const counts = new Map();
  postIds.forEach((postId) => {
    const key = getIdKey(postId);
    counts.set(key, (collectionCounts.get(key) || 0) + (legacyCounts.get(key) || 0));
  });
  return counts;
};

const getBlogViewCountMap = async (postIds, range) => {
  if (!postIds.length || !range) return new Map();
  const rows = await BlogView.aggregate([
    {
      $match: {
        postId: { $in: postIds },
        createdAt: { $gte: range.start, $lte: range.end },
      },
    },
    { $group: { _id: "$postId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [getIdKey(row._id), row.count]));
};

const serializePost = (post, { comments, commentCount, includeComments = false } = {}) => {
  const data = post.toObject ? post.toObject({ virtuals: true }) : post;
  const { comments: _comments, viewLogs: _viewLogs, ...publicData } = data;
  const nextPost = {
    ...publicData,
    ratingAverage: data.ratingCount ? Number((data.ratingSum / data.ratingCount).toFixed(1)) : 0,
    commentCount: Number(commentCount || 0),
  };

  if (includeComments) {
    nextPost.comments = comments || [];
  }

  return nextPost;
};

const parseDateBoundary = (value, endOfDay = false) => {
  if (!BLOG_STATS_DATE_PATTERN.test(value)) {
    return { error: "from and to must use YYYY-MM-DD format" };
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ),
  );

  const isSameDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isSameDate) {
    return { error: "from and to must be valid calendar dates" };
  }

  return { date };
};

const getDateRange = ({ from, to }) => {
  if (!from && !to) return { range: null };

  const startValue = from
    ? parseDateBoundary(from)
    : { date: new Date("1970-01-01T00:00:00.000Z") };
  if (startValue.error) {
    return { error: startValue.error };
  }

  const endValue = to ? parseDateBoundary(to, true) : { date: new Date() };
  if (endValue.error) {
    return { error: endValue.error };
  }

  if (startValue.date > endValue.date) {
    return { error: "from must be before or equal to to" };
  }

  return { range: { start: startValue.date, end: endValue.date } };
};

const toDateKey = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
};

const buildDailyViews = async (postIds, range) => {
  if (!range || !postIds.length) return [];

  const days = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end && days.length < 90) {
    days.push({
      key: toDateKey(cursor),
      label: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(cursor),
      views: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const rows = await BlogView.aggregate([
    {
      $match: {
        postId: { $in: postIds },
        createdAt: { $gte: range.start, $lte: range.end },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        views: { $sum: 1 },
      },
    },
  ]);
  const viewsByDay = new Map(rows.map((row) => [row._id, row.views]));

  days.forEach((day) => {
    day.views = viewsByDay.get(day.key) || 0;
  });

  return days;
};

export const getBlogPosts = async (_req, res) => {
  try {
    await ensureDefaultBlogPosts();
    const posts = await BlogPost.find({ isPublished: true })
      .select("-comments -viewLogs")
      .sort({ createdAt: 1 });
    const commentCounts = await getCommentCountMap(posts.map((post) => post._id));
    return res.status(200).json({
      posts: posts.map((post) =>
        serializePost(post, { commentCount: commentCounts.get(getIdKey(post._id)) || 0 }),
      ),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getBlogPostBySlug = async (req, res) => {
  try {
    await ensureDefaultBlogPosts();
    const post = await BlogPost.findOne({ slug: req.params.slug, isPublished: true }).select("-viewLogs");
    if (!post) {
      return res.status(404).json({ message: "blog post not found" });
    }
    const comments = await getBlogComments(post);
    return res.status(200).json({
      post: serializePost(post, { comments, commentCount: comments.length, includeComments: true }),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const increaseBlogView = async (req, res) => {
  try {
    await ensureDefaultBlogPosts();
    const cooldownKey = getBlogVisitorKey(req, "view");
    const activeCooldown = getActiveBlogActionCooldown(cooldownKey);
    if (activeCooldown) {
      const post = await BlogPost.findOne({ slug: req.params.slug, isPublished: true }).select("-comments -viewLogs");
      if (!post) {
        return res.status(404).json({ message: "blog post not found" });
      }
      const commentCounts = await getCommentCountMap([post._id]);
      return res.status(200).json({
        post: serializePost(post, { commentCount: commentCounts.get(getIdKey(post._id)) || 0 }),
        viewCounted: false,
        retryAfterSeconds: activeCooldown.retryAfterSeconds,
      });
    }

    startBlogActionCooldown(cooldownKey, BLOG_VIEW_COOLDOWN_MS);
    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug, isPublished: true },
      {
        $inc: { viewCount: 1 },
      },
      { new: true },
    ).select("-comments -viewLogs");
    if (!post) {
      blogActionCooldowns.delete(cooldownKey);
      return res.status(404).json({ message: "blog post not found" });
    }
    await BlogView.create({ postId: post._id, slug: post.slug });
    const commentCounts = await getCommentCountMap([post._id]);
    return res.status(200).json({
      post: serializePost(post, { commentCount: commentCounts.get(getIdKey(post._id)) || 0 }),
      viewCounted: true,
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const rateBlogPost = async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const cooldownKey = getBlogVisitorKey(req, "rating");
    const activeCooldown = getActiveBlogActionCooldown(cooldownKey);
    if (activeCooldown) {
      return res.status(429).json({
        message: "You have already rated this blog post recently.",
        retryAfterSeconds: activeCooldown.retryAfterSeconds,
      });
    }

    startBlogActionCooldown(cooldownKey, BLOG_RATING_COOLDOWN_MS);
    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug, isPublished: true },
      { $inc: { ratingSum: rating, ratingCount: 1 } },
      { new: true },
    ).select("-comments -viewLogs");
    if (!post) {
      blogActionCooldowns.delete(cooldownKey);
      return res.status(404).json({ message: "blog post not found" });
    }
    const commentCounts = await getCommentCountMap([post._id]);
    return res.status(200).json({
      post: serializePost(post, { commentCount: commentCounts.get(getIdKey(post._id)) || 0 }),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const commentBlogPost = async (req, res) => {
  try {
    const { name, content } = req.body;
    const rating = Number(req.body.rating || 5);
    if (!content?.trim()) {
      return res.status(400).json({ message: "comment content is required" });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const cooldownKey = getBlogVisitorKey(req, "comment");
    const activeCooldown = getActiveBlogActionCooldown(cooldownKey);
    if (activeCooldown) {
      return res.status(429).json({
        message: "You are commenting too quickly. Please try again later.",
        retryAfterSeconds: activeCooldown.retryAfterSeconds,
      });
    }

    startBlogActionCooldown(cooldownKey, BLOG_COMMENT_COOLDOWN_MS);
    const post = await BlogPost.findOne({ slug: req.params.slug, isPublished: true }).select("-viewLogs");
    if (!post) {
      blogActionCooldowns.delete(cooldownKey);
      return res.status(404).json({ message: "blog post not found" });
    }

    await BlogComment.create({
      postId: post._id,
      slug: post.slug,
      name: name?.trim() || "Bạn đọc CareGo",
      content: content.trim(),
      rating,
    });
    const updatedPost = await BlogPost.findByIdAndUpdate(
      post._id,
      { $inc: { ratingSum: rating, ratingCount: 1 } },
      { new: true },
    ).select("-viewLogs");
    const comments = await getBlogComments(updatedPost);
    return res.status(201).json({
      post: serializePost(updatedPost, { comments, commentCount: comments.length, includeComments: true }),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getBlogStats = async (req, res) => {
  try {
    await ensureDefaultBlogPosts();
    const dateRange = getDateRange(req.query);
    if (dateRange.error) {
      return res.status(400).json({ message: dateRange.error });
    }
    const range = dateRange.range;
    const posts = await BlogPost.find({ isPublished: true })
      .select("title slug category viewCount ratingSum ratingCount createdAt")
      .sort({ viewCount: -1 });
    const postIds = posts.map((post) => post._id);
    const [commentCounts, rangeViewCounts, dailyViews] = await Promise.all([
      getCommentCountMap(postIds),
      getBlogViewCountMap(postIds, range),
      buildDailyViews(postIds, range),
    ]);

    const blogStats = posts
      .map((post) => {
        const key = getIdKey(post._id);
        const data = serializePost(post, { commentCount: commentCounts.get(key) || 0 });
        return {
          ...data,
          allTimeViewCount: data.viewCount || 0,
          viewCount: range ? rangeViewCounts.get(key) || 0 : data.viewCount || 0,
        };
      })
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

    const categoryViews = Object.values(
      blogStats.reduce((acc, post) => {
        const category = post.category || "CareGo";
        acc[category] ||= { category, views: 0, posts: 0 };
        acc[category].views += post.viewCount || 0;
        acc[category].posts += 1;
        return acc;
      }, {}),
    ).sort((a, b) => b.views - a.views);

    return res.status(200).json({
      blogStats,
      dailyViews,
      categoryViews,
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
