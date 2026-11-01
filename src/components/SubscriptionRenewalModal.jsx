import React, { useState, useEffect } from "react";
import { FiX, FiCheck, FiCopy, FiCreditCard, FiSmartphone, FiCalendar, FiClock, FiShield, FiAlertTriangle, FiUsers, FiGlobe, FiFileText, FiStar } from "react-icons/fi";
import { FaWhatsapp, FaUniversity } from "react-icons/fa";
import supabase from "../lib/supabaseClient";
import { getPlans, getPaymentMethods, getGlobalConfig, OFFICIAL_DEFAULT_PLANS } from "../services/adminService";

export default function SubscriptionRenewalModal({ isOpen, onClose, userProfile }) {
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState("");
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [globalConfig, setGlobalConfig] = useState({ adminPhone: "573015768935" });
    const [selectedDuration, setSelectedDuration] = useState("yearly");
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);

    const tenant = userProfile?.tenant || {};
    const tenantPlanId = (tenant?.planId || tenant?.plan?.id || tenant?.plan || "").toString().toLowerCase();

    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;
        setSubmitted(false);

        const load = async () => {
            try {
                setLoading(true);
                const [pRows, pMethods, pConfig] = await Promise.all([
                    getPlans(),
                    getPaymentMethods(),
                    getGlobalConfig()
                ]);

                if (isMounted) {
                    const catalogPlans = (Array.isArray(pRows) && pRows.length > 0) ? pRows : OFFICIAL_DEFAULT_PLANS;
                    setPlans(catalogPlans);
                    setPaymentMethods(pMethods || []);
                    setGlobalConfig(pConfig || { adminPhone: "573015768935" });

                    // Seleccionar plan inicial:
                    // 1. Si coincide con el plan del tenant
                    // 2. O el plan recomendado (ej: clínica)
                    // 3. O el primer plan disponible
                    const matchingPlan = catalogPlans.find(p => p.id === tenantPlanId);
                    const recommendedPlan = catalogPlans.find(p => p.recommended || p.id === "clinica");
                    if (matchingPlan) {
                        setSelectedPlanId(matchingPlan.id);
                    } else if (recommendedPlan) {
                        setSelectedPlanId(recommendedPlan.id);
                    } else if (catalogPlans.length > 0) {
                        setSelectedPlanId(catalogPlans[0].id);
                    }

                    if (tenant?.planDuration === "monthly") {
                        setSelectedDuration("monthly");
                    } else {
                        setSelectedDuration("yearly");
                    }
                }
            } catch (err) {
                console.error("Error cargando opciones de renovación:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        load();
        return () => { isMounted = false; };
    }, [isOpen, tenantPlanId]);

    if (!isOpen) return null;

    // Plan actualmente seleccionado
    const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0] || {};
    const planName = selectedPlan.name || (selectedPlanId.includes("clinica") ? "Plan Clínica" : selectedPlanId.includes("enterprise") ? "Plan Enterprise" : "Plan Consultorio");

    // Precios del plan seleccionado
    const monthlyPrice = Number(selectedPlan.monthlyPrice ?? selectedPlan.price ?? 79900);
    const yearlyPrice = Number(selectedPlan.yearlyPrice ?? (monthlyPrice * 10)); // 2 meses gratis de ahorro
    const currentPrice = selectedDuration === "yearly" ? yearlyPrice : monthlyPrice;

    const formatEndDate = (dateStr) => {
        if (!dateStr) return "Vencida recientemente";
        try {
            const d = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
            return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
            return String(dateStr);
        }
    };

    const handleCopy = (text, idx) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const getWhatsAppMessage = () => {
        const clinicName = tenant.name || tenant.nombre || "Mi Clínica";
        const nit = tenant.nit ? ` (NIT: ${tenant.nit})` : "";
        const durationText = selectedDuration === "yearly" ? "ANUAL (365 días)" : "MENSUAL (30 días)";
        const valorFmt = currentPrice.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

        return `Hola OdontoCloud, he realizado la transferencia para la *Renovación de Membresía* de mi clínica *${clinicName}*${nit}.\n\n` +
            `📋 *Plan Seleccionado:* ${planName}\n` +
            `⏳ *Ciclo de Facturación:* ${durationText}\n` +
            `💰 *Valor Transferido:* ${valorFmt}\n\n` +
            `Adjunto mi comprobante de pago para que por favor validen la transacción y reactiven el acceso a nuestra clínica. ¡Muchas gracias!`;
    };

    const handleSendWhatsApp = () => {
        const rawPhone = globalConfig?.adminPhone || "573015768935";
        let phone = String(rawPhone).replace(/\D/g, "");
        if (!phone.startsWith("57") && phone.length === 10) {
            phone = "57" + phone;
        }
        if (!phone) phone = "573015768935";

        const message = getWhatsAppMessage();
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
    };

    const handleNotifyInSystem = async () => {
        try {
            setSubmitting(true);
            const { data: authData } = await supabase.auth.getUser();
            const durationText = selectedDuration === "yearly" ? "yearly" : "monthly";

            await supabase
                .from("subscription_change_requests")
                .insert([{
                    tenant_id: userProfile?.inquilino || tenant?.id,
                    requested_by: authData?.user?.id || null,
                    requester_email: authData?.user?.email || userProfile?.email || "",
                    tenant_name: tenant.name || tenant.nombre || "Clínica",
                    tenant_phone: tenant.telCelular || tenant.telefono || "",
                    request_type: "renewal",
                    requested_plan_id: selectedPlan.id || selectedPlanId,
                    requested_plan_name: `${planName} (${selectedDuration === 'yearly' ? 'Renovación Anual' : 'Renovación Mensual'})`,
                    plan_duration: durationText,
                    payment_status: "awaiting_validation",
                    status: "pending"
                }]);

            setSubmitted(true);
            setTimeout(() => {
                handleSendWhatsApp();
            }, 800);
        } catch (err) {
            console.error("Error registrando solicitud:", err);
            handleSendWhatsApp();
        } finally {
            setSubmitting(false);
        }
    };

    // Métodos de pago limpios y oficiales (sin pasarelas dummy Wompi)
    const defaultPaymentMethods = [
        {
            id: "nequi_bancolombia",
            name: "Nequi & Bancolombia",
            type: "Billetera Digital / Transferencia",
            number: "301 576 8935",
            holder: "OdontoCloud Colombia",
            active: true
        }
    ];

    const displayPaymentMethods = (paymentMethods && paymentMethods.length > 0)
        ? paymentMethods.filter(m => m.active !== false && !String(m.number || "").includes("12345") && !String(m.type || "").toLowerCase().includes("wompi"))
        : defaultPaymentMethods;

    const safePaymentMethods = displayPaymentMethods.length > 0 ? displayPaymentMethods : defaultPaymentMethods;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
                {/* Header Premium */}
                <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 sm:p-6 relative shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute right-4 sm:right-5 top-4 sm:top-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border-0"
                        title="Cerrar"
                    >
                        <FiX size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                            <FiCreditCard size={20} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Módulo de Renovación</span>
                            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">Renovar Suscripción OdontoCloud</h2>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                    {/* Tarjeta Informativa de la Clínica */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Clínica / Consultorio</span>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                                {tenant.name || tenant.nombre || "Tu Consultorio"}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900">
                                    Prueba / Membresía Vencida
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                                    <FiCalendar size={13} className="text-slate-400" />
                                    Vencimiento: <strong className="text-slate-700">{formatEndDate(tenant.subscriptionEndDate)}</strong>
                                </span>
                            </div>
                        </div>

                        <div className="sm:text-right shrink-0">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Acceso Seguro</span>
                            <span className="text-xs text-slate-500 font-medium">Tus datos están 100% respaldados</span>
                        </div>
                    </div>

                    {/* Paso 1: Selector de Planes Dinámicos */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                                Selecciona el Plan a Activar:
                            </label>
                            <span className="text-[11px] text-slate-500 hidden sm:inline">Elige el plan ideal para tu clínica</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {plans.map((plan) => {
                                const isSelected = (selectedPlan.id || selectedPlanId) === plan.id;
                                const isClinica = plan.id === "clinica" || plan.recommended;
                                const pMonthly = Number(plan.monthlyPrice || 0);
                                const pYearly = Number(plan.yearlyPrice || (pMonthly * 10));
                                const displayPrice = selectedDuration === "yearly" ? pYearly : pMonthly;
                                const periodSuffix = selectedDuration === "yearly" ? "/ año" : "/ mes";

                                return (
                                    <div
                                        key={plan.id}
                                        onClick={() => setSelectedPlanId(plan.id)}
                                        className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                            isSelected
                                                ? "border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-600/20"
                                                : "border-slate-200 hover:border-slate-300 bg-white"
                                        }`}
                                    >
                                        {/* Badge destacado */}
                                        {isClinica && (
                                            <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                                <FiStar size={10} /> Más Popular
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                                    {plan.name}
                                                </h4>
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                                                    {isSelected && <FiCheck size={10} strokeWidth={4} />}
                                                </div>
                                            </div>

                                            <p className="text-[11px] text-slate-500 line-clamp-2">
                                                {plan.description || "Gestión odontológica profesional en la nube."}
                                            </p>

                                            <div className="space-y-1 pt-1 text-[11px] text-slate-600">
                                                <div className="flex items-center gap-1.5 font-semibold">
                                                    <FiUsers size={12} className="text-blue-600 shrink-0" />
                                                    <span>Hasta {plan.maxUsers || 2} usuarios</span>
                                                </div>
                                                {plan.includeFacturacion && (
                                                    <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                                                        <FiFileText size={12} className="text-emerald-600 shrink-0" />
                                                        <span>Facturación DIAN / RIPS</span>
                                                    </div>
                                                )}
                                                {(plan.id === "clinica" || plan.id === "enterprise") && (
                                                    <div className="flex items-center gap-1.5 font-semibold text-indigo-700">
                                                        <FiGlobe size={12} className="text-indigo-600 shrink-0" />
                                                        <span>Sitio Web Corporativo GRATIS</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-200/60">
                                            <div className="text-lg font-black text-slate-900">
                                                {displayPrice.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                                                <span className="text-[10px] text-slate-400 font-semibold ml-1">{periodSuffix}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Paso 2: Selector de Ciclo (Anual vs Mensual) */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                                Selecciona el Periodo de Facturación:
                            </label>
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                ⭐ Recomendado: Ahorra con el Plan Anual
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Opción Anual */}
                            <div
                                onClick={() => setSelectedDuration("yearly")}
                                className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    selectedDuration === "yearly"
                                        ? "border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600/20"
                                        : "border-slate-200 hover:border-slate-300 bg-white"
                                }`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-blue-900 uppercase">Plan Anual (365 Días)</span>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedDuration === "yearly" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                                            {selectedDuration === "yearly" && <FiCheck size={10} strokeWidth={4} />}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Un año completo sin cortes. Incluye 2 meses de ahorro.</p>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-baseline gap-1">
                                    <span className="text-lg font-black text-slate-900">
                                        {yearlyPrice.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-semibold">/ año</span>
                                </div>
                            </div>

                            {/* Opción Mensual */}
                            <div
                                onClick={() => setSelectedDuration("monthly")}
                                className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    selectedDuration === "monthly"
                                        ? "border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600/20"
                                        : "border-slate-200 hover:border-slate-300 bg-white"
                                }`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-800 uppercase">Plan Mensual (30 Días)</span>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedDuration === "monthly" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                                            {selectedDuration === "monthly" && <FiCheck size={10} strokeWidth={4} />}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Pago mes a mes según tu flujo de caja.</p>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-baseline gap-1">
                                    <span className="text-lg font-black text-slate-900">
                                        {monthlyPrice.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-semibold">/ mes</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Paso 3: Cuentas Oficiales para Transferencia (Sin Wompi) */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                            Transfiere a Nuestra Cuenta Oficial:
                        </label>

                        <div className="grid grid-cols-1 gap-3">
                            {safePaymentMethods.map((m, idx) => (
                                <div key={m.id || idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm shrink-0 font-bold shadow-sm">
                                            <FiSmartphone size={18} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{m.type || "Billetera Digital & Transferencia"}</span>
                                            <h4 className="text-sm font-black text-slate-900">{m.name}</h4>
                                            {m.holder && (
                                                <p className="text-[11px] text-slate-500 font-medium">
                                                    Titular: <strong className="text-slate-700">{m.holder}</strong>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                        <div>
                                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Número de cuenta / Nequi:</span>
                                            <span className="text-sm font-mono font-black text-slate-900 select-all">{m.number}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(m.number, idx)}
                                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
                                            title="Copiar número de cuenta"
                                        >
                                            {copiedIndex === idx ? (
                                                <>
                                                    <FiCheck size={13} className="text-emerald-600" />
                                                    <span className="text-emerald-600 font-bold">¡Copiado!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiCopy size={13} />
                                                    <span>Copiar</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Paso 4: Activación Inmediata con WhatsApp destacado */}
                    <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-emerald-50/30 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                    4
                                </span>
                                <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                                    Envía tu comprobante para activación inmediata
                                </h4>
                            </div>
                            <span className="text-xs font-black text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                                Valor a Transferir: {currentPrice.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                            </span>
                        </div>

                        <p className="text-xs text-emerald-900/90 leading-relaxed">
                            Una vez realizada la transferencia para el <strong>{planName} ({selectedDuration === 'yearly' ? 'Anual' : 'Mensual'})</strong>, presiona el botón inferior para enviar el comprobante directamente a nuestra línea oficial de activaciones por WhatsApp (<strong>301 576 8935</strong>). La renovación quedará aplicada en minutos.
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <p className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
                        Soporte oficial OdontoCloud Colombia · WhatsApp <strong>301 576 8935</strong>
                    </p>

                    <div className="w-full sm:w-auto flex justify-end">
                        <button
                            type="button"
                            onClick={handleNotifyInSystem}
                            disabled={submitting}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer border-0 whitespace-nowrap"
                        >
                            <FaWhatsapp size={16} />
                            <span>{submitting ? "Registrando solicitud..." : "Enviar Comprobante por WhatsApp"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
