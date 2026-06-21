import BlogPost from "../models/blog-post.models.js";

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
];

export const ensureDefaultBlogPosts = async () => {
  await Promise.all(
    defaultBlogPosts.map((post) =>
      BlogPost.findOneAndUpdate(
        { slug: post.slug },
        { $setOnInsert: post },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );
};

const serializePost = (post) => {
  const data = post.toObject ? post.toObject({ virtuals: true }) : post;
  const { viewLogs: _viewLogs, ...publicData } = data;
  return {
    ...publicData,
    ratingAverage: data.ratingCount ? Number((data.ratingSum / data.ratingCount).toFixed(1)) : 0,
    commentCount: data.comments?.length || 0,
    comments: (data.comments || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  };
};

const getDateRange = ({ from, to }) => {
  if (!from && !to) return null;

  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date("1970-01-01T00:00:00.000Z");
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
};

const countViewsInRange = (post, range) => {
  if (!range) return post.viewCount || 0;

  const viewLogs = post.viewLogs || [];
  if (!viewLogs.length && post.viewCount) {
    const createdAt = new Date(post.createdAt);
    return createdAt >= range.start && createdAt <= range.end ? post.viewCount : 0;
  }

  return viewLogs.filter((log) => {
    const viewedAt = new Date(log.createdAt);
    return viewedAt >= range.start && viewedAt <= range.end;
  }).length;
};

const toDateKey = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toISOString().slice(0, 10);
};

const buildDailyViews = (posts, range) => {
  if (!range) return [];

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

  posts.forEach((post) => {
    const viewLogs = post.viewLogs || [];
    if (!viewLogs.length && post.viewCount) {
      const createdAt = new Date(post.createdAt);
      if (Number.isNaN(createdAt.getTime())) return;
      const bucket = days.find((item) => item.key === toDateKey(createdAt));
      if (bucket) bucket.views += post.viewCount;
      return;
    }

    viewLogs.forEach((log) => {
      const viewedAt = new Date(log.createdAt);
      if (viewedAt < range.start || viewedAt > range.end) return;
      const bucket = days.find((item) => item.key === toDateKey(viewedAt));
      if (bucket) bucket.views += 1;
    });
  });

  return days;
};

export const getBlogPosts = async (_req, res) => {
  try {
    await ensureDefaultBlogPosts();
    const posts = await BlogPost.find({ isPublished: true }).sort({ createdAt: 1 });
    return res.status(200).json({ posts: posts.map(serializePost) });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getBlogPostBySlug = async (req, res) => {
  try {
    await ensureDefaultBlogPosts();
    const post = await BlogPost.findOne({ slug: req.params.slug, isPublished: true });
    if (!post) {
      return res.status(404).json({ message: "blog post not found" });
    }
    return res.status(200).json({ post: serializePost(post) });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const increaseBlogView = async (req, res) => {
  try {
    await ensureDefaultBlogPosts();
    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug, isPublished: true },
      {
        $inc: { viewCount: 1 },
        $push: { viewLogs: { createdAt: new Date() } },
      },
      { new: true },
    );
    if (!post) {
      return res.status(404).json({ message: "blog post not found" });
    }
    return res.status(200).json({ post: serializePost(post) });
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

    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug, isPublished: true },
      { $inc: { ratingSum: rating, ratingCount: 1 } },
      { new: true },
    );
    if (!post) {
      return res.status(404).json({ message: "blog post not found" });
    }
    return res.status(200).json({ post: serializePost(post) });
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

    const post = await BlogPost.findOneAndUpdate(
      { slug: req.params.slug, isPublished: true },
      {
        $inc: { ratingSum: rating, ratingCount: 1 },
        $push: {
          comments: {
            name: name?.trim() || "Bạn đọc CareGo",
            content: content.trim(),
            rating,
          },
        },
      },
      { new: true },
    );
    if (!post) {
      return res.status(404).json({ message: "blog post not found" });
    }
    return res.status(201).json({ post: serializePost(post) });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getBlogStats = async (req, res) => {
  try {
    await ensureDefaultBlogPosts();
    const range = getDateRange(req.query);
    const posts = await BlogPost.find({ isPublished: true })
      .select("title slug category viewCount viewLogs ratingSum ratingCount comments createdAt")
      .sort({ viewCount: -1 });

    const blogStats = posts
      .map((post) => {
        const data = serializePost(post);
        return {
          ...data,
          allTimeViewCount: data.viewCount || 0,
          viewCount: countViewsInRange(post, range),
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
      dailyViews: buildDailyViews(posts, range),
      categoryViews,
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
