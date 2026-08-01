import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import supabase from "../lib/supabaseClient";
import VivaHeader from "./VivaHeader";
import VivaFooter from "./VivaFooter";
import { MASTER_CONFIG } from "../constants/MasterConfig";
import { DEFAULT_CONFIG } from "../constants/DefaultConfig";
import { useAuth } from "../context/AuthContext";
import { FaWhatsapp } from "react-icons/fa";
import "../styles/modern.css";


import { fetchTenantConfigBySlug } from "../utils/tenantConfigHelper";

export default function ModernLayout() {
    const { pathname } = useLocation();
    const { clinicSlug } = useParams();
    const { userProfile } = useAuth();

    const isMaster = !clinicSlug && !pathname.startsWith('/c/');

    const [config, setConfig] = useState(isMaster ? MASTER_CONFIG : DEFAULT_CONFIG);

    useEffect(() => {
        if (isMaster) {
            setConfig(MASTER_CONFIG);
            return;
        }

        let isMounted = true;
        const loadData = async () => {
            try {
                const fetchedConfig = await fetchTenantConfigBySlug(clinicSlug || "atm", false);
                if (isMounted && fetchedConfig) {
                    setConfig(fetchedConfig);
                }
            } catch (e) {
                console.error("Error loading Layout Config:", e);
            }
        };
        loadData();
        return () => { isMounted = false; };
    }, [isMaster, clinicSlug]);

    const displayConfig = isMaster ? MASTER_CONFIG : {
        ...config,
        name: config.name || userProfile?.tenant?.name || "Clínica Dental"
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
