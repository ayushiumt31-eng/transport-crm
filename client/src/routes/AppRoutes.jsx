import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import MainLayout from '../components/common/MainLayout';
import { allModulePaths, canAccessPath, moduleByPath } from '../config/navigation';
import { LoginPage, RegisterPage } from '../pages/Auth/LoginPage';
import BookingManagement from '../pages/Booking/BookingManagement';
import CustomerKycPortal from '../pages/Customer/CustomerKycPortal';
import CustomerManagement from '../pages/Customer/CustomerManagement';
import DashboardOverview from '../pages/Dashboard/DashboardOverview';
import VehicleManagement from '../pages/Fleet/VehicleManagement';
import FleetAllocation from '../pages/Fleet/FleetAllocation';
import TripManagement from '../pages/Trips/TripManagement';
import ModuleWorkspace from '../pages/ModuleWorkspace';

function moduleElement(path) {
  if (path === '/crm/customers') return <CustomerManagement />;
  if (path === '/crm/portal') return <CustomerKycPortal />;
  if (path === '/crm/history' || path.startsWith('/bookings/')) return <BookingManagement />;
  if (path === '/fleet/register' || path === '/fleet/status') return <VehicleManagement />;
  if (path === '/fleet/allocation') return <FleetAllocation />;
  if (path.startsWith('/trips/')) return <TripManagement path={path} />;
  return <ModuleWorkspace module={moduleByPath[path]} path={path} />;
}

// Each role only reaches the modules in its own panel menu.
function PanelModule({ path }) {
  const { role } = useAuth();
  return canAccessPath(role, path) ? moduleElement(path) : <Navigate to="/" replace />;
}

function RequireAuth({ children }) {
  const { session, checking } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin text-emerald-700" />Checking your session…</span>
      </div>
    );
  }
  return children;
}

// Where a signed-in user lands: new customers finish their profile first, otherwise
// the page they originally asked for (if their role may open it), otherwise the dashboard.
function landingPath(session, from) {
  if (session.role === 'customer' && session.user && !session.user.isProfileComplete) return '/crm/portal';
  if (from && from !== '/' && canAccessPath(session.role, from)) return from;
  return '/';
}

function GuestOnly({ children }) {
  const { session } = useAuth();
  const location = useLocation();
  return session ? <Navigate to={landingPath(session, location.state?.from?.pathname)} replace /> : children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Every role signs in on the same page; the account's role picks the panel. */}
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/login/*" element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
            <Route path="/" element={<DashboardOverview />} />
            <Route path="/crm/register" element={<Navigate to="/crm/customers" replace />} />
            <Route path="/fuel/reports" element={<Navigate to="/reports/fuel" replace />} />
            <Route path="/trips/reports" element={<Navigate to="/reports/trip" replace />} />
            {allModulePaths.map((path) => (
              <Route key={path} path={path} element={<PanelModule path={path} />} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
