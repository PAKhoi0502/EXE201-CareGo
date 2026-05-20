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
      title="Dang ky gia dinh"
      subtitle="Tao tai khoan de dat lich cham soc cho nguoi than."
      footer={<Link className="font-semibold text-teal-700" to="/companion-register">Dang ky lam nguoi dong hanh</Link>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Input label="Ho ten" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Mat khau" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <Button>Dang ky</Button>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
