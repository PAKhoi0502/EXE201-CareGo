export const infoController = (req, res) => {
  res.send("info");
};
export const createProfileController = (req, res) => {
  console.log("user from token:", req.info);
  res.send("create profile");
};
