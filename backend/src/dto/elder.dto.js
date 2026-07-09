import { z } from "zod";

const phonePattern = /^\+?[0-9]{9,15}$/;

const requiredText = (label, max) =>
  z
    .string({ error: `${label} phải là chuỗi.` })
    .trim()
    .min(1, `${label} không được để trống.`)
    .max(max, `${label} không được vượt quá ${max} ký tự.`);

const optionalText = (label, max) =>
  z
    .string({ error: `${label} phải là chuỗi.` })
    .trim()
    .max(max, `${label} không được vượt quá ${max} ký tự.`)
    .optional();

const ageSchema = z
  .number({ error: "Tuổi phải là số." })
  .int("Tuổi phải là số nguyên.")
  .min(0, "Tuổi không được nhỏ hơn 0.")
  .max(130, "Tuổi không được lớn hơn 130.");

const phoneSchema = z
  .string({ error: "Số điện thoại khẩn cấp phải là chuỗi." })
  .trim()
  .max(16, "Số điện thoại khẩn cấp không được vượt quá 16 ký tự.")
  .refine((value) => !value || phonePattern.test(value), {
    message: "Số điện thoại khẩn cấp phải gồm 9 đến 15 chữ số và có thể bắt đầu bằng dấu +.",
  });

const chronicConditionsSchema = z
  .array(requiredText("Tình trạng sức khỏe", 200), {
    error: "Danh sách tình trạng sức khỏe phải là một mảng.",
  })
  .max(30, "Chỉ được lưu tối đa 30 tình trạng sức khỏe.");

const medicinesSchema = z
  .array(
    z.strictObject({
      name: optionalText("Tên thuốc", 120),
      dosage: optionalText("Liều dùng", 120),
      schedule: optionalText("Lịch dùng thuốc", 200),
      note: optionalText("Ghi chú thuốc", 500),
    }),
    { error: "Danh sách thuốc phải là một mảng." },
  )
  .max(50, "Chỉ được lưu tối đa 50 loại thuốc.");

const emergencyContactSchema = z.strictObject({
  name: optionalText("Tên người liên hệ khẩn cấp", 120),
  phone: phoneSchema.optional(),
  relationship: optionalText("Mối quan hệ", 120),
});

const elderFields = {
  fullName: requiredText("Họ tên người thân", 120),
  age: ageSchema,
  gender: z.enum(["male", "female", "other"], {
    error: "Giới tính không hợp lệ.",
  }),
  address: requiredText("Địa chỉ", 500),
  medicalNotes: optionalText("Ghi chú chăm sóc", 5000),
  chronicConditions: chronicConditionsSchema.optional(),
  medicines: medicinesSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
};

export const createElderDto = z.strictObject({
  ...elderFields,
  gender: elderFields.gender.optional(),
});

export const updateElderDto = z
  .strictObject(Object.fromEntries(
    Object.entries(elderFields).map(([field, schema]) => [field, schema.optional()]),
  ))
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Vui lòng cung cấp ít nhất một trường cần cập nhật.",
  });

export const formatElderValidationError = (error) => {
  const issue = error?.issues?.[0];
  if (!issue) return "Dữ liệu hồ sơ người thân không hợp lệ.";
  if (issue.code === "unrecognized_keys") {
    return `Trường không được phép sử dụng: ${(issue.keys || []).join(", ")}.`;
  }
  return issue.message || "Dữ liệu hồ sơ người thân không hợp lệ.";
};
