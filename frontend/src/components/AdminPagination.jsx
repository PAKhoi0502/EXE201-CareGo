import { Button } from "./Ui.jsx";

const AdminPagination = ({ pagination, loading, onPageChange, itemLabel = "bản ghi" }) => {
  const page = Number(pagination?.page || 1);
  const limit = Number(pagination?.limit || 25);
  const total = Number(pagination?.total || 0);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const start = total ? (page - 1) * limit + 1 : 0;
  const end = total ? Math.min(page * limit, total) : 0;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="font-medium text-slate-500">
        Hiển thị {start}-{end} trong {total} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-8 px-3 text-xs"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          Trang trước
        </Button>
        <span className="min-w-20 text-center font-semibold text-slate-600">
          Trang {page}/{totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          className="min-h-8 px-3 text-xs"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
        >
          Trang sau
        </Button>
      </div>
    </div>
  );
};

export default AdminPagination;
