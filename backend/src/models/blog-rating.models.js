import mongoose from "mongoose";

const BlogRatingSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  { timestamps: true },
);

BlogRatingSchema.index({ postId: 1, userId: 1 }, { unique: true });
BlogRatingSchema.index({ slug: 1, userId: 1 });

const BlogRating = mongoose.model("blogRating", BlogRatingSchema);
export default BlogRating;
