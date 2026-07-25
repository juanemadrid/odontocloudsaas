import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ServicesSection from './landing/ServicesSection';
import TrialModal from '../components/landing/TrialModal';
import { FiArrowRight } from 'react-icons/fi';

export default function Servicios() {
    const { config } = useOutletContext() || {};
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState("Trial");

    const onShowTrial = () => {
        if (!config?.isMaster) {
            const whatsappUrl = `https://wa.me/57${(config?.contactPhone || "3001234567").replace(/\D/g, '')}?text=Hola,%20quisiera%20agendar%20una%20cita%20en%20${config?.name || 'la clínica'}`;
            window.open(whatsappUrl, '_blank');
            return;
        }
        setShowTrialModal(true);
    };

    return (
        <div className="fade-in min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
            {/* HERO SECTION - PREMIUM DARK THEME */}
            <section className="relative pt-48 pb-20 px-6 overflow-hidden bg-[#020617] text-white">
                {/* Mesh Gradients */}
                <div className="absolute inset-0 opacity-40 pointer-events-none">
                    <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse duration-[10s]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-[100px]" />
                </div>
                <div className="absolute inset-0 bg-[url('/odontocloud-react/noise.svg')] opacity-10 mix-blend-overlay"></div>

                <div className="container mx-auto max-w-7xl relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sky-500/30 bg-sky-500/10 backdrop-blur-md mb-6">
                        <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.6)]"></span>
                        <span className="text-sky-200 text-xs font-bold tracking-widest uppercase">Ecosistema Integral</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 text-white tracking-tight leading-tight drop-shadow-2xl">
                        Todo lo que tu clínica necesita <br />
                        <span className="text-gradient-gold">en un solo lugar</span>
                    </h1>

                    <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-light">
                        Olvídate de usar múltiples herramientas desconectadas. Centraliza tu operación con la suite más potente del mercado.
                    </p>
                </div>
            </section>

            {/* SERVICES GRID - SHARED COMPONENT */}
            <ServicesSection config={{ ...config, servicesSectionTitle: null }} dark={false} onShowTrial={onShowTrial} />

            {/* CTA SECTION - CLEAN & ELEGANT */}
            <section className="bg-[#022a63] text-white py-24 relative overflow-hidden mt-auto">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}></div>

                <div className="container mx-auto px-6 text-center relative z-10">
                    <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
                        ¿Listo para escalar tu negocio?
                    </h2>
                    <p className="text-blue-100 text-lg mb-10 max-w-2xl mx-auto font-light">
                        Únete a las clínicas más exitosas que ya confían en OdontoCloud para su gestión diaria.
                    </p>
                    <button
                        onClick={onShowTrial}
                        className="bg-white text-[#022a63] px-10 py-4 rounded-full font-bold text-sm tracking-widest hover:bg-amber-400 hover:text-[#022a63] hover:shadow-lg hover:scale-105 transition-all duration-300 shadow-xl inline-flex items-center gap-2"
                    >
                        COMENZAR PRUEBA GRATIS <FiArrowRight />
                    </button>
                </div>
            </section>

            {/* TRIAL MODAL */}
            <TrialModal
                isOpen={showTrialModal}
                onClose={() => setShowTrialModal(false)}
                initialPlan={selectedPlan}
            />
        </div>
    );
}
