import { Link } from "react-router";
import { Button, Card, PageHeader } from "../../components/Ui.jsx";

const CustomerHomePage = () => (
  <div className="space-y-6">
    <PageHeader
      title="Tổng quan gia đình"
      subtitle="Đặt lịch, theo dõi và nhận báo cáo chăm sóc trong một nơi."
      action={
        <Link to="/customer/bookings/new">
          <Button>Đặt lịch mới</Button>
        </Link>
      }
    />
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-teal-100 bg-[#f7fffe]">
        <p className="text-sm text-slate-500">Bước 1</p>
        <h2 className="mt-1 font-bold text-slate-950">Tạo hồ sơ người thân</h2>
        <p className="mt-2 text-sm text-slate-500">Lưu địa chỉ, bệnh nền, thuốc và liên hệ khẩn cấp.</p>
      </Card>
      <Card className="border-teal-100 bg-[#f7fffe]">
        <p className="text-sm text-slate-500">Bước 2</p>
        <h2 className="mt-1 font-bold text-slate-950">Chọn dịch vụ và người đồng hành</h2>
        <p className="mt-2 text-sm text-slate-500">Chỉ hiển thị hồ sơ đã được admin duyệt.</p>
      </Card>
      <Card className="border-teal-100 bg-[#f7fffe]">
        <p className="text-sm text-slate-500">Bước 3</p>
        <h2 className="mt-1 font-bold text-slate-950">Theo dõi ca làm</h2>
        <p className="mt-2 text-sm text-slate-500">Xem trạng thái, GPS, ảnh xác nhận, checklist và ghi chú.</p>
      </Card>
    </div>
  </div>
);

export default CustomerHomePage;
