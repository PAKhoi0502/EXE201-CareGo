import { useRef, useState } from "react";
import { uploadImage } from "../api/client.js";
import { Button } from "./Ui.jsx";

const ImageUpload = ({ label, folder, value, onUploaded }) => {
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
          <p className="text-xs text-slate-500">Chup anh bang dien thoai hoac tai anh tu may.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "Dang upload..." : "Chon/chup anh"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {value ? (
        <img src={value} alt={label} className="max-h-64 w-full rounded-md border border-slate-200 object-cover" />
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
};

export default ImageUpload;
