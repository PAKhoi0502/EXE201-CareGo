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
