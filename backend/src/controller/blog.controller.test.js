import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import BlogComment from "../models/blog-comment.models.js";
import BlogPost from "../models/blog-post.models.js";
import BlogRating from "../models/blog-rating.models.js";
import BlogView from "../models/blog-view.models.js";
import {
  buildBlogDailyViews,
  createAdminBlog,
  getAdminBlogComments,
  getBlogStats,
  getBlogStatsDateRange,
  publishAdminBlog,
  restoreAdminBlog,
} from "./blog.controller.js";

const restorers = [];

const mockMethod = (target, key, value) => {
  const original = target[key];
  restorers.push(() => {
    target[key] = original;
  });
  target[key] = value;
};

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()();
  }
});

test("blog stats accepts a 223-day range and returns every calendar day", { concurrency: false }, async () => {
  const parsed = getBlogStatsDateRange({ from: "2026-01-01", to: "2026-08-11" });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.range.days, 223);

  mockMethod(BlogView, "aggregate", async () => [
    { _id: "2026-08-11", views: 7 },
  ]);
  const days = await buildBlogDailyViews(["post-1"], parsed.range);

  assert.equal(days.length, 223);
  assert.equal(days[0].key, "2026-01-01");
  assert.equal(days.at(-1).key, "2026-08-11");
  assert.equal(days.at(-1).views, 7);
});

test("blog stats rejects incomplete and excessively long ranges", { concurrency: false }, () => {
  assert.match(getBlogStatsDateRange({ from: "2026-06-01" }).error, /đầy đủ/i);
  assert.match(
    getBlogStatsDateRange({ from: "2025-01-01", to: "2026-08-11" }).error,
    /366 ngày/i,
  );
});

test("blog stats uses live, date-filtered ratings instead of stale post counters", { concurrency: false }, async () => {
  const postId = "507f1f77bcf86cd799439011";
  const post = {
    _id: postId,
    toObject: () => ({
      _id: postId,
      title: "Bài viết thử nghiệm",
      slug: "bai-viet-thu-nghiem",
      category: "CareGo",
      viewCount: 999,
      ratingSum: 400,
      ratingCount: 100,
    }),
  };
  mockMethod(BlogPost, "find", () => ({
    select() { return this; },
    sort: async () => [post],
  }));
  mockMethod(BlogPost, "aggregate", async () => []);

  let commentMatch;
  mockMethod(BlogComment, "aggregate", async (pipeline) => {
    [commentMatch] = pipeline;
    return [];
  });

  let ratingMatch;
  mockMethod(BlogRating, "aggregate", async (pipeline) => {
    [ratingMatch] = pipeline;
    return [{ _id: postId, ratingSum: 9, ratingCount: 2 }];
  });
  mockMethod(BlogView, "aggregate", async () => []);

  const res = createResponse();
  await getBlogStats({ query: { from: "2026-06-01", to: "2026-06-30" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.blogStats[0].ratingSum, 9);
  assert.equal(res.body.blogStats[0].ratingCount, 2);
  assert.equal(res.body.blogStats[0].ratingAverage, 4.5);
  assert.ok(ratingMatch.$match.createdAt.$gte instanceof Date);
  assert.ok(ratingMatch.$match.createdAt.$lte instanceof Date);
  assert.ok(commentMatch.$match.createdAt.$gte instanceof Date);
  assert.ok(commentMatch.$match.createdAt.$lte instanceof Date);
});

test("admin blog comment API returns 400 before querying an invalid ObjectId", { concurrency: false }, async () => {
  let queried = false;
  mockMethod(BlogPost, "findById", () => {
    queried = true;
    throw new Error("The database should not be queried");
  });

  const res = createResponse();
  await getAdminBlogComments({ params: { id: "not-an-object-id" } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(queried, false);
  assert.match(res.body.message, /không hợp lệ/i);
});

test("creating a blog keeps multiline sections and always creates a draft", { concurrency: false }, async () => {
  let createdPayload;
  mockMethod(BlogPost, "create", async (payload) => {
    createdPayload = payload;
    return { _id: "post-1", ...payload };
  });

  const content = [
    {
      heading: "Chuẩn bị trước chuyến đi",
      body: "- Kiểm tra thuốc\n- Mang theo nước\n\nLuôn giữ số điện thoại người thân.",
    },
  ];
  const res = createResponse();
  await createAdminBlog({
    body: {
      title: "Chăm sóc người cao tuổi",
      category: "Sức khỏe",
      excerpt: "Hướng dẫn ngắn",
      content,
      status: "published",
      isPublished: true,
    },
    user: { userId: "admin-1" },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdPayload.isPublished, false);
  assert.equal(createdPayload.publishedAt, null);
  assert.deepEqual(createdPayload.content, content);
});

test("publishing preserves the first publishedAt timestamp", { concurrency: false }, async () => {
  const publishedAt = new Date("2026-06-12T03:17:41.000Z");
  const post = {
    isPublished: false,
    publishedAt,
    async save() {},
  };
  mockMethod(BlogPost, "findOne", async () => post);

  const res = createResponse();
  await publishAdminBlog({ params: { id: "507f1f77bcf86cd799439011" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(post.isPublished, true);
  assert.equal(post.publishedAt, publishedAt);
});

test("restoring a deleted blog returns it as an unpublished draft", { concurrency: false }, async () => {
  let receivedFilter;
  let receivedUpdate;
  let receivedOptions;
  mockMethod(BlogPost, "findOneAndUpdate", async (filter, update, options) => {
    receivedFilter = filter;
    receivedUpdate = update;
    receivedOptions = options;
    return { _id: filter._id, ...update };
  });

  const res = createResponse();
  await restoreAdminBlog({ params: { id: "507f1f77bcf86cd799439011" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(receivedFilter, {
    _id: "507f1f77bcf86cd799439011",
    isDeleted: true,
  });
  assert.deepEqual(receivedUpdate, {
    isDeleted: false,
    isPublished: false,
    isFeatured: false,
  });
  assert.deepEqual(receivedOptions, { new: true, runValidators: true });
});
