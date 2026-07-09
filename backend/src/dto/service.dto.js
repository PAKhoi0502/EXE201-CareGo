import { z } from "zod";

const nameSchema = z
  .string({ error: "Tên dịch vụ phải là chuỗi." })
  .trim()
  .min(1, "Tên dịch vụ không được để trống.")
  .max(120, "Tên dịch vụ không được vượt quá 120 ký tự.");

const codeSchema = z
  .string({ error: "Mã dịch vụ phải là chuỗi." })
  .trim()
  .min(1, "Mã dịch vụ không được để trống.")
  .max(50, "Mã dịch vụ không được vượt quá 50 ký tự.")
  .regex(/^[A-Za-z0-9_-]+$/, "Mã dịch vụ chỉ được chứa chữ, số, dấu gạch ngang và gạch dưới.");

const descriptionSchema = z
  .string({ error: "Mô tả dịch vụ phải là chuỗi." })
  .trim()
  .max(2000, "Mô tả dịch vụ không được vượt quá 2.000 ký tự.");

const priceSchema = z
  .number({ error: "Đơn giá theo giờ phải là số." })
  .finite("Đơn giá theo giờ không hợp lệ.")
  .min(0, "Đơn giá theo giờ không được nhỏ hơn 0.")
  .max(100_000_000, "Đơn giá theo giờ không được vượt quá 100.000.000 đồng.");

const checklistSchema = z
  .array(
    z
      .string({ error: "Mỗi bước công việc phải là chuỗi." })
      .trim()
      .min(1, "Bước công việc không được để trống.")
      .max(300, "Mỗi bước công việc không được vượt quá 300 ký tự."),
    { error: "Danh sách công việc phải là một mảng." },
  )
  .max(50, "Mỗi dịch vụ chỉ được có tối đa 50 bước công việc.");

const serviceFields = {
  name: nameSchema,
  code: codeSchema,
  description: descriptionSchema.optional(),
  pricePerHour: priceSchema,
  defaultChecklist: checklistSchema.optional(),
  isActive: z.boolean({ error: "Trạng thái dịch vụ phải là giá trị đúng hoặc sai." }).optional(),
};

export const createServiceDto = z.strictObject(serviceFields);

export const updateServiceDto = z
  .strictObject({
    name: nameSchema.optional(),
    code: codeSchema.optional(),
    description: descriptionSchema.optional(),
    pricePerHour: priceSchema.optional(),
    defaultChecklist: checklistSchema.optional(),
    isActive: z.boolean({ error: "Trạng thái dịch vụ phải là giá trị đúng hoặc sai." }).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Vui lòng cung cấp ít nhất một trường cần cập nhật.",
  });

export const formatServiceValidationIssue = (issue) => {
  if (!issue) return "Dữ liệu dịch vụ không hợp lệ.";
  if (issue.code === "unrecognized_keys") {
    return `Trường không được phép sử dụng: ${(issue.keys || []).join(", ")}.`;
  }
  return issue.message || "Dữ liệu dịch vụ không hợp lệ.";
};

export const formatServiceValidationError = (error) =>
  formatServiceValidationIssue(error?.issues?.[0]);
