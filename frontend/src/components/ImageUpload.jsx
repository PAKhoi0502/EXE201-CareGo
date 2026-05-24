import { useRef, useState } from "react";
import { uploadImage } from "../api/client.js";
import { Button } from "./Ui.jsx";

const ImageUpload = ({ label, folder, value, onUploaded, locked = false, compact = false }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError("");
    try {
      const data = await uploadImage({ file, folder });
      onUploaded(data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-500">
            {locked ? "Ảnh đã được xác nhận và không thể thay đổi." : "Chụp ảnh bằng điện thoại hoặc tải ảnh từ máy."}
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
          className="hidden"
          onChange={handleFile}
        />
      ) : null}
      {value ? (
        <div className={compact ? "w-28" : "grid gap-2"}>
          <a href={value} target="_blank" rel="noreferrer" className={compact ? "block w-28" : "block"}>
            <img
              src={value}
              alt={label}
              className={
                compact
                  ? "h-24 w-28 rounded-2xl border border-teal-200 object-cover shadow-lg shadow-teal-900/10"
                  : "max-h-64 w-full rounded-md border border-slate-200 object-cover"
              }
            />
          </a>
          {!locked ? (
            <Button type="button" variant="danger" className="w-fit" onClick={() => onUploaded("")}>
              Xóa ảnh, chụp lại
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
};

export default ImageUpload;
