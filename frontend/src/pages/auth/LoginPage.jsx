import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Input } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthShell from "./AuthShell.jsx";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [roleTab, setRoleTab] = useState("customer");
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
      title="Đăng nhập"
      subtitle="CareGo Cần chăm sóc là có ngay luôn đồng hành cùng bạn"
      footer={
        <>
          Chưa có tài khoản? <Link className="font-black text-teal-700" to="/register">Đăng ký ngay</Link>
        </>
      }
    >
      <form className="grid gap-5" onSubmit={submit}>
        {/* <div className="grid grid-cols-3 gap-2 rounded-3xl bg-teal-50 p-2">
          {[
            ["customer", "Con cái"],
            ["companion", "Đồng hành"],
            ["admin", "Admin"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRoleTab(value)}
              className={`min-h-11 rounded-2xl text-sm font-black transition ${roleTab === value ? "bg-white text-teal-800 shadow-md shadow-teal-900/5" : "text-slate-500 hover:text-teal-800"
                }`}
            >
              {label}
            </button>
          ))}
        </div> */}

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100 bg-white px-4 focus:border-teal-500"
          placeholder="nhập email của bạn"
        />
        <Input
          label="Mật khẩu"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100 bg-white px-4 focus:border-teal-500"
          placeholder="Nhập mật khẩu"
        />

        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 font-semibold text-slate-500">
            <input type="checkbox" className="accent-teal-700" />
            Ghi nhớ đăng nhập
          </label>
          <Link className="font-black text-teal-700" to="/forgot-password">
            Quên mật khẩu?
          </Link>
        </div>

        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
          {submitting ? "Đang xử lý..." : "Đăng nhập"}
        </Button>

        {/* <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
          <span className="h-px flex-1 bg-teal-100" />
          hoặc đăng nhập bằng
          <span className="h-px flex-1 bg-teal-100" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="min-h-12 rounded-2xl border border-teal-100 bg-white text-sm font-black text-slate-700">
            Google
          </button>
          <button type="button" className="min-h-12 rounded-2xl border border-teal-100 bg-white text-sm font-black text-slate-700">
            Facebook
          </button>
        </div> */}

      </form>
    </AuthShell>
  );
};

export default LoginPage;
