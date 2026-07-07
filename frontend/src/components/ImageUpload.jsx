import { useRef, useState } from "react";
import { uploadImage } from "../api/client.js";
import { Button } from "./Ui.jsx";

const normalizeImageItem = (item) => {
  if (!item) {
    return null;
  }

  if (typeof item === "string") {
    const value = item.trim();
    return value ? { value, previewUrl: value } : null;
  }

  if (typeof item === "object") {
    const value = String(item.value || item.url || "").trim();
    const previewUrl = String(item.previewUrl || item.url || value).trim();
    if (!value && !previewUrl) {
      return null;
    }

    return {
      value: value || previewUrl,
      previewUrl: previewUrl || value,
    };
  }

  return null;
};

const normalizeImageList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeImageItem).filter(Boolean);
  }

  const imageItem = normalizeImageItem(value);
  return imageItem ? [imageItem] : [];
};

const serializeImageList = (images, storeUploadReference) =>
  storeUploadReference
    ? images.map((image) => ({ value: image.value, previewUrl: image.previewUrl }))
    : images.map((image) => image.previewUrl || image.value);

const ImageUpload = ({
  label,
  folder,
  value = [],
  onUploaded,
  locked = false,
  compact = false,
  storeUploadReference = false,
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const images = normalizeImageList(value);

  const handleFiles = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    setError("");
    try {
      const uploadPromises = Array.from(files).map((file) => uploadImage({ file, folder }));
      const results = await Promise.all(uploadPromises);
      const newImages = results
        .map((data) =>
          normalizeImageItem(
            storeUploadReference
              ? { value: data.storageRef || data.url, previewUrl: data.url || data.storageRef }
              : data.url,
          ),
        )
        .filter(Boolean);
      onUploaded(serializeImageList([...images, ...newImages], storeUploadReference));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeImage = (index) => {
    const updated = images.filter((_, imageIndex) => imageIndex !== index);
    onUploaded(serializeImageList(updated, storeUploadReference));
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-500">
            {locked ? "áº¢nh Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n vÃ  khÃ´ng thá»ƒ thay Ä‘á»•i." : "Chá»¥p áº£nh báº±ng Ä‘iá»‡n thoáº¡i hoáº·c táº£i áº£nh tá»« mÃ¡y. CÃ³ thá»ƒ upload nhiá»u áº£nh."}
          </p>
        </div>
        {!locked ? (
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? "Äang táº£i áº£nh lÃªn..." : "Chá»n/chá»¥p áº£nh"}
          </Button>
        ) : null}
      </div>
      {!locked ? (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      ) : null}
      {images.length > 0 ? (
        <div className={compact ? "flex flex-wrap gap-2" : "grid gap-2"}>
          {images.map((image, index) => (
            <div key={image.value || image.previewUrl} className="relative">
              <a href={image.previewUrl || image.value} target="_blank" rel="noreferrer" className="block">
                <img
                  src={image.previewUrl || image.value}
                  alt={`${label} ${index + 1}`}
                  className={
                    compact
                      ? "h-24 w-28 rounded-2xl border border-teal-200 object-cover shadow-lg shadow-teal-900/10"
                      : "max-h-64 w-full rounded-md border border-slate-200 object-cover"
                  }
                />
              </a>
              {!locked ? (
                <Button
                  type="button"
                  variant="danger"
                  className="absolute -right-2 -top-2 w-fit rounded-full px-2 text-xs"
                  onClick={() => removeImage(index)}
                >
                  XÃ³a
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
};

export default ImageUpload;
