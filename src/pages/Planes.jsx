import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import PricingSection from './landing/PricingSection';
import SubscriptionModal from '../components/landing/SubscriptionModal';
import TrialModal from '../components/landing/TrialModal';

export default function Planes() {
    const { config } = useOutletContext();
    const [showModal, setShowModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState("");

    const onShowTrial = (plan) => {
        setSelectedPlan(plan);
        setShowModal(true);
    };

    return (
        <div className="fade-in min-h-screen flex flex-col bg-slate-50 font-sans">
            {/* HERO SECTION - CLEAN WHITE */}
            <section className="relative pt-52 pb-24 px-6 bg-white border-b border-slate-100">
                <div className="container-custom mx-auto relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 mb-6">
                        <span className="text-emerald-700 text-xs font-bold tracking-widest uppercase">Sin Cláusulas de Permanencia</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 text-slate-900 tracking-tight">
                        Planes transparentes <br />
                        <span className="text-blue-600">para cada etapa</span>
                    </h1>

                    <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-light">
                        Desde consultorios independientes hasta redes de clínicas. Elige el plan que se adapte a tu ritmo de crecimiento.
                    </p>
                </div>

                {/* Soft Background Blur Props */}
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-50/50 rounded-full blur-[100px] pointer-events-none translate-x-1/3 translate-y-1/3"></div>
            </section>

            {/* PRICING SECTION - Embed Existing Component (It already supports White/Light theme well) */}
            <div className="relative z-10 -mt-10">
                <PricingSection config={config} onShowTrial={onShowTrial} dark={false} />
            </div>

            {/* CTA SECTION - CLEAN & ELEGANT */}
            <section className="bg-white py-24 mt-auto border-t border-slate-100">
                <div className="container-custom mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-slate-900 mb-6 font-display">
                        ¿Tienes requerimientos especiales?
                    </h2>
                    <p className="text-slate-500 mb-10 max-w-xl mx-auto">
                        Para franquicias o redes de más de 10 sedes, ofrecemos planes Enterprise con API dedicada y Account Manager.
                    </p>
                    <button
                        onClick={() => window.open(`https://wa.me/57${(config?.contactPhone || "3001234567").replace(/\D/g, '')}`, '_blank')}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-full border-2 border-slate-200 text-slate-700 font-bold text-sm hover:border-blue-600 hover:text-blue-600 transition-all duration-300"
                    >
                        <span>📞</span> CONTACTAR A VENTAS CORPORATIVAS
                    </button>
                </div>
            </section>

            <SubscriptionModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                plan={selectedPlan}
            />
        </div>
    );
}
