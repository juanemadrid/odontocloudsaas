import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import ServicesSection from "./ServicesSection";
import { DEFAULT_CONFIG } from "../../constants/DefaultConfig";
import { MASTER_CONFIG } from "../../constants/MasterConfig";
import TrialModal from "../../components/landing/TrialModal";
import { FiArrowRight } from "react-icons/fi";

import { useParams } from "react-router-dom";

export default function ServicesPage() {
    const { clinicSlug } = useParams();
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState("");

    const isMaster = !clinicSlug;

    useEffect(() => {
        const loadData = async () => {
            try {
                if (clinicSlug) {
                    const q = query(collection(db, "tenants"), where("slug", "==", clinicSlug));
                    const qSnap = await getDocs(q);

                    if (!qSnap.empty) {
                        const tenantData = qSnap.docs[0].data();
                        const inquilino = qSnap.docs[0].id;

                        const webRef = doc(db, "website_config", inquilino);
                        const webSnap = await getDoc(webRef);

                        if (webSnap.exists()) {
                            setConfig({ ...DEFAULT_CONFIG, ...webSnap.data(), name: tenantData.name, slug: clinicSlug, isMaster: false });
                        } else {
                            setConfig({ ...DEFAULT_CONFIG, name: tenantData.name, slug: clinicSlug, isMaster: false });
                        }
                    }
                } else {
                    const docRef = doc(db, "website_config", "general");
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        setConfig({
                            ...MASTER_CONFIG,
                            ...snap.data(),
                            services: snap.data().services || MASTER_CONFIG.services,
                            isMaster: true
                        });
                    } else {
                        setConfig(MASTER_CONFIG);
                    }
                }
            } catch (e) {
                console.error("Error loading config:", e);
                setConfig(isMaster ? MASTER_CONFIG : DEFAULT_CONFIG);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [clinicSlug, isMaster]);

    const onShowTrial = (planName) => {
        setSelectedPlan(planName || "Trial");
        setShowTrialModal(true);
    };

    if (loading) return <div className="min-h-screen bg-[#0a0f1a]" />;

    return (
        <div className="bg-[#022a63] min-h-screen relative overflow-hidden font-sans text-white selection:bg-cyan-500/30 selection:text-cyan-200">
            {/* --- HERO SECTION (Dark & Premium) --- */}
            <section className="bg-[#022a63] pt-32 pb-24 text-center relative overflow-hidden">
                {/* Background Texture & Effects */}
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 mb-8"
                    >
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                        <span className="text-blue-100 font-bold tracking-[0.2em] text-[10px] uppercase">
                            {isMaster ? "Solución Integral" : "Experiencia Premium"}
                        </span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl md:text-7xl font-display font-bold text-white mb-8 tracking-tight leading-tight"
                    >
                        {isMaster ? (
                            <>
                                Potencia tu Clínica con <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-amber-300 italic">
                                    Tecnología Inteligente
                                </span>
                            </>
                        ) : (
                            <>
                                Cuidamos tu Sonrisa con <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-amber-300 italic">
                                    Experiencia Elite
                                </span>
                            </>
                        )}
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-xl md:text-2xl text-blue-100/70 max-w-3xl mx-auto font-light leading-relaxed"
                    >
                        {isMaster
                            ? "OdontoCloud ofrece una suite completa de herramientas diseñadas para optimizar cada proceso en tu consultorio dental."
                            : `En ${config.name} combinamos años de experiencia con tecnología de vanguardia para ofrecerte el mejor servicio.`
                        }
                    </motion.p>
                </div>
            </section>

            {/* Subtle Gradient Transition (Like Plans Page) */}
            <div className="h-32 bg-gradient-to-b from-[#022a63] to-white"></div>

            {/* --- CONTENT SECTION (Premium Dark Background) --- */}
            <div className="relative z-10 pb-32 -mt-16 bg-transparent">
                <div className="container mx-auto px-6">
                    <ServicesSection
                        dark={true}
                        config={{
                            ...config,
                            isMaster: isMaster,
                            servicesLimit: 0,
                            servicesSectionTitle: null,
                            servicesSectionDesc: null
                        }}
                        onShowTrial={isMaster ? onShowTrial : () => window.open(`https://wa.me/57${(config?.contactPhone || "3001234567").replace(/\D/g, '')}?text=Hola,%20quisiera%20más%20información%20sobre%20sus%20servicios%20en%20${config?.name}`, '_blank')}
                    />
                </div>
            </div>


            {/* CTA Section - Professional & Clean */}
            {
                isMaster && (
                    <section className="py-24 border-t border-white/10 relative overflow-hidden">
                        {/* Background Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

                        <div className="container mx-auto px-6 max-w-5xl text-center relative z-10">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                            >
                                <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-8 tracking-tight drop-shadow-lg">
                                    ¿Listo para transformar tu negocio?
                                </h2>
                                <p className="text-lg text-slate-300 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
                                    Inicia hoy mismo tu prueba gratuita de 30 días y descubre por qué las clínicas líderes eligen OdontoCloud.
                                </p>
                                <button
                                    onClick={() => onShowTrial()}
                                    className="bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-5 px-12 rounded-full hover:shadow-[0_0_30px_-5px_rgba(14,165,233,0.5)] transition-all shadow-xl active:scale-95 text-sm uppercase tracking-widest border border-white/10"
                                >
                                    EMPEZAR PRUEBA GRATIS
                                </button>
                            </motion.div>
                        </div>
                    </section>
                )
            }

            {
                !isMaster && (
                    <section className="py-24 border-t border-slate-100 bg-white">
                        <div className="container mx-auto px-6 max-w-5xl text-center">
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                            >
                                <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-8 tracking-tight">
                                    {config.ctaTitle || "¿Deseas agendar una cita?"}
                                </h2>
                                <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
                                    {config.ctaText || "Contamos con horarios flexibles y especialistas en todas las áreas para brindarte la mejor atención."}
                                </p>
                                <button
                                    onClick={() => window.open(`https://wa.me/57${(config?.contactPhone || "3001234567").replace(/\D/g, '')}?text=Hola,%20vi%20sus%20servicios%20y%20quisiera%20agendar%20una%20cita%20ne%20${config?.name}`, '_blank')}
                                    className="bg-blue-600 text-white font-bold py-5 px-12 rounded-2xl hover:bg-blue-700 transition-all text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20"
                                >
                                    AGENDAR POR WHATSAPP <FiArrowRight className="inline-block ml-2" />
                                </button>
                            </motion.div>
                        </div>
                    </section>
                )
            }

            {/* Trial Modal Registration */}
            <TrialModal
                isOpen={showTrialModal}
                onClose={() => setShowTrialModal(false)}
                initialPlan={selectedPlan}
            />
        </div >
    );
}
