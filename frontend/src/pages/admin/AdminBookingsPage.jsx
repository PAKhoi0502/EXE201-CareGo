import { api } from "../../api/client.js";
import { Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const AdminBookingsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/admin/bookings"), []);
  const bookings = data?.bookings || [];

  return (
    <>
      <PageHeader title="Tat ca booking" subtitle="Theo doi trang thai van hanh ca cham soc." />
      {loading ? <p>Dang tai...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && bookings.length === 0 ? <EmptyState title="Chua co booking" /> : null}
      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking._id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{booking.serviceId?.name}</h2>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Customer: {booking.customerId?.email} - Companion: {booking.companionId?.email}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {booking.elderProfileId?.fullName} - {dateTime(booking.startTime)}
                </p>
              </div>
              <p className="text-sm font-bold text-teal-700">{money(booking.totalAmount)}</p>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default AdminBookingsPage;
