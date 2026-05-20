import { Link } from "react-router";
import { Button, Card, PageHeader } from "../../components/Ui.jsx";

const CustomerHomePage = () => (
  <>
    <PageHeader
      title="Tong quan gia dinh"
      subtitle="Dat lich, theo doi va nhan bao cao cham soc trong mot noi."
      action={
        <Link to="/customer/bookings/new">
          <Button>Dat lich moi</Button>
        </Link>
      }
    />
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <p className="text-sm text-slate-500">Buoc 1</p>
        <h2 className="mt-1 font-bold text-slate-950">Tao ho so nguoi than</h2>
        <p className="mt-2 text-sm text-slate-500">Luu dia chi, benh nen, thuoc va lien he khan cap.</p>
      </Card>
      <Card>
        <p className="text-sm text-slate-500">Buoc 2</p>
        <h2 className="mt-1 font-bold text-slate-950">Chon dich vu va nguoi dong hanh</h2>
        <p className="mt-2 text-sm text-slate-500">Chi hien thi cac ho so companion da duoc admin duyet.</p>
      </Card>
      <Card>
        <p className="text-sm text-slate-500">Buoc 3</p>
        <h2 className="mt-1 font-bold text-slate-950">Theo doi ca lam</h2>
        <p className="mt-2 text-sm text-slate-500">Xem trang thai, GPS, anh xac nhan, checklist va ghi chu.</p>
      </Card>
    </div>
  </>
);

export default CustomerHomePage;
