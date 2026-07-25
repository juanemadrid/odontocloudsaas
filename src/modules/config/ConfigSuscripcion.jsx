import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useToast } from "../../context/ToastContext";
import { getPlans, getPaymentMethods, getGlobalConfig } from "../../services/adminService";
import { FiPackage, FiZap, FiClock, FiStar, FiCreditCard, FiSmartphone, FiArrowRight, FiCheck } from "react-icons/fi";
import { FaWhatsapp, FaUniversity } from "react-icons/fa";
import { isSubscriptionExpired } from "../../utils/subscriptionHelper";

export default function ConfigSuscripcion() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const tenant = userProfile?.tenant || {};
    const plan = tenant?.plan || {};
    const isSuperAdmin = userProfile?.rol?.trim().toLowerCase() === 'superadmin';

    const [plans, setPlans] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [globalConfig, setGlobalConfig] = useState({ adminPhone: "573124119846" });
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [requesting, setRequesting] = useState(null);
    const [selectedDuration, setSelectedDuration] = useState("monthly");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [pRows, pMethods, pConfig] = await Promise.all([
                    getPlans(),
                    getPaymentMethods(),
                    getGlobalConfig()
                ]);
                setPlans(pRows);
                setPaymentMethods(pMethods);
                setGlobalConfig(pConfig);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleRequestUpgrade = async (newPlan) => {
        if (isSuperAdmin) {
            if (toast?.info) toast.info("Como SuperAdmin, puedes modificar los planes directamente en la base de datos.");
            return;
        }
        const durationText = selectedDuration === "yearly" ? "ANUAL" : "MENSUAL";
        if (!window.confirm(`¿Solicitar cambio al plan "${newPlan.name}" (${durationText})?`)) return;

        setRequesting(newPlan.id);
        const requestData = {
            inquilino: userProfile.inquilino,
            tenantName: tenant.name,
            currentPlanId: tenant.planId || "custom",
            requestedPlanId: newPlan.id,
            requestedPlanName: newPlan.name,
            planDuration: selectedDuration,
            status: "pending",
            paymentStatus: "awaiting_validation",
            tenantPhone: tenant.telCelular || "",
            createdAt: serverTimestamp()
        };
        try {
            await addDoc(collection(db, "subscription_requests"), requestData);
            if (toast?.success) toast.success("Solicitud enviada. Redirigiendo a WhatsApp para adjuntar comprobante...");

            const phone = globalConfig.adminPhone || "573124119846";
            const msg = `Hola OdontoCloud, he realizado el pago para el plan *${newPlan.name}* de mi clínica *${tenant.name}*. Adjunto comprobante para activación.`;
            const wpUrl = `https://wa.me/${phone.replace(/\s+/g, '')}?text=${encodeURIComponent(msg)}`;

            setTimeout(() => {
                window.open(wpUrl, "_blank");
                setShowUpgrade(false);
            }, 1500);

        } catch (error) {
            console.error(error);
            if (toast?.error) toast.error("No se pudo enviar la solicitud. Intenta más tarde.");
        } finally {
            setRequesting(null);
        }
    };

    const handleSupportWhatsApp = () => {
        const phone = globalConfig.adminPhone || "573124119846";
        const msg = `Hola OdontoCloud, tengo una duda sobre el pago/suscripción de mi clínica *${tenant?.name || ''}*.`;
        window.open(`https://wa.me/${phone.replace(/\s+/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleRequestTrial = async () => {
        if (!window.confirm("¿Deseas solicitar un mes de prueba gratuito?")) return;
        setRequesting("trial");
        try {
            await addDoc(collection(db, "subscription_requests"), {
                inquilino: userProfile.inquilino,
                tenantName: tenant.name,
                requestedPlanName: "MES DE PRUEBA (SOLICITUD)",
                status: "pending",
                paymentStatus: "trial_request",
                tenantPhone: tenant.telCelular || "",
                createdAt: serverTimestamp()
            });
            if (toast?.success) toast.success("Solicitud enviada.");
            const phone = globalConfig.adminPhone || "573124119846";
            const message = `Hola OdontoCloud, solicito activar el *MES DE PRUEBA* para mi clínica *${tenant.name}*.`;
            window.open(`https://wa.me/${phone.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
        } catch (error) {
            console.error(error);
            if (toast?.error) toast.error("Error al solicitar prueba.");
        } finally {
            setRequesting(null);
        }
    };

    const formatDate = (ts) => {
        if (!ts) return "Indefinido";
        if (ts.toDate) return ts.toDate().toLocaleDateString();
        return new Date(ts).toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="p-4 max-w-4xl mx-auto py-24 text-center text-slate-400 font-medium">
                <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                Sincronizando portal de suscripción...
            </div>
        );
    }

    const isExpired = isSubscriptionExpired(userProfile?.tenant);

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiPackage size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Portal de Suscripción</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Gestión del plan activo, fecha de renovación y accesos a la plataforma</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                        isSuperAdmin ? "bg-amber-50 text-amber-600 border-amber-200" :
                        isExpired ? "bg-rose-50 text-rose-600 border-rose-200" :
                        "bg-emerald-50 text-emerald-600 border-emerald-200"
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${isSuperAdmin ? "bg-amber-500" : isExpired ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
                        {isSuperAdmin ? "Cta. Maestro (Admin)" : (isExpired ? "Suscripción Vencida" : "Servicio Activo")}
                    </span>
                </div>
            </div>

            {/* Platform Master HUD for SuperAdmin */}
            {isSuperAdmin && (
                <div className="bg-slate-900 rounded-xl p-5 text-white flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
                            <FiZap size={20} />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold">Panel Maestro del Software</h3>
                            <p className="text-[11px] text-slate-300">Tienes control total sobre los planes y facturación de la plataforma.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Plan Info Cards */}
            {!isSuperAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Current Plan Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tu Plan Actual</span>
                            <h2 className="text-[22px] font-bold text-blue-600 uppercase tracking-tight">
                                {plan.name || "Plan Personalizado"}
                            </h2>
                            <p className="text-[11px] font-semibold text-slate-500">
                                {tenant?.planDuration === 'yearly' ? 'Facturación Anual' : 'Facturación Mensual'}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-[12px]">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Costo Estimado</span>
                                <span className="font-bold text-slate-800 text-[15px]">
                                    {(tenant.planDuration === 'yearly' && plan.yearlyPrice ? plan.yearlyPrice : (plan.monthlyPrice || plan.price || 0)).toLocaleString("es-CO", { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Usuarios Habilitados</span>
                                <span className="font-bold text-slate-800 text-[15px]">{plan.maxUsers || "Ilimitados"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Vigencia Card */}
                    <div className="bg-slate-900 rounded-xl p-5 text-white shadow-sm flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Vigencia y Acceso</span>
                            <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                                        {tenant.planDuration === 'yearly' ? 'Próxima Renovación Anual' : 'Fecha de Vencimiento'}
                                    </span>
                                    <span className="text-[16px] font-bold text-white">{formatDate(tenant.subscriptionEndDate)}</span>
                                </div>
                                <FiClock className="text-blue-400" size={20} />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <button
                                onClick={() => setShowUpgrade(!showUpgrade)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-[12px] shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-0"
                            >
                                <FiZap size={14} />
                                <span>{showUpgrade ? "Cerrar Catálogo" : "Mejorar mi Suscripción"}</span>
                            </button>
                            {!showUpgrade && (
                                <button
                                    onClick={handleRequestTrial}
                                    disabled={requesting}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-1.5 rounded-lg text-[11px] transition-colors border border-slate-700 cursor-pointer"
                                >
                                    {requesting === 'trial' ? 'Enviando...' : 'Solicitar Mes de Prueba Gratis'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Catalog & Payment Section */}
            {(showUpgrade || isSuperAdmin) && (
                <div className="space-y-4 pt-2">
                    {/* Payment Methods */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <FiCreditCard size={15} />
                            </div>
                            <h3 className="text-[14px] font-bold text-slate-800">Métodos de Pago Autorizados</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {paymentMethods.filter(m => m.active !== false).map((m) => (
                                <div key={m.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                            {m.type?.includes("Billetera") ? <FiSmartphone size={14} /> : <FaUniversity size={14} />}
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">{m.type}</span>
                                            <span className="text-[12px] font-bold text-slate-800">{m.name}</span>
                                        </div>
                                    </div>
                                    <div className="pt-1 border-t border-slate-200">
                                        <span className="text-[13px] font-mono font-bold text-slate-900 block">{m.number}</span>
                                        <span className="text-[10px] text-slate-500">Titular: {m.holder}</span>
                                    </div>
                                </div>
                            ))}

                            {/* WhatsApp Support Box */}
                            <div
                                onClick={handleSupportWhatsApp}
                                className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 flex items-center gap-3 cursor-pointer transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 font-bold">
                                    <FaWhatsapp size={18} />
                                </div>
                                <div className="text-[11px]">
                                    <span className="font-bold text-slate-800 block">Soporte de Pagos</span>
                                    <span className="text-emerald-700 font-medium">Asistencia inmediata vía WhatsApp</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Plans Grid Header */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <h3 className="text-[14px] font-bold text-slate-800">Catálogo de Planes OdontoCloud</h3>

                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setSelectedDuration("monthly")}
                                className={`px-3 py-1 rounded text-[11px] font-bold transition-colors border-0 cursor-pointer ${selectedDuration === 'monthly' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
                            >
                                Mensual
                            </button>
                            <button
                                onClick={() => setSelectedDuration("yearly")}
                                className={`px-3 py-1 rounded text-[11px] font-bold transition-colors border-0 cursor-pointer ${selectedDuration === 'yearly' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'}`}
                            >
                                Anual (Descuento)
                            </button>
                        </div>
                    </div>

                    {/* Plans Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {plans.map(p => {
                            const isSelected = !isSuperAdmin && p.id === plan.id;
                            return (
                                <div key={p.id} className={`bg-white rounded-xl border p-4 space-y-4 flex flex-col justify-between shadow-sm ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}`}>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-blue-600 uppercase">
                                                {p.maxUsers || "Ilimitados"} Usuarios
                                            </span>
                                            {isSelected && (
                                                <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded">
                                                    Plan Actual
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="text-[16px] font-bold text-slate-800 uppercase">{p.name}</h4>

                                        <div className="pt-1">
                                            <span className="text-[22px] font-bold text-slate-900">
                                                {(selectedDuration === 'yearly' && p.yearlyPrice ? p.yearlyPrice : (p.monthlyPrice || p.price || 0)).toLocaleString("es-CO", { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                                            </span>
                                            <span className="text-[11px] text-slate-400 ml-1">
                                                /{selectedDuration === 'yearly' ? 'año' : 'mes'}
                                            </span>
                                        </div>

                                        <ul className="space-y-1.5 pt-2 text-[11px] text-slate-600">
                                            {p.features?.map(f => (
                                                <li key={f} className="flex items-center gap-1.5">
                                                    <FiCheck className="text-emerald-500 shrink-0" size={13} />
                                                    <span>{f}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <button
                                        onClick={() => handleRequestUpgrade(p)}
                                        disabled={isSelected || requesting}
                                        className={`w-full py-2 rounded-lg text-[12px] font-bold transition-colors cursor-pointer border-0 ${
                                            isSelected ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                        }`}
                                    >
                                        {isSelected ? "Plan Instalado" : (requesting === p.id ? "Procesando..." : "Solicitar Cambio")}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
