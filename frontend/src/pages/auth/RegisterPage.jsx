import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Input } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthShell from "./AuthShell.jsx";

const RegisterPage = () => {
  const { registerCustomer } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await registerCustomer(form);
      navigate("/verify-email", {
        state: { email: form.email, password: form.password, role: "customer" },
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AuthShell
      title="Đăng ký gia đình"
      subtitle="Tạo tài khoản để đặt lịch chăm sóc cho người thân."
      badge="Tài khoản gia đình"
      footer={
        <>
          Đã có tài khoản? <Link className="font-black text-teal-700" to="/login">Đăng nhập</Link>
        </>
      }
    >
      <form className="grid gap-5" onSubmit={submit}>
        <Input label="Họ tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-14 rounded-2xl border-teal-100" />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="min-h-14 rounded-2xl border-teal-100" />
        <Input label="Mật khẩu" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="min-h-14 rounded-2xl border-teal-100" />
        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20">Đăng ký</Button>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
