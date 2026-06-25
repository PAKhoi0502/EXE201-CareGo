import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import AdminLayout from "./layouts/AdminLayout.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { getUserHomePath, hasRoleAccess, needsCompanionApproval } from "./utils/authNavigation.js";

const AdminBlogsPage = lazy(() => import("./pages/admin/AdminBlogsPage.jsx"));
const AdminBookingsPage = lazy(() => import("./pages/admin/AdminBookingsPage.jsx"));
const AdminCompanionsPage = lazy(() => import("./pages/admin/AdminCompanionsPage.jsx"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage.jsx"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage.jsx"));
const AdminServicesPage = lazy(() => import("./pages/admin/AdminServicesPage.jsx"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage.jsx"));
const AdminWithdrawalsPage = lazy(() => import("./pages/admin/AdminWithdrawalsPage.jsx"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage.jsx"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage.jsx"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage.jsx"));
const RegisterCompanionPage = lazy(() => import("./pages/auth/RegisterCompanionPage.jsx"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage.jsx"));
const VerifyEmailPage = lazy(() => import("./pages/auth/VerifyEmailPage.jsx"));
const BlogDetailPage = lazy(() => import("./pages/BlogDetailPage.jsx"));
const BlogPage = lazy(() => import("./pages/BlogPage.jsx"));
const CompanionBookingDetailPage = lazy(() => import("./pages/companion/CompanionBookingDetailPage.jsx"));
const CompanionBookingHistoryPage = lazy(() => import("./pages/companion/CompanionBookingHistoryPage.jsx"));
const CompanionBookingsPage = lazy(() => import("./pages/companion/CompanionBookingsPage.jsx"));
const CompanionEarningsPage = lazy(() => import("./pages/companion/CompanionEarningsPage.jsx"));
const CompanionProfilePage = lazy(() => import("./pages/companion/CompanionProfilePage.jsx"));
const CompanionStatusPage = lazy(() => import("./pages/companion/CompanionStatusPage.jsx"));
const CompanionWithdrawalsPage = lazy(() => import("./pages/companion/CompanionWithdrawalsPage.jsx"));
const CustomerBookingDetailPage = lazy(() => import("./pages/customer/CustomerBookingDetailPage.jsx"));
const CustomerBookingsPage = lazy(() => import("./pages/customer/CustomerBookingsPage.jsx"));
const CustomerCompanionsPage = lazy(() => import("./pages/customer/CustomerCompanionsPage.jsx"));
const CustomerEldersPage = lazy(() => import("./pages/customer/CustomerEldersPage.jsx"));
const CustomerProfilePage = lazy(() => import("./pages/customer/CustomerProfilePage.jsx"));
const CustomerServicesPage = lazy(() => import("./pages/customer/CustomerServicesPage.jsx"));
const NewBookingPage = lazy(() => import("./pages/customer/NewBookingPage.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const SupportPage = lazy(() => import("./pages/support/SupportPage.jsx"));

const LoadingFallback = () => <div className="p-6 text-sm text-slate-500">Đang tải...</div>;

const RoleRoute = ({ role, children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRoleAccess(user, role)) {
    return <Navigate to={getUserHomePath(user)} replace />;
  }

  if (role === "companion" && needsCompanionApproval(user)) {
    return <Navigate to="/companion-status" replace />;
  }

  return children;
};

const HomeRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  const homePath = getUserHomePath(user);
  if (homePath !== "/") {
    return <Navigate to={homePath} replace />;
  }

  return <LandingPage />;
};

const App = () => (
  <Suspense fallback={<LoadingFallback />}>
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/companion-register" element={<RegisterCompanionPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/companion-status" element={<CompanionStatusPage />} />

      <Route
        path="/customer"
        element={
          <RoleRoute role="customer">
            <AppLayout />
          </RoleRoute>
        }
      >
        <Route index element={<Navigate to="bookings" replace />} />
        <Route path="profile" element={<CustomerProfilePage />} />
        <Route path="services" element={<CustomerServicesPage />} />
        <Route path="elders" element={<CustomerEldersPage />} />
        <Route path="companions" element={<CustomerCompanionsPage />} />
        <Route path="bookings/new" element={<NewBookingPage />} />
        <Route path="bookings" element={<CustomerBookingsPage />} />
        <Route path="bookings/:id" element={<CustomerBookingDetailPage />} />
        <Route path="support" element={<SupportPage />} />
      </Route>

      <Route
        path="/companion"
        element={
          <RoleRoute role="companion">
            <AppLayout />
          </RoleRoute>
        }
      >
        <Route index element={<Navigate to="bookings" replace />} />
        <Route path="profile" element={<CompanionProfilePage />} />
        <Route path="bookings" element={<CompanionBookingsPage />} />
        <Route path="bookings/history" element={<CompanionBookingHistoryPage />} />
        <Route path="bookings/:id" element={<CompanionBookingDetailPage />} />
        <Route path="earnings" element={<CompanionEarningsPage />} />
        <Route path="withdrawals" element={<CompanionWithdrawalsPage />} />
        <Route path="support" element={<SupportPage />} />
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
        <Route path="blogs" element={<AdminBlogsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="support" element={<AdminSupportPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

export default App;
