import { useMemo, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/client.js";
import AdminPagination from "../../components/AdminPagination.jsx";
import { Button, Card, EmptyState, Input, PageHeader, Select, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const BOOKING_STATUS_FILTERS = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "accepted", label: "Đã nhận" },
  { value: "in_progress", label: "Đang diễn ra" },
  { value: "completed", label: "Hoàn thành" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "cancelled", label: "Đã hủy" },
];

const DEFAULT_FILTERS = {
  status: "all",
  dateFrom: "",
  dateTo: "",
  search: "",
};

const CustomerBookingsPage = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const bookingQuery = useMemo(() => {
    const params = new URLSearchParams({
      as: "customer",
      page: String(page),
      limit: "10",
    });

    if (appliedFilters.status !== "all") params.set("status", appliedFilters.status);
    if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);
    if (appliedFilters.search.trim()) params.set("search", appliedFilters.search.trim());

    return params.toString();
  }, [appliedFilters, page]);
  const { data, loading, error } = useAsync(() => api.get(`/bookings/my?${bookingQuery}`), [bookingQuery]);
  const bookings = data?.bookings || [];
  const pagination = data?.pagination;

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lịch của tôi"
        subtitle="Theo dõi tất cả ca chăm sóc đã đặt."
        action={<Link to="/customer/bookings/new"><Button>Đặt lịch mới</Button></Link>}
      />
      <Card className="border-teal-100">
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]" onSubmit={applyFilters}>
          <Select
            label="Trạng thái"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            {BOOKING_STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Select>
          <Input
            label="Từ ngày"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => updateFilter("dateFrom", event.target.value)}
          />
          <Input
            label="Đến ngày"
            type="date"
            value={filters.dateTo}
            onChange={(event) => updateFilter("dateTo", event.target.value)}
          />
          <Input
            label="Tìm kiếm"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Tên người thân, dịch vụ, companion, địa chỉ..."
          />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={loading}>Lọc</Button>
            <Button type="button" variant="secondary" onClick={clearFilters} disabled={loading}>
              Xóa
            </Button>
          </div>
        </form>
      </Card>
      {loading ? <p>Đang tải...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && bookings.length === 0 ? <EmptyState title="Chưa có lịch đặt" /> : null}
      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking._id} className="border-teal-100">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{booking.serviceId?.name}</h2>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {booking.elderProfileId?.fullName} - {booking.companionId?.name} - {dateTime(booking.startTime)}
                </p>
                <p className="mt-1 text-sm font-semibold text-teal-700">{money(booking.totalAmount)}</p>
              </div>
              <Link to={`/customer/bookings/${booking._id}`}>
                <Button variant="secondary">Xem chi tiết</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
      {pagination ? (
        <AdminPagination
          pagination={pagination}
          loading={loading}
          itemLabel="lịch"
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
};

export default CustomerBookingsPage;
