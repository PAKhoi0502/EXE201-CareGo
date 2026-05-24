import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./context/AuthContext.jsx";
import AdminBookingsPage from "./pages/admin/AdminBookingsPage.jsx";
import AdminCompanionsPage from "./pages/admin/AdminCompanionsPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminReportsPage from "./pages/admin/AdminReportsPage.jsx";
import AdminServicesPage from "./pages/admin/AdminServicesPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import RegisterCompanionPage from "./pages/auth/RegisterCompanionPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage.jsx";
import CompanionBookingDetailPage from "./pages/companion/CompanionBookingDetailPage.jsx";
import CompanionBookingsPage from "./pages/companion/CompanionBookingsPage.jsx";
import CompanionHomePage from "./pages/companion/CompanionHomePage.jsx";
import CompanionProfilePage from "./pages/companion/CompanionProfilePage.jsx";
import CustomerBookingDetailPage from "./pages/customer/CustomerBookingDetailPage.jsx";
import CustomerBookingsPage from "./pages/customer/CustomerBookingsPage.jsx";
import CustomerCompanionsPage from "./pages/customer/CustomerCompanionsPage.jsx";
import CustomerEldersPage from "./pages/customer/CustomerEldersPage.jsx";
import CustomerProfilePage from "./pages/customer/CustomerProfilePage.jsx";
import CustomerServicesPage from "./pages/customer/CustomerServicesPage.jsx";
import NewBookingPage from "./pages/customer/NewBookingPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";

const RoleRoute = ({ role, children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Dang tai...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children;
};

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/companion-register" element={<RegisterCompanionPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/customer"
        element={
          <RoleRoute role="customer">
            <AppLayout />
          </RoleRoute>
        }
      >
        <Route index element={<Navigate to="/" replace />} />
        <Route path="profile" element={<CustomerProfilePage />} />
        <Route path="services" element={<CustomerServicesPage />} />
        <Route path="elders" element={<CustomerEldersPage />} />
        <Route path="companions" element={<CustomerCompanionsPage />} />
        <Route path="bookings/new" element={<NewBookingPage />} />
        <Route path="bookings" element={<CustomerBookingsPage />} />
        <Route path="bookings/:id" element={<CustomerBookingDetailPage />} />
      </Route>

      <Route
        path="/companion"
        element={
          <RoleRoute role="companion">
            <AppLayout />
          </RoleRoute>
        }
      >
        <Route index element={<CompanionHomePage />} />
        <Route path="profile" element={<CompanionProfilePage />} />
        <Route path="bookings" element={<CompanionBookingsPage />} />
        <Route path="bookings/:id" element={<CompanionBookingDetailPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RoleRoute role="admin">
            <AdminLayout />
          </RoleRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="services" element={<AdminServicesPage />} />
        <Route path="companions" element={<AdminCompanionsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="bookings" element={<AdminBookingsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
