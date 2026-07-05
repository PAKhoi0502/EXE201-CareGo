export const COMPANION_APPLICANT_TYPES = [
  "student",
  "graduate",
  "healthcare_professional",
  "experienced_caregiver",
  "community_supporter",
];

const qualificationDocumentFields = {
  student: "studentCardUrl",
  graduate: "degreeCertificateUrl",
  healthcare_professional: "professionalCertificateUrl",
  experienced_caregiver: "experienceProofUrl",
  community_supporter: "backgroundCheckUrl",
};

export const normalizeCompanionApplicantType = (value) => {
  const normalizedValue = String(value || "").trim();
  return COMPANION_APPLICANT_TYPES.includes(normalizedValue) ? normalizedValue : "";
};

export const normalizeGraduationYear = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
};

export const normalizeYearsOfExperience = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  const years = Number(value);
  return Number.isFinite(years) ? years : 0;
};

export const getRequiredCompanionDocumentFields = (applicantType) => {
  const qualificationField = qualificationDocumentFields[applicantType];
  return ["citizenIdFrontUrl", "citizenIdBackUrl", ...(qualificationField ? [qualificationField] : [])];
};

export const getCompanionApplicationProfileError = (profile = {}, now = new Date()) => {
  const applicantType = normalizeCompanionApplicantType(profile.applicantType);
  if (!applicantType) {
    return "Vui lòng chọn nhóm ứng viên hợp lệ.";
  }

  const dateOfBirth = new Date(profile.dateOfBirth);
  if (Number.isNaN(dateOfBirth.getTime())) {
    return "Vui lòng nhập ngày sinh hợp lệ.";
  }

  const adultThreshold = new Date(now);
  adultThreshold.setFullYear(adultThreshold.getFullYear() - 18);
  if (dateOfBirth > adultThreshold) {
    return "Người đồng hành phải đủ 18 tuổi tại thời điểm đăng ký.";
  }

  const university = String(profile.university || "").trim();
  const major = String(profile.major || "").trim();
  const graduationYear = normalizeGraduationYear(profile.graduationYear);
  const yearsOfExperience = normalizeYearsOfExperience(profile.yearsOfExperience);
  const qualificationDescription = String(profile.qualificationDescription || "").trim();

  if (["student", "graduate", "healthcare_professional"].includes(applicantType) && (!university || !major)) {
    return "Vui lòng nhập đầy đủ cơ sở đào tạo và ngành hoặc chuyên môn.";
  }

  if (applicantType === "graduate") {
    const currentYear = now.getFullYear();
    if (!graduationYear || graduationYear < 1950 || graduationYear > currentYear) {
      return "Vui lòng nhập năm tốt nghiệp hợp lệ.";
    }
  }

  if (applicantType === "healthcare_professional" && yearsOfExperience < 0) {
    return "Số năm kinh nghiệm không hợp lệ.";
  }

  if (applicantType === "experienced_caregiver" && yearsOfExperience < 1) {
    return "Ứng viên chăm sóc có kinh nghiệm cần khai báo ít nhất 1 năm kinh nghiệm.";
  }

  if (["experienced_caregiver", "community_supporter"].includes(applicantType) && !qualificationDescription) {
    return "Vui lòng mô tả kinh nghiệm hoặc lý do phù hợp với vai trò người đồng hành.";
  }

  return "";
};
