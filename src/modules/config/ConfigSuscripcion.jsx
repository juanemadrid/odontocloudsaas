import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useToast } from "../../context/ToastContext";
import { getPlans, getPaymentMethods, getGlobalConfig } from "../../services/adminService";
import { FiPackage, FiZap, FiCheckCircle, FiClock, FiStar, FiCreditCard, FiSmartphone, FiArrowRight } from "react-icons/fi";
import { FaWhatsapp, FaUniversity } from "react-icons/fa";

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
            toast.info("Como SuperAdmin, puedes modificar los planes directamente en la base de datos.");
            return;
        }
        const durationText = selectedDuration === "yearly" ? "ANUAL" : "MENSUAL";
        if (!window.confirm(`¿Solicitar cambio al plan "${newPlan.name}" (${durationText})?`)) return;

        setRequesting(newPlan.id);
        const requestData = {
            tenantId: userProfile.tenantId,
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
            toast.success("Solicitud enviada. Redirigiendo a WhatsApp para adjuntar comprobante...");

            const phone = globalConfig.adminPhone || "573124119846";
            const msg = `Hola OdontoCloud, he realizado el pago para el plan *${newPlan.name}* de mi clínica *${tenant.name}*. Adjunto comprobante para activación.`;
            const wpUrl = `https://wa.me/${phone.replace(/\s+/g, '')}?text=${encodeURIComponent(msg)}`;

            setTimeout(() => {
                window.open(wpUrl, "_blank");
                setShowUpgrade(false);
            }, 1500);

        } catch (error) {
            console.error(error);
            toast.error("No se pudo enviar la solicitud. Intenta más tarde.");
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
                tenantId: userProfile.tenantId,
                tenantName: tenant.name,
                requestedPlanName: "MES DE PRUEBA (SOLICITUD)",
                status: "pending",
                paymentStatus: "trial_request",
                tenantPhone: tenant.telCelular || "",
                createdAt: serverTimestamp()
            });
            toast.success("Solicitud enviada.");
            const phone = globalConfig.adminPhone || "573124119846";
            const message = `Hola OdontoCloud, solicito activar el *MES DE PRUEBA* para mi clínica *${tenant.name}*.`;
            window.open(`https://wa.me/${phone.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
        } catch (error) {
            console.error(error);
            toast.error("Error.");
        } finally {
            setRequesting(null);
        }
    };

    const formatDate = (ts) => {
        if (!ts) return "Indefinido";
        if (ts.toDate) return ts.toDate().toLocaleDateString();
        return new Date(ts).toLocaleDateString();
    };

    const getDiscount = (p) => {
        const mPrice = p.monthlyPrice || p.price || 0;
        const yPrice = p.yearlyPrice || 0;
        if (!mPrice || !yPrice) return null;
        const totalMonthly = mPrice * 12;
        const discount = Math.round(((totalMonthly - yPrice) / totalMonthly) * 100);
        return discount > 0 ? `-${discount}%` : null;
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Sincronizando portal...</p>
        </div>
    );

    const isExpired = userProfile?.subscriptionStatus === "expired";

    return (
        <div className="p-2 md:p-6 space-y-8 animate-fade-in">
            {/* Header */}
            <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                <div className="z-10 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <FiPackage size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Portal de Suscripción</h2>
                    </div>
                    <p className="text-slate-500 font-medium">Gestiona los planes y el acceso a la plataforma OdontoCloud</p>
                </div>
                <div className="z-10">
                    <div className={`px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-sm uppercase tracking-widest border-2 shadow-sm ${isSuperAdmin ? "bg-amber-50 text-amber-600 border-amber-100" : (isExpired ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${isSuperAdmin ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" : (isExpired ? "bg-rose-500" : "bg-emerald-500 animate-pulse")}`}></span>
                        {isSuperAdmin ? "Cta. Maestro (MadridSystem)" : (isExpired ? "Suscripción Vencida" : "Servicio Activo")}
                    </div>
                </div>
            </div>

            {/* Platform Master HUD for SuperAdmin */}
            {isSuperAdmin && (
                <div className="bg-slate-900 rounded-[40px] p-10 border border-slate-800 shadow-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl transition-all group-hover:bg-indigo-500/20" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-20 h-20 bg-amber-400 rounded-3xl flex items-center justify-center text-slate-900 shadow-2xl shadow-amber-400/20 transform group-hover:scale-110 transition-transform">
                            <FiZap size={40} />
                        </div>
                        <div className="flex-1 space-y-3">
                            <h3 className="text-2xl font-black text-white tracking-tight uppercase">Panel Maestro del Software</h3>
                            <p className="text-indigo-200 font-medium text-sm leading-relaxed max-w-2xl">
                                MadridSystem tiene control global sobre OdontoCloud. Como administrador del sistema, puedes ver los planes que ofreces a las clínicas y el catálogo de pagos configurado.
                            </p>
                        </div>
                        <button onClick={() => toast.info("Lista de clínicas coming soon...")} className="px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2">
                            Ver carteras de clínicas <FiArrowRight />
                        </button>
                    </div>
                </div>
            )}

            {/* Plan Info - Only for Clinics */}
            {!isSuperAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-xl shadow-slate-200/40 relative group">
                        <div className="absolute top-8 right-8 text-slate-100 group-hover:text-indigo-50 transition-colors pointer-events-none">
                            <FiStar size={80} />
                        </div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Tu Plan Actual</h3>
                        <div className="space-y-6">
                            <div>
                                <p className="text-3xl font-black text-indigo-700 leading-tight">{plan.name || "Plan Personalizado"}</p>
                                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                    {tenant?.planDuration === 'yearly' ? 'Facturación Anual' : 'Facturación Mensual'}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Costo Estimado</label>
                                    <p className="font-black text-slate-700 text-lg">
                                        {(tenant.planDuration === 'yearly' && plan.yearlyPrice ? plan.yearlyPrice : (plan.monthlyPrice || plan.price || 0)).toLocaleString("es-CO", { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Usuarios</label>
                                    <p className="font-black text-slate-700 text-lg">{plan.maxUsers || "Ilimitados"}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                        <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-6">Vigencia y Acceso</h3>
                        <div className="space-y-6 relative z-10">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div>
                                    <p className="text-[10px] text-indigo-300 font-bold uppercase mb-1">
                                        {tenant.planDuration === 'yearly' ? 'Próxima Renovación Anual' : 'Vence / Renueva el'}
                                    </p>
                                    <p className="text-xl font-black text-white">{formatDate(tenant.subscriptionEndDate)}</p>
                                </div>
                                <FiClock className="text-indigo-400" size={24} />
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setShowUpgrade(!showUpgrade)}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <FiZap className="animate-bounce" />
                                    {showUpgrade ? "Cerrar Catálogo" : "Mejorar mi Suscripción"}
                                </button>
                                {!showUpgrade && (
                                    <button onClick={handleRequestTrial} disabled={requesting} className="w-full py-3 bg-white/10 hover:bg-white/20 text-indigo-200 rounded-2xl font-bold text-[10px] uppercase tracking-[.2em] transition-all border border-white/5 active:scale-95">
                                        {requesting === 'trial' ? 'Enviando...' : 'Solicitar Mes de Prueba Gratis'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Catalog & Payment Info */}
            {(showUpgrade || isSuperAdmin) && (
                <div className="space-y-12 pt-4 animate-fade-in-up">
                    {/* Payment Accounts */}
                    <div className="bg-white rounded-[40px] border border-indigo-100 p-10 shadow-xl shadow-indigo-100/20 border-t-4 border-t-indigo-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <FiCreditCard size={28} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Métodos de Pago {isSuperAdmin ? "Configurados" : "Autorizados"}</h3>
                                    <p className="text-sm text-slate-500 font-medium">Cuentas habilitadas para el recaudo de membresías.</p>
                                </div>
                            </div>
                            {isSuperAdmin && (
                                <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Vista de Referencia</span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {paymentMethods.filter(m => m.active !== false).map((m) => (
                                <div key={m.id} className="relative overflow-hidden p-8 rounded-[32px] transition-all group border border-slate-100 bg-slate-50/30 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 flex flex-col justify-between h-[180px]">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden text-white shadow-lg ${m.type?.includes("Billetera") ? 'bg-purple-600 shadow-purple-200' : 'bg-blue-600 shadow-blue-200'}`}>
                                            {m.logoUrl ? (
                                                <img src={m.logoUrl} alt={m.name} className="w-full h-full object-contain p-2 bg-white" />
                                            ) : (
                                                m.type?.includes("Billetera") ? <FiSmartphone size={28} /> : <FaUniversity size={28} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.type}</p>
                                            <p className="font-black text-slate-800 text-xl tracking-tight leading-none mt-1">{m.name}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{m.number}</p>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest opacity-60">Titular: {m.holder}</p>
                                    </div>
                                </div>
                            ))}

                            {/* Support Card */}
                            <div onClick={handleSupportWhatsApp} className="relative overflow-hidden p-8 rounded-[32px] transition-all group border border-emerald-100 bg-emerald-50/40 flex items-center gap-6 cursor-pointer hover:bg-emerald-100 h-[180px] shadow-sm">
                                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-200 group-hover:scale-110 group-hover:rotate-6 transition-all shrink-0">
                                    <FaWhatsapp size={32} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[.3em]">Asistencia Directa</p>
                                    <p className="text-slate-900 font-black text-lg tracking-tight">¿Dudas con tu pago?</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Atención en línea</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-900 p-10 rounded-[48px] border border-slate-800 shadow-3xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                        <div className="z-10">
                            <h3 className="text-2xl font-black text-white tracking-tight leading-none">Catálogo de Planes Premium</h3>
                            <p className="text-sm text-indigo-300 font-medium mt-2">Tarifas preferenciales para socios activos</p>
                        </div>
                        <div className="z-10 flex bg-white/5 p-2 rounded-2xl border border-white/10 shadow-inner">
                            <button onClick={() => setSelectedDuration("monthly")} className={`px-10 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedDuration === 'monthly' ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>MENSUAL</button>
                            <button onClick={() => setSelectedDuration("yearly")} className={`px-10 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedDuration === 'yearly' ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>ANUAL (Mejor Precio)</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
                        {plans.map(p => {
                            const isSelected = !isSuperAdmin && p.id === plan.id;
                            const isPremium = p.name?.toLowerCase().includes("premium");
                            const isCorporate = p.name?.toLowerCase().includes("corporativo");

                            let cardClasses = "bg-white border-slate-100 text-slate-900 shadow-sm";
                            let badgeClasses = "bg-[#020617] text-white";
                            let priceClasses = "text-slate-900";
                            let titleClasses = "text-slate-900";
                            let featureClasses = "text-slate-600";
                            let buttonClasses = "bg-[#020617] hover:bg-slate-800 text-white shadow-xl";

                            if (isCorporate) {
                                cardClasses = "bg-white border-indigo-100 shadow-indigo-100/20";
                                priceClasses = "text-indigo-900";
                                titleClasses = "text-indigo-900";
                            } else if (isPremium) {
                                cardClasses = "bg-[#0f172a] border-slate-800 text-white shadow-slate-950/50";
                                badgeClasses = "bg-amber-400 text-slate-900";
                                priceClasses = "text-white";
                                titleClasses = "text-white";
                                featureClasses = "text-slate-300";
                                buttonClasses = "bg-white hover:bg-slate-100 text-slate-900 shadow-white/10";
                            }

                            return (
                                <div key={p.id} className={`rounded-[48px] p-10 border-2 transition-all duration-500 flex flex-col group relative ${cardClasses} ${isSelected ? "border-indigo-500 scale-105 z-10 shadow-2xl shadow-indigo-100" : (p.recommended ? "border-indigo-300 scale-102 hover:-translate-y-4 shadow-xl" : "hover:-translate-y-4 hover:shadow-2xl")} `}>
                                    {isPremium && <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-indigo-500/20 transition-colors duration-700"></div>}
                                    {isSelected && <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl ${badgeClasses}`}>Plan Instalado</div>}
                                    {p.recommended && !isSelected && <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-8 py-2.5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl animate-bounce z-20">Recomendado</div>}

                                    <div className="mb-10 relative">
                                        <p className={`text-[9px] font-black uppercase tracking-[0.4em] mb-4 opacity-50 ${isPremium ? 'text-amber-400' : 'text-indigo-600'}`}>Nivel {isPremium ? 'Élite' : isCorporate ? 'Profesional' : 'Esencial'} • {p.maxUsers || "Ilimitados"} Usuarios</p>
                                        <h4 className={`text-3xl font-black transition-colors uppercase tracking-tight leading-none ${titleClasses}`}>{p.name}</h4>
                                        <div className={`h-1.5 rounded-full mt-5 transition-all duration-500 group-hover:w-20 ${isPremium ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : isCorporate ? 'bg-indigo-600 w-12' : 'bg-slate-200 w-8'}`}></div>
                                    </div>

                                    <div className="mb-10">
                                        <div className="flex items-baseline gap-2">
                                            <span className={`text-5xl font-black tracking-tighter ${priceClasses}`}>{(selectedDuration === 'yearly' && p.yearlyPrice ? p.yearlyPrice : (p.monthlyPrice || p.price || 0)).toLocaleString("es-CO", { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{selectedDuration === 'yearly' ? '/ anual' : '/ mensual'}</span>
                                                {selectedDuration === 'yearly' && getDiscount(p) && <span className="text-emerald-500 text-[10px] font-black flex items-center gap-1"><FiZap size={10} /> {getDiscount(p)} AHORRO</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-5 mb-12 flex-1 relative">
                                        {p.features?.map(f => (
                                            <div key={f} className={`flex items-start gap-4 text-[11px] font-bold transition-all duration-300 group-hover:pl-2 ${featureClasses}`}>
                                                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isPremium ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'bg-indigo-100 group-hover:bg-indigo-500'} transition-all duration-300`}></div>
                                                <span className="leading-tight">{f === "CMS" ? "Sitio Web Corporativo" : f}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <button onClick={() => handleRequestUpgrade(p)} disabled={isSelected || requesting} className={`w-full py-6 rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] transition-all duration-500 border-2 ${isSelected ? "bg-transparent text-slate-400 cursor-not-allowed border-slate-100" : `${buttonClasses} border-transparent hover:scale-[1.02] active:scale-95`}`}><span className="relative z-10">{isSelected ? "Plan en Uso" : (requesting === p.id ? "Procesando..." : "Solicitar Cambio")}</span></button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
