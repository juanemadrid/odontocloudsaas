import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PremiumLoading from './PremiumLoading';
import { isTenantSuspended, isSubscriptionExpired } from '../utils/subscriptionHelper';
import { FiCreditCard, FiAlertTriangle, FiLogOut, FiCalendar } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import SubscriptionRenewalModal from './SubscriptionRenewalModal';

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
            return <ExpiredOrSuspendedScreen isSuspended={isSuspended} userProfile={userProfile} />;
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

function ExpiredOrSuspendedScreen({ isSuspended, userProfile }) {
    const [showRenewalModal, setShowRenewalModal] = useState(false);
    const tenant = userProfile?.tenant || {};
    const clinicName = tenant.name || tenant.nombre || "Tu Consultorio";

    const formatEndDate = (dateStr) => {
        if (!dateStr) return null;
        try {
            const d = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
            return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
            return null;
        }
    };

    const endDateFmt = formatEndDate(tenant.subscriptionEndDate);

    const handleWhatsAppSupport = () => {
        const phone = "573124119846";
        const msg = `Hola OdontoCloud, el acceso a mi clínica *${clinicName}* aparece ${isSuspended ? "suspendido" : "vencido"}. ` +
            `Deseo realizar la reactivación / renovación del servicio. ¿Me pueden colaborar por favor?`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900/95 p-6 relative overflow-hidden">
            {/* Glow decorativo de fondo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 sm:p-10 max-w-lg w-full text-center space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-200">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto ${isSuspended ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                    <FiAlertTriangle size={36} />
                </div>

                <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                        OdontoCloud · Plataforma Clínica
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                        {isSuspended ? "Servicio Temporalmente Suspendido" : "Periodo de Suscripción Vencido"}
                    </h2>
                    <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">
                        {clinicName}
                    </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2 text-xs text-slate-600">
                    <p className="leading-relaxed">
                        {isSuspended
                            ? "El acceso a la plataforma ha sido suspendido temporalmente. Tus pacientes, historias clínicas y datos contables están respaldados de forma segura."
                            : "La membresía de este consultorio ha llegado a su fecha de vencimiento. Renueva tu suscripción para continuar atendiendo consultas y gestionando tu agenda sin restricciones."}
                    </p>
                    {endDateFmt && (
                        <div className="flex items-center gap-1.5 text-slate-500 font-semibold pt-1 border-t border-slate-200/60">
                            <FiCalendar size={13} className="text-slate-400" />
                            <span>Fecha de vencimiento: <strong className="text-slate-700">{endDateFmt}</strong></span>
                        </div>
                    )}
                </div>

                {/* Acciones principales */}
                <div className="space-y-3 pt-1">
                    <button
                        type="button"
                        onClick={() => setShowRenewalModal(true)}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer border-0"
                    >
                        <FiCreditCard size={16} />
                        <span>Ver Cuentas y Renovar Suscripción</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleWhatsAppSupport}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer border-0"
                    >
                        <FaWhatsapp size={16} />
                        <span>Contactar a Soporte por WhatsApp</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            localStorage.removeItem("odc_session");
                            window.location.href = '/login';
                        }}
                        className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-0"
                    >
                        <FiLogOut size={14} />
                        <span>Volver al inicio de sesión</span>
                    </button>
                </div>

                <p className="text-[10px] text-slate-400 font-medium">
                    Atención y soporte: soporte@odontocloudcolombia.com · WhatsApp 312 411 9846
                </p>
            </div>

            {/* Modal de renovación con cuentas bancarias y WhatsApp */}
            <SubscriptionRenewalModal
                isOpen={showRenewalModal}
                onClose={() => setShowRenewalModal(false)}
                userProfile={userProfile}
            />
        </div>
    );
}
