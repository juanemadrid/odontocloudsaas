import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiStar, FiZap, FiX } from 'react-icons/fi';
import { getPlans } from '../../services/adminService';

export default function PricingSection({ config, dbPlans, onShowTrial, dark = false }) {
    const [fetchedPlans, setFetchedPlans] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!dbPlans || dbPlans.length === 0) {
            setLoading(true);
            getPlans()
                .then(plans => {
                    setFetchedPlans(plans || []);
                })
                .catch(err => console.error("Error cargando planes en PricingSection:", err))
                .finally(() => setLoading(false));
        }
    }, [dbPlans]);

    const featureMapping = {
        "Agenda": "Agenda Inteligente con Recordatorios",
        "Pacientes": "Gestión de Pacientes e Historia Clínica Digital",
        "Inventario": "Control de Inventarios y Suministros",
        "Facturación": "Módulo de Facturación Integrado",
        "Facturacion": "Módulo de Facturación Integrado",
        "RIPS": "RIPS y Normativa de Salud Vigente",
        "Administración": "Módulo de Administración Clínica",
        "Administracion": "Módulo de Administración Clínica",
        "CMS": "Sitio Web Corporativo Profesional (CMS)",
        "Personalizacion": "Personalización Web para tu Clínica"
    };

    const sourcePlans = (dbPlans && dbPlans.length > 0) ? dbPlans : fetchedPlans;

    let displayPlans = sourcePlans.map(p => {
        const hasFactus = p.includeFacturacion !== false && Boolean(p.facturasIncluidas && p.facturasIncluidas > 0);
        const factusFeature = hasFactus
            ? `⚡ Facturación Electrónica (${(p.facturasIncluidas || 300).toLocaleString('es-CO')} / mes)`
            : `✕ Sin Facturación Electrónica`;

        const enrichedFeatures = [factusFeature];

        if (p.features && Array.isArray(p.features)) {
            p.features.forEach(f => {
                const clean = f.trim();
                const mapped = featureMapping[clean] || clean;
                if (!enrichedFeatures.includes(mapped)) {
                    enrichedFeatures.push(mapped);
                }
            });
        }

        return {
            ...p,
            name: p.name || "Plan",
            desc: p.description || p.desc || "Solución clínica integral para tu consultorio.",
            userLimit: p.maxUsers ? `Hasta ${p.maxUsers} Usuarios` : "Usuarios Ilimitados",
            coreModule: p.coreModule || "Módulo Core",
            price: p.monthlyPrice || p.price || 0,
            yearlyPrice: p.yearlyPrice || p.annualPrice || 0,
            recommended: p.recommended || p.isPopular || p.name?.toLowerCase().includes('corporativo'),
            features: enrichedFeatures,
            btnText: `Elegir ${p.name}`
        };
    });

    if (displayPlans.length === 2 && !displayPlans[1].recommended) {
        displayPlans[1].recommended = true;
    }

    return (
        <section id="planes" className={`py-32 relative overflow-hidden ${dark ? 'bg-transparent' : 'bg-slate-50'}`}>
            {/* Background Ornaments */}
            {!dark && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-100/30 rounded-full blur-[120px] pointer-events-none" />}

            <div className={`container relative z-10 mx-auto px-6`}>
                <div className="text-center mb-20">
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-indigo-500 font-bold tracking-widest text-sm uppercase mb-3 block"
                    >
                        Planes y Precios
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className={`text-4xl md:text-6xl font-display font-bold mb-6 ${dark ? 'text-white' : 'text-slate-900'}`}
                    >
                        Inversión inteligente para <br /> tu crecimiento digital
                    </motion.h2>
                    <p className={`text-xl max-w-2xl mx-auto font-light leading-relaxed ${dark ? 'text-slate-200' : 'text-slate-500'}`}>
                        Elige el plan que mejor se adapte al tamaño de tu práctica. <br /> Sin contratos forzosos ni letras pequeñas.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {displayPlans.map((plan, i) => {
                        const isRecommended = plan.isPopular || plan.recommended;

                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className={`relative p-8 rounded-[2.5rem] border shadow-2xl flex flex-col h-full overflow-hidden transition-all duration-500 hover:-translate-y-3 z-10 
                                    ${isRecommended
                                        ? 'bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 border-blue-400/50 text-white ring-4 ring-blue-500/20 scale-105 z-20 shadow-blue-900/40'
                                        : dark
                                        ? 'glass-premium border-white/10 text-white'
                                        : 'bg-white border-slate-200 text-slate-900 hover:border-blue-300'
                                    }`}
                            >
                                {/* Top Color Gradient Bar */}
                                <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r 
                                    ${i % 3 === 0 ? 'from-cyan-400 to-blue-600' : i % 3 === 1 ? 'from-purple-500 via-pink-500 to-amber-400' : 'from-emerald-400 to-teal-600'}`} 
                                />

                                {isRecommended && (
                                    <motion.div
                                        initial={{ x: 50, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        className="absolute top-4 right-4 px-5 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-1.5 z-20 shadow-lg bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white border border-white/20 animate-pulse"
                                    >
                                        <FiStar /> MÁS POPULAR
                                    </motion.div>
                                )}

                                <div className="mb-8 pt-2">
                                    <h3 className={`text-2xl font-black mb-2 ${isRecommended || dark ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                                    <p className={`text-xs font-medium leading-relaxed mb-6 ${isRecommended || dark ? 'text-slate-300' : 'text-slate-500'}`}>{plan.desc || plan.description}</p>

                                    <div className="flex flex-wrap gap-2">
                                        {plan.userLimit && (
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border
                                                ${isRecommended || dark ? 'bg-blue-500/20 border-blue-400/30 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                                {plan.userLimit}
                                            </span>
                                        )}
                                        {plan.coreModule && (
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border
                                                ${isRecommended || dark ? 'bg-purple-500/20 border-purple-400/30 text-purple-200' : 'bg-purple-50 border-purple-100 text-purple-700'}`}>
                                                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                                                {plan.coreModule}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <div className="space-y-2">
                                        <div className="flex items-baseline gap-2">
                                            <span className={`text-4xl font-black tracking-tight ${isRecommended || dark ? 'text-white' : 'text-slate-900'}`}>
                                                $ {Number(plan.price || plan.monthlyPrice).toLocaleString('es-CO')}
                                            </span>
                                            <span className={`${isRecommended || dark ? 'text-slate-300' : 'text-slate-400'} font-bold text-sm`}>/mes</span>
                                        </div>

                                        {(plan.yearlyPrice || plan.annualPrice) > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${isRecommended || dark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    $ {Number(plan.yearlyPrice || plan.annualPrice).toLocaleString('es-CO')} / año
                                                </span>
                                                <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                                                    Ahorra 15%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`mt-4 text-[10px] font-black uppercase tracking-widest border-t pt-3 ${isRecommended || dark ? 'border-white/10 text-cyan-300/70' : 'border-slate-100 text-blue-600/70'}`}>
                                        IVA Incluido • Pesos Colombianos
                                    </div>
                                </div>

                                <ul className="space-y-3.5 mb-10 flex-grow">
                                    {(plan.features || []).map((feat, j) => {
                                        const isFactus = feat.startsWith("⚡");
                                        const isNoFactus = feat.startsWith("✕");

                                        return (
                                            <li key={j} className="flex items-start gap-3 group/item">
                                                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors
                                                    ${isFactus 
                                                        ? 'bg-emerald-500 text-white font-black shadow-md shadow-emerald-500/30' 
                                                        : isNoFactus 
                                                        ? 'bg-slate-200 text-slate-400' 
                                                        : isRecommended || dark 
                                                        ? 'bg-blue-500/30 text-blue-300' 
                                                        : 'bg-blue-100 text-blue-600'
                                                    }
                                                `}>
                                                    {isFactus ? <FiZap size={11} /> : isNoFactus ? <FiX size={11} /> : <FiCheck size={12} />}
                                                </div>
                                                <span className={`text-xs font-semibold leading-tight ${isFactus ? 'font-black text-emerald-400' : isNoFactus ? 'text-slate-400 line-through' : isRecommended || dark ? 'text-slate-200' : 'text-slate-700'}`}>
                                                    {feat.replace(/^⚡\s*/, '').replace(/^✕\s*/, '')}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <button
                                    onClick={() => {
                                        if (onShowTrial) {
                                            onShowTrial(plan);
                                        }
                                    }}
                                    className={`w-full py-4 px-8 rounded-2xl font-black transition-all duration-300 uppercase tracking-[0.2em] text-xs shadow-xl transform active:scale-95
                                        ${isRecommended
                                            ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 text-white shadow-indigo-500/30 hover:brightness-110 border-b-4 border-indigo-700'
                                            : 'bg-gradient-to-r from-slate-900 to-blue-900 text-white hover:from-blue-600 hover:to-cyan-600 shadow-slate-900/20'
                                        }`}
                                >
                                    {plan.btnText || `Elegir ${plan.name}`}
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section >
    );
}
