import slugify from "slugify";
import BlogComment from "../models/blog-comment.models.js";
import BlogPost from "../models/blog-post.models.js";
import BlogRating from "../models/blog-rating.models.js";
import BlogView from "../models/blog-view.models.js";
import { getClientIp, getPositiveEnvNumber } from "../middlleware/rate-limit.middleware.js";

const BLOG_ACTION_COOLDOWN_CLEANUP_MS = 5 * 60 * 1000;
const BLOG_VIEW_COOLDOWN_MS = getPositiveEnvNumber(
  ["CAREGO_BLOG_VIEW_DEDUPE_WINDOW_MS", "BLOG_VIEW_DEDUPE_WINDOW_MS"],
  30 * 60 * 1000,
);
const BLOG_COMMENT_COOLDOWN_MS = getPositiveEnvNumber(
  ["CAREGO_BLOG_COMMENT_DEDUPE_WINDOW_MS", "BLOG_COMMENT_DEDUPE_WINDOW_MS"],
  10 * 60 * 1000,
);
const BLOG_STATS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BLOG_STATS_TIMEZONE = "Asia/Bangkok";
const BLOG_STATS_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;
const blogActionCooldowns = new Map();

const normalizeSlug = (value) =>
  slugify(String(value || ""), {
    lower: true,
    strict: true,
    locale: "vi",
  });

const normalizeContent = (content) => {
  if (!Array.isArray(content)) return [];

  return content
    .map((section) => ({
      heading: String(section?.heading || "").trim(),
      body: String(section?.body || "").trim(),
    }))
    .filter((section) => section.heading && section.body);
};

const buildBlogPayload = (body, existingPost) => {
  const payload = {};

  if ("title" in body) payload.title = String(body.title || "").trim();
  if ("slug" in body || "title" in body) {
    payload.slug = normalizeSlug(body.slug || body.title || existingPost?.title);
    if (!payload.slug) {
      const error = new Error("slug is required");
      error.statusCode = 400;
      throw error;
    }
  }
  if ("category" in body) payload.category = String(body.category || "").trim();
  if ("readTime" in body) payload.readTime = String(body.readTime || "").trim();
  if ("date" in body) payload.date = String(body.date || "").trim();
  if ("excerpt" in body) payload.excerpt = String(body.excerpt || "").trim();
  if ("highlight" in body) payload.highlight = String(body.highlight || "").trim();
  if ("imageUrl" in body || "coverImage" in body) {
    payload.imageUrl = String(body.imageUrl || body.coverImage?.url || "").trim();
  }
  if ("content" in body) payload.content = normalizeContent(body.content);
  if ("isFeatured" in body) payload.isFeatured = Boolean(body.isFeatured);
  if ("displayOrder" in body) {
    const displayOrder = Number(body.displayOrder);
    payload.displayOrder = Number.isFinite(displayOrder) ? displayOrder : 0;
  }

  if ("status" in body || "isPublished" in body) {
    const isPublished = "status" in body ? body.status === "published" : Boolean(body.isPublished);
    payload.isPublished = isPublished;
    if (isPublished && !existingPost?.publishedAt) payload.publishedAt = new Date();
  }

  return payload;
};

const sendBlogError = (res, error) => {
  if (error?.code === 11000) {
    return res.status(409).json({ message: "blog slug already exists" });
  }

  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "internal server error",
    error: error.message,
  });
};

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

const getIdKey = (value) => value?._id?.toString?.() || value?.toString?.() || String(value);

const serializeComment = (comment) => {
  const data = comment.toObject ? comment.toObject() : comment;
  const content = data.content || data.body || "";
  return {
    _id: data._id,
    name: data.name || data.userId?.name || "Ban doc CareGo",
    content,
    body: content,
    rating: data.rating,
    createdAt: data.createdAt,
  };
};

const getCommentStatus = (comment) => {
  const data = comment.toObject ? comment.toObject() : comment;
  if (data.status) return data.status;
  return data.isVisible === false ? "hidden" : "visible";
};

