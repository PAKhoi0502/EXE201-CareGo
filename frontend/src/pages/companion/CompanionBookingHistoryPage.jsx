import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const CompanionBookingHistoryPage = () => {
    const { data, loading, error } = useAsync(() => api.get("/bookings/my?as=companion"), []);
    const bookings = data?.bookings || [];
    const completedBookings = bookings.filter((booking) => ["completed", "paid"].includes(booking.status));
    const paidEarnings = completedBookings
        .filter((booking) => booking.status === "paid")
        .reduce((sum, booking) => sum + (booking.totalAmount - booking.platformFee), 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Lịch sử hoàn thành"
                subtitle="Tổng hợp các ca đã hoàn thành và đã thanh toán."
                action={
                    <Link to="/companion/bookings">
                        <Button variant="secondary">Quay lại ca làm</Button>
                    </Link>
                }
            />

            <section className="rounded-[28px] border border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-emerald-100 bg-[#f7fffe] px-4 py-3 text-sm">
                        <p className="text-xs font-semibold text-slate-400">Ca đã hoàn thành</p>
                        <p className="mt-1 text-lg font-black text-emerald-700">{completedBookings.length}</p>
                    </div>
                    <div className="rounded-[18px] border border-emerald-100 bg-[#f7fffe] px-4 py-3 text-sm">
                        <p className="text-xs font-semibold text-slate-400">Thu nhập đã nhận</p>
                        <p className="mt-1 text-lg font-black text-emerald-700">{money(paidEarnings)}</p>
                    </div>
                </div>
            </section>

            {loading ? <p>Đang tải...</p> : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {!loading && completedBookings.length === 0 ? <EmptyState title="Chưa có ca hoàn thành" /> : null}

            <div className="grid gap-4">
                {completedBookings.map((booking) => (
                    <Card key={booking._id} className="border-emerald-100 bg-white/95 shadow-xl shadow-emerald-900/5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-bold text-slate-950">{booking.serviceId?.name}</h2>
                                    <StatusBadge status={booking.status} />
                                </div>
                                <p className="mt-1 text-sm text-slate-500">
                                    {booking.elderProfileId?.fullName} • {dateTime(booking.startTime)}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-emerald-700">
                                    Thu nhập: {money(booking.totalAmount - booking.platformFee)}
                                </p>
                            </div>
                            <Link to={`/companion/bookings/${booking._id}`}>
                                <Button variant="secondary">Xem chi tiết</Button>
                            </Link>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default CompanionBookingHistoryPage;
