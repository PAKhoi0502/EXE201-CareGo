import Service from "../models/service.models.js";
import {
  createServiceDto,
  formatServiceValidationError,
  formatServiceValidationIssue,
  updateServiceDto,
} from "../dto/service.dto.js";

const sendValidationError = (res, validation) =>
  res.status(400).json({
    message: formatServiceValidationError(validation.error),
    errors: validation.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: formatServiceValidationIssue(issue),
    })),
  });

const handleServiceWriteError = (error, res) => {
  if (error?.code === 11000) {
    return res.status(409).json({ message: "Mã dịch vụ đã tồn tại." });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ message: "Dữ liệu dịch vụ không hợp lệ." });
  }
  return res.status(500).json({
    message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
    error: error.message,
  });
};

export const getServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json({ services });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

export const createService = async (req, res) => {
  try {
    const validation = createServiceDto.safeParse(req.body);
    if (!validation.success) {
      return sendValidationError(res, validation);
    }

    const service = await Service.create(validation.data);

    return res.status(201).json({ message: "Tạo dịch vụ thành công.", service });
  } catch (error) {
    return handleServiceWriteError(error, res);
  }
};

export const updateService = async (req, res) => {
  try {
    const validation = updateServiceDto.safeParse(req.body);
    if (!validation.success) {
      return sendValidationError(res, validation);
    }

    const service = await Service.findByIdAndUpdate(req.params.id, validation.data, {
      new: true,
      runValidators: true,
      context: "query",
    });
    if (!service) {
      return res.status(404).json({ message: "Không tìm thấy dịch vụ." });
    }

    return res.status(200).json({ message: "Cập nhật dịch vụ thành công.", service });
  } catch (error) {
    return handleServiceWriteError(error, res);
  }
};

export const deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true, runValidators: true, context: "query" },
    );
    if (!service) {
      return res.status(404).json({ message: "Không tìm thấy dịch vụ." });
    }

    return res.status(200).json({ message: "Đã ngừng cung cấp dịch vụ.", service });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};
