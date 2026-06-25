export const getEffectiveRoles = (user) => {
  const roles = new Set();
  if (user?.role) {
    roles.add(user.role);
  }

  if (user?.role === "companion") {
    roles.add("customer");
  }

  return [...roles];
};

export const hasRole = (user, role) => getEffectiveRoles(user).includes(role);

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.some((role) => hasRole(req.user, role))) {
      return res.status(403).json({ message: "permission denied" });
    }

    next();
  };
};
