import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const CustomerBookingsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/bookings/my"), []);
  const bookings = data?.bookings || [];

  return (
    <>
      <PageHeader
        title="Lich cua toi"
        subtitle="Theo doi tat ca ca cham soc da dat."
        action={<Link to="/customer/bookings/new"><Button>Dat lich moi</Button></Link>}
      />
      {loading ? <p>Dang tai...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && bookings.length === 0 ? <EmptyState title="Chua co booking" /> : null}
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
                  {booking.elderProfileId?.fullName} - {booking.companionId?.name} - {dateTime(booking.startTime)}
                </p>
                <p className="mt-1 text-sm font-semibold text-teal-700">{money(booking.totalAmount)}</p>
              </div>
              <Link to={`/customer/bookings/${booking._id}`}>
                <Button variant="secondary">Xem chi tiet</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default CustomerBookingsPage;
