import cloudinary from "../config/cloudinary.js";
import {
  buildCloudinaryAuthenticatedUrl,
  createCloudinaryAuthenticatedRef,
} from "../utils/private-media.js";

const PRIVATE_IMAGE_FOLDER_PREFIX = "carego/companion-documents";

const isPrivateImageFolder = (folder) => {
  const normalizedFolder = String(folder || "").trim();
  return normalizedFolder === PRIVATE_IMAGE_FOLDER_PREFIX || normalizedFolder.startsWith(`${PRIVATE_IMAGE_FOLDER_PREFIX}/`);
};

export const uploadImageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng chọn ảnh cần tải lên." });
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
      !process.env.CLOUDINARY_API_KEY?.trim() ||
      !process.env.CLOUDINARY_API_SECRET?.trim()
    ) {
      return res.status(500).json({ message: "Dịch vụ lưu trữ ảnh chưa được cấu hình." });
    }

    const folder = req.body.folder || "carego";
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const shouldUsePrivateDelivery = isPrivateImageFolder(folder);
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: "image",
      ...(shouldUsePrivateDelivery ? { type: "authenticated" } : {}),
    });
    const storageRef = shouldUsePrivateDelivery
      ? createCloudinaryAuthenticatedRef({
          publicId: result.public_id,
          version: result.version,
          format: result.format,
        })
      : "";
    const url = shouldUsePrivateDelivery
      ? buildCloudinaryAuthenticatedUrl(storageRef)
      : result.secure_url;

    return res.status(201).json({
      message: "Tải ảnh lên thành công.",
      url,
      storageRef,
      publicId: result.public_id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Tải ảnh lên không thành công. Vui lòng thử lại.",
      error: error.message,
    });
  }
};
