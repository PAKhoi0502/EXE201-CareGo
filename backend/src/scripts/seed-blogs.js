import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
import BlogComment from "../models/blog-comment.models.js";
import BlogPost from "../models/blog-post.models.js";
import BlogRating from "../models/blog-rating.models.js";
import BlogView from "../models/blog-view.models.js";
import User from "../models/user.models.js";
import {
  blogInteractionProfiles,
  getBlogPublishedDateKey,
  getSeedActivityDate,
  getSeedCommentContent,
} from "./blog-interaction-seed.js";
import { blogSeedPosts } from "./blog-seed-data.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
dotenv.config();

const ratingValues = [5, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 5];
const fallbackCommentNames = [
  "Minh Anh",
  "Thùy Dung",
  "Quốc Đạt",
  "Ngọc Hân",
  "Trung Kiên",
  "Mỹ Hạnh",
  "Anh Tuấn",
  "Khánh Linh",
  "Minh Quân",
  "Thanh Thảo",
  "Đức Huy",
  "Bảo Trâm",
  "Hoàng Nam",
  "Gia Linh",
  "Nhật Minh",
  "Thảo Vy",
  "Quang Hưng",
];
const legacyBlogRatingIndexNames = ["blogId_1_userId_1", "blogId_1"];

const getPublishedAt = (displayDate, postIndex) => {
  const dateKey = getBlogPublishedDateKey(displayDate);
  const hour = 8 + (postIndex % 3);
  const minute = 12 + ((postIndex * 7) % 41);
  return new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`,
  );
};

const selectInteractionUser = ({ users, usedUserIds, interactedAt, postIndex, commentIndex }) => {
  const availableUsers = users.filter(
    (user) => new Date(user.createdAt) <= interactedAt && !usedUserIds.has(String(user._id)),
  );
  if (!availableUsers.length) return null;

  const user = availableUsers[(postIndex * 7 + commentIndex * 3) % availableUsers.length];
  usedUserIds.add(String(user._id));
  return user;
};

const removeLegacyBlogRatingIndexes = async () => {
  await BlogRating.createCollection();
  const indexes = await BlogRating.collection.indexes();
  const existingIndexNames = new Set(indexes.map((index) => index.name));

  for (const indexName of legacyBlogRatingIndexNames) {
    if (existingIndexNames.has(indexName)) {
      await BlogRating.collection.dropIndex(indexName);
    }
  }
};

export const seedBlogData = async () => {
  const configuredSlugs = new Set(Object.keys(blogInteractionProfiles));
  const missingProfiles = blogSeedPosts
    .map((post) => post.slug)
    .filter((slug) => !configuredSlugs.has(slug));
  if (missingProfiles.length) {
    throw new Error(`Thiếu cấu hình tương tác blog: ${missingProfiles.join(", ")}`);
  }

  await Promise.all(
    blogSeedPosts.map(async ({ viewCount: _viewCount, ...post }, index) => {
      await BlogPost.findOneAndUpdate(
        { slug: post.slug },
        {
          $set: {
            ...post,
            viewCount: 0,
            ratingSum: 0,
            ratingCount: 0,
            isPublished: true,
            isFeatured: index < 3,
            displayOrder: index,
            publishedAt: getPublishedAt(post.date, index),
            isDeleted: false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
      );
    }),
  );

  const slugs = blogSeedPosts.map((post) => post.slug);
  const [posts, users] = await Promise.all([
    BlogPost.find({ slug: { $in: slugs } }).select("_id slug"),
    User.find({ role: { $in: ["customer", "companion"] }, isActive: true })
      .select("_id name role createdAt")
      .sort({ createdAt: 1, name: 1 })
      .lean(),
  ]);
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  const postIds = posts.map((post) => post._id);

  await Promise.all([BlogView.init(), BlogComment.init()]);
  await removeLegacyBlogRatingIndexes();
  await BlogRating.init();

  // Các tương tác của blog demo là dữ liệu chuẩn từ seed, nên được dựng lại hoàn toàn để
  // không cộng dồn comment/view cũ sau mỗi lần chạy seed.
  const [deletedViews, deletedComments, deletedRatings] = await Promise.all([
    BlogView.deleteMany({ postId: { $in: postIds } }),
    BlogComment.deleteMany({ postId: { $in: postIds } }),
    BlogRating.deleteMany({ postId: { $in: postIds } }),
  ]);

  const viewDocuments = [];
  const commentDocuments = [];
  const ratingDocuments = [];

  blogSeedPosts.forEach((seedPost, postIndex) => {
    const post = postsBySlug.get(seedPost.slug);
    if (!post) return;

    for (let viewIndex = 0; viewIndex < seedPost.viewCount; viewIndex += 1) {
      const viewedAt = getSeedActivityDate({
        eventIndex: viewIndex,
        postIndex,
        publishedDate: seedPost.date,
        type: "view",
      });
      viewDocuments.push({
        postId: post._id,
        slug: post.slug,
        seedKey: `blog-seed:${seedPost.slug}:view:${viewIndex}`,
        createdAt: viewedAt,
        updatedAt: viewedAt,
      });
    }

    const profile = blogInteractionProfiles[seedPost.slug];
    const datedComments = Array.from({ length: profile.commentCount }, (_, commentIndex) => ({
      commentIndex,
      commentedAt: getSeedActivityDate({
        eventIndex: commentIndex,
        postIndex,
        publishedDate: seedPost.date,
        type: "comment",
      }),
    })).sort((left, right) => left.commentedAt - right.commentedAt);
    const usedUserIds = new Set();

    datedComments.forEach(({ commentIndex, commentedAt }) => {
      const user = selectInteractionUser({
        users,
        usedUserIds,
        interactedAt: commentedAt,
        postIndex,
        commentIndex,
      });
      const rating = ratingValues[commentIndex % ratingValues.length];
      const name = user?.name || fallbackCommentNames[commentIndex % fallbackCommentNames.length];

      commentDocuments.push({
        postId: post._id,
        slug: post.slug,
        seedKey: `blog-seed:${seedPost.slug}:comment:${commentIndex}`,
        userId: user?._id || null,
        name,
        content: getSeedCommentContent(seedPost.slug, commentIndex),
        rating,
        status: "visible",
        isVisible: true,
        createdAt: commentedAt,
        updatedAt: commentedAt,
      });

      if (user) {
        ratingDocuments.push({
          postId: post._id,
          slug: post.slug,
          userId: user._id,
          value: rating,
          createdAt: commentedAt,
          updatedAt: commentedAt,
        });
      }
    });
  });

  if (viewDocuments.length) {
    await BlogView.insertMany(viewDocuments, { ordered: false });
  }
  if (commentDocuments.length) {
    await BlogComment.insertMany(commentDocuments, { ordered: false });
  }
  if (ratingDocuments.length) {
    await BlogRating.insertMany(ratingDocuments, { ordered: false });
  }

  const [viewCounts, ratingStats] = await Promise.all([
    BlogView.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]),
    BlogRating.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", ratingSum: { $sum: "$value" }, ratingCount: { $sum: 1 } } },
    ]),
  ]);
  const viewCountByPost = new Map(viewCounts.map((row) => [String(row._id), row.count]));
  const ratingStatsByPost = new Map(ratingStats.map((row) => [String(row._id), row]));

  await Promise.all(
    posts.map((post) => {
      const rating = ratingStatsByPost.get(String(post._id));
      return BlogPost.updateOne(
        { _id: post._id },
        {
          $set: {
            viewCount: viewCountByPost.get(String(post._id)) || 0,
            ratingSum: rating?.ratingSum || 0,
            ratingCount: rating?.ratingCount || 0,
          },
        },
      );
    }),
  );

  console.log("Database:", mongoose.connection.name);
  console.log("Blog posts:", await BlogPost.countDocuments({ isPublished: true, isDeleted: { $ne: true } }));
  console.log("Previous blog interactions removed:", {
    views: deletedViews.deletedCount,
    comments: deletedComments.deletedCount,
    ratings: deletedRatings.deletedCount,
  });
  console.log("Seed views created:", viewDocuments.length);
  console.log("Seed comments created:", commentDocuments.length);
  console.log("Seed ratings created:", ratingDocuments.length);
  console.log("Blog activity range: 2026-06-01 to 2026-08-09");
  console.log("Seed slugs:", slugs.join(", "));
};

const run = async () => {
  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is required");
  }

  await mongoose.connect(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DB_NAME || "carego",
  });
  await seedBlogData();
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
