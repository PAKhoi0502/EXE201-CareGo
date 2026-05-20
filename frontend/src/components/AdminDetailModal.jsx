import { Button, StatusBadge } from "./Ui.jsx";

const valueOrEmpty = (value) => {
  if (value === null || value === undefined || value === "") return "Chua cap nhat";
  return value;
};

export const DetailGrid = ({ children }) => (
  <div className="grid gap-3 sm:grid-cols-2">{children}</div>
);

export const DetailItem = ({ label, value, children }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <div className="mt-1 text-sm font-semibold text-slate-800">{children || valueOrEmpty(value)}</div>
  </div>
);

export const DetailTags = ({ items = [], tone = "teal", empty = "Chua cap nhat" }) => {
  const colors = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };
  const list = items.length ? items : [empty];

  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((item) => (
        <span key={item} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${colors[tone] || colors.teal}`}>
          {item}
        </span>
      ))}
    </div>
  );
};

const AdminDetailModal = ({ title, subtitle, status, children, onClose }) => {
  if (!onClose) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-100 bg-white p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              {status ? <StatusBadge status={status} /> : null}
            </div>
            {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={onClose}>
            Dong
          </Button>
        </div>
        <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

export default AdminDetailModal;
