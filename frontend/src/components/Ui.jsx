export const Card = ({ children, className = "", ...props }) => (
  <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

export const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const variants = {
    primary: "bg-teal-700 text-white hover:bg-teal-800",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    muted: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  };

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input = ({ label, className = "", ...props }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
    <input
      className={`min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 ${className}`}
      {...props}
    />
  </label>
);

export const Textarea = ({ label, className = "", ...props }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
    <textarea
      className={`min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 ${className}`}
      {...props}
    />
  </label>
);

export const Select = ({ label, children, className = "", ...props }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
    <select
      className={`min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 ${className}`}
      {...props}
    >
      {children}
    </select>
  </label>
);

export const StatusBadge = ({ status }) => {
  const styles = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    accepted: "bg-sky-50 text-sky-700 ring-sky-200",
    in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    completed: "bg-slate-100 text-slate-700 ring-slate-200",
    paid: "bg-teal-50 text-teal-700 ring-teal-200",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
    rejected: "bg-rose-50 text-rose-700 ring-rose-200",
    suspended: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const labels = {
    pending: "Chờ xử lý",
    approved: "Đã duyệt",
    accepted: "Đã nhận",
    in_progress: "Đang diễn ra",
    completed: "Hoàn thành",
    paid: "Đã thanh toán",
    cancelled: "Đã hủy",
    rejected: "Từ chối",
    suspended: "Tạm khóa",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[status] || styles.completed}`}>
      {labels[status] || "Không rõ"}
    </span>
  );
};

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ title = "Chưa có dữ liệu", children }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
    <p className="font-semibold text-slate-800">{title}</p>
    {children ? <div className="mt-2 text-sm text-slate-500">{children}</div> : null}
  </div>
);
