import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Input } from "../../components/Ui.jsx";
import AuthShell from "./AuthShell.jsx";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const data = await api.post("/auth/forget-password", { email });
      setMessage(data.message || "Đã gửi liên kết đặt lại mật khẩu.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Quên mật khẩu"
      subtitle="Nhập email đăng nhập hoặc tài khoản @carego.cfd. Nếu là tài khoản companion, link đặt lại sẽ gửi về email cá nhân."
      badge="Khôi phục tài khoản"
      footer={<Link className="font-black text-teal-700" to="/login">Quay lại đăng nhập</Link>}
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Input
          label="Email hoặc tài khoản CareGo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-14 rounded-2xl border-teal-100"
          placeholder="email cá nhân hoặc tài khoản @carego.cfd"
        />
        {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
          {submitting ? "Đang gửi..." : "Gửi link đặt lại"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
