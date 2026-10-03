import React, { useState, useEffect } from "react";
import { FiX, FiCheck, FiCopy, FiCreditCard, FiSmartphone, FiCalendar, FiClock, FiShield, FiAlertTriangle } from "react-icons/fi";
import { FaWhatsapp, FaUniversity } from "react-icons/fa";
import supabase from "../lib/supabaseClient";
import { getPlans, getPaymentMethods, getGlobalConfig } from "../services/adminService";

export default function SubscriptionRenewalModal({ isOpen, onClose, userProfile }) {
    const [plans, setPlans] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [globalConfig, setGlobalConfig] = useState({ adminPhone: "573124119846" });
    const [selectedDuration, setSelectedDuration] = useState("yearly");
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);

    const tenant = userProfile?.tenant || {};
    const tenantPlanId = (tenant?.planId || tenant?.plan?.id || tenant?.plan || "pro").toString().toLowerCase();

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
                    setPlans(pRows || []);
                    setPaymentMethods(pMethods || []);
                    setGlobalConfig(pConfig || { adminPhone: "573124119846" });
                    // Si el tenant tiene planDuration configurado, usarlo por defecto
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
    }, [isOpen]);

    if (!isOpen) return null;

    // Plan activo
    const activeCatalogPlan = (plans || []).find(p => p.id === tenantPlanId) || tenant.plan || {};
    const planName = activeCatalogPlan.name || (tenantPlanId.includes("pro") ? "Plan Profesional" : tenantPlanId.includes("enterprise") ? "Plan IPS Enterprise" : "Plan Básico");
    
    // Precios
    const monthlyPrice = Number(activeCatalogPlan.monthlyPrice ?? activeCatalogPlan.price ?? 129000);
    const yearlyPrice = Number(activeCatalogPlan.yearlyPrice ?? (monthlyPrice * 10)); // Si no hay anual configurado, 10 meses (2 meses gratis)
    const currentPrice = selectedDuration === "yearly" ? yearlyPrice : monthlyPrice;

    // Fecha de vencimiento
    const formatEndDate = (dateStr) => {
        if (!dateStr) return "No disponible";
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

        return `Hola OdontoCloud, he realizado el pago para la *Renovación de Suscripción* de mi clínica *${clinicName}*${nit}.\n\n` +
            `📋 *Plan a Renovar:* ${planName}\n` +
            `⏳ *Ciclo Elegido:* ${durationText}\n` +
            `💰 *Valor:* ${valorFmt}\n\n` +
            `Adjunto mi comprobante de transferencia para que por favor validen el pago y extiendan la fecha de servicio. ¡Muchas gracias!`;
    };

    const handleSendWhatsApp = () => {
        const rawPhone = globalConfig?.adminPhone || "573124119846";
        const phone = rawPhone.replace(/\D/g, "");
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
                    requested_plan_id: tenantPlanId,
                    requested_plan_name: `${planName} (${selectedDuration === 'yearly' ? 'Renovación Anual' : 'Renovación Mensual'})`,
                    plan_duration: durationText,
                    payment_status: "awaiting_validation",
                    status: "pending"
                }]);

            setSubmitted(true);
            // Abrir también WhatsApp para asegurar que envíen el comprobante
            setTimeout(() => {
                handleSendWhatsApp();
            }, 1200);
        } catch (err) {
            console.error("Error registrando solicitud:", err);
            // Si ya existía o falla la tabla, abrir WhatsApp de todas formas
            handleSendWhatsApp();
        } finally {
            setSubmitting(false);
        }
    };

    const defaultPaymentMethods = [
        { id: "bancolombia", name: "Bancolombia Ahorros", type: "Cuenta de Ahorros", number: "300-123456-78", holder: "OdontoCloud SAS (NIT 901.234.567-8)" },
        { id: "nequi", name: "Nequi / Daviplata", type: "Billetera Digital", number: "312 411 9846", holder: "OdontoCloud" }
    ];

    const displayPaymentMethods = (paymentMethods && paymentMethods.length > 0)
        ? paymentMethods.filter(m => m.active !== false)
        : defaultPaymentMethods;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
                {/* Header Premium */}
                <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 relative shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute right-5 top-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Cerrar"
                    >
                        <FiX size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                            <FiCreditCard size={22} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Módulo de Renovación</span>
                            <h2 className="text-xl font-black tracking-tight text-white">Renovar Suscripción OdontoCloud</h2>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                    {/* Tarjeta Informativa de la Clínica */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Clínica / Consultorio</span>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                                {tenant.name || tenant.nombre || "Tu Consultorio"}
                            </h3>
                            <div className="flex items-center gap-2 pt-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                                    {planName}
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                                    <FiCalendar size={13} className="text-slate-400" />
                                    Vencimiento: <strong className="text-slate-700">{formatEndDate(tenant.subscriptionEndDate)}</strong>
                                </span>
                            </div>
                        </div>

                        <div className="sm:text-right shrink-0">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Acceso Seguro</span>
                            <span className="text-xs text-slate-500 font-medium">Datos respaldados 24/7</span>
                        </div>
                    </div>

                    {/* Selector de Ciclo (Anual vs Mensual) */}
                    <div>
                        <div className="flex items-center justify-between mb-2.5">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                1. Selecciona el periodo a renovar:
                            </label>
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                ⭐ Recomendado: Ahorra con el Plan Anual
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Opción Anual */}
                            <div
                                onClick={() => setSelectedDuration("yearly")}
                                className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    selectedDuration === "yearly"
                                        ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-600/20"
                                        : "border-slate-200 hover:border-slate-300 bg-white"
                                }`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-blue-900 uppercase">Renovación Anual (365 Días)</span>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedDuration === "yearly" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                                            {selectedDuration === "yearly" && <FiCheck size={10} strokeWidth={4} />}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Un año completo sin interrupciones ni preocupaciones.</p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-200/60">
                                    <span className="text-xl font-black text-slate-900">
                                        {yearlyPrice.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-semibold ml-1">/ año</span>
                                </div>
                            </div>

                            {/* Opción Mensual */}
                            <div
                                onClick={() => setSelectedDuration("monthly")}
                                className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    selectedDuration === "monthly"
                                        ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-600/20"
                                        : "border-slate-200 hover:border-slate-300 bg-white"
                                }`}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-800 uppercase">Renovación Mensual (30 Días)</span>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedDuration === "monthly" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                                            {selectedDuration === "monthly" && <FiCheck size={10} strokeWidth={4} />}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Pago mes a mes según tu flujo de caja.</p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-slate-200/60">
                                    <span className="text-xl font-black text-slate-900">
                                        {monthlyPrice.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-semibold ml-1">/ mes</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cuentas Bancarias Autorizadas */}
                    <div>
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2.5">
                            2. Transfiere a cualquiera de nuestras cuentas oficiales:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {displayPaymentMethods.map((m, idx) => (
                                <div key={m.id || idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs shrink-0 font-bold">
                                                {m.type?.toLowerCase().includes("billetera") ? <FiSmartphone size={14} /> : <FaUniversity size={14} />}
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block">{m.type || "Cuenta Bancaria"}</span>
                                                <h4 className="text-xs font-black text-slate-800">{m.name}</h4>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-semibold">Número de cuenta / teléfono:</span>
                                            <span className="text-xs font-mono font-black text-slate-900 select-all">{m.number}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(m.number, idx)}
                                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[10px] font-bold transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
                                            title="Copiar número"
                                        >
                                            {copiedIndex === idx ? (
                                                <>
                                                    <FiCheck size={12} className="text-emerald-600" />
                                                    <span className="text-emerald-600 font-bold">¡Copiado!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiCopy size={12} />
                                                    <span>Copiar</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {m.holder && (
                                        <p className="text-[10px] text-slate-500 font-medium truncate">
                                            Titular: <span className="font-semibold text-slate-700">{m.holder}</span>
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Paso 3: Validación y Comprobante */}
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                3
                            </span>
                            <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                                Envía tu comprobante para activación inmediata
                            </h4>
                        </div>
                        <p className="text-xs text-emerald-800 leading-relaxed pl-7">
                            Una vez realizada la transferencia, pulsa el botón a continuación para enviar el comprobante directamente a nuestro equipo de activaciones vía WhatsApp. La renovación quedará aplicada en minutos.
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <p className="text-[11px] text-slate-400 font-medium text-center sm:text-left">
                        Soporte oficial OdontoCloud Colombia · Atención de lunes a sábado
                    </p>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-white transition-colors cursor-pointer"
                        >
                            Cerrar
                        </button>

                        <button
                            type="button"
                            onClick={handleNotifyInSystem}
                            disabled={submitting}
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer border-0"
                        >
                            <FaWhatsapp size={16} />
                            <span>{submitting ? "Registrando..." : "Enviar Comprobante por WhatsApp"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
