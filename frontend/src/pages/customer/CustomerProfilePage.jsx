import { Link } from "react-router";
import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button, Card, Input, PageHeader } from "../../components/Ui.jsx";
import { dateTime } from "../../utils/format.js";

const getInitials = (name = "CG") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CG";

const CustomerProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    otp: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
    });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSaving(true);
    try {
      await updateProfile({
        name: form.name,
        phone: form.phone,
      });
      setEditing(false);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const requestPasswordOtp = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }

    setChangingPassword(true);
    try {
      await api.post("/auth/current-user/password/request-otp", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordOtpSent(true);
      setPasswordSuccess("Mã OTP đã được gửi đến email của bạn.");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const confirmPasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    setChangingPassword(true);
    try {
      await api.patch("/auth/current-user/password", {
        otp: passwordForm.otp,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        otp: "",
      });
      setPasswordOtpSent(false);
      setPasswordSuccess("Đổi mật khẩu thành công.");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ cá nhân"
        subtitle="Quản lý thông tin khách hàng và các tác vụ đặt lịch trên CareGo."
        action={
          editing ? (
            <Button variant="secondary" type="button" onClick={() => setEditing(false)}>
              Hủy chỉnh sửa
            </Button>
          ) : (
            <Button type="button" onClick={() => setEditing(true)}>
              Chỉnh sửa hồ sơ
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="overflow-hidden border-emerald-100 bg-white/95 p-0 shadow-xl shadow-emerald-900/10">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 p-6 text-white">
            <div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-white text-2xl font-black text-emerald-700 shadow-lg shadow-emerald-950/10">
                {getInitials(user?.name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-white/80">Khách hàng CareGo</p>
                <h2 className="mt-1 text-2xl font-black">{user?.name || "Khách hàng"}</h2>
                <p className="mt-1 text-sm text-white/75">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-6 text-sm">
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Trạng thái tài khoản</p>
              <p className="mt-1 font-bold text-emerald-700">
                {user?.isActive === false ? "Tạm khóa" : "Đang hoạt động"}
              </p>
            </div>
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Xác thực email</p>
              <p className="mt-1 font-bold text-teal-700">
                {user?.isEmailVerified === false ? "Chưa xác thực" : "Đã xác thực"}
              </p>
            </div>
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Ngày tạo tài khoản</p>
              <p className="mt-1 font-bold text-slate-900">
                {user?.createdAt ? dateTime(user.createdAt) : "Đang cập nhật"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
          <div className="mb-5 rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
            <h2 className="text-xl font-black text-[#12312f]">Thông tin liên hệ</h2>
            <p className="mt-1 text-sm text-slate-500">
              Thông tin này giúp CareGo liên hệ khi có cập nhật về ca chăm sóc.
            </p>
          </div>

          {editing ? (
            <form className="grid gap-4" onSubmit={saveProfile}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Họ tên"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
                <Input
                  label="Số điện thoại"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Email</p>
                <p className="mt-2 font-bold text-slate-900">{user?.email || "Chưa cập nhật"}</p>
                <p className="mt-1 text-xs text-slate-500">Email dùng để đăng nhập nên không chỉnh sửa tại đây.</p>
              </div>
              {submitError ? <p className="text-sm font-semibold text-rose-600">{submitError}</p> : null}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                  Hủy
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Họ tên</p>
                <p className="mt-2 font-bold text-slate-900">{user?.name || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Số điện thoại</p>
                <p className="mt-2 font-bold text-slate-900">{user?.phone || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-black uppercase text-slate-400">Email</p>
                <p className="mt-2 font-bold text-slate-900">{user?.email || "Chưa cập nhật"}</p>
              </div>
            </div>
          )}

          {/* <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/customer/bookings/new">
              <Button>Đặt lịch chăm sóc</Button>
            </Link>
            <Link to="/customer/elders">
              <Button variant="secondary">Quản lý người thân</Button>
            </Link>
            <Link to="/customer/bookings">
              <Button variant="secondary">Xem lịch của tôi</Button>
            </Link>
          </div> */}
        </Card>
      </div>

      <Card className="border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
        <div className="mb-5 rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
          <h2 className="text-xl font-black text-[#12312f]">Đổi mật khẩu</h2>
          <p className="mt-1 text-sm text-slate-500">
            Nhập mật khẩu hiện tại để đặt mật khẩu mới cho tài khoản customer.
          </p>
        </div>

        <form className="grid gap-4" onSubmit={passwordOtpSent ? confirmPasswordChange : requestPasswordOtp}>
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label="Mật khẩu hiện tại"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
              required
            />
            <Input
              label="Mật khẩu mới"
              type="password"
              minLength="6"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
              required
            />
            <Input
              label="Nhập lại mật khẩu mới"
              type="password"
              minLength="6"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
              required
            />
          </div>

          {passwordOtpSent ? (
            <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 p-4">
              <Input
                label="Mã OTP xác nhận"
                value={passwordForm.otp}
                onChange={(event) => setPasswordForm({ ...passwordForm, otp: event.target.value })}
                placeholder="Nhập mã OTP trong email"
                required
              />
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                Chúng tôi đã gửi OTP đến email {user?.email}. Nhập OTP để hoàn tất đổi mật khẩu.
              </p>
            </div>
          ) : null}

          {passwordError ? <p className="text-sm font-semibold text-rose-600">{passwordError}</p> : null}
          {passwordSuccess ? <p className="text-sm font-semibold text-emerald-700">{passwordSuccess}</p> : null}

          <Button type="submit" className="w-fit" disabled={changingPassword}>
            {changingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default CustomerProfilePage;
