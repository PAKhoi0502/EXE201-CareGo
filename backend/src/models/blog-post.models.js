import mongoose from "mongoose";

const BlogCommentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "Bạn đọc CareGo",
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
  },
  { timestamps: true },
);

const BlogPostSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "CareGo",
      trim: true,
    },
    excerpt: {
      type: String,
      default: "",
    },
    highlight: {
      type: String,
      default: "",
    },
    readTime: {
      type: String,
      default: "5 phút đọc",
    },
    date: {
      type: String,
      default: "",
    },
    content: [
      {
        heading: String,
        body: String,
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewLogs: [
      {
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    ratingSum: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    comments: [BlogCommentSchema],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

BlogPostSchema.virtual("ratingAverage").get(function getRatingAverage() {
  if (!this.ratingCount) return 0;
  return Number((this.ratingSum / this.ratingCount).toFixed(1));
});

BlogPostSchema.set("toJSON", { virtuals: true });
BlogPostSchema.set("toObject", { virtuals: true });

const BlogPost = mongoose.model("blogPost", BlogPostSchema);
export default BlogPost;
