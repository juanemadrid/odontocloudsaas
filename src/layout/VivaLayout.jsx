import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
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
                const ref = doc(db, "website_config", "general");
                const snap = await getDoc(ref);
                if (snap.exists()) setConfig((prev) => ({ ...prev, ...snap.data() }));
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
