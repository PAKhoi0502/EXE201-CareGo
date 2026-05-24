import { Link } from "react-router";
import { useEffect, useState } from "react";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ cá nhân"
        subtitle="Thông tin tài khoản khách hàng dùng để đặt lịch chăm sóc trên CareGo."
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

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden border-teal-100 bg-white/95 p-0 shadow-xl shadow-teal-900/10">
          <div className="bg-gradient-to-br from-teal-700 to-teal-500 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-[28px] bg-white text-2xl font-black text-teal-700 shadow-lg shadow-teal-950/10">
                {getInitials(user?.name)}
              </div>
              <div>
                <p className="text-sm font-bold text-white/75">Khách hàng CareGo</p>
                <h2 className="mt-1 text-2xl font-black">{user?.name || "Khách hàng"}</h2>
                <p className="mt-1 text-sm text-white/75">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-6 text-sm">
            <div className="rounded-[20px] border border-teal-100 bg-[#fbfffe] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Trạng thái tài khoản</p>
              <p className="mt-1 font-bold text-emerald-700">
                {user?.isActive === false ? "Tạm khóa" : "Đang hoạt động"}
              </p>
            </div>
            <div className="rounded-[20px] border border-teal-100 bg-[#fbfffe] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Xác thực email</p>
              <p className="mt-1 font-bold text-teal-700">
                {user?.isEmailVerified === false ? "Chưa xác thực" : "Đã xác thực"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
          <div className="mb-5 rounded-[24px] border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-4">
            <h2 className="text-xl font-black text-[#12312f]">Thông tin liên hệ</h2>
            <p className="mt-1 text-sm text-slate-500">Thông tin này giúp CareGo liên hệ khi có cập nhật về ca chăm sóc.</p>
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
                  placeholder=""
                />
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
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
              <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Họ tên</p>
                <p className="mt-2 font-bold text-slate-900">{user?.name || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Số điện thoại</p>
                <p className="mt-2 font-bold text-slate-900">{user?.phone || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-black uppercase text-slate-400">Email</p>
                <p className="mt-2 font-bold text-slate-900">{user?.email || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-black uppercase text-slate-400">Ngày tạo tài khoản</p>
                <p className="mt-2 font-bold text-slate-900">
                  {user?.createdAt ? dateTime(user.createdAt) : "Đang cập nhật"}
                </p>
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
    </div>
  );
};

export default CustomerProfilePage;
