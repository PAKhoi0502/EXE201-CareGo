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
    },
    password: {
      type: String,
      require: true,
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
    emailOtpHash: {
      type: String,
    },
    emailOtpExpires: {
      type: Date,
    },
    passwordChangeOtpHash: {
      type: String,
    },
    passwordChangeOtpExpires: {
      type: Date,
    },
    pendingPasswordHash: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    resetPasswordToken: {
      //token dùng để đặt lại mật khẩu
      type: String,
    },
    resetPasswordExpries: {
      type: Date,
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
const User = mongoose.model("user", UserSchema);
export default User;
