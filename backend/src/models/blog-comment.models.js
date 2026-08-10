import mongoose from "mongoose";

const BlogCommentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "blogPost",
      required: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    seedKey: {
      type: String,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "Ban doc CareGo",
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 1000,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    isVisible: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "visible", "hidden"],
      default: "visible",
      index: true,
    },
  },
  { timestamps: true },
);

BlogCommentSchema.index({ postId: 1, createdAt: -1 });
BlogCommentSchema.index({ slug: 1, createdAt: -1 });
BlogCommentSchema.index({ postId: 1, status: 1, createdAt: -1 });
BlogCommentSchema.index({ seedKey: 1 }, { unique: true, sparse: true });

const BlogComment = mongoose.model("blogComment", BlogCommentSchema);
export default BlogComment;
