import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Input } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthShell from "./AuthShell.jsx";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const user = await login(form);
      navigate(`/${user.role}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Dang nhap"
      subtitle="Truy cap CareGo theo vai tro cua ban."
      footer={
        <>
          Chua co tai khoan? <Link className="font-semibold text-teal-700" to="/register">Dang ky gia dinh</Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Mat khau" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Link className="text-right text-sm font-semibold text-teal-700" to="/forgot-password">
          Quen mat khau?
        </Link>
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <Button disabled={submitting}>{submitting ? "Dang xu ly..." : "Dang nhap"}</Button>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
