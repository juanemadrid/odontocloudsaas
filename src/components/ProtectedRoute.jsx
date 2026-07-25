import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PremiumLoading from './PremiumLoading';
import { isTenantSuspended, isSubscriptionExpired } from '../utils/subscriptionHelper';

const normalizeRole = (role) => (role || "").trim().toLowerCase();

export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, userProfile, loading } = useAuth();
    const location = useLocation();

    console.log("ProtectedRoute - Estado:", {
        loading,
        hasUser: !!user,
        hasProfile: !!userProfile,
        rol: userProfile?.rol,
        inquilino: userProfile?.inquilino,
        hasTenant: !!userProfile?.tenant,
        tenantStatus: userProfile?.tenant?.status
    });

    if (loading) {
        return <PremiumLoading />;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If no userProfile yet, show loading (shouldn't happen but safety check)
    if (!userProfile) {
        console.warn("ProtectedRoute - Usuario autenticado pero sin perfil, mostrando loading");
        return <PremiumLoading />;
    }

    // ── Tenant suspension/expiration check ──
    // superadmin is always allowed through
    const role = normalizeRole(userProfile?.rol);
    if (role !== "superadmin" && userProfile.inquilino && userProfile.tenant) {
        // Only check suspension/expiration if tenant data is loaded
        const isSuspended = isTenantSuspended(userProfile.tenant);
        const isExpired = isSubscriptionExpired(userProfile.tenant);

        console.log("ProtectedRoute - Verificación suspensión:", {
            isSuspended,
            isExpired,
            tenantStatus: userProfile.tenant.status,
            tenantId: userProfile.tenant.id
        });

        if (isSuspended || isExpired) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                    <div className="bg-white rounded-2xl shadow-xl border border-rose-100 p-10 max-w-md w-full text-center space-y-4">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                            {isSuspended ? "Servicio suspendido" : "Suscripción vencida"}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {isSuspended 
                                ? "El acceso a esta clínica ha sido suspendido temporalmente. Por favor contacta al administrador del sistema para reactivar el servicio."
                                : "El periodo de suscripción de esta clínica ha vencido. Por favor contacta al administrador o renueva tu suscripción para continuar utilizando el servicio."}
                        </p>
                        <p className="text-xs text-slate-400 font-medium">OdontoCloud · soporte@odontocloud.com</p>
                        <button 
                            onClick={() => { 
                                // Clear auth and go to login
                                localStorage.removeItem("odc_session");
                                window.location.href = '/login';
                            }}
                            className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors"
                        >
                            Volver al inicio de sesión
                        </button>
                    </div>
                </div>
            );
        }
    }

    if (allowedRoles?.length) {
        const isAllowed = allowedRoles.some((allowedRole) => role === normalizeRole(allowedRole));
        if (!isAllowed) {
            return <Navigate to="/unauthorized" replace />;
        }
    }

    return children;
}
