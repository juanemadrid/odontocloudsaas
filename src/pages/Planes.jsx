import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getPlans } from '../services/adminService';
import SubscriptionModal from '../components/landing/SubscriptionModal';
import TrialModal from '../components/landing/TrialModal';

const cop = (n) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

function CheckIcon() {
    return (
        <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs">
            ✓
        </div>
    );
}

export default function Planes() {
    const ctx = useOutletContext();
    const config = ctx?.config || {};
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [billing, setBilling] = useState('anual'); // 'anual' or 'mensual'
    const [showSub, setShowSub] = useState(false);
    const [showTrial, setShowTrial] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [openFaq, setOpenFaq] = useState(null);

    const phone = (config?.contactPhone || '3001234567').replace(/\D/g, '');

    useEffect(() => {
        const fetchDbPlans = async () => {
            try {
                setLoading(true);
                const dbPlans = await getPlans();
                if (Array.isArray(dbPlans) && dbPlans.length > 0) {
                    setPlans(dbPlans);
                }
            } catch (err) {
                console.error("Error al cargar los planes desde Supabase:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDbPlans();
    }, []);

    const handleOpenSub = (plan) => {
        setSelectedPlan(plan);
        setShowSub(true);
    };

    const handleOpenTrial = (plan) => {
        setSelectedPlan(plan);
        setShowTrial(true);
    };

    const COMPARATIVA_DATA = [
        { label: 'Precio anual (5 dentistas)', otrosSoftwares: '$2.205.000', odontoCloud: '$1.190.000', highlight: true },
        { label: 'Cobro por usuario adicional', otrosSoftwares: '+$120.150 / usuario', odontoCloud: '$0 (Tarifa Fija)', highlight: true },
        { label: 'Mínimo de usuarios obligatorio', otrosSoftwares: '3 usuarios mínimo', odontoCloud: 'Sin mínimo' },
        { label: 'Usuarios ilimitados incluidos', otrosSoftwares: 'No', odontoCloud: 'Sí (Tarifa fija)' },
        { label: 'Sitio Web Corporativo (CMS)', otrosSoftwares: 'No', odontoCloud: 'Incluido gratis' },
        { label: 'Facturación Electrónica DIAN + RIPS', otrosSoftwares: 'Solo en plan pro', odontoCloud: 'Incluido en plan Clínica' },
        { label: 'Cláusula de permanencia', otrosSoftwares: '1 año', odontoCloud: 'Sin permanencia' },
        { label: 'Soporte directo por WhatsApp', otrosSoftwares: 'Ticket / Email', odontoCloud: 'Directo en WhatsApp' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30">

            {/* ═══════════════════════════════════════════════════════
                HERO SECTION - CLEAN LIGHT ROYAL BLUE DESIGN
            ═══════════════════════════════════════════════════════ */}
            <section className="relative pt-44 pb-20 px-6 bg-white border-b border-slate-100 overflow-hidden text-center">
                {/* Subtle Background Elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-blue-500/10 via-sky-50/20 to-transparent rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-4xl mx-auto relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-bold uppercase tracking-widest mb-6"
                    >
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        Ahorra hasta un 70% comparado con la competencia
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6"
                    >
                        Planes transparentes con <br />
                        <span className="text-blue-600 font-black">Tarifa Fija Sin Sorpresas</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto font-normal leading-relaxed mb-10"
                    >
                        Sin cobros por usuario adicional ni aumentos inesperados. Elige la suscripción que impulse la rentabilidad de tu clínica.
                    </motion.p>

                    {/* Billing Switch Toggle */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 }}
                        className="inline-flex items-center p-1.5 bg-slate-100 rounded-full border border-slate-200 shadow-inner"
                    >
                        <button
                            onClick={() => setBilling('mensual')}
                            className={`px-6 py-2.5 rounded-full text-xs font-extrabold tracking-wide uppercase transition-all duration-300 ${billing === 'mensual'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            Pago Mensual
                        </button>
                        <button
                            onClick={() => setBilling('anual')}
                            className={`px-6 py-2.5 rounded-full text-xs font-extrabold tracking-wide uppercase transition-all duration-300 flex items-center gap-2 ${billing === 'anual'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            Pago Anual
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${billing === 'anual' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                1 MES GRATIS
                            </span>
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════
                DYNAMIC PLAN CARDS (LOADED FROM SUPERADMIN)
            ═══════════════════════════════════════════════════════ */}
            <section className="py-20 px-6 max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse text-slate-400">
                        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mb-4" />
                        <p className="text-sm font-semibold tracking-wider uppercase">Cargando planes actualizados...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                        {plans.map((plan, i) => {
                            const isRecommended = plan.recommended || plan.isPopular;
                            const displayPrice = billing === 'anual' ? (plan.yearlyPrice || plan.monthlyPrice * 10) : (plan.monthlyPrice || 0);

                            return (
                                <motion.div
                                    key={plan.id || i}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`relative bg-white rounded-3xl p-8 border flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 ${isRecommended
                                            ? 'border-blue-600 shadow-2xl shadow-blue-500/15 ring-2 ring-blue-600/40 scale-105 z-10'
                                            : 'border-slate-200 shadow-lg hover:shadow-xl'
                                        }`}
                                >
                                    {isRecommended && (
                                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
                                            ⭐ MÁS POPULAR
                                        </div>
                                    )}

                                    <div>
                                        {/* Plan Header */}
                                        <div className="mb-6 pb-6 border-b border-slate-100">
                                            <span className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
                                                {plan.maxUsers ? `Hasta ${plan.maxUsers} Usuarios` : 'Usuarios Ilimitados'}
                                            </span>
                                            <h3 className="text-2xl font-extrabold text-slate-900 mt-1 mb-2">
                                                {plan.name}
                                            </h3>
                                            <p className="text-slate-500 text-xs font-normal leading-relaxed min-h-[40px]">
                                                {plan.description || "Solución clínica integral para tu consultorio."}
                                            </p>

                                            {/* Price Display */}
                                            <div className="mt-6">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                                                        {cop(displayPrice)}
                                                    </span>
                                                    <span className="text-slate-400 text-sm font-semibold">
                                                        /{billing === 'anual' ? 'año' : 'mes'}
                                                    </span>
                                                </div>
                                                {billing === 'anual' ? (
                                                    <p className="text-xs text-slate-400 font-medium mt-1">
                                                        Equivalente a {cop(Math.round(displayPrice / 12))}/mes
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-blue-600 font-semibold mt-1">
                                                        Ahorra 1 mes pagando el plan anual
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Plan Features */}
                                        <ul className="space-y-3 mb-8">
                                            {(plan.features || []).map((feat, fi) => (
                                                <li key={fi} className="flex items-start gap-3">
                                                    <CheckIcon />
                                                    <span className="text-xs font-medium text-slate-700 leading-normal">
                                                        {feat}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Actions */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <button
                                            onClick={() => handleOpenSub({ ...plan, billing, displayPrice })}
                                            className={`w-full py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-md ${isRecommended
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'
                                                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                                                }`}
                                        >
                                            Seleccionar {plan.name}
                                        </button>
                                        <button
                                            onClick={() => handleOpenTrial({ ...plan, billing, displayPrice })}
                                            className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
                                        >
                                            Probar 30 días gratis sin compromiso →
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════
                COMPETITOR COMPARISON TABLE
            ═══════════════════════════════════════════════════════ */}
            <section className="py-20 px-6 bg-white border-t border-b border-slate-100">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="text-blue-600 text-xs font-bold tracking-widest uppercase mb-2 block">
                            Comparativa Real
                        </span>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                            OdontoCloud vs La Competencia
                        </h2>
                        <p className="text-slate-500 text-sm mt-2">
                            Compara la inversión real estimada para una clínica con 5 dentistas activos.
                        </p>
                    </div>

                    <div className="bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        {/* Table Header */}
                        <div className="grid grid-cols-3 bg-slate-900 text-white p-4 font-bold text-xs uppercase tracking-wider">
                            <div>Característica</div>
                            <div className="text-center text-slate-400">Software Tradicional</div>
                            <div className="text-center text-blue-400">OdontoCloud</div>
                        </div>

                        {/* Table Body */}
                        {COMPARATIVA_DATA.map((row, idx) => (
                            <div
                                key={idx}
                                className={`grid grid-cols-3 p-4 text-xs font-medium border-t border-slate-200/60 items-center ${row.highlight ? 'bg-blue-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                    }`}
                            >
                                <div className="text-slate-800 font-semibold">{row.label}</div>
                                <div className="text-center text-slate-500">{row.otrosSoftwares}</div>
                                <div className="text-center font-bold text-blue-600">{row.odontoCloud}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════
                FAQ ACCORDION
            ═══════════════════════════════════════════════════════ */}
            <section className="py-20 px-6 max-w-3xl mx-auto">
                <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-10 tracking-tight">
                    Preguntas Frecuentes
                </h2>
                <div className="space-y-3">
                    {[
                        { q: "¿Puedo agregar usuarios sin costo adicional?", a: "¡Sí! Con la tarifa fija de OdontoCloud puedes crear los usuarios que tu clínica requiera sin cobros por persona." },
                        { q: "¿Los cambios que realiza el SuperAdmin se aplican en tiempo real?", a: "Totalmente. Cualquier actualización de precios, nombres o características en el panel del SuperAdmin se refleja de inmediato en esta vista." },
                        { q: "¿Cómo funcionan los 30 días gratis?", a: "No requieres ingresar tarjeta de crédito. Simplemente registras tu consultorio y tienes acceso total a todas las herramientas durante un mes completo." },
                        { q: "¿Incluye facturación electrónica DIAN y RIPS?", a: "Sí, el plan Clínica e IPS Enterprise incluyen el módulo de facturación electrónica integrado y generación de RIPS según la normativa vigente en Colombia." }
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                            className="bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer hover:border-blue-500/50 transition-all duration-200 shadow-xs"
                        >
                            <div className="flex justify-between items-center text-sm font-bold text-slate-900">
                                <span>{item.q}</span>
                                <span className="text-blue-600 text-lg">{openFaq === idx ? '−' : '+'}</span>
                            </div>
                            {openFaq === idx && (
                                <p className="text-xs text-slate-500 leading-relaxed mt-3 pt-3 border-t border-slate-100">
                                    {item.a}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════
                CTA FOOTER BANNER
            ═══════════════════════════════════════════════════════ */}
            <section className="bg-slate-900 text-white py-16 px-6 text-center">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-3xl font-extrabold mb-4">¿Tienes dudas sobre cuál plan elegir?</h2>
                    <p className="text-slate-400 text-sm mb-8">
                        Nuestro equipo de soporte odontológico te asesora en directo por WhatsApp.
                    </p>
                    <button
                        onClick={() => window.open(`https://wa.me/57${phone}`, '_blank')}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-blue-500/30"
                    >
                        <span>💬</span> Contactar Asesor por WhatsApp
                    </button>
                </div>
            </section>

            {/* Modals */}
            <SubscriptionModal
                isOpen={showSub}
                onClose={() => setShowSub(false)}
                plan={selectedPlan}
                config={config}
            />
            <TrialModal
                isOpen={showTrial}
                onClose={() => setShowTrial(false)}
                plan={selectedPlan}
                config={config}
            />
        </div>
    );
}
