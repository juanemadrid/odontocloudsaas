import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MASTER_CONFIG } from '../../constants/MasterConfig';
import PricingSection from './PricingSection';
import { getPlans } from '../../services/adminService';
import FAQSection from './FAQSection';
import { fetchTenantConfigBySlug } from "../../utils/tenantConfigHelper";
import TrialModal from "../../components/landing/TrialModal";
import SubscriptionModal from "../../components/landing/SubscriptionModal";

export default function PricingPage() {
    const [config, setConfig] = useState(MASTER_CONFIG);
    const [plans, setPlans] = useState([]);
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState("");

    useEffect(() => {
        window.scrollTo(0, 0);
        const loadData = async () => {
            try {
                const publicConfig = await fetchTenantConfigBySlug(null, true);
                setConfig(publicConfig);

                // 2. Load plans
                const dbPlans = await getPlans();
                setPlans(dbPlans.filter(p => p.active !== false));
            } catch (e) {
                console.error("Error loading pricing data:", e);
                setConfig(MASTER_CONFIG);
            } finally {
                // setLoading(false);
            }
        };
        loadData();
    }, []);

    return (
        <div className="bg-[#022a63] min-h-screen relative overflow-hidden text-white">
            {/* Header Section (Unified Style) */}
            <section className="bg-[#022a63] pt-32 pb-24 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 mb-8"
                    >
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                        <span className="text-blue-100 font-bold tracking-[0.2em] text-[10px] uppercase">Flexibilidad y Potencia</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl md:text-7xl font-display font-bold text-white mb-8 leading-tight"
                    >
                        Planes que <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-amber-300 italic">crecen contigo</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-xl md:text-2xl text-blue-100/70 max-w-3xl mx-auto font-light leading-relaxed"
                    >
                        Transparencia total. Elige el nivel de potencia que necesita tu práctica dental hoy.
                    </motion.p>
                </div>
            </section>

            {/* Subtle Gradient Transition */}
            <div className="h-32 bg-gradient-to-b from-[#022a63] to-white"></div>

            <div className="relative z-10 -mt-16">
                <PricingSection
                    dark={true}
                    config={config}
                    dbPlans={plans}
                    onShowTrial={(plan) => {
                        // User Request: Plans page should lead to subscription/payment, not trial
                        setSelectedPlan(plan);
                        setShowSubscriptionModal(true);
                    }}
                />
            </div>

            <TrialModal
                isOpen={showTrialModal}
                onClose={() => setShowTrialModal(false)}
                initialPlan={selectedPlan}
            />

            <SubscriptionModal
                isOpen={showSubscriptionModal}
                onClose={() => setShowSubscriptionModal(false)}
                plan={selectedPlan}
            />

            {/* Bottom CTA */}
            <section className="py-24 bg-transparent border-t border-white/10 relative">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-[#022a63] to-transparent opacity-50 pointer-events-none" />
                <div className="container mx-auto px-6 text-center relative z-10">
                    <h2 className="text-3xl font-display font-bold text-white mb-8">
                        ¿Tienes dudas sobre el plan ideal?
                    </h2>
                    <p className="text-lg text-slate-300 mb-12">
                        Nuestro equipo de especialistas está listo para asesorarte sin compromiso.
                    </p>
                    <a
                        href={`https://wa.me/573001234567?text=Hola,%20necesito%20asesoría%20con%20los%20planes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-4 px-10 rounded-full hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all shadow-lg border border-white/10"
                    >
                        HABLAR CON UN ASESOR
                    </a>
                </div>
            </section>
        </div>
    );
}
