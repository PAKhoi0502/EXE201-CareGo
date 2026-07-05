import { useRef, useState } from "react";
import { uploadImage } from "../api/client.js";
import { Button } from "./Ui.jsx";

const ImageUpload = ({ label, folder, value = [], onUploaded, locked = false, compact = false }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Normalize value to array
  const images = Array.isArray(value) ? value : (value ? [value] : []);

  const handleFiles = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    setError("");
    try {
      const uploadPromises = Array.from(files).map((file) =>
        uploadImage({ file, folder })
      );
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map((data) => data.url);
      onUploaded([...images, ...newUrls]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeImage = (index) => {
    const updated = images.filter((_, i) => i !== index);
    onUploaded(updated);
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-500">
            {locked ? "Ảnh đã được xác nhận và không thể thay đổi." : "Chụp ảnh bằng điện thoại hoặc tải ảnh từ máy. Có thể upload nhiều ảnh."}
          </p>
        </div>
        {!locked ? (
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? "Đang tải ảnh lên..." : "Chọn/chụp ảnh"}
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
          {images.map((imageUrl, index) => (
            <div key={imageUrl} className="relative">
              <a href={imageUrl} target="_blank" rel="noreferrer" className={compact ? "block" : "block"}>
                <img
                  src={imageUrl}
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
                  Xóa
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
