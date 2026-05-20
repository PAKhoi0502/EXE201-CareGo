import { Link } from "react-router";
import { Button, Card, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const CompanionHomePage = () => {
  const { user } = useAuth();
  const profile = user?.companionProfile;

  return (
    <>
      <PageHeader
        title="Trang nguoi dong hanh"
        subtitle="Quan ly ca cham soc va cap nhat bao cao cho gia dinh."
        action={<Link to="/companion/bookings"><Button>Xem ca lam</Button></Link>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-950">Trang thai kiem duyet</h2>
            <StatusBadge status={profile?.vettingStatus || "pending"} />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Chi khi ho so duoc admin duyet, ban moi co the nhan va cap nhat ca lam.
          </p>
        </Card>
        <Card>
          <h2 className="font-bold text-slate-950">{profile?.fullName || user?.name}</h2>
          <p className="mt-2 text-sm text-slate-500">{profile?.university || "Chua cap nhat truong"}</p>
          <p className="text-sm text-slate-500">{profile?.major || "Chua cap nhat nganh"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile?.skills?.map((skill) => (
              <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                {skill}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
};

export default CompanionHomePage;
