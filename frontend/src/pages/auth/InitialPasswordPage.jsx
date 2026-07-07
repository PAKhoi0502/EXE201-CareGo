import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Button, Input } from "../../components/Ui.jsx";
import { useAuth } from "../../context/useAuth.js";
import { getUserHomePath } from "../../utils/authNavigation.js";
import AuthShell from "./AuthShell.jsx";

const InitialPasswordPage = () => {
  const { user, loading, changeInitialPassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.mustChangePassword) {
    return <Navigate to={getUserHomePath(user)} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);
    try {
      const nextUser = await changeInitialPassword(form);
      navigate(getUserHomePath(nextUser), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Đổi mật khẩu lần đầu"
      subtitle="Tài khoản companion mới được cấp đang dùng mật khẩu tạm thời. Hãy đổi sang mật khẩu riêng trước khi tiếp tục."
      badge="Bảo mật tài khoản"
      footer={<Link className="font-black text-teal-700" to="/forgot-password">Mật khẩu tạm đã hết hạn?</Link>}
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Input
          label="Mật khẩu tạm thời"
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100"
          placeholder="Nhập mật khẩu được gửi qua email"
        />
        <Input
          label="Mật khẩu mới"
          type="password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100"
          placeholder="Tối thiểu 8 ký tự, có hoa, thường, số, ký tự đặc biệt"
        />
        <Input
          label="Nhập lại mật khẩu mới"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100"
        />

        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Đổi mật khẩu và tiếp tục"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default InitialPasswordPage;
