import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Button, Input, Select } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getUserHomePath } from "../../utils/authNavigation.js";
import AuthShell from "./AuthShell.jsx";
import ConsentChecklist from "../../components/legal/ConsentChecklist.jsx";
import { companionApplicantTypes, getCompanionApplicantType } from "../../utils/companionApplication.js";

const DocumentCameraCapture = ({ label, value, onChange }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [documentError, setDocumentError] = useState("");

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
      setDocumentError("Camera đã mở nhưng trình duyệt chưa phát được hình. Hãy thử đóng rồi mở lại camera.");
    });
  }, [cameraOpen]);

  const openCamera = async () => {
    setDocumentError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setDocumentError("Trình duyệt không hỗ trợ mở camera.");
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
      setDocumentError("Không mở được camera. Hãy cấp quyền camera rồi thử lại.");
    }
  };

  const selectFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setDocumentError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setDocumentError("Chỉ hỗ trợ tệp ảnh JPG, PNG hoặc WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDocumentError("Tệp ảnh không được vượt quá 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setDocumentError("Không đọc được tệp ảnh. Vui lòng chọn tệp khác.");
        return;
      }
      stopCamera();
      onChange(reader.result);
    };
    reader.onerror = () => setDocumentError("Không đọc được tệp ảnh. Vui lòng chọn tệp khác.");
    reader.readAsDataURL(file);
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    const maxWidth = 1024;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL("image/jpeg", 0.72));
    stopCamera();
  };

  return (
    <div className="rounded-3xl border border-teal-100 bg-[#fbfffe] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-[#12312f]">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Chụp trực tiếp hoặc tải tệp ảnh JPG, PNG, WebP tối đa 5 MB.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {value ? (
            <Button type="button" variant="secondary" className="min-h-10 rounded-2xl px-4 text-xs" onClick={() => onChange("")}>
              Xóa ảnh
            </Button>
          ) : null}
          <Button type="button" variant="secondary" className="min-h-10 rounded-2xl px-4 text-xs" onClick={() => fileInputRef.current?.click()}>
            Tải tệp từ máy
          </Button>
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
              Lưu ảnh
            </Button>
          </div>
        </div>
      ) : null}

      {value ? (
        <div className="mt-4">
          <img src={value} alt={label} className="max-h-64 w-full rounded-2xl border border-teal-100 object-cover shadow-lg shadow-teal-900/10" />
          <p className="mt-2 text-xs font-bold text-emerald-700">Đã chọn ảnh, có thể gửi hồ sơ.</p>
        </div>
      ) : null}

      {documentError ? <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{documentError}</p> : null}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={selectFile} />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const RegisterCompanionPage = () => {
  const { user, loading, registerCompanion } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: user?.name || "",
    fullName: user?.name || "",
    phone: user?.phone || "",
    gender: "other",
    dateOfBirth: "",
    workingShift: "full_day",
    applicantType: "student",
    university: "",
    major: "",
    graduationYear: "",
    yearsOfExperience: "",
    qualificationDescription: "",
    skillsText: "",
    serviceAreasText: "",
    citizenIdFrontUrl: "",
    citizenIdBackUrl: "",
    studentCardUrl: "",
    degreeCertificateUrl: "",
    professionalCertificateUrl: "",
    experienceProofUrl: "",
    backgroundCheckUrl: "",
    legalAcceptances: [],
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const companionForm = {
    ...form,
    name: form.name || user?.name || "",
    fullName: form.fullName || user?.name || "",
    phone: form.phone || user?.phone || "",
  };
  const applicantType = getCompanionApplicantType(form.applicantType);

  const validateProfileStep = () => {
    if (!companionForm.name || !companionForm.fullName || !companionForm.phone) {
      return "Vui lòng nhập đủ họ tên hiển thị, họ tên đầy đủ và số điện thoại.";
    }

    if (!companionForm.dateOfBirth) {
      return "Vui lòng nhập ngày sinh.";
    }

    const dateOfBirth = new Date(companionForm.dateOfBirth);
    const adultThreshold = new Date();
    adultThreshold.setFullYear(adultThreshold.getFullYear() - 18);
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > adultThreshold) {
      return "Người đồng hành phải đủ 18 tuổi tại thời điểm đăng ký.";
    }

    if (applicantType.requiresEducation && (!companionForm.university || !companionForm.major)) {
      return "Vui lòng nhập đầy đủ cơ sở đào tạo và ngành hoặc chuyên môn.";
    }

    if (companionForm.applicantType === "graduate") {
      const graduationYear = Number(companionForm.graduationYear);
      if (!Number.isInteger(graduationYear) || graduationYear < 1950 || graduationYear > new Date().getFullYear()) {
        return "Vui lòng nhập năm tốt nghiệp hợp lệ.";
      }
    }

    if (companionForm.applicantType === "experienced_caregiver" && Number(companionForm.yearsOfExperience) < 1) {
      return "Vui lòng nhập ít nhất 1 năm kinh nghiệm chăm sóc.";
    }

    if (applicantType.requiresDescription && !companionForm.qualificationDescription.trim()) {
      return "Vui lòng mô tả kinh nghiệm hoặc lý do phù hợp với vai trò người đồng hành.";
    }

    if (!companionForm.skillsText || !companionForm.serviceAreasText) {
      return "Vui lòng nhập kỹ năng và khu vực hoạt động.";
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

    if (!form[applicantType.documentField]) {
      setError(`Vui lòng bổ sung ${applicantType.documentLabel.toLowerCase()} trước khi gửi hồ sơ.`);
      return;
    }

    if (!form.legalAcceptances.length || form.legalAcceptances.some((item) => !item.accepted)) {
      setError("Vui lòng đọc và đồng ý với đầy đủ điều khoản dành cho người đồng hành.");
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
          [applicantType.documentField]: companionForm[applicantType.documentField],
        },
        legalAcceptances: companionForm.legalAcceptances,
      });
      navigate("/companion-status", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: { pathname: "/companion-register" } }} />;
  }

  if (user.role !== "customer") {
    return <Navigate to={getUserHomePath(user)} replace />;
  }

  if (user.companionApplication) {
    return <Navigate to="/companion-status" replace />;
  }

  return (
    <AuthShell
      title="Đăng ký người đồng hành"
      subtitle={step === 1 ? "Chọn nhóm ứng viên và khai thông tin phù hợp trước khi gửi kiểm duyệt." : "Bổ sung CCCD cùng giấy tờ chứng minh phù hợp với nhóm ứng viên."}
      badge={`Bước ${step}/2`}
      footer={
        <Link className="font-black text-teal-700" to="/">Về trang chủ</Link>
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
            Giấy tờ xác minh
          </button>
        </div>

        {step === 1 ? (
          <>
            <Input label="Tên hiển thị" value={companionForm.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập tên hiển thị" />
            <Input label="Họ tên đầy đủ" value={companionForm.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập họ tên đầy đủ" />
            <Input label="Số điện thoại" value={companionForm.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nhập số điện thoại" />
            <Select label="Giới tính" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="min-h-12 rounded-2xl border-teal-100">
              <option value="other">Khác</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </Select>
            <Input label="Ngày sinh" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
            <Select label="Ca làm việc" value={form.workingShift} onChange={(e) => setForm({ ...form, workingShift: e.target.value })} className="min-h-12 rounded-2xl border-teal-100">
              <option value="morning">Buổi sáng 07:00 - 13:00</option>
              <option value="afternoon">Buổi chiều 13:00 - 19:00</option>
              <option value="full_day">Cả ngày 07:00 - 19:00</option>
            </Select>
            <Select label="Bạn đăng ký với tư cách" value={form.applicantType} onChange={(e) => setForm({ ...form, applicantType: e.target.value })} className="min-h-12 rounded-2xl border-teal-100">
              {companionApplicantTypes.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
            <p className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-semibold leading-6 text-teal-800">
              {applicantType.description}
            </p>
            {applicantType.requiresEducation ? (
              <>
                <Input label="Cơ sở đào tạo" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Ví dụ: Đại học Y Dược TP. HCM" />
                <Input label="Ngành hoặc chuyên môn" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Ví dụ: Điều dưỡng" />
              </>
            ) : null}
            {form.applicantType === "graduate" ? (
              <Input label="Năm tốt nghiệp" type="number" min="1950" max={new Date().getFullYear()} value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
            ) : null}
            {applicantType.requiresExperience ? (
              <Input label="Số năm kinh nghiệm" type="number" min="0" max="60" step="0.5" value={form.yearsOfExperience} onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" />
            ) : null}
            {applicantType.requiresDescription ? (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Kinh nghiệm hoặc lý do phù hợp</span>
                <textarea value={form.qualificationDescription} onChange={(e) => setForm({ ...form, qualificationDescription: e.target.value })} className="min-h-28 rounded-2xl border border-teal-100 bg-white px-4 py-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" maxLength="1000" />
              </label>
            ) : null}
            <Input label="Kỹ năng, cách nhau bằng dấu phẩy" value={form.skillsText} onChange={(e) => setForm({ ...form, skillsText: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Ví dụ: sơ cứu, đo huyết áp, đi khám" />
            <Input label="Khu vực hoạt động" value={form.serviceAreasText} onChange={(e) => setForm({ ...form, serviceAreasText: e.target.value })} className="min-h-12 rounded-2xl border-teal-100" placeholder="Ví dụ: Quận 1, Quận 7, Thủ Đức" />
          </>
        ) : (
          <div className="grid gap-4 rounded-[28px] border border-teal-100 bg-white/70 p-4">
            <div>
              <h3 className="text-base font-black text-[#12312f]">Giấy tờ xác minh</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Hãy chụp rõ CCCD và giấy tờ chứng minh tương ứng. Admin sẽ đối chiếu trước khi duyệt hồ sơ.
              </p>
            </div>
            <DocumentCameraCapture
              label="CCCD mặt trước"
              value={form.citizenIdFrontUrl}
              onChange={(value) => setForm((current) => ({ ...current, citizenIdFrontUrl: value }))}
            />
            <DocumentCameraCapture
              label="CCCD mặt sau"
              value={form.citizenIdBackUrl}
              onChange={(value) => setForm((current) => ({ ...current, citizenIdBackUrl: value }))}
            />
            <DocumentCameraCapture
              label={applicantType.documentLabel}
              value={form[applicantType.documentField]}
              onChange={(value) => setForm((current) => ({ ...current, [applicantType.documentField]: value }))}
            />
            <ConsentChecklist
              flow="COMPANION_APPLICATION"
              onChange={(legalAcceptances) => setForm((current) => ({ ...current, legalAcceptances }))}
            />
          </div>
        )}

        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        {step === 1 ? (
          <Button type="button" className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" onClick={nextStep}>
            Tiếp tục bổ sung giấy tờ
          </Button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <Button type="button" variant="secondary" className="min-h-14 rounded-2xl px-5 text-base font-black" onClick={() => setStep(1)}>
              Quay lại
            </Button>
            <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
              {submitting ? "Đang gửi hồ sơ..." : "Gửi hồ sơ"}
            </Button>
          </div>
        )}
      </form>
    </AuthShell>
  );
};

export default RegisterCompanionPage;
