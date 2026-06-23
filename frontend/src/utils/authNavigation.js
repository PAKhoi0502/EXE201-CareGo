export const isApprovedCompanion = (user) =>
  user?.role === "companion" && user?.companionProfile?.vettingStatus === "approved";

export const needsCompanionApproval = (user) =>
  user?.role === "companion" && user?.companionProfile?.vettingStatus !== "approved";

export const getUserHomePath = (user) => {
  if (!user?.role) return "/";
  if (user.role === "customer") return "/";
  if (user.role === "companion") {
    return isApprovedCompanion(user) ? "/companion/bookings" : "/companion-status";
  }
  return `/${user.role}`;
};
