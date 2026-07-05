export const companionApplicantTypes = [
  {
    value: "student",
    label: "Sinh viên đang học",
    description: "Đang theo học tại trường đại học, cao đẳng hoặc cơ sở đào tạo phù hợp.",
    requiresEducation: true,
    documentField: "studentCardUrl",
    documentLabel: "Thẻ sinh viên hoặc giấy xác nhận đang học",
  },
  {
    value: "graduate",
    label: "Đã tốt nghiệp",
    description: "Đã hoàn thành chương trình đào tạo và có bằng hoặc giấy chứng nhận tốt nghiệp.",
    requiresEducation: true,
    documentField: "degreeCertificateUrl",
    documentLabel: "Bằng hoặc giấy chứng nhận tốt nghiệp",
  },
  {
    value: "healthcare_professional",
    label: "Nhân sự ngành sức khỏe",
    description: "Đang làm việc hoặc đã được đào tạo chuyên môn trong lĩnh vực sức khỏe, chăm sóc.",
    requiresEducation: true,
    requiresExperience: true,
    documentField: "professionalCertificateUrl",
    documentLabel: "Bằng cấp hoặc chứng chỉ chuyên môn",
  },
  {
    value: "experienced_caregiver",
    label: "Người có kinh nghiệm chăm sóc",
    description: "Có kinh nghiệm thực tế trong việc hỗ trợ, chăm sóc người cao tuổi hoặc người cần trợ giúp.",
    requiresExperience: true,
    requiresDescription: true,
    documentField: "experienceProofUrl",
    documentLabel: "Chứng chỉ, xác nhận công việc hoặc tài liệu kinh nghiệm",
  },
  {
    value: "community_supporter",
    label: "Cộng tác viên cộng đồng",
    description: "Muốn tham gia các hoạt động đồng hành phi y tế và sẵn sàng qua quy trình kiểm duyệt.",
    requiresDescription: true,
    documentField: "backgroundCheckUrl",
    documentLabel: "Phiếu lý lịch tư pháp hoặc giấy xác nhận nhân thân",
  },
];

export const getCompanionApplicantType = (value) =>
  companionApplicantTypes.find((item) => item.value === value) || companionApplicantTypes[0];

export const getCompanionApplicantTypeLabel = (value) => getCompanionApplicantType(value).label;
