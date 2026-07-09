export const PASSWORD_POLICY_MESSAGE =
  "Mật khẩu phải có tối thiểu 8 ký tự, bao gồm chữ thường, chữ hoa, số và ký tự đặc biệt.";

export const isStrongPassword = (value) =>
  typeof value === "string" &&
  value.length >= 8 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);
