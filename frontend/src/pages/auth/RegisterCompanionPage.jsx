import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Input, Select } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthShell from "./AuthShell.jsx";

const RegisterCompanionPage = () => {
  const { registerCompanion } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    fullName: "",
    email: "",
    password: "",
    phone: "",
    gender: "other",
    university: "",
    major: "",
    skillsText: "",
    serviceAreasText: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);
    try {
      await registerCompanion({
        ...form,
        skills: form.skillsText.split(",").map((item) => item.trim()).filter(Boolean),
        serviceAreas: form.serviceAreasText.split(",").map((item) => item.trim()).filter(Boolean),
      });
      navigate("/verify-email", {
        state: { email: form.email, password: form.password, role: "companion" },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Đăng ký người đồng hành"
      subtitle="Hồ sơ sẽ được admin kiểm duyệt trước khi nhận ca."
      badge="Hồ sơ người đồng hành"
      footer={<Link className="font-black text-teal-700" to="/login">Đã có tài khoản</Link>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Input label="Tên hiển thị" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập tên hiển thị"/>
        <Input label="Họ tên đầy đủ" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder = "Nhập họ tên đầy đủ"/>
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
        <Input label="Mật khẩu" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
        <Input label="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
        <Select label="Giới tính" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="min-h-12 rounded-2xl border-teal-100">
          <option value="other">Khác</option>
          <option value="male">Nam</option>
          <option value="female">Nữ</option>
        </Select>
        <Input label="Trường đại học" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
        <Input label="Ngành học" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
        <Input label="Kỹ năng, cách nhau bằng dấu phẩy" value={form.skillsText} onChange={(e) => setForm({ ...form, skillsText: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
        <Input label="Khu vực hoạt động" value={form.serviceAreasText} onChange={(e) => setForm({ ...form, serviceAreasText: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
          {submitting ? "Đang gửi OTP..." : "Gửi hồ sơ"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default RegisterCompanionPage;
