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
    pricePerHour: 80000,
  });
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await registerCompanion({
        ...form,
        skills: form.skillsText.split(",").map((item) => item.trim()).filter(Boolean),
        serviceAreas: form.serviceAreasText.split(",").map((item) => item.trim()).filter(Boolean),
        pricePerHour: Number(form.pricePerHour),
      });
      navigate("/companion");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AuthShell
      title="Dang ky nguoi dong hanh"
      subtitle="Ho so se duoc admin kiem duyet truoc khi nhan ca."
      footer={<Link className="font-semibold text-teal-700" to="/login">Da co tai khoan</Link>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Input label="Ten dang nhap/hien thi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Ho ten day du" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Mat khau" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Input label="So dien thoai" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Select label="Gioi tinh" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="other">Khac</option>
          <option value="male">Nam</option>
          <option value="female">Nu</option>
        </Select>
        <Input label="Truong dai hoc" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
        <Input label="Nganh hoc" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} />
        <Input label="Ky nang, cach nhau bang dau phay" value={form.skillsText} onChange={(e) => setForm({ ...form, skillsText: e.target.value })} />
        <Input label="Khu vuc hoat dong" value={form.serviceAreasText} onChange={(e) => setForm({ ...form, serviceAreasText: e.target.value })} />
        <Input label="Gia theo gio" type="number" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <Button>Gui ho so</Button>
      </form>
    </AuthShell>
  );
};

export default RegisterCompanionPage;
