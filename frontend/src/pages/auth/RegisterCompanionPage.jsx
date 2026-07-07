import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Button, Input, Select } from "../../components/Ui.jsx";
import { useAuth } from "../../context/useAuth.js";
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
      setDocumentError("Camera Ä‘Ã£ má»Ÿ nhÆ°ng trÃ¬nh duyá»‡t chÆ°a phÃ¡t Ä‘Æ°á»£c hÃ¬nh. HÃ£y thá»­ Ä‘Ã³ng rá»“i má»Ÿ láº¡i camera.");
    });
  }, [cameraOpen]);

  const openCamera = async () => {
    setDocumentError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setDocumentError("TrÃ¬nh duyá»‡t khÃ´ng há»— trá»£ má»Ÿ camera.");
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
      setDocumentError("KhÃ´ng má»Ÿ Ä‘Æ°á»£c camera. HÃ£y cáº¥p quyá»n camera rá»“i thá»­ láº¡i.");
    }
  };

  const selectFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setDocumentError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setDocumentError("Chá»‰ há»— trá»£ tá»‡p áº£nh JPG, PNG hoáº·c WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDocumentError("Tá»‡p áº£nh khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setDocumentError("KhÃ´ng Ä‘á»c Ä‘Æ°á»£c tá»‡p áº£nh. Vui lÃ²ng chá»n tá»‡p khÃ¡c.");
        return;
      }
      stopCamera();
      onChange(reader.result);
    };
    reader.onerror = () => setDocumentError("KhÃ´ng Ä‘á»c Ä‘Æ°á»£c tá»‡p áº£nh. Vui lÃ²ng chá»n tá»‡p khÃ¡c.");
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
          <p className="mt-1 text-xs leading-5 text-slate-500">Chá»¥p trá»±c tiáº¿p hoáº·c táº£i tá»‡p áº£nh JPG, PNG, WebP tá»‘i Ä‘a 5 MB.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {value ? (
            <Button type="button" variant="secondary" className="min-h-10 rounded-2xl px-4 text-xs" onClick={() => onChange("")}>
              XÃ³a áº£nh
            </Button>
          ) : null}
          <Button type="button" variant="secondary" className="min-h-10 rounded-2xl px-4 text-xs" onClick={() => fileInputRef.current?.click()}>
            Táº£i tá»‡p tá»« mÃ¡y
          </Button>
          <Button type="button" variant="secondary" className="min-h-10 rounded-2xl px-4 text-xs" onClick={cameraOpen ? stopCamera : openCamera}>
            {cameraOpen ? "ÄÃ³ng camera" : value ? "Má»Ÿ camera" : "Chá»¥p áº£nh"}
          </Button>
        </div>
      </div>

      {cameraOpen ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-teal-100 bg-slate-900">
          <video ref={videoRef} autoPlay playsInline muted controls={false} className="aspect-video w-full bg-slate-950 object-cover" />
          <div className="border-t border-white/10 bg-slate-950/70 p-3">
            <Button type="button" className="min-h-11 w-full rounded-2xl" onClick={capture}>
              LÆ°u áº£nh
            </Button>
          </div>
        </div>
      ) : null}

      {value ? (
        <div className="mt-4">
          <img src={value} alt={label} className="max-h-64 w-full rounded-2xl border border-teal-100 object-cover shadow-lg shadow-teal-900/10" />
          <p className="mt-2 text-xs font-bold text-emerald-700">ÄÃ£ chá»n áº£nh, cÃ³ thá»ƒ gá»­i há»“ sÆ¡.</p>
        </div>
      ) : null}

      {documentError ? <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{documentError}</p> : null}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={selectFile} />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const createInitialForm = (user, application) => ({
  name: application?.fullName || user?.name || "",
  fullName: application?.fullName || user?.name || "",
  phone: application?.phone || user?.phone || "",
  gender: application?.gender || "other",
  dateOfBirth: application?.dateOfBirth ? String(application.dateOfBirth).slice(0, 10) : "",
  workingShift: application?.workingShift || "full_day",
  applicantType: application?.applicantType || "student",
  university: application?.university || "",
  major: application?.major || "",
  graduationYear: application?.graduationYear || "",
  yearsOfExperience: application?.yearsOfExperience || "",
  qualificationDescription: application?.qualificationDescription || "",
  skillsText: application?.skills?.join(", ") || "",
  serviceAreasText: application?.serviceAreas?.join(", ") || "",
  citizenIdFrontUrl: "",
  citizenIdBackUrl: "",
  studentCardUrl: "",
  degreeCertificateUrl: "",
  professionalCertificateUrl: "",
  experienceProofUrl: "",
  backgroundCheckUrl: "",
  legalAcceptances: [],
});

