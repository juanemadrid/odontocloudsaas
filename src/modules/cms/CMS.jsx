import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import PremiumLoading from "../../components/PremiumLoading";
import { FiPlus } from "react-icons/fi";

export default function CMS() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    const [config, setConfig] = useState({
        heroTitle: "",
        heroSubtitle: "",
        contactPhone: "",
        services: [
            { title: "Servicio 1", desc: "Descripción..." },
            { title: "Servicio 2", desc: "Descripción..." },
            { title: "Servicio 3", desc: "Descripción..." },
        ],
    });

    useEffect(() => {
        const load = async () => {
            try {
                const docRef = doc(db, "website_config", "general");
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setConfig((prev) => ({ ...prev, ...snap.data() }));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleChange = (key, val) => {
        setConfig((prev) => ({ ...prev, [key]: val }));
    };

    const handleServiceChange = (idx, key, val) => {
        const arr = [...config.services];
        arr[idx][key] = val;
        setConfig((prev) => ({ ...prev, services: arr }));
    };

    const addService = () => {
        setConfig((prev) => ({
            ...prev,
            services: [...prev.services, { title: "Nuevo Servicio", desc: "" }]
        }));
    };

    const removeService = (idx) => {
        const arr = config.services.filter((_, i) => i !== idx);
        setConfig((prev) => ({ ...prev, services: arr }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMsg("");
        try {
            await setDoc(doc(db, "website_config", "general"), config, { merge: true });
            setMsg("¡Guardado correctamente!");
        } catch (error) {
            console.error(error);
            setMsg("Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PremiumLoading />;

    return (
        <div className="p-6 max-w-4xl mx-auto animation-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Gestión Sitio Web Público</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition shadow-lg disabled:opacity-50"
                >
                    {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
            </div>

            {msg && (
                <div className={`p-4 mb-6 rounded-lg ${msg.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                    {msg}
                </div>
            )}

            <div className="space-y-8">
                {/* HERO */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Sección Principal (Hero)</h2>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Título Principal</label>
                            <input
                                type="text"
                                value={config.heroTitle}
                                onChange={(e) => handleChange("heroTitle", e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Subtítulo</label>
                            <textarea
                                value={config.heroSubtitle}
                                onChange={(e) => handleChange("heroSubtitle", e.target.value)}
                                rows={3}
                                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* CONTACTO */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Contacto</h2>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Teléfono visible</label>
                        <input
                            type="text"
                            value={config.contactPhone}
                            onChange={(e) => handleChange("contactPhone", e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* SERVICIOS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-700">Servicios Destacados</h2>
                        <button
                            onClick={addService}
                            className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1"
                        >
                            <span>+</span> Añadir Servicio
                        </button>
                    </div>
                    <div className="grid gap-6">
                        {config.services.map((svc, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative group">
                                <button
                                    onClick={() => removeService(idx)}
                                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                                >
                                    ✕
                                </button>
                                <div className="mb-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Título Servicio {idx + 1}</label>
                                    <input
                                        type="text"
                                        value={svc.title}
                                        onChange={(e) => handleServiceChange(idx, "title", e.target.value)}
                                        className="w-full p-2 bg-white border border-slate-300 rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Descripción</label>
                                    <textarea
                                        value={svc.desc}
                                        onChange={(e) => handleServiceChange(idx, "desc", e.target.value)}
                                        rows={2}
                                        className="w-full p-2 bg-white border border-slate-300 rounded"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
