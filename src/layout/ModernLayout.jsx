import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import VivaHeader from "./VivaHeader";
import VivaFooter from "./VivaFooter";
import { MASTER_CONFIG } from "../constants/MasterConfig";
import { DEFAULT_CONFIG } from "../constants/DefaultConfig";
import { useAuth } from "../context/AuthContext";
import { FaWhatsapp } from "react-icons/fa";
import "../styles/modern.css";


export default function ModernLayout() {
    const { pathname } = useLocation();
    const { clinicSlug } = useParams();
    const { userProfile } = useAuth();

    const masterRoutes = ['/', '/nosotros', '/servicios', '/sedes', '/planes', '/faq'];
    const isMaster = masterRoutes.includes(pathname) || pathname.startsWith('/funcionalidades/');

    const [config, setConfig] = useState(isMaster ? MASTER_CONFIG : {
        ...DEFAULT_CONFIG,
        name: "OdontoCloud"
    });

    useEffect(() => {
        if (isMaster) {
            setConfig(MASTER_CONFIG);
            return;
        }

        const safetyTimer = setTimeout(() => {
            console.warn("⚠️ Layout Data Timeout - Forcing Default");
            setConfig(prev => ({ ...prev, name: "OdontoCloud (Offline Mode)" }));
        }, 3000);

        const loadData = async () => {
            try {
                if (clinicSlug) {
                    const q = query(collection(db, "tenants"), where("slug", "==", clinicSlug));
                    const qSnap = await getDocs(q);
                    if (!qSnap.empty) {
                        const inquilino = qSnap.docs[0].id;
                        const tenantData = qSnap.docs[0].data();

                        const ref = doc(db, "website_config", inquilino);
                        const snap = await getDoc(ref);
                        if (snap.exists()) {
                            setConfig({ ...DEFAULT_CONFIG, ...snap.data(), name: tenantData.name, slug: clinicSlug });
                        } else {
                            setConfig({ ...DEFAULT_CONFIG, name: tenantData.name, slug: clinicSlug });
                        }
                    }
                } else {
                    const ref = doc(db, "website_config", "general");
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        setConfig((prev) => ({ ...prev, ...snap.data() }));
                    }
                }
            } catch (e) {
                console.error("Error loading Layout Config:", e);
            } finally {
                clearTimeout(safetyTimer);
            }
        };
        loadData();
    }, [isMaster, clinicSlug]);

    const displayConfig = {
        ...config,
        name: userProfile?.tenant?.name || config.name || "OdontoCloud"
    };

    // Header styling: Use clean, crisp light mode navigation
    const hasHeroHeader = false;

    return (
        <div className="viva-root landing-mode min-h-screen flex flex-col font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
            <VivaHeader config={displayConfig} overlay={hasHeroHeader} />

            <main className="flex-1 w-full relative">
                <Outlet context={{ config: displayConfig }} />
            </main>

            <VivaFooter config={displayConfig} />

            {/* Floating WhatsApp Support */}
            <a
                href={`https://wa.me/57${(displayConfig?.contactPhone || "3001234567").replace(/\D/g, '')}?text=Hola,%20quisiera%20más%20información%20sobre%20sus%20servicios%20en%20${displayConfig?.name || 'la clínica'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-8 right-8 z-[90] bg-[#25D366] text-white p-4 rounded-full shadow-[0_10px_20px_rgba(37,211,102,0.3)] hover:bg-[#20bd5a] hover:scale-110 transition-all duration-300 group"
                title="Habla con soporte"
            >
                <FaWhatsapp size={28} />
                <span className="absolute right-full mr-4 bg-slate-900 text-white text-xs py-2 px-4 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                    ¿Necesitas ayuda?
                </span>
            </a>
        </div>
    );
}
