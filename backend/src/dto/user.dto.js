export const USER_SELF_PROJECTION = [
  "_id",
  "name",
  "email",
  "phone",
  "role",
  "avatar",
  "isActive",
  "isEmailVerified",
  "mustChangePassword",
  "temporaryPasswordExpiresAt",
  "createdAt",
  "updatedAt",
].join(" ");

export const toUserSelfDto = (user) => {
  if (!user) return null;

  const source = typeof user.toObject === "function" ? user.toObject() : user;
  return {
    _id: source._id,
    name: source.name,
    email: source.email,
    phone: source.phone,
    role: source.role,
    avatar: source.avatar,
    isActive: source.isActive,
    isEmailVerified: source.isEmailVerified,
    mustChangePassword: source.mustChangePassword,
    temporaryPasswordExpiresAt: source.temporaryPasswordExpiresAt,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};
