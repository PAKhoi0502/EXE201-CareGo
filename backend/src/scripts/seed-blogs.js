import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
import BlogComment from "../models/blog-comment.models.js";
import BlogPost from "../models/blog-post.models.js";
import BlogRating from "../models/blog-rating.models.js";
import BlogView from "../models/blog-view.models.js";
import User from "../models/user.models.js";
import { blogSeedPosts } from "./blog-seed-data.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
dotenv.config();

const seededInteractions = [
  {
    slug: "khi-nao-can-nguoi-dong-hanh-di-kham",
    comments: [
      {
        name: "Nguyễn Minh An",
        rating: 5,
        content: "Bài viết rất đúng với tình huống gia đình mình, nhất là phần ghi chú lời dặn của bác sĩ.",
        createdAt: new Date("2026-06-05T09:20:00.000+07:00"),
      },
      {
        name: "Đoàn Thị Bích Vân",
        rating: 5,
        content: "Mình sẽ thử chuẩn bị thông tin trước khi đặt lịch cho ba đi tái khám.",
        createdAt: new Date("2026-06-06T14:10:00.000+07:00"),
      },
    ],
  },
  {
    slug: "5-luu-y-khi-dat-lich-cham-soc-ba-me",
    comments: [
      {
        name: "Trần Hoàng Bảo",
        rating: 4,
        content: "Checklist ngắn gọn, dễ áp dụng trước khi tạo booking.",
        createdAt: new Date("2026-06-05T18:35:00.000+07:00"),
      },
      {
        name: "Mai Phương",
        rating: 5,
        content: "Phần số liên hệ khẩn cấp rất cần thiết, trước giờ nhà mình hay quên bước này.",
        createdAt: new Date("2026-06-07T08:45:00.000+07:00"),
      },
    ],
  },
  {
    slug: "quy-tac-an-toan-cho-nguoi-dong-hanh",
    comments: [
      {
        name: "Phạm Anh Khôi",
        rating: 5,
        content: "Quy tắc “3 không” nên được nhắc lại trong quy trình nhận ca của người đồng hành.",
        createdAt: new Date("2026-06-06T10:15:00.000+07:00"),
      },
      {
        name: "Nguyễn Quang Thanh",
        rating: 4,
        content: "Nội dung phù hợp để training companion mới trước khi nhận ca đầu tiên.",
        createdAt: new Date("2026-06-08T20:05:00.000+07:00"),
      },
    ],
  },
  {
    slug: "sinh-vien-y-duoc-ho-tro-nguoi-cao-tuoi",
    comments: [
      {
        name: "Phạm Minh Tuấn",
        rating: 5,
        content: "Bài này giải thích rõ vai trò hỗ trợ, không làm thay nhân viên y tế.",
        createdAt: new Date("2026-06-09T12:00:00.000+07:00"),
      },
      {
        name: "Trần Ngọc Hoàng Thành",
        rating: 5,
        content: "Rất hợp với sinh viên muốn làm theo ca nhưng vẫn có quy trình an toàn.",
        createdAt: new Date("2026-06-10T16:25:00.000+07:00"),
      },
    ],
  },
];

const getSeedViewDate = (viewIndex, postIndex) => {
  const now = new Date();
  const date = new Date(now);
  date.setHours(8 + ((viewIndex + postIndex) % 10), (viewIndex * 7 + postIndex * 11) % 60, 0, 0);
  date.setDate(date.getDate() - ((viewIndex * 3 + postIndex) % 7));
  return date > now
    ? new Date(now.getTime() - ((viewIndex + postIndex) % 5) * 60 * 1000)
    : date;
};

