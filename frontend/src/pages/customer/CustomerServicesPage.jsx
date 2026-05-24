import { api } from "../../api/client.js";
import { Card, EmptyState, PageHeader } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

const CustomerServicesPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/services"), []);
  const services = data?.services || [];

  return (
    <div className="space-y-4">
      <PageHeader title="Dịch vụ CareGo" subtitle="Các gói chăm sóc theo giờ đang hoạt động." />
      {loading ? <p>Đang tải...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && services.length === 0 ? <EmptyState title="Chưa có dịch vụ" /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <Card key={service._id} className="border-teal-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{service.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{service.description}</p>
              </div>
              <p className="whitespace-nowrap text-sm font-bold text-teal-700">{money(service.pricePerHour)}/giờ</p>
            </div>
            {service.defaultChecklist?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {service.defaultChecklist.map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CustomerServicesPage;
