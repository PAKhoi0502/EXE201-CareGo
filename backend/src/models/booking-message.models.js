import mongoose from "mongoose";

const BookingMessageSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "booking",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

BookingMessageSchema.index({ bookingId: 1, createdAt: -1 });

const BookingMessage = mongoose.model("bookingMessage", BookingMessageSchema);
export default BookingMessage;
