import React, { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
// import { AnimatePresence } from "framer-motion"; // REMOVED to fix crash
import { useAuth } from "./context/AuthContext";

// Components
import PremiumLoading from "./components/PremiumLoading";
import ProtectedRoute from "./components/ProtectedRoute";

// Static Imports for Critical Path
import Login from "./pages/Login";
import ModernLanding from "./pages/ModernLanding";
import ModernLayout from "./layout/ModernLayout";
import Servicios from "./pages/Servicios";
import Planes from "./pages/Planes";
import { FAQPage } from "./pages/SectionPages";
import PatientPortal from "./modules/portal/PatientPortal";
import DigitalSignaturePublicPage from "./pages/DigitalSignaturePublicPage";
import CmsPreview from "./pages/CmsPreview";
import ResetPassword from "./pages/ResetPassword";
import ClinicServiciosPage from "./pages/landing/ClinicServiciosPage";
import ClinicNosotrosPage from "./pages/landing/ClinicNosotrosPage";
import ClinicSedesPage from "./pages/landing/ClinicSedesPage";

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

import ScrollToTop from "./components/ScrollToTop";

export default function App() {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  // 🛡️ Debug Log
  console.log("App Render - User:", user?.email, "Loading:", loading, "Role:", userProfile?.rol);

  // 🚀 PWA Management: Restrict installation only to Login & App routes (suppress on landing)
  React.useEffect(() => {
    const p = location.pathname.toLowerCase();
    const isAppRoute = p.includes("/login") ||
                       p.includes("/dashboard") ||
                       p.includes("/superadmin") ||
                       p.includes("/home");

    const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const manifestHref = `${baseUrl}/manifest.json`;

    let manifestLink = document.querySelector('link[rel="manifest"]');

    if (isAppRoute) {
      if (!manifestLink) {
        manifestLink = document.createElement("link");
        manifestLink.rel = "manifest";
        manifestLink.href = manifestHref;
        document.head.appendChild(manifestLink);
      }
      if ("serviceWorker" in navigator && !import.meta.env.DEV) {
        navigator.serviceWorker.register(`${baseUrl || ""}/sw.js`)
          .then((reg) => console.log("PWA Service Worker registered for app:", reg.scope))
          .catch((err) => console.error("SW registration error:", err));
      }
    } else {
      if (manifestLink) {
        manifestLink.remove();
      }
      const suppressPrompt = (e) => {
        e.preventDefault();
      };
      window.addEventListener("beforeinstallprompt", suppressPrompt);
      return () => window.removeEventListener("beforeinstallprompt", suppressPrompt);
    }
  }, [location.pathname]);

  if (loading) {
    return <PremiumLoading />;
  }

  return (
    <Suspense fallback={<PremiumLoading />}>
      <ScrollToTop />
      <Routes>
        {/* Public Routes with Isolated Layout */}
        <Route path="/login" element={
          user ? <RoleBridge /> : <Login />
        } />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Firma Digital & Documento Clínico Público para Pacientes */}
        <Route path="/portal-paciente/firma-digital" element={<DigitalSignaturePublicPage />} />

        {/* Portal Page - Standalone */}
        <Route path="/c/:clinicSlug/portal" element={<PatientPortal />} />

        {/* CMS Preview Standalone Route */}
        <Route path="/preview" element={<CmsPreview />} />

        {/* Modern Landing Layout */}
        <Route element={<ModernLayout />}>
          <Route path="/" element={<ModernLanding isMaster={true} />} />
          <Route path="/c/:clinicSlug" element={<ModernLanding />} />
          <Route path="/c/:clinicSlug/nosotros" element={<ClinicNosotrosPage />} />
          <Route path="/c/:clinicSlug/servicios" element={<ClinicServiciosPage />} />
          <Route path="/c/:clinicSlug/sedes" element={<ClinicSedesPage />} />

          <Route path="/servicios" element={<Servicios />} />
          <Route path="/funcionalidades" element={<Servicios />} />
          <Route path="/planes" element={<Planes />} />
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
          <ProtectedRoute allowedRoles={["superadmin"]}>
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
        {/* OralDrive compatibility routes */}
        <Route path="/ConfigParameters" element={<Navigate to="/dashboard/config/parametros" replace />} />
        <Route path="/configparameters" element={<Navigate to="/dashboard/config/parametros" replace />} />
        <Route path="/parametros" element={<Navigate to="/dashboard/config/parametros" replace />} />
        <Route path="/RatesAndCopays" element={<Navigate to="/dashboard/config/tarifas-copago" replace />} />
        <Route path="/ratesandcopays" element={<Navigate to="/dashboard/config/tarifas-copago" replace />} />
        <Route path="/NewRate" element={<Navigate to="/dashboard/config/tarifas-copago" replace />} />
        <Route path="/newrate" element={<Navigate to="/dashboard/config/tarifas-copago" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
}