const splitTextList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const RegisterCompanionPage = () => {
  const {
    user,
    loading,
    registerCompanion,
    resubmitCompanionApplication,
  } = useAuth();
  const navigate = useNavigate();
  const application = user?.companionApplication;
  const isResubmission = application?.vettingStatus === "rejected";
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => createInitialForm(user, application));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const applicantType = getCompanionApplicantType(form.applicantType);
  const companionForm = {
    ...form,
    name: form.name || user?.name || "",
    fullName: form.fullName || user?.name || "",
    phone: form.phone || user?.phone || "",
  };

  useEffect(() => {
    const nextForm = createInitialForm(user, application);
    const timer = window.setTimeout(() => {
      setForm(nextForm);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user, application]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateProfileStep = () => {
    if (!companionForm.name || !companionForm.fullName || !companionForm.phone) {
      return "Vui lÃ²ng nháº­p Ä‘á»§ tÃªn hiá»ƒn thá»‹, há» tÃªn Ä‘áº§y Ä‘á»§ vÃ  sá»‘ Ä‘iá»‡n thoáº¡i.";
    }

    if (!companionForm.dateOfBirth) {
      return "Vui lÃ²ng nháº­p ngÃ y sinh.";
    }

    const dateOfBirth = new Date(companionForm.dateOfBirth);
    const adultThreshold = new Date();
    adultThreshold.setFullYear(adultThreshold.getFullYear() - 18);
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > adultThreshold) {
      return "NgÆ°á»i Ä‘á»“ng hÃ nh pháº£i Ä‘á»§ 18 tuá»•i táº¡i thá»i Ä‘iá»ƒm Ä‘Äƒng kÃ½.";
    }

    if (applicantType.requiresEducation && (!companionForm.university || !companionForm.major)) {
      return "Vui lÃ²ng nháº­p Ä‘áº§y Ä‘á»§ cÆ¡ sá»Ÿ Ä‘Ã o táº¡o vÃ  ngÃ nh hoáº·c chuyÃªn mÃ´n.";
    }

    if (companionForm.applicantType === "graduate") {
      const graduationYear = Number(companionForm.graduationYear);
      if (!Number.isInteger(graduationYear) || graduationYear < 1950 || graduationYear > new Date().getFullYear()) {
        return "Vui lÃ²ng nháº­p nÄƒm tá»‘t nghiá»‡p há»£p lá»‡.";
      }
    }

    if (companionForm.applicantType === "experienced_caregiver" && Number(companionForm.yearsOfExperience) < 1) {
      return "Vui lÃ²ng nháº­p Ã­t nháº¥t 1 nÄƒm kinh nghiá»‡m chÄƒm sÃ³c.";
    }

    if (applicantType.requiresDescription && !companionForm.qualificationDescription.trim()) {
      return "Vui lÃ²ng mÃ´ táº£ kinh nghiá»‡m hoáº·c lÃ½ do phÃ¹ há»£p vá»›i vai trÃ² ngÆ°á»i Ä‘á»“ng hÃ nh.";
    }

    if (!companionForm.skillsText || !companionForm.serviceAreasText) {
      return "Vui lÃ²ng nháº­p ká»¹ nÄƒng vÃ  khu vá»±c hoáº¡t Ä‘á»™ng.";
    }

    return "";
  };

  const validateDocumentsStep = () => {
    if (!form.citizenIdFrontUrl || !form.citizenIdBackUrl) {
      return "Vui lÃ²ng chá»¥p Ä‘á»§ CCCD máº·t trÆ°á»›c vÃ  máº·t sau trÆ°á»›c khi gá»­i há»“ sÆ¡.";
    }

    if (!form[applicantType.documentField]) {
      return `Vui lÃ²ng bá»• sung ${applicantType.documentLabel.toLowerCase()} trÆ°á»›c khi gá»­i há»“ sÆ¡.`;
    }

    if (!isResubmission && (!form.legalAcceptances.length || form.legalAcceptances.some((item) => !item.accepted))) {
      return "Vui lÃ²ng Ä‘á»c vÃ  Ä‘á»“ng Ã½ vá»›i Ä‘áº§y Ä‘á»§ Ä‘iá»u khoáº£n dÃ nh cho ngÆ°á»i Ä‘á»“ng hÃ nh.";
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

    const documentError = validateDocumentsStep();
    if (documentError) {
      setStep(2);
      setError(documentError);
      return;
    }

    const payload = {
      ...companionForm,
      skills: splitTextList(companionForm.skillsText),
      serviceAreas: splitTextList(companionForm.serviceAreasText),
      documents: {
        citizenIdFrontUrl: companionForm.citizenIdFrontUrl,
        citizenIdBackUrl: companionForm.citizenIdBackUrl,
        [applicantType.documentField]: companionForm[applicantType.documentField],
      },
      ...(isResubmission ? {} : { legalAcceptances: companionForm.legalAcceptances }),
    };

    setSubmitting(true);
    try {
      if (isResubmission) {
        await resubmitCompanionApplication(payload);
      } else {
        await registerCompanion(payload);
      }
      navigate("/companion-status", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Äang táº£i...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: { pathname: "/companion-register" } }} />;
  }

  if (user.role !== "customer") {
    return <Navigate to={getUserHomePath(user)} replace />;
  }

  if (application && !isResubmission) {
    return <Navigate to="/companion-status" replace />;
  }

  return (
    <AuthShell
      title={isResubmission ? "Bá»• sung vÃ  gá»­i láº¡i há»“ sÆ¡ companion" : "ÄÄƒng kÃ½ ngÆ°á»i Ä‘á»“ng hÃ nh"}
      subtitle={step === 1
        ? (isResubmission
          ? "Cáº­p nháº­t láº¡i thÃ´ng tin theo gá»£i Ã½ tá»« admin, sau Ä‘Ã³ bá»• sung láº¡i giáº¥y tá» Ä‘á»ƒ gá»­i duyá»‡t."
          : "Chá»n nhÃ³m á»©ng viÃªn vÃ  khai thÃ´ng tin phÃ¹ há»£p trÆ°á»›c khi gá»­i kiá»ƒm duyá»‡t.")
        : "Bá»• sung CCCD cÃ¹ng giáº¥y tá» chá»©ng minh phÃ¹ há»£p vá»›i nhÃ³m á»©ng viÃªn."}
      badge={isResubmission ? `Gá»­i láº¡i - BÆ°á»›c ${step}/2` : `BÆ°á»›c ${step}/2`}
      footer={<Link className="font-black text-teal-700" to="/">Vá» trang chá»§</Link>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        {isResubmission && application?.rejectionReason ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
            LÃ½ do tá»« chá»‘i gáº§n nháº¥t: {application.rejectionReason}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-teal-50 p-1 text-sm font-black">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 ${step === 1 ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}
            onClick={() => setStep(1)}
          >
            Há»“ sÆ¡
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 ${step === 2 ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}
            onClick={nextStep}
          >
            Giáº¥y tá» xÃ¡c minh
          </button>
        </div>

        {step === 1 ? (
          <>
            <Input label="TÃªn hiá»ƒn thá»‹" value={companionForm.name} onChange={(event) => updateField("name", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nháº­p tÃªn hiá»ƒn thá»‹" />
            <Input label="Há» tÃªn Ä‘áº§y Ä‘á»§" value={companionForm.fullName} onChange={(event) => updateField("fullName", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nháº­p há» tÃªn Ä‘áº§y Ä‘á»§" />
            <Input label="Sá»‘ Ä‘iá»‡n thoáº¡i" value={companionForm.phone} onChange={(event) => updateField("phone", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" placeholder="Nháº­p sá»‘ Ä‘iá»‡n thoáº¡i" />
            <Select label="Giá»›i tÃ­nh" value={form.gender} onChange={(event) => updateField("gender", event.target.value)} className="min-h-12 rounded-2xl border-teal-100">
              <option value="other">KhÃ¡c</option>
              <option value="male">Nam</option>
              <option value="female">Ná»¯</option>
            </Select>
            <Input label="NgÃ y sinh" type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" />
            <Select label="Ca lÃ m viá»‡c" value={form.workingShift} onChange={(event) => updateField("workingShift", event.target.value)} className="min-h-12 rounded-2xl border-teal-100">
              <option value="morning">Buá»•i sÃ¡ng 07:00 - 13:00</option>
              <option value="afternoon">Buá»•i chiá»u 13:00 - 19:00</option>
              <option value="full_day">Cáº£ ngÃ y 07:00 - 19:00</option>
            </Select>
            <Select label="Báº¡n Ä‘Äƒng kÃ½ vá»›i tÆ° cÃ¡ch" value={form.applicantType} onChange={(event) => updateField("applicantType", event.target.value)} className="min-h-12 rounded-2xl border-teal-100">
              {companionApplicantTypes.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
            <p className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-semibold leading-6 text-teal-800">
              {applicantType.description}
            </p>

            {applicantType.requiresEducation ? (
              <>
                <Input label="CÆ¡ sá»Ÿ Ä‘Ã o táº¡o" value={form.university} onChange={(event) => updateField("university", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" placeholder="VÃ­ dá»¥: Äáº¡i há»c Y DÆ°á»£c TP. HCM" />
                <Input label="NgÃ nh hoáº·c chuyÃªn mÃ´n" value={form.major} onChange={(event) => updateField("major", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" placeholder="VÃ­ dá»¥: Äiá»u dÆ°á»¡ng" />
              </>
            ) : null}

            {form.applicantType === "graduate" ? (
              <Input label="NÄƒm tá»‘t nghiá»‡p" type="number" min="1950" max={new Date().getFullYear()} value={form.graduationYear} onChange={(event) => updateField("graduationYear", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" />
            ) : null}

            {applicantType.requiresExperience ? (
              <Input label="Sá»‘ nÄƒm kinh nghiá»‡m" type="number" min="0" max="60" step="0.5" value={form.yearsOfExperience} onChange={(event) => updateField("yearsOfExperience", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" />
            ) : null}

            {applicantType.requiresDescription ? (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Kinh nghiá»‡m hoáº·c lÃ½ do phÃ¹ há»£p</span>
                <textarea value={form.qualificationDescription} onChange={(event) => updateField("qualificationDescription", event.target.value)} className="min-h-28 rounded-2xl border border-teal-100 bg-white px-4 py-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" maxLength="1000" />
              </label>
            ) : null}

            <Input label="Ká»¹ nÄƒng, cÃ¡ch nhau báº±ng dáº¥u pháº©y" value={form.skillsText} onChange={(event) => updateField("skillsText", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" placeholder="VÃ­ dá»¥: sÆ¡ cá»©u, Ä‘o huyáº¿t Ã¡p, Ä‘i khÃ¡m" />
            <Input label="Khu vá»±c hoáº¡t Ä‘á»™ng" value={form.serviceAreasText} onChange={(event) => updateField("serviceAreasText", event.target.value)} className="min-h-12 rounded-2xl border-teal-100" placeholder="VÃ­ dá»¥: Quáº­n 1, Quáº­n 7, Thá»§ Äá»©c" />
          </>
        ) : (
          <div className="grid gap-4 rounded-[28px] border border-teal-100 bg-white/70 p-4">
            <div>
              <h3 className="text-base font-black text-[#12312f]">Giáº¥y tá» xÃ¡c minh</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                HÃ£y chá»¥p rÃµ CCCD vÃ  giáº¥y tá» chá»©ng minh tÆ°Æ¡ng á»©ng. Admin sáº½ Ä‘á»‘i chiáº¿u trÆ°á»›c khi duyá»‡t há»“ sÆ¡.
              </p>
            </div>
            <DocumentCameraCapture label="CCCD máº·t trÆ°á»›c" value={form.citizenIdFrontUrl} onChange={(value) => updateField("citizenIdFrontUrl", value)} />
            <DocumentCameraCapture label="CCCD máº·t sau" value={form.citizenIdBackUrl} onChange={(value) => updateField("citizenIdBackUrl", value)} />
            <DocumentCameraCapture label={applicantType.documentLabel} value={form[applicantType.documentField]} onChange={(value) => updateField(applicantType.documentField, value)} />
            {!isResubmission ? (
              <ConsentChecklist
                flow="COMPANION_APPLICATION"
                onChange={(legalAcceptances) => updateField("legalAcceptances", legalAcceptances)}
              />
            ) : (
              <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-semibold leading-6 text-teal-800">
                Há»“ sÆ¡ bá»‹ tá»« chá»‘i cáº§n báº¡n táº£i láº¡i giÃ¡º¥y tá» má»›i hoáº·c Ä‘Ã£ Ä‘iá»u chá»‰nh. Pháº§n Ä‘iá»u khoáº£n Ä‘Ã£ Ä‘Æ°á»£c lÆ°u tá»« láº§n gá»­i trÆ°á»›c.
              </div>
            )}
          </div>
        )}

        {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        {step === 1 ? (
          <Button type="button" className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" onClick={nextStep}>
            Tiáº¿p tá»¥c bá»• sung giáº¥y tá»
          </Button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <Button type="button" variant="secondary" className="min-h-14 rounded-2xl px-5 text-base font-black" onClick={() => setStep(1)}>
              Quay láº¡i
            </Button>
            <Button className="min-h-14 rounded-2xl text-base font-black shadow-lg shadow-teal-700/20" disabled={submitting}>
              {submitting ? (isResubmission ? "Äang gá»­i láº¡i..." : "Äang gá»­i há»“ sÆ¡...") : (isResubmission ? "Gá»­i láº¡i há»“ sÆ¡" : "Gá»­i há»“ sÆ¡")}
            </Button>
          </div>
        )}
      </form>
    </AuthShell>
  );
};

export default RegisterCompanionPage;
