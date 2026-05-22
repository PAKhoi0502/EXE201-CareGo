import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button, Input } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthShell from "./AuthShell.jsx";

const VerifyEmailPage = () => {
  const { verifyEmail, resendOtp, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password] = useState(location.state?.password || "");
  const [role] = useState(location.state?.role || "customer");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await verifyEmail({ email, otp });
      setMessage("Xac thuc thanh cong.");
      if (password) {
        const user = await login({ email, password });
        navigate(`/${user.role}`);
      } else {
        navigate("/login");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError("");
    setMessage("");
    try {
      await resendOtp(email);
      setMessage("Da gui lai OTP. Neu chua cau hinh SMTP, xem OTP trong terminal backend.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AuthShell
      title="Xác thực email"
      subtitle={role === "companion" ? "Xác thực email trước khi admin duyệt hồ sơ." : "Nhập mã OTP được gửi đến email của bạn."}
      badge="Xác thực OTP"
      footer={<Link className="font-black text-teal-700" to="/login">Quay lại đăng nhập</Link>}
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Input
          label="Email"
          type="email"
          value={email}
          readOnly
          className="min-h-14 cursor-not-allowed rounded-2xl border-teal-100 bg-slate-50 text-slate-500"
        />
        <Input label="Mã OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} className="min-h-14 rounded-2xl border-teal-100" />
        {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
          {submitting ? "Đang xác thực..." : "Xác thực"}
        </Button>
        <Button type="button" variant="secondary" className="min-h-12 rounded-2xl font-black" onClick={resend} disabled={!email}>
          Gửi lại OTP
        </Button>
      </form>
    </AuthShell>
  );
};

export default VerifyEmailPage;
