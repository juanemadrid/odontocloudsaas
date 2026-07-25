import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MASTER_CONFIG } from '../../constants/MasterConfig';
import FAQSection from './FAQSection';
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { DEFAULT_CONFIG } from '../../constants/DefaultConfig';
import { db } from "../../firebase/firebaseConfig";

import { useParams } from "react-router-dom";

export default function FAQPage() {
    const { clinicSlug } = useParams();
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    const isMaster = !clinicSlug;

    useEffect(() => {
        window.scrollTo(0, 0);
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
                        setConfig({ ...MASTER_CONFIG, ...snap.data(), isMaster: true });
                    } else {
                        setConfig(MASTER_CONFIG);
                    }
                }
            } catch (e) {
                console.error("Error loading faq config:", e);
                setConfig(isMaster ? MASTER_CONFIG : DEFAULT_CONFIG);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return <div className="min-h-screen bg-white" />;

    return (
        <div className="bg-[#022a63] min-h-screen text-white">
            {/* Header / Hero */}
            <section className="relative bg-[#022a63] pt-32 pb-64 overflow-hidden">
                {/* Background Patterns */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] -mr-64 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-sky-500/10 rounded-full blur-[100px] -ml-32 -mb-16"></div>
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                </div>

                <div className="container mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <h1 className="text-5xl md:text-7xl font-display font-black text-white mb-8 tracking-tighter leading-tight">
                            Centro de <span className="text-sky-400">Ayuda</span> {isMaster ? "y FAQ" : ""}
                        </h1>
                        <p className="text-xl md:text-2xl text-white/60 font-medium max-w-3xl mx-auto leading-relaxed">
                            {isMaster
                                ? "Respuestas rápidas y soluciones detalladas para optimizar la gestión de tu clínica con OdontoCloud."
                                : `Resuelve tus dudas sobre los servicios y atención en ${config.name}. Estamos para servirte.`
                            }
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Subtle Gradient Transition (Restored) */}
            <div className="h-32 bg-gradient-to-b from-[#022a63] to-white"></div>

            {/* --- CONTENT SECTION (Pure White Background - No Overlap) --- */}
            {/* --- CONTENT SECTION (Premium Dark Background) --- */}
            <div className="relative z-10 pb-32 -mt-16 bg-transparent">
                <FAQSection config={config} simpleView={true} dark={true} />
            </div>

            {/* Bottom Support CTA - Dark */}
            <section className="py-24 border-t border-white/10 relative z-50">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-display font-bold text-white mb-8">
                        ¿No encuentras lo que buscas?
                    </h2>
                    <p className="text-xl text-slate-300 mb-12 font-light max-w-2xl mx-auto">
                        Nuestro equipo de soporte técnico está disponible 24/7 para ayudarte.
                    </p>
                    <a
                        href={`https://wa.me/57${(config?.contactPhone || "3001234567").replace(/\D/g, '')}?text=Hola,%20tengo%20una%20pregunta%20sobre%20${config.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-4 px-10 rounded-full hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all shadow-xl"
                    >
                        CHATEAR CON NOSOTROS
                    </a>
                </div>
            </section>
        </div>
    );
}
