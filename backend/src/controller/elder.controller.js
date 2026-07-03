import ElderProfile from "../models/elder-profile.models.js";
import { saveConsentReceipts, validateLegalAcceptances } from "../utils/legal-consent.js";

export const createElderProfile = async (req, res) => {
  try {
    const { fullName, address } = req.body;
    if (!fullName || !address) {
      return res.status(400).json({ message: "Vui lòng nhập họ tên và địa chỉ của người thân." });
    }

    const consentValidation = validateLegalAcceptances({
      acceptances: req.body.legalAcceptances,
      flow: "ELDER_PROFILE_CREATE",
      req,
    });
    if (consentValidation.error) {
      return res.status(400).json({ message: consentValidation.error, code: "LEGAL_ACCEPTANCE_REQUIRED" });
    }

    const { legalAcceptances, ...elderPayload } = req.body;

    const elder = await ElderProfile.create({
      ...elderPayload,
      customerId: req.user.userId,
    });

    try {
      await saveConsentReceipts({
        userId: req.user.userId,
        acceptances: consentValidation.acceptances,
        contextType: "elderProfile",
        contextId: elder._id,
      });
    } catch (consentError) {
      await ElderProfile.deleteOne({ _id: elder._id });
      throw consentError;
    }

    return res.status(201).json({ message: "Tạo hồ sơ người thân thành công.", elder });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getMyElderProfiles = async (req, res) => {
  try {
    const elders = await ElderProfile.find({ customerId: req.user.userId }).sort({
      createdAt: -1,
    });
    return res.status(200).json({ elders });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const getElderProfileById = async (req, res) => {
  try {
    const elder = await ElderProfile.findOne({
      _id: req.params.id,
      customerId: req.user.userId,
    });
    if (!elder) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người thân." });
    }

    return res.status(200).json({ elder });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const updateElderProfile = async (req, res) => {
  try {
    const elder = await ElderProfile.findOneAndUpdate(
      { _id: req.params.id, customerId: req.user.userId },
      req.body,
      { new: true },
    );
    if (!elder) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người thân." });
    }

    return res.status(200).json({ message: "Cập nhật hồ sơ người thân thành công.", elder });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const deleteElderProfile = async (req, res) => {
  try {
    const elder = await ElderProfile.findOneAndDelete({
      _id: req.params.id,
      customerId: req.user.userId,
    });
    if (!elder) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người thân." });
    }

    return res.status(200).json({ message: "Xóa hồ sơ người thân thành công." });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};
