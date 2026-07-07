import cloudinary from "../config/cloudinary.js";

export const CLOUDINARY_AUTHENTICATED_PREFIX = "cloudinary-auth:";

const normalizeRefText = (value) => String(value || "").trim();

export const isCloudinaryAuthenticatedRef = (value) =>
  normalizeRefText(value).startsWith(CLOUDINARY_AUTHENTICATED_PREFIX);

export const createCloudinaryAuthenticatedRef = ({ publicId, version, format } = {}) => {
  const cleanPublicId = normalizeRefText(publicId);
  if (!cleanPublicId) return "";

  const cleanVersion = Number(version);
  const versionPart = Number.isFinite(cleanVersion) && cleanVersion > 0 ? String(cleanVersion) : "";
  const formatPart = normalizeRefText(format);

  return `${CLOUDINARY_AUTHENTICATED_PREFIX}${encodeURIComponent(cleanPublicId)}:${versionPart}:${formatPart}`;
};

export const parseCloudinaryAuthenticatedRef = (value) => {
  const normalizedValue = normalizeRefText(value);
  if (!normalizedValue.startsWith(CLOUDINARY_AUTHENTICATED_PREFIX)) {
    return null;
  }

  const payload = normalizedValue.slice(CLOUDINARY_AUTHENTICATED_PREFIX.length);
  const [encodedPublicId = "", rawVersion = "", rawFormat = ""] = payload.split(":");
  const publicId = decodeURIComponent(encodedPublicId || "");
  if (!publicId) {
    return null;
  }

  const version = Number(rawVersion);
  return {
    publicId,
    version: Number.isFinite(version) && version > 0 ? version : undefined,
    format: normalizeRefText(rawFormat) || undefined,
  };
};

export const buildCloudinaryAuthenticatedUrl = (value) => {
  const parsedValue = typeof value === "string" ? parseCloudinaryAuthenticatedRef(value) : value;
  if (!parsedValue?.publicId) {
    return normalizeRefText(value);
  }

  const options = {
    resource_type: "image",
    type: "authenticated",
    secure: true,
    sign_url: true,
  };

  if (parsedValue.version) {
    options.version = parsedValue.version;
  }

  if (parsedValue.format) {
    options.format = parsedValue.format;
  }

  return cloudinary.url(parsedValue.publicId, options);
};
