import React, { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
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
                    // Logic for Clinic Tenant
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
                    // SaaS Master Logic
                    const docRef = doc(db, "website_config", "general");
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        setConfig({ ...MASTER_CONFIG, ...snap.data(), isMaster: true });
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
