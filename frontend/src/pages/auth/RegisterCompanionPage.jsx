import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Input, Select } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthShell from "./AuthShell.jsx";

const CccdCameraCapture = ({ label, value, onChange }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;

    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {
      setCameraError("Camera đã mở nhưng trình duyệt chưa phát được hình. Hãy thử đóng rồi mở lại camera.");
    });
  }, [cameraOpen]);

  const openCamera = async () => {
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Trình duyệt không hỗ trợ mở camera.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraError("Không mở được camera. Hãy cấp quyền camera rồi thử lại.");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL("image/jpeg", 0.82));
    stopCamera();
  };

  return (
    <div className="rounded-3xl border border-teal-100 bg-[#fbfffe] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-[#12312f]">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Chỉ chụp trực tiếp bằng camera, ảnh sẽ gửi cùng hồ sơ duyệt.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {value ? (
            <Button type="button" variant="secondary" className="min-h-10 rounded-2xl px-4 text-xs" onClick={() => onChange("")}>
              Chụp lại
            </Button>
          ) : null}
          <Button type="button" variant="secondary" className="min-h-10 rounded-2xl px-4 text-xs" onClick={cameraOpen ? stopCamera : openCamera}>
            {cameraOpen ? "Đóng camera" : value ? "Mở camera" : "Chụp ảnh"}
          </Button>
        </div>
      </div>

      {cameraOpen ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-teal-100 bg-slate-900">
          <video ref={videoRef} autoPlay playsInline muted controls={false} className="aspect-video w-full bg-slate-950 object-cover" />
          <div className="border-t border-white/10 bg-slate-950/70 p-3">
            <Button type="button" className="min-h-11 w-full rounded-2xl" onClick={capture}>
              Lưu ảnh CCCD
            </Button>
          </div>
        </div>
      ) : null}

      {value ? (
        <div className="mt-4">
          <img src={value} alt={label} className="max-h-64 w-full rounded-2xl border border-teal-100 object-cover shadow-lg shadow-teal-900/10" />
          <p className="mt-2 text-xs font-bold text-emerald-700">Đã chụp ảnh, có thể gửi hồ sơ.</p>
        </div>
      ) : null}

      {cameraError ? <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{cameraError}</p> : null}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const RegisterCompanionPage = () => {
  const { user, registerCompanion } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: user?.name || "",
    fullName: user?.name || "",
    email: user?.email || "",
    password: "",
    phone: user?.phone || "",
    gender: "other",
    university: "",
    major: "",
    skillsText: "",
    serviceAreasText: "",
    citizenIdFrontUrl: "",
    citizenIdBackUrl: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isApplyingWithCurrentAccount = Boolean(user);
  const companionForm = {
    ...form,
    name: form.name || user?.name || "",
    fullName: form.fullName || user?.name || "",
    email: user?.email || form.email,
    phone: form.phone || user?.phone || "",
  };

  const validateProfileStep = () => {
    if (!companionForm.name || !companionForm.fullName || !companionForm.email || !companionForm.phone || (!isApplyingWithCurrentAccount && !companionForm.password)) {
      return "Vui lòng nhập đủ thông tin tài khoản và số điện thoại.";
    }

    if (!companionForm.university || !companionForm.major || !companionForm.skillsText || !companionForm.serviceAreasText) {
      return "Vui lòng nhập đủ trường, ngành, kỹ năng và khu vực hoạt động.";
    }

    return "";
  };

  const nextStep = () => {
    const message = validateProfileStep();
    if (message) {
      setError(message);
      return;
    }

    setError("");
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    const profileError = validateProfileStep();
    if (profileError) {
      setStep(1);
      setError(profileError);
      return;
    }

    if (!form.citizenIdFrontUrl || !form.citizenIdBackUrl) {
      setError("Vui lòng chụp đủ CCCD mặt trước và mặt sau trước khi gửi hồ sơ.");
      return;
    }

    setSubmitting(true);
    try {
      await registerCompanion({
        ...companionForm,
        skills: companionForm.skillsText.split(",").map((item) => item.trim()).filter(Boolean),
        serviceAreas: companionForm.serviceAreasText.split(",").map((item) => item.trim()).filter(Boolean),
        documents: {
          citizenIdFrontUrl: companionForm.citizenIdFrontUrl,
          citizenIdBackUrl: companionForm.citizenIdBackUrl,
        },
      });
      if (isApplyingWithCurrentAccount) {
        navigate("/companion-status", { replace: true });
      } else {
        navigate("/verify-email", {
          state: { email: companionForm.email, password: companionForm.password, role: "companion" },
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Đăng ký người đồng hành"
      subtitle={step === 1 ? "Điền thông tin hồ sơ trước, sau đó chụp CCCD để admin kiểm duyệt." : "Chụp CCCD mặt trước và mặt sau để hoàn tất hồ sơ."}
      badge={`Bước ${step}/2`}
      footer={
        isApplyingWithCurrentAccount
          ? <Link className="font-black text-teal-700" to="/">Về trang chủ</Link>
          : <Link className="font-black text-teal-700" to="/login">Đã có tài khoản</Link>
      }
    >
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-teal-50 p-1 text-sm font-black">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 ${step === 1 ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}
            onClick={() => setStep(1)}
          >
            Hồ sơ
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 ${step === 2 ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}
            onClick={nextStep}
          >
            Chụp CCCD
          </button>
        </div>

        {step === 1 ? (
          <>
            <Input label="Tên hiển thị" value={companionForm.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập tên hiển thị" />
            <Input label="Họ tên đầy đủ" value={companionForm.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập họ tên đầy đủ" />
            <Input
              label="Email"
              type="email"
              value={companionForm.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              readOnly={isApplyingWithCurrentAccount}
              className={`min-h-12 rounded-2xl border-teal-100 ${isApplyingWithCurrentAccount ? "bg-slate-50 text-slate-500" : ""}`}
              placeholder="Nhập email"
            />
            {!isApplyingWithCurrentAccount ? (
              <Input label="Mật khẩu" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập mật khẩu" />
            ) : null}
            <Input label="Số điện thoại" value={companionForm.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập số điện thoại" />
            <Select label="Giới tính" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="min-h-12 rounded-2xl border-teal-100">
              <option value="other">Khác</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </Select>
            <Input label="Trường đại học" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập tên trường đại học" />
            <Input label="Ngành học" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập tên ngành học" />
            <Input label="Kỹ năng, cách nhau bằng dấu phẩy" value={form.skillsText} onChange={(e) => setForm({ ...form, skillsText: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Ví dụ: sơ cứu, đo huyết áp, đi khám" />
            <Input label="Khu vực hoạt động" value={form.serviceAreasText} onChange={(e) => setForm({ ...form, serviceAreasText: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Ví dụ: Quận 1, Quận 7, Thủ Đức" />
          </>
        ) : (
          <div className="grid gap-4 rounded-[28px] border border-teal-100 bg-white/70 p-4">
            <div>
              <h3 className="text-base font-black text-[#12312f]">Chụp CCCD trực tiếp</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Ảnh CCCD dùng để admin kiểm duyệt hồ sơ người đồng hành. Hãy chụp rõ mặt trước và mặt sau.
              </p>
            </div>
            <CccdCameraCapture
              label="CCCD mặt trước"
              value={form.citizenIdFrontUrl}
              onChange={(value) => setForm((current) => ({ ...current, citizenIdFrontUrl: value }))}
            />
            <CccdCameraCapture
              label="CCCD mặt sau"
              value={form.citizenIdBackUrl}
              onChange={(value) => setForm((current) => ({ ...current, citizenIdBackUrl: value }))}
            />
          </div>
        )}

        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        {step === 1 ? (
          <Button type="button" className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" onClick={nextStep}>
            Tiếp tục chụp CCCD
          </Button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <Button type="button" variant="secondary" className="min-h-14 rounded-2xl px-5 text-base font-black" onClick={() => setStep(1)}>
              Quay lại
            </Button>
            <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
              {submitting ? (isApplyingWithCurrentAccount ? "Đang gửi hồ sơ..." : "Đang gửi OTP...") : "Gửi hồ sơ"}
            </Button>
          </div>
        )}
      </form>
    </AuthShell>
  );
};

export default RegisterCompanionPage;
