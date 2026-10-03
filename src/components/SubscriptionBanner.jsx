import React, { useState, useMemo } from "react";
import { FiClock, FiAlertTriangle, FiZap, FiX, FiCheckCircle } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";

export default function SubscriptionBanner({ userProfile, onOpenRenewalModal }) {
    const [dismissed, setDismissed] = useState(() => {
        try {
            const tenantId = userProfile?.inquilino || userProfile?.tenant?.id;
            if (!tenantId) return false;
            const dismissedDate = sessionStorage.getItem(`odc_sub_banner_dismissed_${tenantId}`);
            if (!dismissedDate) return false;
            // Si lo cerró hoy, no volver a molestarlo durante la sesión
            return dismissedDate === new Date().toISOString().slice(0, 10);
        } catch {
            return false;
        }
    });

    const tenant = userProfile?.tenant;
    const role = (userProfile?.rol || "").trim().toLowerCase();

    // El superadministrador no debe ver alertas de su propia cuenta
    const isSuperAdmin = role === "superadmin";

    // Calcular días restantes y estado
    const subscriptionInfo = useMemo(() => {
        if (isSuperAdmin || !tenant || !tenant.subscriptionEndDate) {
            return null;
        }

        const rawEnd = tenant.subscriptionEndDate;
        let endDate;
        if (rawEnd.toDate) {
            endDate = rawEnd.toDate();
        } else if (rawEnd.seconds) {
            endDate = new Date(rawEnd.seconds * 1000);
        } else {
            endDate = new Date(rawEnd);
        }

        if (isNaN(endDate.getTime())) return null;

        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        // Redondear días restantes
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const isTrial = tenant.planId === "trial" || tenant.plan === "trial";
        const formattedDate = endDate.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

        return {
            endDate,
            formattedDate,
            diffDays,
            isTrial,
            isExpired: diffDays < 0 || tenant.subscriptionStatus === "expired",
            isUrgent: diffDays <= 7 && diffDays >= 0,
            isWarning: diffDays > 7 && diffDays <= 15
        };
    }, [tenant, isSuperAdmin]);

    if (!subscriptionInfo || dismissed) return null;

    const { diffDays, formattedDate, isTrial, isExpired, isUrgent, isWarning } = subscriptionInfo;

    // Solo mostrar el banner si faltan 15 días o menos, o si es trial y le quedan 15 días o menos, o si ya venció
    if (!isExpired && !isUrgent && !isWarning) {
        return null;
    }

    const handleDismiss = () => {
        try {
            const tenantId = userProfile?.inquilino || userProfile?.tenant?.id;
            if (tenantId) {
                sessionStorage.setItem(`odc_sub_banner_dismissed_${tenantId}`, new Date().toISOString().slice(0, 10));
            }
        } catch (_) {}
        setDismissed(true);
    };

    // ── 1. Caso: Vencido o vence hoy ──
    if (isExpired || diffDays === 0) {
        return (
            <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 text-white shadow-md relative z-20 border-b border-rose-800">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                            <FiAlertTriangle size={14} className="text-white" />
                        </span>
                        <div>
                            <span className="font-extrabold uppercase tracking-wide">
                                {diffDays === 0 ? "¡Tu suscripción vence HOY!" : "Suscripción por vencer o en periodo final"}
                            </span>
                            <span className="hidden md:inline text-rose-100 ml-1.5 font-medium">
                                Fecha límite: <strong>{formattedDate}</strong>. Renueva ahora para evitar la interrupción del servicio y agendamiento.
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onOpenRenewalModal}
                            className="bg-white hover:bg-rose-50 text-rose-700 font-black px-3.5 py-1.5 rounded-lg shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-0"
                        >
                            <FiZap size={13} className="text-amber-500 fill-amber-500" />
                            <span>Renovar Ahora</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── 2. Caso: Urgente (1 a 7 días) ──
    if (isUrgent) {
        return (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-sm relative z-20 border-b border-amber-600/30">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <FiClock size={14} className="text-white" />
                        </span>
                        <div>
                            <span className="font-extrabold tracking-wide uppercase">
                                {isTrial
                                    ? `⚠️ Tu Mes de Prueba vence en ${diffDays === 1 ? '1 día (mañana)' : `${diffDays} días`}`
                                    : `⚠️ Tu suscripción OdontoCloud vence en ${diffDays === 1 ? '1 día (mañana)' : `${diffDays} días`}`}
                            </span>
                            <span className="hidden lg:inline text-amber-100 ml-1.5 font-medium">
                                ({formattedDate}). Extiende tu membresía hoy y mantén tu clínica activa sin cortes.
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onOpenRenewalModal}
                            className="bg-white hover:bg-amber-50 text-orange-700 font-black px-3.5 py-1.5 rounded-lg shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border-0"
                        >
                            <FiZap size={13} className="text-amber-500 fill-amber-500" />
                            <span>Renovar Suscripción</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="w-7 h-7 rounded-lg bg-black/10 hover:bg-black/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                            title="Ocultar aviso por hoy"
                        >
                            <FiX size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── 3. Caso: Informativo Preventivo (8 a 15 días) ──
    return (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-xs relative z-20 border-b border-blue-900/30">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <FiClock size={12} className="text-blue-100" />
                    </span>
                    <div>
                        <span className="font-bold">
                            Tu suscripción {isTrial ? 'de prueba' : 'de OdontoCloud'} vence en <strong>{diffDays} días</strong> ({formattedDate}).
                        </span>
                        <span className="hidden md:inline text-blue-200 ml-1">
                            Renueva con tiempo para asegurar la disponibilidad de tu agenda médica.
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <button
                        type="button"
                        onClick={onOpenRenewalModal}
                        className="bg-white/95 hover:bg-white text-blue-800 font-bold px-3 py-1 rounded-md text-[11px] shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer border-0"
                    >
                        <FiZap size={12} className="text-blue-600" />
                        <span>Renovar Plan</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
                        title="Ocultar aviso por hoy"
                    >
                        <FiX size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
}
