import mongoose from "mongoose";

const BlogViewSchema = new mongoose.Schema(
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
  },
  { timestamps: true },
);

BlogViewSchema.index({ postId: 1, createdAt: -1 });
BlogViewSchema.index({ slug: 1, createdAt: -1 });

const BlogView = mongoose.model("blogView", BlogViewSchema);
export default BlogView;
