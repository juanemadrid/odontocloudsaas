import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import VivaHeader from "./VivaHeader";
import VivaFooter from "./VivaFooter";
import "../styles/landing.css";
import "../styles/inner.css";

export default function VivaLayout() {
    const [config, setConfig] = useState({
        contactPhone: "300 123 4567"
    });

    // Load Config
    useEffect(() => {
        const loadData = async () => {
            try {
                const { data: webSnap } = await supabase.from("website_config").select("config").eq("tenant_id", "general").maybeSingle();
                if (webSnap?.config) setConfig((prev) => ({ ...prev, ...webSnap.config }));
            } catch (e) {
                console.error(e);
            }
        };
        loadData();
    }, []);

    return (
        <div className="viva-wrapper">
            <VivaHeader config={config} />

            {/* CONTENT OUTLET */}
            <main>
                <Outlet />
            </main>

            <VivaFooter />
        </div>
    );
}
