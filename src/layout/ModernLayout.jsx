import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import supabase from "../lib/supabaseClient";
import VivaHeader from "./VivaHeader";
import VivaFooter from "./VivaFooter";
import { MASTER_CONFIG } from "../constants/MasterConfig";
import { DEFAULT_CONFIG } from "../constants/DefaultConfig";
import { useAuth } from "../context/AuthContext";
import { FaWhatsapp } from "react-icons/fa";
import LandingAiAssistant from "../components/landing/LandingAiAssistant";
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

            {/* Floating Intelligent AI Assistant (Solo en Master Landing de OdontoCloud SaaS) */}
            {isMaster && <LandingAiAssistant config={displayConfig} />}

            {/* Para Clínicas: Botón directo a WhatsApp de Recepción sin bot de ventas SaaS */}
            {!isMaster && (config.phone || config.contactPhone) && (
                <a
                    href={`https://wa.me/57${(config.phone || config.contactPhone || "").replace(/\D/g, '')}?text=Hola,%20me%20gustar%C3%ADa%20solicitar%20informaci%C3%B3n%20en%20${encodeURIComponent(displayConfig.name || "la clínica")}.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-full shadow-2xl hover:scale-105 transition-all"
                    title="Chatear con Recepción por WhatsApp"
                >
                    <FaWhatsapp size={20} />
                    <span className="hidden sm:inline">WhatsApp Recepción</span>
                </a>
            )}
        </div>
    );
}
