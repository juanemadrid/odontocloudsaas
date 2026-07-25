import React, { useState, useEffect } from "react";
import ModernLanding from "./ModernLanding";
import VivaHeader from "../layout/VivaHeader";
import VivaFooter from "../layout/VivaFooter";
import IdentitySection from "./landing/IdentitySection";
import ServicesSection from "./landing/ServicesSection";
import { DEFAULT_CONFIG } from "../constants/DefaultConfig";

export default function CmsPreview() {
    const [config, setConfig] = useState(() => {
        try {
            const raw = localStorage.getItem("odc_cms_preview_config");
            return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
        } catch {
            return DEFAULT_CONFIG;
        }
    });

    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem("odc_cms_preview_active_tab") || "hero";
    });

    const [isMaster, setIsMaster] = useState(() => {
        return localStorage.getItem("odc_cms_preview_is_master") === "true";
    });

    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === "odc_cms_preview_config") {
                try {
                    setConfig(e.newValue ? JSON.parse(e.newValue) : DEFAULT_CONFIG);
                } catch (err) {
                    console.error("Error parsing preview config", err);
                }
            } else if (e.key === "odc_cms_preview_active_tab") {
                setActiveTab(e.newValue || "hero");
            } else if (e.key === "odc_cms_preview_is_master") {
                setIsMaster(e.newValue === "true");
            }
        };

        window.addEventListener("storage", handleStorageChange);

        // Fast interval to sync configuration instantly
        const interval = setInterval(() => {
            try {
                const rawConfig = localStorage.getItem("odc_cms_preview_config");
                if (rawConfig) {
                    const parsed = JSON.parse(rawConfig);
                    if (JSON.stringify(parsed) !== JSON.stringify(config)) {
                        setConfig(parsed);
                    }
                }
                const tab = localStorage.getItem("odc_cms_preview_active_tab");
                if (tab && tab !== activeTab) {
                    setActiveTab(tab);
                }
                const master = localStorage.getItem("odc_cms_preview_is_master") === "true";
                if (master !== isMaster) {
                    setIsMaster(master);
                }
            } catch (err) {
                // Ignore
            }
        }, 150);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            clearInterval(interval);
        };
    }, [config, activeTab, isMaster]);

    return (
        <div className="min-h-screen bg-white">
            <VivaHeader config={config} isPreview={true} />
            <div className="p-0">
                <ModernLanding previewConfig={config} isMaster={isMaster} activeTab={activeTab} />
            </div>
            <VivaFooter config={{ ...config, isMaster: isMaster }} isPreview={true} />
        </div>
    );
}
