import ElderProfile from "../models/elder-profile.models.js";
import {
  createElderDto,
  formatElderValidationError,
  updateElderDto,
} from "../dto/elder.dto.js";
import { saveConsentReceipts, validateLegalAcceptances } from "../utils/legal-consent.js";

export const createElderProfile = async (req, res) => {
  try {
    const { legalAcceptances, ...submittedElder } = req.body || {};
    const validation = createElderDto.safeParse(submittedElder);
    if (!validation.success) {
      return res.status(400).json({ message: formatElderValidationError(validation.error) });
    }

    const consentValidation = validateLegalAcceptances({
      acceptances: legalAcceptances,
      flow: "ELDER_PROFILE_CREATE",
      req,
    });
    if (consentValidation.error) {
      return res.status(400).json({ message: consentValidation.error, code: "LEGAL_ACCEPTANCE_REQUIRED" });
    }

    const elder = await ElderProfile.create({
      ...validation.data,
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
    const elders = await ElderProfile.find({
      customerId: req.user.userId,
      isArchived: { $ne: true },
    }).sort({
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
      isArchived: { $ne: true },
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
    const validation = updateElderDto.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ message: formatElderValidationError(validation.error) });
    }

    const elder = await ElderProfile.findOneAndUpdate(
      {
        _id: req.params.id,
        customerId: req.user.userId,
        isArchived: { $ne: true },
      },
      { $set: validation.data },
      { new: true, runValidators: true },
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
    const elder = await ElderProfile.findOneAndUpdate(
      {
        _id: req.params.id,
        customerId: req.user.userId,
        isArchived: { $ne: true },
      },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    );
    if (!elder) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ người thân." });
    }

    return res.status(200).json({ message: "Xóa hồ sơ người thân thành công." });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};
