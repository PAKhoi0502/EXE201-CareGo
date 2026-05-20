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
      title="Xac thuc email"
      subtitle={role === "companion" ? "Xac thuc email truoc khi admin duyet ho so." : "Nhap ma OTP duoc gui den email cua ban."}
      footer={<Link className="font-semibold text-teal-700" to="/login">Quay lai dang nhap</Link>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Ma OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
        {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <Button disabled={submitting}>{submitting ? "Dang xac thuc..." : "Xac thuc"}</Button>
        <Button type="button" variant="secondary" onClick={resend} disabled={!email}>
          Gui lai OTP
        </Button>
      </form>
    </AuthShell>
  );
};

export default VerifyEmailPage;
