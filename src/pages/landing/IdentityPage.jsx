import React, { useState, useEffect } from "react";
import { fetchTenantConfigBySlug } from "../../utils/tenantConfigHelper";
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
                const publicConfig = await fetchTenantConfigBySlug(clinicSlug, isMaster);
                setConfig(publicConfig);
            } catch (e) {
                console.error("Error loading identity config:", e);
                setConfig(isMaster ? MASTER_CONFIG : DEFAULT_CONFIG);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [clinicSlug, isMaster]);

    if (loading) return <div className="min-h-screen bg-white" />;

    return (
        <div className="pt-20">
            <IdentitySection config={config} />
        </div>
    );
}
