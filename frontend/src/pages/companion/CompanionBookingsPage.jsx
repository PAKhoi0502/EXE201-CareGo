import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const CompanionBookingsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/bookings/my"), []);
  const bookings = data?.bookings || [];

  return (
    <>
      <PageHeader title="Ca lam cua toi" subtitle="Cac ca gia dinh da dat ban lam nguoi dong hanh." />
      {loading ? <p>Dang tai...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && bookings.length === 0 ? <EmptyState title="Chua co ca lam" /> : null}
      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking._id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{booking.serviceId?.name}</h2>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {booking.elderProfileId?.fullName} - {dateTime(booking.startTime)}
                </p>
                <p className="mt-1 text-sm font-semibold text-teal-700">{money(booking.totalAmount - booking.platformFee)}</p>
              </div>
              <Link to={`/companion/bookings/${booking._id}`}>
                <Button variant="secondary">Cap nhat ca</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default CompanionBookingsPage;
