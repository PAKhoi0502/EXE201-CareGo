import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../../api/client.js";
import { Button, Input } from "../../components/Ui.jsx";
import AuthShell from "./AuthShell.jsx";

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setMessage("Đặt lại mật khẩu thành công. Đang chuyển về trang đăng nhập...");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Đặt lại mật khẩu"
      subtitle="Nhập mật khẩu mới cho tài khoản CareGo."
      badge="Bảo mật tài khoản"
      footer={<Link className="font-black text-teal-700" to="/login">Quay lại đăng nhập</Link>}
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Input
          label="Mật khẩu mới"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100"
        />
        <Input
          label="Nhập lại mật khẩu"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100"
        />
        {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Đặt lại mật khẩu"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordPage;
