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
    name: {
      type: String,
      trim: true,
      default: "Ban doc CareGo",
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
    isVisible: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

BlogCommentSchema.index({ postId: 1, createdAt: -1 });
BlogCommentSchema.index({ slug: 1, createdAt: -1 });

const BlogComment = mongoose.model("blogComment", BlogCommentSchema);
export default BlogComment;
