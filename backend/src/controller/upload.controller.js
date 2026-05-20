import cloudinary from "../config/cloudinary.js";

export const uploadImageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "image file is required" });
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
      !process.env.CLOUDINARY_API_KEY?.trim() ||
      !process.env.CLOUDINARY_API_SECRET?.trim()
    ) {
      return res.status(500).json({ message: "cloudinary config is missing" });
    }

    const folder = req.body.folder || "carego";
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: "image",
    });

    return res.status(201).json({
      message: "image uploaded",
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "cloudinary upload failed",
      error: error.message,
    });
  }
};
