import React, { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "./context/AuthContext";

// Components
import PremiumLoading from "./components/PremiumLoading";
import ProtectedRoute from "./components/ProtectedRoute";

// Static Imports for Critical Path
import Login from "./pages/Login";
import ModernLanding from "./pages/ModernLanding";
import ModernLayout from "./layout/ModernLayout";
import { ServicesPage, PricingPage, FAQPage } from "./pages/SectionPages";

// Lazy Imports
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const SuperAdminDashboard = React.lazy(() => import("./pages/SuperAdminPanel"));
const UnauthorizedPage = React.lazy(() => import("./pages/UnauthorizedPage"));

// 🚀 Role Bridge: Automatic redirection to the correct portal
function RoleBridge() {
  const { userProfile, loading } = useAuth();
  if (loading) return <PremiumLoading />;

  const role = userProfile?.rol?.trim().toLowerCase() || "";
  console.log("RoleBridge - Evaluando rol para redirección:", {
    role,
    rawRole: userProfile?.rol,
    email: userProfile?.email
  });

  if (role === "superadmin") {
    return <Navigate to="/superadmin" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  // 🛡️ Debug Log
  console.log("App Render - User:", user?.email, "Loading:", loading, "Role:", userProfile?.rol);

  if (loading) {
    return <PremiumLoading />;
  }

  return (
    <Suspense fallback={<PremiumLoading />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/login" element={
            user ? <RoleBridge /> : <Login />
          } />

          <Route element={<ModernLayout />}>
            <Route path="/" element={<ModernLanding isMaster={true} />} />
            <Route path="/servicios" element={<ServicesPage />} />
            <Route path="/planes" element={<PricingPage />} />
            <Route path="/faq" element={<FAQPage />} />
          </Route>

          {/* Private Routes */}
          <Route path="/home" element={
            <ProtectedRoute>
              <RoleBridge />
            </ProtectedRoute>
          } />

          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          {/* Master Platform Route */}
          <Route path="/superadmin/*" element={
            <ProtectedRoute>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />

          {/* Compatibility Routes for specific roles */}
          <Route path="/dashboard_admin/*" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard_doctor/*" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard_recepcion/*" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
