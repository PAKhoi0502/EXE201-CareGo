import { api } from "../../api/client.js";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";

const AdminUsersPage = () => {
  const { data, loading, error, reload } = useAsync(() => api.get("/admin/users"), []);
  const users = data?.users || [];

  const toggleStatus = async (user) => {
    await api.patch(`/admin/users/${user._id}/status`, { isActive: !user.isActive });
    reload();
  };

  return (
    <>
      <PageHeader title="Nguoi dung" subtitle="Quan ly tai khoan customer, companion va admin." />
      {loading ? <p>Dang tai...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && users.length === 0 ? <EmptyState title="Chua co nguoi dung" /> : null}
      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user._id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{user.name}</h2>
                  <StatusBadge status={user.role} />
                  <StatusBadge status={user.isActive ? "approved" : "suspended"} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
              </div>
              <Button variant={user.isActive ? "danger" : "secondary"} onClick={() => toggleStatus(user)}>
                {user.isActive ? "Khoa tai khoan" : "Mo tai khoan"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default AdminUsersPage;
