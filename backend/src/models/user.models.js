import mongoose from "mongoose";

//ODM Object Data Modeling
//mô hình dữ liệu đối tượng
//giúp thao tác mongodb dễ dàng hơn
//quy tắc đặt tên model: chữ cái đầu viết hoa
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      require: true,
    },
    email: {
      type: String,
      require: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    recoveryEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      require: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["customer", "companion", "admin"],
      default: "customer",
    },
    phone: {
      type: String,
      default: "",
    },
    avatar: {
      url: {
        type: String,
        default: "",
      },
      alt: {
        type: String,
        default: "user avatar",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    temporaryPasswordExpiresAt: {
      type: Date,
      default: null,
    },
    emailOtpHash: {
      type: String,
      select: false,
    },
    emailOtpExpires: {
      type: Date,
      select: false,
    },
    passwordChangeOtpHash: {
      type: String,
      select: false,
    },
    passwordChangeOtpExpires: {
      type: Date,
      select: false,
    },
    pendingPasswordHash: {
      type: String,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      //token dùng để đặt lại mật khẩu
      type: String,
      select: false,
    },
    resetPasswordExpries: {
      type: Date,
      select: false,
    },
    // isVeryfied: {
    //   type: Boolean,
    //   default: false,
    // },
  },
  {
    timestamps: true, // thằng này sẽ tự động tạo ra 2 tường createAt và updateAt
  },
);
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ role: 1, isActive: 1, createdAt: -1 });
const User = mongoose.model("user", UserSchema);
export default User;
