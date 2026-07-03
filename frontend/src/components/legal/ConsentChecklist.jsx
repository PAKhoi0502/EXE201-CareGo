import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/client.js";

const ConsentChecklist = ({ flow, onChange }) => {
  const [documents, setDocuments] = useState([]);
  const [acceptedTypes, setAcceptedTypes] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadRequirements = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.get(`/legal/requirements/${flow}`);
        if (!active) return;
        setDocuments(data.documents || []);
        setAcceptedTypes(new Set());
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    Promise.resolve().then(loadRequirements);
    return () => {
      active = false;
    };
  }, [flow]);

  const toggleDocument = (documentType) => {
    const nextTypes = new Set(acceptedTypes);
    if (nextTypes.has(documentType)) {
      nextTypes.delete(documentType);
    } else {
      nextTypes.add(documentType);
    }
    setAcceptedTypes(nextTypes);
    onChange(documents.map((document) => ({
      documentType: document.type,
      documentVersion: document.version,
      accepted: nextTypes.has(document.type),
    })));
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-500">Đang tải điều khoản...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>;
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
      <p className="text-sm font-black text-[#12312f]">Xác nhận điều khoản bắt buộc</p>
      {documents.map((document) => {
        const inputId = `legal-${flow}-${document.type}`;
        return (
          <div key={document.type} className="flex items-start gap-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-600">
            <input
              id={inputId}
              type="checkbox"
              checked={acceptedTypes.has(document.type)}
              onChange={() => toggleDocument(document.type)}
              className="mt-1 h-4 w-4 shrink-0 accent-teal-700"
            />
            <span>
              <label htmlFor={inputId} className="cursor-pointer">Tôi đã đọc và đồng ý với</label>{" "}
              <Link
                to={`/legal/${document.slug}`}
                target="_blank"
                rel="noreferrer"
                className="font-black text-teal-700 underline decoration-teal-300 underline-offset-2"
              >
                {document.title}
              </Link>
              <span className="ml-1 text-xs text-slate-400">({document.version})</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ConsentChecklist;