export const seedBlogData = async () => {
  await Promise.all(
    blogSeedPosts.map(async ({ viewCount, ...post }, index) => {
      await BlogPost.findOneAndUpdate(
        { slug: post.slug },
        {
          $set: {
            ...post,
            viewCount,
            isPublished: true,
            isFeatured: index < 3,
            displayOrder: index,
            isDeleted: false,
          },
          $setOnInsert: {
            publishedAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
      );
      await BlogPost.updateOne(
        { slug: post.slug, publishedAt: null },
        { $set: { publishedAt: new Date() } },
      );
    }),
  );

  const seedNames = [...new Set(seededInteractions.flatMap((post) => post.comments.map((comment) => comment.name)))];
  const users = await User.find({ name: { $in: seedNames } }).select("_id name");
  const usersByName = new Map(users.map((user) => [user.name, user]));
  const slugs = blogSeedPosts.map((post) => post.slug);
  const posts = await BlogPost.find({ slug: { $in: slugs } }).select("_id slug ratingSum ratingCount");
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));

  await BlogView.init();
  await BlogView.deleteMany({ seedKey: { $regex: /^blog-seed:/ } });
  const viewOperations = blogSeedPosts.flatMap((seedPost, postIndex) => {
    const post = postsBySlug.get(seedPost.slug);
    if (!post) return [];

    return Array.from({ length: seedPost.viewCount }, (_, viewIndex) => {
      const viewedAt = getSeedViewDate(viewIndex, postIndex);
      return {
        updateOne: {
          filter: { seedKey: `blog-seed:${seedPost.slug}:${viewIndex}` },
          update: {
            $set: {
              postId: post._id,
              slug: post.slug,
              seedKey: `blog-seed:${seedPost.slug}:${viewIndex}`,
              createdAt: viewedAt,
              updatedAt: viewedAt,
            },
          },
          upsert: true,
        },
      };
    });
  });
  if (viewOperations.length) {
    await BlogView.bulkWrite(viewOperations, { ordered: false, timestamps: false });
  }

  const viewCounts = await BlogView.aggregate([
    { $match: { postId: { $in: posts.map((post) => post._id) } } },
    { $group: { _id: "$postId", count: { $sum: 1 } } },
  ]);
  const viewCountByPost = new Map(viewCounts.map((row) => [String(row._id), row.count]));
  await Promise.all(
    posts.map((post) =>
      BlogPost.updateOne(
        { _id: post._id },
        { $set: { viewCount: viewCountByPost.get(String(post._id)) || 0 } },
      ),
    ),
  );

  let commentsUpserted = 0;
  let ratingsUpserted = 0;

  for (const seedPost of seededInteractions) {
    const post = postsBySlug.get(seedPost.slug);
    if (!post) continue;

    for (const comment of seedPost.comments) {
      const user = usersByName.get(comment.name);
      await BlogComment.findOneAndUpdate(
        { postId: post._id, content: comment.content },
        {
          $set: {
            postId: post._id,
            slug: post.slug,
            userId: user?._id || null,
            name: comment.name,
            content: comment.content,
            rating: comment.rating,
            status: "visible",
            isVisible: true,
            createdAt: comment.createdAt,
            updatedAt: comment.createdAt,
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
      commentsUpserted += 1;

      if (user?._id) {
        await BlogRating.findOneAndUpdate(
          { postId: post._id, userId: user._id },
          {
            $set: {
              postId: post._id,
              slug: post.slug,
              userId: user._id,
              value: comment.rating,
              createdAt: comment.createdAt,
              updatedAt: comment.createdAt,
            },
          },
          { upsert: true, setDefaultsOnInsert: true },
        );
        ratingsUpserted += 1;
      }
    }

    const ratingStats = await BlogRating.aggregate([
      { $match: { postId: post._id } },
      { $group: { _id: "$postId", ratingSum: { $sum: "$value" }, ratingCount: { $sum: 1 } } },
    ]);
    const nextStats = ratingStats[0] || { ratingSum: 0, ratingCount: 0 };
    await BlogPost.updateOne(
      { _id: post._id },
      { $set: { ratingSum: nextStats.ratingSum, ratingCount: nextStats.ratingCount } },
    );
  }

  console.log("Database:", mongoose.connection.name);
  console.log("Blog posts:", await BlogPost.countDocuments({ isPublished: true }));
  console.log("Seed views upserted:", viewOperations.length);
  console.log("Seed comments upserted:", commentsUpserted);
  console.log("Seed ratings upserted:", ratingsUpserted);
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
