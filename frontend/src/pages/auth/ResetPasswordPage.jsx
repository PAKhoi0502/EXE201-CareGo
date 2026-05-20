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
      setError("Mat khau xac nhan khong khop");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setMessage("Dat lai mat khau thanh cong. Dang chuyen ve dang nhap...");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Dat lai mat khau"
      subtitle="Nhap mat khau moi cho tai khoan CareGo."
      footer={<Link className="font-semibold text-teal-700" to="/login">Quay lai dang nhap</Link>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Input
          label="Mat khau moi"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Input
          label="Nhap lai mat khau"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        />
        {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <Button disabled={submitting}>{submitting ? "Dang luu..." : "Dat lai mat khau"}</Button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordPage;
