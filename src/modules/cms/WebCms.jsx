import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

const TABS = [
    { id: "hero", label: "🏠 Inicio y Stats" },
    { id: "services", label: "🛠️ Servicios" },
    { id: "team", label: "👨‍⚕️ Equipo Médico" },
    { id: "testimonials", label: "💬 Testimonios" },
];

export default function WebCms() {
    const [activeTab, setActiveTab] = useState("hero");
    const [config, setConfig] = useState({
        heroTitle: "",
        heroSubtitle: "",
        contactPhone: "",
        statYears: "12",
        statPatients: "5k",
        statSatisfaction: "100%",
        services: [],
        doctors: [],
        testimonials: [],
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, "website_config", "general");
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setConfig({
                    ...data,
                    services: data.services || [],
                    doctors: data.doctors || [],
                    testimonials: data.testimonials || [],
                    // Asegurar campos nuevos para evitar undefined
                    statYears: data.statYears || "10+",
                    statPatients: data.statPatients || "5k",
                    statSatisfaction: data.statSatisfaction || "100%",
                });
            } else {
                // Defaults seguros
                setConfig({
                    heroTitle: "Sonrisas que iluminan tu vida",
                    heroSubtitle: "Tecnología avanzada y expertos en salud dental.",
                    contactPhone: "+57 300 123 4567",
                    statYears: "10+",
                    statPatients: "5000+",
                    statSatisfaction: "100%",
                    services: [
                        { title: "Ortodoncia Invisible", desc: "Sin brackets, alineadores transparentes." },
                        { title: "Implantes", desc: "Recupera tu sonrisa con titanio de alta calidad." }
                    ],
                    doctors: [],
                    testimonials: []
                });
            }
        } catch (e) {
            console.error("Error loading CMS data:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "website_config", "general"), config);
            alert("✅ Sitio web actualizado correctamente.");
        } catch (e) {
            console.error(e);
            alert("❌ Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // Generic List Helpers
    const updateItem = (listKey, index, field, val) => {
        const list = [...(config[listKey] || [])];
        if (!list[index]) return;
        list[index][field] = val;
        setConfig({ ...config, [listKey]: list });
    };
    const addItem = (listKey, defaultItem) => {
        const list = config[listKey] || [];
        setConfig({ ...config, [listKey]: [...list, defaultItem] });
    };
    const removeItem = (listKey, index) => {
        if (!window.confirm("¿Eliminar ítem?")) return;
        const list = (config[listKey] || []).filter((_, i) => i !== index);
        setConfig({ ...config, [listKey]: list });
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Cargando Editor del Sitio Web...</div>;

    return (
        <div style={{ padding: 24, paddingBottom: 100 }}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Editor de Página Web</h2>
                    <p className="text-sm text-slate-500">Cambia lo que ven tus pacientes en tiempo real.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg flex items-center gap-2"
                >
                    {saving ? "Guardando..." : "💾 Guardar Publicación"}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 border-b border-slate-200">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-t-lg font-semibold transition whitespace-nowrap ${activeTab === tab.id
                                ? "bg-white border text-blue-600 border-b-white translate-y-[1px]"
                                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white p-6 rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 min-h-[400px]">

                {/* HERO & STATS */}
                {activeTab === "hero" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-bold text-blue-600 mb-4 border-b pb-2">Sección Principal</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Título Grande</label>
                                    <input className="form-input w-full p-2 border rounded" value={config.heroTitle || ""} onChange={e => setConfig({ ...config, heroTitle: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Subtítulo / Bajada</label>
                                    <textarea className="form-input w-full p-2 border rounded" rows={3} value={config.heroSubtitle || ""} onChange={e => setConfig({ ...config, heroSubtitle: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">WhatsApp de Contacto (Solo números)</label>
                                    <input className="form-input w-full p-2 border rounded" value={config.contactPhone || ""} onChange={e => setConfig({ ...config, contactPhone: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-blue-600 mb-4 border-b pb-2">Barra de Estadísticas</h3>
                            <div className="space-y-4 bg-slate-50 p-4 rounded-xl">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Años de Experiencia</label>
                                    <input className="form-input w-full p-2 border rounded" value={config.statYears || ""} onChange={e => setConfig({ ...config, statYears: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pacientes Atendidos</label>
                                    <input className="form-input w-full p-2 border rounded" value={config.statPatients || ""} onChange={e => setConfig({ ...config, statPatients: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">% Satisfacción</label>
                                    <input className="form-input w-full p-2 border rounded" value={config.statSatisfaction || ""} onChange={e => setConfig({ ...config, statSatisfaction: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SERVICES */}
                {activeTab === "services" && (
                    <div>
                        <div className="flex justify-between mb-4 items-center">
                            <h3 className="font-bold text-slate-700">Lista de Servicios</h3>
                            <button onClick={() => addItem('services', { title: "Nuevo", desc: "..." })} className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm py-2 px-4 rounded font-bold">+ Agregar Servicio</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {config.services && config.services.map((svc, i) => (
                                <div key={i} className="p-4 border rounded-xl bg-slate-50 relative group hover:bg-white hover:shadow transition">
                                    <button onClick={() => removeItem('services', i)} className="absolute top-2 right-2 text-red-500 font-bold bg-white px-2 rounded shadow opacity-0 group-hover:opacity-100 transition">Borrar</button>
                                    <input className="w-full bg-transparent font-bold mb-2 border-b border-slate-300 focus:border-blue-500 outline-none pb-1"
                                        value={svc.title || ""} onChange={e => updateItem('services', i, 'title', e.target.value)} placeholder="Nombre del servicio" />
                                    <textarea className="w-full bg-transparent text-sm resize-none border-b border-slate-300 focus:border-blue-500 outline-none"
                                        rows={2} value={svc.desc || ""} onChange={e => updateItem('services', i, 'desc', e.target.value)} placeholder="Descripción..." />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TEAM */}
                {activeTab === "team" && (
                    <div>
                        <div className="flex justify-between mb-4 items-center">
                            <h3 className="font-bold text-slate-700">Equipo Médico</h3>
                            <button
                                onClick={() => addItem('doctors', { name: "Dr. Nombre", role: "Especialidad", img: "https://via.placeholder.com/400" })}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm py-2 px-4 rounded font-bold"
                            >
                                + Agregar Doctor
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {config.doctors && config.doctors.map((doc, i) => (
                                <div key={i} className="p-4 border rounded-xl text-center relative group hover:shadow-lg transition bg-white">
                                    <button onClick={() => removeItem('doctors', i)} className="absolute top-2 right-2 text-red-500 bg-white rounded-full p-1 shadow z-10 opacity-0 group-hover:opacity-100 transition font-bold">🗑️</button>

                                    <div className="w-24 h-24 mx-auto bg-slate-100 rounded-full mb-3 overflow-hidden border-2 border-white shadow">
                                        <img src={doc.img} alt="Doc" className="w-full h-full object-cover" />
                                    </div>

                                    <div className="space-y-2">
                                        <input className="w-full text-center font-bold border rounded px-2 py-1 focus:border-blue-500 outline-none"
                                            value={doc.name || ""} onChange={e => updateItem('doctors', i, 'name', e.target.value)} placeholder="Nombre Dr." />
                                        <input className="w-full text-center text-sm text-blue-600 border rounded px-2 py-1 focus:border-blue-500 outline-none"
                                            value={doc.role || ""} onChange={e => updateItem('doctors', i, 'role', e.target.value)} placeholder="Especialidad" />
                                        <input className="w-full text-xs text-slate-400 border rounded px-2 py-1 focus:border-blue-500 outline-none"
                                            value={doc.img || ""} onChange={e => updateItem('doctors', i, 'img', e.target.value)} placeholder="URL Foto" />
                                        <small className="text-xs text-slate-400 block">Pega aquí el enlace de la foto</small>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TESTIMONIALS */}
                {activeTab === "testimonials" && (
                    <div>
                        <div className="flex justify-between mb-4 items-center">
                            <h3 className="font-bold text-slate-700">Testimonios Pacientes</h3>
                            <button
                                onClick={() => addItem('testimonials', { author: "Paciente", text: "Excelente atención..." })}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm py-2 px-4 rounded font-bold"
                            >
                                + Agregar Testimonio
                            </button>
                        </div>
                        <div className="space-y-4">
                            {config.testimonials && config.testimonials.map((t, i) => (
                                <div key={i} className="flex flex-col md:flex-row gap-4 p-4 border rounded-xl items-start relative group bg-white hover:shadow-md transition">
                                    <button onClick={() => removeItem('testimonials', i)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 font-bold">borrar</button>
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                                        {t.author ? t.author.charAt(0) : "?"}
                                    </div>
                                    <div className="flex-1 w-full">
                                        <textarea className="w-full font-medium text-slate-700 bg-transparent border rounded p-2 focus:border-blue-500 outline-none mb-2"
                                            rows={2} value={t.text || ""} onChange={e => updateItem('testimonials', i, 'text', e.target.value)} placeholder="Opinión del paciente..." />
                                        <input className="text-sm font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
                                            value={t.author || ""} onChange={e => updateItem('testimonials', i, 'author', e.target.value)} placeholder="Nombre Paciente" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
