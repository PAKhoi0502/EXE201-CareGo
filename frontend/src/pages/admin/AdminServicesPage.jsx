import { useMemo, useState } from "react";
import { api } from "../../api/client.js";
import AdminDetailModal, { DetailGrid, DetailItem, DetailTags } from "../../components/AdminDetailModal.jsx";
import { Button, Input, Select, StatusBadge, Textarea } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const emptyForm = { name: "", code: "", description: "", pricePerHour: 80000, checklistText: "" };

const serviceCategory = (code = "", name = "") => {
  const text = `${code} ${name}`.toLowerCase();
  if (text.includes("hospital") || text.includes("kham") || text.includes("vien")) return "hospital";
  if (text.includes("home") || text.includes("thuoc") || text.includes("nha")) return "home";
  if (text.includes("walk") || text.includes("dao")) return "walk";
  return "other";
};

const categoryLabel = {
  all: "Tất cả",
  hospital: "Đi viện",
  home: "Tại nhà",
  walk: "Đi dạo",
  other: "Khác",
};

const AdminServicesPage = () => {
  const { data, reload, error: loadError } = useAsync(() => api.get("/services"), []);
  const [form, setForm] = useState(emptyForm);
  const [submitError, setSubmitError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState("");
  const [selectedService, setSelectedService] = useState(null);
  const services = data?.services || [];

  const filteredServices = services.filter((service) => {
    const text = `${service.name} ${service.code} ${service.description}`.toLowerCase();
    const category = serviceCategory(service.code, service.name);
    return text.includes(query.toLowerCase()) && (categoryFilter === "all" || category === categoryFilter);
  });

  const averagePrice = useMemo(() => {
    if (!services.length) return 0;
    return services.reduce((sum, item) => sum + (item.pricePerHour || 0), 0) / services.length;
  }, [services]);

  const checklistCount = services.reduce((sum, item) => sum + (item.defaultChecklist?.length || 0), 0);

  const closeModal = () => {
    setIsModalOpen(false);
    setSubmitError("");
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setEditForm({
      name: service.name || "",
      code: service.code || "",
      description: service.description || "",
      pricePerHour: service.pricePerHour ?? 0,
      checklistText: (service.defaultChecklist || []).join(", "),
    });
    setEditError("");
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingService(null);
    setEditError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    try {
      await api.post("/services", {
        name: form.name,
        code: form.code,
        description: form.description,
        pricePerHour: Number(form.pricePerHour),
        defaultChecklist: form.checklistText.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setForm(emptyForm);
      closeModal();
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const disable = async (id) => {
    await api.delete(`/services/${id}`);
    reload();
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editingService) return;
    setEditError("");
    try {
      await api.put(`/services/${editingService._id}`, {
        name: editForm.name,
        code: editForm.code,
        description: editForm.description,
        pricePerHour: Number(editForm.pricePerHour),
        defaultChecklist: editForm.checklistText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      closeEditModal();
      reload();
    } catch (err) {
      setEditError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý dịch vụ</h1>
          <p className="mt-1 text-sm text-slate-500">
            Thiết lập gói CareGo, giá theo giờ và checklist vận hành mặc định.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <Button className="whitespace-nowrap" onClick={() => setIsModalOpen(true)}>
            Tạo dịch vụ
          </Button>
          <div className="relative w-full xl:w-96">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm dịch vụ, mã, mô tả..."
              className="min-h-11 w-full rounded-xl border border-transparent bg-slate-100 px-4 pl-10 text-sm outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
          </div>
        </div>
      </div>

      {loadError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{loadError}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tổng dịch vụ</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{services.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Giá trung bình</span>
          <p className="mt-2 text-2xl font-bold text-teal-700">{money(averagePrice)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="block text-xs font-medium text-amber-600">Tổng checklist</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{checklistCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Dịch vụ hiển thị</span>
          <p className="mt-2 text-2xl font-bold text-blue-700">{filteredServices.length}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Danh sách gói dịch vụ</h2>
            <p className="mt-1 text-xs text-slate-400">
              Giá dịch vụ là cơ sở tính tổng tiền booking và phí nền tảng.
            </p>
          </div>
          <Select
            label="Phân loại"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="sm:w-48"
          >
            {Object.entries(categoryLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-400">
                <th className="p-4">Dịch vụ</th>
                <th className="p-4">Phân loại</th>
                <th className="p-4">Giá theo giờ</th>
                <th className="p-4">Checklist mặc định</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredServices.map((service) => {
                const category = serviceCategory(service.code, service.name);

                return (
                  <tr key={service._id} className="hover:bg-slate-50/80">
                    <td className="p-4">
                      <p className="text-sm font-bold text-slate-800">{service.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{service.code}</p>
                      <p className="mt-2 max-w-md text-xs text-slate-500">{service.description || "Chưa có mô tả"}</p>
                    </td>
                    <td className="p-4">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {categoryLabel[category]}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-teal-700">{money(service.pricePerHour)}</p>
                      <p className="text-[11px] text-slate-400">mỗi giờ</p>
                    </td>
                    <td className="p-4">
                      <div className="flex max-w-lg flex-wrap gap-1">
                        {(service.defaultChecklist?.length ? service.defaultChecklist : ["Chưa có checklist"]).slice(0, 6).map((item) => (
                          <span key={item} className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={service.isActive ? "approved" : "suspended"} />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="secondary"
                          className="min-h-8 px-2.5 text-xs"
                          onClick={() => openEditModal(service)}
                        >
                          Chỉnh sửa
                        </Button>
                        <Button variant="muted" className="min-h-8 px-2.5 text-xs" onClick={() => setSelectedService(service)}>
                          Chi tiết
                        </Button>
                        <Button variant="danger" className="min-h-8 px-2.5 text-xs" onClick={() => disable(service._id)}>
                          Ẩn dịch vụ
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredServices.length ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-sm text-slate-400">
                    Không tìm thấy dịch vụ phù hợp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div>
                <h2 className="font-bold text-slate-900">Tạo dịch vụ CareGo</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Checklist sẽ được copy vào ca làm khi khách hàng đặt dịch vụ này.
                </p>
              </div>
              <button
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
                onClick={closeModal}
                type="button"
              >
                Đóng
              </button>
            </div>

            <form className="grid gap-4 p-5" onSubmit={submit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Tên dịch vụ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input label="Mã dịch vụ" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <Input label="Giá theo giờ" type="number" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
              <Textarea label="Mô tả" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input
                label="Checklist mặc định, cách nhau bằng dấu phẩy"
                value={form.checklistText}
                onChange={(e) => setForm({ ...form, checklistText: e.target.value })}
              />
              {submitError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{submitError}</p> : null}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Hủy
                </Button>
                <Button>Tạo dịch vụ</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div>
                <h2 className="font-bold text-slate-900">Chỉnh sửa dịch vụ</h2>
                <p className="mt-1 text-xs text-slate-400">Cập nhật thông tin gói dịch vụ CareGo.</p>
              </div>
              <button
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
                onClick={closeEditModal}
                type="button"
              >
                Đóng
              </button>
            </div>

            <form className="grid gap-4 p-5" onSubmit={submitEdit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Tên dịch vụ"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <Input
                  label="Mã dịch vụ"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                />
              </div>
              <Input
                label="Giá theo giờ"
                type="number"
                value={editForm.pricePerHour}
                onChange={(e) => setEditForm({ ...editForm, pricePerHour: e.target.value })}
              />
              <Textarea
                label="Mô tả"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
              <Input
                label="Checklist mặc định, cách nhau bằng dấu phẩy"
                value={editForm.checklistText}
                onChange={(e) => setEditForm({ ...editForm, checklistText: e.target.value })}
              />
              {editError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{editError}</p> : null}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={closeEditModal}>
                  Hủy
                </Button>
                <Button>Cập nhật</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedService ? (
        <AdminDetailModal
          title={selectedService.name}
          subtitle={`Mã dịch vụ: ${selectedService.code}`}
          status={selectedService.isActive ? "approved" : "suspended"}
          onClose={() => setSelectedService(null)}
        >
          <div className="space-y-5">
            <DetailGrid>
              <DetailItem label="ID dịch vụ" value={selectedService._id} />
              <DetailItem label="Phân loại" value={categoryLabel[serviceCategory(selectedService.code, selectedService.name)]} />
              <DetailItem label="Giá theo giờ" value={money(selectedService.pricePerHour)} />
              <DetailItem label="Trạng thái" value={selectedService.isActive ? "Đang hiển thị" : "Đang ẩn"} />
              <DetailItem label="Ngày tạo" value={dateTime(selectedService.createdAt)} />
              <DetailItem label="Cập nhật lần cuối" value={dateTime(selectedService.updatedAt)} />
            </DetailGrid>

            <section className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">Mô tả dịch vụ</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{selectedService.description || "Chưa có mô tả."}</p>
            </section>

            <section className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">Checklist mặc định</h3>
              <div className="mt-3">
                <DetailTags items={selectedService.defaultChecklist || []} tone="teal" empty="Chua co checklist" />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Checklist này sẽ được đưa vào booking để người đồng hành gạt theo thứ tự khi thực hiện ca.
              </p>
            </section>
          </div>
        </AdminDetailModal>
      ) : null}
    </div>
  );
};

export default AdminServicesPage;