const serializeAdminComment = (comment) => {
  const data = comment.toObject ? comment.toObject() : comment;
  const publicComment = serializeComment(data);
  return {
    ...publicComment,
    status: getCommentStatus(data),
    isVisible: data.isVisible !== false,
    userId: data.userId || null,
  };
};

const getLegacyComments = (post) => {
  const data = post.toObject ? post.toObject() : post;
  return (data.comments || []).map(serializeComment);
};

const getBlogComments = async (post) => {
  const comments = await BlogComment.find({
    postId: post._id,
    isVisible: true,
    $or: [{ status: "visible" }, { status: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .lean();
  return [...comments.map(serializeComment), ...getLegacyComments(post)].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
};

const getCollectionCommentCountMap = async (postIds) => {
  if (!postIds.length) return new Map();
  const rows = await BlogComment.aggregate([
    {
      $match: {
        postId: { $in: postIds },
        isVisible: true,
        $or: [{ status: "visible" }, { status: { $exists: false } }],
      },
    },
    { $group: { _id: "$postId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [getIdKey(row._id), row.count]));
};

const getAdminCommentStatusCountMap = async (postIds) => {
  const counts = new Map();
  postIds.forEach((postId) => {
    counts.set(getIdKey(postId), {
      visibleCommentCount: 0,
      pendingCommentCount: 0,
      hiddenCommentCount: 0,
      commentCount: 0,
    });
  });

  if (!postIds.length) return counts;

  const rows = await BlogComment.aggregate([
    { $match: { postId: { $in: postIds } } },
    {
      $project: {
        postId: 1,
        status: {
          $ifNull: [
            "$status",
            {
              $cond: [{ $eq: ["$isVisible", false] }, "hidden", "visible"],
            },
          ],
        },
      },
    },
    { $group: { _id: { postId: "$postId", status: "$status" }, count: { $sum: 1 } } },
  ]);

  for (const row of rows) {
    const key = getIdKey(row._id.postId);
    const current = counts.get(key) || {
      visibleCommentCount: 0,
      pendingCommentCount: 0,
      hiddenCommentCount: 0,
      commentCount: 0,
    };
    const statusKey = `${row._id.status}CommentCount`;
    if (statusKey in current) {
      current[statusKey] += row.count;
    }
    current.commentCount += row.count;
    counts.set(key, current);
  }

  return counts;
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
  if (!postIds.length) return new Map();
  const match = { postId: { $in: postIds } };
  if (range) {
    match.createdAt = { $gte: range.start, $lte: range.end };
  }
  const rows = await BlogView.aggregate([
    { $match: match },
    { $group: { _id: "$postId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [getIdKey(row._id), row.count]));
};

const serializePost = (post, { comments, commentCount, includeComments = false, viewerRating = 0 } = {}) => {
  const data = post.toObject ? post.toObject({ virtuals: true }) : post;
  const {
    authorId: _authorId,
    comments: _comments,
    isDeleted: _isDeleted,
    viewLogs: _viewLogs,
    ...publicData
  } = data;
  const nextPost = {
    ...publicData,
    ratingAverage: data.ratingCount ? Number((data.ratingSum / data.ratingCount).toFixed(1)) : 0,
    commentCount: Number(commentCount || 0),
    viewerRating,
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
    ) - BLOG_STATS_TIMEZONE_OFFSET_MS,
  );

  const localDate = new Date(date.getTime() + BLOG_STATS_TIMEZONE_OFFSET_MS);
  const isSameDate =
    localDate.getUTCFullYear() === year
    && localDate.getUTCMonth() === month - 1
    && localDate.getUTCDate() === day;
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
  return new Date(value.getTime() + BLOG_STATS_TIMEZONE_OFFSET_MS).toISOString().slice(0, 10);
};

const buildDailyViews = async (postIds, range) => {
  if (!range || !postIds.length) return [];

  const days = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end && days.length < 90) {
    const key = toDateKey(cursor);
    const [, month, day] = key.split("-");
    days.push({
      key,
      label: `${day}/${month}`,
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
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: BLOG_STATS_TIMEZONE,
          },
        },
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
    const posts = await BlogPost.find({ isPublished: true, isDeleted: { $ne: true } })
      .select("-comments -viewLogs")
      .sort({ displayOrder: 1, publishedAt: -1, createdAt: 1 });
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

export const getFeaturedBlogPosts = async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit || 3);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 12)
      : 3;
    const posts = await BlogPost.find({
      isPublished: true,
      isFeatured: true,
      isDeleted: { $ne: true },
    })
      .select("-comments -viewLogs")
      .sort({ displayOrder: 1, publishedAt: -1, createdAt: 1 })
      .limit(limit);
    const commentCounts = await getCommentCountMap(posts.map((post) => post._id));

    return res.status(200).json({
      posts: posts.map((post) =>
        serializePost(post, { commentCount: commentCounts.get(getIdKey(post._id)) || 0 }),
      ),
    });
  } catch (error) {
    return sendBlogError(res, error);
  }
};

export const getBlogPostBySlug = async (req, res) => {
  try {
    const post = await BlogPost.findOne({
      slug: req.params.slug,
      isPublished: true,
      isDeleted: { $ne: true },
    }).select("-viewLogs");
    if (!post) {
      return res.status(404).json({ message: "blog post not found" });
    }
    const [comments, viewerRating] = await Promise.all([
      getBlogComments(post),
      req.user?.userId
        ? BlogRating.findOne({ postId: post._id, userId: req.user.userId }).select("value").lean()
        : null,
    ]);
    return res.status(200).json({
      post: serializePost(post, {
        comments,
        commentCount: comments.length,
        includeComments: true,
        viewerRating: viewerRating?.value || 0,
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const increaseBlogView = async (req, res) => {
  try {
    const cooldownKey = getBlogVisitorKey(req, "view");
    const activeCooldown = getActiveBlogActionCooldown(cooldownKey);
    if (activeCooldown) {
      const post = await BlogPost.findOne({
        slug: req.params.slug,
        isPublished: true,
        isDeleted: { $ne: true },
      }).select("-comments -viewLogs");
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
    const post = await BlogPost.findOne({
      slug: req.params.slug,
      isPublished: true,
      isDeleted: { $ne: true },
    }).select("-comments -viewLogs");
    if (!post) {
      blogActionCooldowns.delete(cooldownKey);
      return res.status(404).json({ message: "blog post not found" });
    }
    await BlogView.create({ postId: post._id, slug: post.slug });
    const viewCount = await BlogView.countDocuments({ postId: post._id });
    post.viewCount = viewCount;
    await post.save();
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
    const rating = Number(req.body.value ?? req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "login is required to rate blog posts" });
    }

    const post = await BlogPost.findOne({
      slug: req.params.slug,
      isPublished: true,
      isDeleted: { $ne: true },
    }).select("-comments -viewLogs");
    if (!post) {
      return res.status(404).json({ message: "blog post not found" });
    }

    const existingRating = await BlogRating.findOne({ postId: post._id, userId });
    let ratingDiff = rating;
    let countDiff = 1;

    if (existingRating) {
      ratingDiff = rating - existingRating.value;
      countDiff = 0;
      existingRating.value = rating;
      await existingRating.save();
    } else {
      try {
        await BlogRating.create({
          postId: post._id,
          slug: post.slug,
          userId,
          value: rating,
        });
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
        const latestRating = await BlogRating.findOne({ postId: post._id, userId });
        if (latestRating) {
          ratingDiff = rating - latestRating.value;
          countDiff = 0;
          latestRating.value = rating;
          await latestRating.save();
        }
      }
    }

    const updatedPost = await BlogPost.findByIdAndUpdate(
      post._id,
      { $inc: { ratingSum: ratingDiff, ratingCount: countDiff } },
      { new: true },
    ).select("-comments -viewLogs");
    const commentCounts = await getCommentCountMap([post._id]);
    return res.status(200).json({
      post: serializePost(updatedPost, {
        commentCount: commentCounts.get(getIdKey(post._id)) || 0,
        viewerRating: rating,
      }),
      viewerRating: rating,
      ratingAverage: updatedPost.ratingCount ? Number((updatedPost.ratingSum / updatedPost.ratingCount).toFixed(1)) : 0,
      ratingCount: updatedPost.ratingCount,
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const commentBlogPost = async (req, res) => {
  try {
    const content = String(req.body.content || req.body.body || "").trim();
    if (!content) {
      return res.status(400).json({ message: "comment content is required" });
    }
    if (content.length < 2 || content.length > 1000) {
      return res.status(400).json({ message: "comment must be between 2 and 1000 characters" });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "login is required to comment on blog posts" });
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
    const post = await BlogPost.findOne({
      slug: req.params.slug,
      isPublished: true,
      isDeleted: { $ne: true },
    }).select("-viewLogs");
    if (!post) {
      blogActionCooldowns.delete(cooldownKey);
      return res.status(404).json({ message: "blog post not found" });
    }

    await BlogComment.create({
      postId: post._id,
      slug: post.slug,
      userId,
      name: req.user?.name || req.user?.email || "Ban doc CareGo",
      content,
      status: "pending",
      isVisible: false,
    });
    const comments = await getBlogComments(post);
    return res.status(201).json({
      message: "comment submitted and waiting for admin approval",
      post: serializePost(post, { comments, commentCount: comments.length, includeComments: true }),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getAdminBlogComments = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id).select("_id title slug");
    if (!post) {
      return res.status(404).json({ message: "blog post not found" });
    }

    const comments = await BlogComment.find({ postId: post._id })
      .populate("userId", "name email role avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      post,
      comments: comments.map(serializeAdminComment),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const updateAdminBlogCommentStatus = async (req, res) => {
  try {
    const status = String(req.body.status || "");
    if (!["visible", "hidden"].includes(status)) {
      return res.status(400).json({ message: "status must be visible or hidden" });
    }

    const comment = await BlogComment.findOneAndUpdate(
      { _id: req.params.commentId, postId: req.params.id },
      { status, isVisible: status === "visible" },
      { new: true },
    ).populate("userId", "name email role avatar");

    if (!comment) {
      return res.status(404).json({ message: "comment not found" });
    }

    return res.status(200).json({
      message: "comment status updated",
      comment: serializeAdminComment(comment),
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const deleteAdminBlogComment = async (req, res) => {
  try {
    const comment = await BlogComment.findOneAndDelete({
      _id: req.params.commentId,
      postId: req.params.id,
    });

    if (!comment) {
      return res.status(404).json({ message: "comment not found" });
    }

    return res.status(200).json({ message: "comment deleted" });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const getBlogStats = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    if (dateRange.error) {
      return res.status(400).json({ message: dateRange.error });
    }
    const range = dateRange.range;
    const posts = await BlogPost.find({ isPublished: true, isDeleted: { $ne: true } })
      .select("title slug category viewCount ratingSum ratingCount createdAt")
      .sort({ viewCount: -1 });
    const postIds = posts.map((post) => post._id);
    const [commentCounts, legacyCommentCounts, allTimeViewCounts, rangeViewCounts, dailyViews] = await Promise.all([
      getAdminCommentStatusCountMap(postIds),
      getLegacyCommentCountMap(postIds),
      getBlogViewCountMap(postIds),
      getBlogViewCountMap(postIds, range),
      buildDailyViews(postIds, range),
    ]);

    const blogStats = posts
      .map((post) => {
        const key = getIdKey(post._id);
        const counts = commentCounts.get(key) || {};
        const legacyCommentCount = legacyCommentCounts.get(key) || 0;
        const visibleCommentCount = Number(counts.visibleCommentCount || 0) + legacyCommentCount;
        const commentCount = Number(counts.commentCount || 0) + legacyCommentCount;
        const data = serializePost(post, { commentCount });
        return {
          ...data,
          visibleCommentCount,
          pendingCommentCount: Number(counts.pendingCommentCount || 0),
          hiddenCommentCount: Number(counts.hiddenCommentCount || 0),
          commentCount,
          allTimeViewCount: allTimeViewCounts.get(key) || 0,
          viewCount: range ? rangeViewCounts.get(key) || 0 : allTimeViewCounts.get(key) || 0,
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

export const getAdminBlogs = async (req, res) => {
  try {
    const filter = req.query.includeDeleted === "true" ? {} : { isDeleted: { $ne: true } };
    const posts = await BlogPost.find(filter)
      .select("-comments -viewLogs")
      .populate("authorId", "name email")
      .sort({ isDeleted: 1, displayOrder: 1, createdAt: -1 });
    const postIds = posts.map((post) => post._id);
    const [commentCounts, legacyCommentCounts, viewCounts] = await Promise.all([
      getAdminCommentStatusCountMap(postIds),
      getLegacyCommentCountMap(postIds),
      getBlogViewCountMap(postIds),
    ]);

    return res.status(200).json({
      blogs: posts.map((post) => {
        const data = post.toObject({ virtuals: true });
        const key = getIdKey(post._id);
        const counts = commentCounts.get(key) || {};
        const legacyCommentCount = legacyCommentCounts.get(key) || 0;
        return {
          ...data,
          viewCount: viewCounts.get(key) || 0,
          status: data.isPublished ? "published" : "draft",
          visibleCommentCount: Number(counts.visibleCommentCount || 0) + legacyCommentCount,
          pendingCommentCount: Number(counts.pendingCommentCount || 0),
          hiddenCommentCount: Number(counts.hiddenCommentCount || 0),
          commentCount: Number(counts.commentCount || 0) + legacyCommentCount,
          ratingAverage: data.ratingCount
            ? Number((data.ratingSum / data.ratingCount).toFixed(1))
            : 0,
        };
      }),
    });
  } catch (error) {
    return sendBlogError(res, error);
  }
};

export const createAdminBlog = async (req, res) => {
  try {
    const payload = buildBlogPayload(req.body);
    const missingFields = ["title", "category", "excerpt"].filter((field) => !payload[field]);
    if (missingFields.length) {
      return res.status(400).json({ message: `${missingFields.join(", ")} are required` });
    }

    const post = await BlogPost.create({
      ...payload,
      authorId: req.user.userId,
      isDeleted: false,
    });
    return res.status(201).json({ message: "blog created", blog: post });
  } catch (error) {
    return sendBlogError(res, error);
  }
};

export const updateAdminBlog = async (req, res) => {
  try {
    const post = await BlogPost.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!post) {
      return res.status(404).json({ message: "blog not found" });
    }

    const payload = buildBlogPayload(req.body, post);
    Object.assign(post, payload);
    await post.save();
    return res.status(200).json({ message: "blog updated", blog: post });
  } catch (error) {
    return sendBlogError(res, error);
  }
};

export const publishAdminBlog = async (req, res) => {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true } },
      { isPublished: true, publishedAt: new Date() },
      { new: true, runValidators: true },
    );
    if (!post) {
      return res.status(404).json({ message: "blog not found" });
    }
    return res.status(200).json({ message: "blog published", blog: post });
  } catch (error) {
    return sendBlogError(res, error);
  }
};

export const unpublishAdminBlog = async (req, res) => {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true } },
      { isPublished: false },
      { new: true, runValidators: true },
    );
    if (!post) {
      return res.status(404).json({ message: "blog not found" });
    }
    return res.status(200).json({ message: "blog unpublished", blog: post });
  } catch (error) {
    return sendBlogError(res, error);
  }
};

export const deleteAdminBlog = async (req, res) => {
  try {
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true } },
      { isDeleted: true, isPublished: false, isFeatured: false },
      { new: true },
    );
    if (!post) {
      return res.status(404).json({ message: "blog not found" });
    }
    return res.status(200).json({ message: "blog deleted" });
  } catch (error) {
    return sendBlogError(res, error);
  }
};
