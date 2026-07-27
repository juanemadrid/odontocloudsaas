import React, { useState, useEffect } from "react";
import supabase from "../../lib/supabaseClient";
import IdentitySection from "./IdentitySection";
import { DEFAULT_CONFIG } from "../../constants/DefaultConfig";
import { MASTER_CONFIG } from "../../constants/MasterConfig";

import { useParams } from "react-router-dom";

export default function IdentityPage() {
    const { clinicSlug } = useParams();
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    const isMaster = !clinicSlug;

    useEffect(() => {
        const loadData = async () => {
            try {
                if (clinicSlug) {
                    const { data: tenantData } = await supabase.from("tenants").select("*").eq("slug", clinicSlug).maybeSingle();
                    if (tenantData) {
                        const inquilino = tenantData.id;
                        const { data: webSnap } = await supabase.from("website_config").select("config").eq("tenant_id", inquilino).maybeSingle();
                        if (webSnap?.config) {
                            setConfig({ ...DEFAULT_CONFIG, ...webSnap.config, name: tenantData.nombre || tenantData.name, slug: clinicSlug, isMaster: false });
                        } else {
                            setConfig({ ...DEFAULT_CONFIG, name: tenantData.nombre || tenantData.name, slug: clinicSlug, isMaster: false });
                        }
                    }
                } else {
                    const { data: webSnap } = await supabase.from("website_config").select("config").eq("tenant_id", "general").maybeSingle();
                    if (webSnap?.config) {
                        setConfig({ ...MASTER_CONFIG, ...webSnap.config, isMaster: true });
                    } else {
                        setConfig(MASTER_CONFIG);
                    }
                }
            } catch (e) {
                console.error("Error loading identity config:", e);
                setConfig(isMaster ? MASTER_CONFIG : DEFAULT_CONFIG);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return <div className="min-h-screen bg-white" />;

    return (
        <div className="pt-20">
            <IdentitySection config={config} />
        </div>
    );
}
