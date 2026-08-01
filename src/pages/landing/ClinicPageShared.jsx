import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight, FiArrowLeft, FiChevronDown } from "react-icons/fi";
import { fetchTenantConfigBySlug } from "../../utils/tenantConfigHelper";
import { DEFAULT_CONFIG } from "../../constants/DefaultConfig";

/**
 * Reusable page hero with video background for clinic sub-pages
 */
export function ClinicPageHero({ config, title, subtitle, badge }) {
    const navigate = useNavigate();
    const { clinicSlug } = useParams();
    const clinicBase = clinicSlug ? `/c/${clinicSlug}` : "";
    const clinicPrimary = config?.primaryColor || "#1e3a8a";
    const clinicAccent = clinicPrimary; // single-color design
    const clinicPhone = (config?.contactPhone || "3015768935").replace(/\D/g, "");

    const handleCita = () => {
        const msg = encodeURIComponent(`Hola, quisiera solicitar una cita en ${config?.name || "la clínica"}.`);
        window.open(`https://wa.me/57${clinicPhone}?text=${msg}`, '_blank');
    };

    return (
        <div className="relative min-h-[65vh] flex items-end overflow-hidden" style={{ paddingTop: '80px' }}>
            {/* Video background */}
            <video autoPlay muted loop playsInline preload="auto"
                className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }}>
                <source src={`${import.meta.env.BASE_URL}video.mp4`} type="video/mp4" />
            </video>
            {/* Strong dark gradient overlay — heavier at bottom so text is always legible */}
            <div className="absolute inset-0" style={{
                zIndex: 1,
                background: 'linear-gradient(to bottom, rgba(4,8,20,0.45) 0%, rgba(4,8,20,0.65) 50%, rgba(4,8,20,0.92) 100%)'
            }} />

            <div className="relative w-full max-w-7xl mx-auto px-6 md:px-16 pb-16 pt-10" style={{ zIndex: 2 }}>
                {/* Back button */}
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => navigate(clinicBase || '/')}
                    className="flex items-center gap-2 text-white/50 hover:text-white/90 text-sm font-medium mb-10 transition-colors group"
                >
                    <FiArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Volver al inicio
                </motion.button>

                {badge && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[11px] font-black uppercase tracking-[0.2em] mb-4"
                        style={{ color: 'rgba(255,255,255,0.65)' }}
                    >
                        {badge}
                    </motion.p>
                )}

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="text-5xl md:text-7xl font-black text-white leading-[1.02] tracking-tight mb-5"
                    style={{ textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}
                >
                    {title}
                </motion.h1>

                {subtitle && (
                    <motion.p
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="text-white/65 text-lg max-w-xl leading-relaxed mb-10"
                    >
                        {subtitle}
                    </motion.p>
                )}

                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    onClick={handleCita}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-white font-bold text-sm transition-all"
                    style={{ background: clinicPrimary }}
                >
                    Agendar Cita
                    <FiArrowRight size={15} />
                </motion.button>
            </div>
        </div>
    );
}

// Module-level cache: each slug is only fetched once per browser session.
// On navigation to /servicios → /nosotros the config is returned instantly.

const _configCache = {};

/**
 * Hook to load clinic config from slug
 */
export function useClinicConfig() {
    const { clinicSlug } = useParams();
    const cached = clinicSlug ? _configCache[clinicSlug] : null;
    const [config, setConfig] = useState(cached || DEFAULT_CONFIG);
    const [loading, setLoading] = useState(!cached && !!clinicSlug);

    useEffect(() => {
        if (!clinicSlug) { setLoading(false); return; }
        // Already cached — nothing to do
        if (_configCache[clinicSlug]) {
            setConfig(_configCache[clinicSlug]);
            setLoading(false);
            return;
        }
        fetchTenantConfigBySlug(clinicSlug, false)
            .then(cfg => {
                if (cfg) {
                    _configCache[clinicSlug] = cfg;
                    setConfig(cfg);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [clinicSlug]);

    return { config, loading };
}
