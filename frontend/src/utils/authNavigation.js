export const isApprovedCompanion = (user) =>
  user?.role === "companion" && user?.companionProfile?.vettingStatus === "approved";

export const needsCompanionApproval = (user) =>
  user?.role === "companion" && user?.companionProfile?.vettingStatus !== "approved";

export const hasCustomerAccess = (user) =>
  user?.role === "customer" || user?.role === "companion";

export const hasRoleAccess = (user, role) => {
  if (role === "customer") {
    return hasCustomerAccess(user);
  }

  return user?.role === role;
};

export const getUserHomePath = (user) => {
  if (!user?.role) return "/";
  if (user.role === "customer") return "/";
  if (user.role === "companion") {
    return isApprovedCompanion(user) ? "/companion/bookings" : "/companion-status";
  }
  return `/${user.role}`;
};
