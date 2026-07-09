import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Input } from "../../components/Ui.jsx";
import { useAuth } from "../../context/useAuth.js";
import AuthShell from "./AuthShell.jsx";
import ConsentChecklist from "../../components/legal/ConsentChecklist.jsx";
import { isStrongPassword, PASSWORD_POLICY_HINT, PASSWORD_POLICY_MESSAGE } from "../../utils/passwordPolicy.js";

const RegisterPage = () => {
  const { registerCustomer } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    legalAcceptances: [],
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (!isStrongPassword(form.password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!form.legalAcceptances.length || form.legalAcceptances.some((item) => !item.accepted)) {
      setError("Vui lòng đọc và đồng ý với đầy đủ điều khoản bắt buộc.");
      return;
    }

    setSubmitting(true);
    try {
      await registerCustomer({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        legalAcceptances: form.legalAcceptances,
      });
      navigate("/verify-email", {
        state: { email: form.email, password: form.password, role: "customer" },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
        <Input
          label="Tên đầy đủ"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100"
          placeholder="VD: Nguyễn Văn An"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100"
          placeholder="Nhập email của bạn"
        />
        <Input
          label="Số điện thoại"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="min-h-14 rounded-2xl border-teal-100"
          placeholder="nhập số điện thoại của bạn"
        />
        <div className="grid gap-4 ">
          <Input
            label="Mật khẩu"
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="min-h-14 rounded-2xl border-teal-100"
            placeholder="Nhập mật khẩu mạnh"
            required
          />
          <Input
            label="Xác nhận mật khẩu"
            type="password"
            minLength={8}
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            className="min-h-14 rounded-2xl border-teal-100"
            placeholder="Nhập lại mật khẩu"
            required
          />
          <p className="text-xs font-semibold text-slate-500">{PASSWORD_POLICY_HINT}</p>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-semibold leading-6 text-teal-800">
          Sau khi đăng ký, CareGo sẽ gửi mã OTP về email để xác thực tài khoản trước khi đặt lịch.
        </div>
        <ConsentChecklist
          flow="CUSTOMER_SIGNUP"
          onChange={(legalAcceptances) => setForm((current) => ({ ...current, legalAcceptances }))}
        />
        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
          {submitting ? "Đang gửi OTP..." : "Đăng ký"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
