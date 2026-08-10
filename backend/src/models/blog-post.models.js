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
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    readTime: {
      type: String,
      default: "5 phút đọc",
    },
    date: {
      type: String,
      default: "",
    },
    content: {
      type: [
        {
          heading: { type: String, required: true, trim: true },
          body: { type: String, required: true, trim: true },
        },
      ],
      validate: {
        validator: (sections) => Array.isArray(sections) && sections.length > 0,
        message: "Bài viết phải có ít nhất một mục nội dung.",
      },
      default: [],
    },
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
      default: false,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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
BlogPostSchema.index({ isPublished: 1, isDeleted: 1, displayOrder: 1, publishedAt: -1 });
BlogPostSchema.index({ isFeatured: 1, isPublished: 1, isDeleted: 1, displayOrder: 1 });

const BlogPost = mongoose.model("blogPost", BlogPostSchema);
export default BlogPost;
