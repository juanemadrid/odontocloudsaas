import React, { useState, useEffect, useRef } from "react";
import supabase from "../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import ModernLanding from "../../pages/ModernLanding";
import { DEFAULT_CONFIG } from "../../constants/DefaultConfig";
import { MASTER_CONFIG } from "../../constants/MasterConfig";
import VivaHeader from "../../layout/VivaHeader";
import VivaFooter from "../../layout/VivaFooter";
import IdentitySection from "../../pages/landing/IdentitySection";
import ServicesSection from "../../pages/landing/ServicesSection";
import { FiMonitor, FiSmartphone, FiLayout, FiImage, FiType, FiUsers, FiMessageSquare, FiSend, FiGlobe, FiPlus, FiTrash2, FiMaximize, FiEdit, FiHash, FiZap, FiExternalLink } from "react-icons/fi";

const TABS = [
    { id: "hero", label: "Inicio / Portada", icon: <FiLayout size={18} /> },
    { id: "style", label: "Estilo y Marca", icon: <FiZap size={18} /> },
    { id: "identity", label: "Identidad y Misión", icon: <FiType size={18} /> },
    { id: "services", label: "Funcionalidades y Servicios", icon: <FiMaximize size={18} /> },
    { id: "team", label: "Nuestro Equipo", icon: <FiUsers size={18} /> },
    { id: "testimonials", label: "Testimonios", icon: <FiMessageSquare size={18} /> },
    { id: "footer", label: "Contacto / Footer", icon: <FiGlobe size={18} /> },
    { id: "cta_final", label: "Llamado a Acción", icon: <FiSend size={18} /> },
];

import { useNavigate } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";

export default function WebCms() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("hero");
    const [isTabsOpen, setIsTabsOpen] = useState(false);
    const [viewMode, setViewMode] = useState("desktop");
    const previewContainerRef = useRef(null);
    const [scale, setScale] = useState(1);

    const isSuperAdmin = userProfile?.rol?.toLowerCase() === "superadmin";
    // FIX: If SuperAdmin wants to edit their OWN tenant site (if they have one), we might need a switch.
    // But for now, let's assume SuperAdmin always edits Master, and Tenant Admins edit Tenant.
    // If a user is BOTH SuperAdmin AND Tenant (unlikely in strict SaaS, but possible in dev), 
    // we default to Master for safety, or we can check if they are in a "Tenant Context".

    // However, the user complaint is "I cannot allow OdontoSalud to modify SuperAdmin".
    // This implies an OdontoSalud user (Tenant Admin) is capable of editing Master.
    // This only happens if isSuperAdmin is true for them.

    const configDocId = isSuperAdmin ? "general" : userProfile?.inquilino;
    const baseConfig = isSuperAdmin ? MASTER_CONFIG : DEFAULT_CONFIG;

    // DEBUG: Add tenant name for UI clarity
    const tenantName = isSuperAdmin ? "SITIO PRINCIPAL (MASTER)" : (userProfile?.tenant?.name || "MI CLÍNICA");

    const [config, setConfig] = useState({ ...baseConfig, isMaster: isSuperAdmin });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!previewContainerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.contentRect) {
                    const parentHeight = entry.contentRect.height;
                    const parentWidth = entry.contentRect.width;
                    if (parentHeight <= 0 || parentWidth <= 0) continue;

                    if (viewMode === "desktop") {
                        const availH = parentHeight - 240;
                        const availW = parentWidth - 100;
                        const scaleH = availH / 980;
                        const scaleW = availW / 1460;
                        const calculatedScale = Math.min(scaleH, scaleW);
                        setScale(Math.max(0.18, Math.min(calculatedScale, 0.65)));
                    } else {
                        const availH = parentHeight - 240;
                        const availW = parentWidth - 100;
                        const scaleH = availH / 720;
                        const scaleW = availW / 403;
                        const calculatedScale = Math.min(scaleH, scaleW);
                        setScale(Math.max(0.25, Math.min(calculatedScale, 0.65)));
                    }
                }
            }
        });
        resizeObserver.observe(previewContainerRef.current);
        return () => resizeObserver.disconnect();
    }, [viewMode, loading]);

    // Sync state to localStorage for the iframe preview
    useEffect(() => {
        try {
            localStorage.setItem("odc_cms_preview_config", JSON.stringify(config));
            localStorage.setItem("odc_cms_preview_active_tab", activeTab);
            localStorage.setItem("odc_cms_preview_is_master", String(isSuperAdmin));
        } catch (e) {
            console.warn("Error writing preview config to localStorage:", e);
        }
    }, [config, activeTab, isSuperAdmin]);

    useEffect(() => {
        if (!userProfile) return;
        if (!isSuperAdmin && !userProfile.inquilino) {
            setLoading(false);
            return;
        }
        loadData();
    }, [userProfile?.uid, configDocId]);

    const loadData = async () => {
        if (!configDocId) return;
        setLoading(true);
        try {
            console.log("Loading Config for:", configDocId);
            const tenantUUID = isSuperAdmin ? "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" : userProfile?.inquilino;
            const { data: row } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", tenantUUID)
                .maybeSingle();

            const data = row?.config || {};
            const clinicName = isSuperAdmin 
                ? (data.name || baseConfig.name) 
                : (data.name && data.name !== "OdontoCloud" 
                    ? data.name 
                    : (userProfile?.empresaNombre || userProfile?.tenant?.name || "Clínica Dental"));

            const isSoftwareTitle = (t) => !t || t.toLowerCase().includes("gestiona tu clínica") || t.toLowerCase().includes("software");
            const heroTitle = (!isSuperAdmin && isSoftwareTitle(data.heroTitle))
                ? `Cuidamos la sonrisa de tu familia en ${clinicName}`
                : (data.heroTitle || baseConfig.heroTitle);

            const heroSubtitle = (!isSuperAdmin && (data.heroSubtitle || "").toLowerCase().includes("odontocloud es el software"))
                ? "Atención odontológica integral con la tecnología más avanzada y profesionales dedicados."
                : (data.heroSubtitle || baseConfig.heroSubtitle);

            const heroBtn1Text = (!isSuperAdmin && (data.heroBtn1Text || "").toLowerCase().includes("solicitar"))
                ? "Agendar Cita"
                : (data.heroBtn1Text || baseConfig.heroBtn1Text);

            setConfig({
                ...baseConfig,
                ...data,
                isMaster: isSuperAdmin,
                name: clinicName,
                heroTitle,
                heroSubtitle,
                heroBtn1Text,
                slug: isSuperAdmin ? "general" : (userProfile?.tenant?.slug || ""),
                services: data.services || baseConfig.services || [],
                doctors: data.doctors || baseConfig.doctors || [],
                testimonials: data.testimonials || baseConfig.testimonials || [],
                slides: data.slides || baseConfig.slides || []
            });
        } catch (e) {
            console.error("Error loading CMS data from Supabase:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const tenantUUID = isSuperAdmin ? "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" : userProfile?.inquilino;
        if (!tenantUUID) {
            alert("❌ Error Crítico: No se encontró la clínica asociada. Recarga la página.");
            return;
        }
        setSaving(true);
        try {
            console.log("Saving Config to Supabase for tenant:", tenantUUID);
            const { error } = await supabase
                .from("website_config")
                .upsert({
                    tenant_id: tenantUUID,
                    config: config,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            alert("✅ SITIO ACTUALIZADO CORRECTAMENTE EN SUPABASE.");
        } catch (e) {
            console.error("Save Error:", e);
            alert("❌ Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (e, listKey, index, field) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const fileName = `${configDocId}/website_uploads/${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage.from("clinical-files").upload(fileName, file);
            if (error) throw error;
            const { data: pubUrl } = supabase.storage.from("clinical-files").getPublicUrl(fileName);
            updateItem(listKey, index, field, pubUrl.publicUrl);
        } catch (error) {
            console.error("Error uploading image:", error);
            alert(`Error subiendo imagen: ${error.message}`);
        }
    };

    const handleSimpleImageUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const fileName = `${configDocId}/website_uploads/${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage.from("clinical-files").upload(fileName, file);
            if (error) throw error;
            const { data: pubUrl } = supabase.storage.from("clinical-files").getPublicUrl(fileName);
            setConfig(prev => ({ ...prev, [field]: pubUrl.publicUrl }));
        } catch (error) {
            console.error("Error uploading image:", error);
            alert(`Error subiendo imagen: ${error.message}`);
        }
    };

    const updateItem = (listKey, index, field, val) => {
        const list = [...(config[listKey] || [])];
        if (!list[index]) return;
        list[index] = { ...list[index], [field]: val };
        setConfig(prev => ({ ...prev, [listKey]: list }));
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

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px] py-20 bg-white/50 rounded-[32px] border border-slate-100">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="mt-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Cargando Editor...</p>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-100px)] min-h-[550px] overflow-hidden bg-slate-50 rounded-xl border border-slate-200 shadow-sm">

            {/* EDITOR PANEL (Left) */}
            <div className="w-[420px] h-full bg-white border-r border-slate-200 flex flex-col z-50 overflow-hidden shrink-0">

                {/* Header Compacto & Limpio */}
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center shrink-0">
                    <div>
                        <button
                            onClick={() => navigate(buildDashboardPath('config/datos-basicos'))}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider block transition-colors border-0 bg-transparent cursor-pointer p-0 mb-0.5"
                        >
                            ← Volver a Ajustes
                        </button>
                        <h1 className="text-[15px] font-bold text-slate-800 tracking-tight">
                            Editor Web
                        </h1>
                        <p className="text-[11px] font-semibold text-slate-500 truncate">
                            {tenantName}
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0 shrink-0"
                    >
                        {saving ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiGlobe size={14} />
                        )}
                        <span>{saving ? "Guardando..." : "Publicar Cambios"}</span>
                    </button>
                </div>

                {/* Collapsible Navigation Tabs Header */}
                <div className="px-3 py-2 bg-slate-100/90 border-b border-slate-200 shrink-0">
                    <button
                        onClick={() => setIsTabsOpen(!isTabsOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-200 text-[12px] font-bold text-slate-800 hover:border-blue-400 transition-all cursor-pointer shadow-sm"
                    >
                        <div className="flex items-center gap-2 truncate">
                            <span className="text-blue-600 shrink-0">
                                {TABS.find(t => t.id === activeTab)?.icon}
                            </span>
                            <span className="truncate">Sección: {TABS.find(t => t.id === activeTab)?.label}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold shrink-0">
                            <span>{isTabsOpen ? "Ocultar ▲" : "Cambiar sección ▼"}</span>
                        </div>
                    </button>

                    {/* Dropdown Grid when Open */}
                    <AnimatePresence>
                        {isTabsOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden pt-2"
                            >
                                <div className="grid grid-cols-2 gap-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-md">
                                    {TABS.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                setActiveTab(tab.id);
                                                setIsTabsOpen(false); // Auto-collapse when option selected!
                                            }}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all border text-left cursor-pointer truncate
                                                ${activeTab === tab.id
                                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                                }`}
                                        >
                                            <span className="shrink-0" style={{ color: activeTab === tab.id ? 'white' : '#2563eb' }}>
                                                {tab.icon}
                                            </span>
                                            <span className="truncate">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-left">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* TAB: HERO / SLIDES */}
                            {activeTab === "hero" && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2 pb-2 border-b border-slate-100">
                                            <FiLayout className="text-blue-600" size={16} />
                                            <span>Contenido Principal de Portada (Hero)</span>
                                        </h3>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Etiqueta Superior (Badge)</label>
                                                <input
                                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold text-[13px] text-slate-800"
                                                    value={config.heroBadgeText || ""}
                                                    onChange={e => setConfig({ ...config, heroBadgeText: e.target.value })}
                                                    placeholder="Ej: Atención Odontológica Especializada"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Título Principal de Portada</label>
                                                <textarea
                                                    rows={2}
                                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-[14px] text-slate-800 resize-none"
                                                    value={config.heroTitle || ""}
                                                    onChange={e => setConfig({ ...config, heroTitle: e.target.value })}
                                                    placeholder="Ej: Cuidamos de tu sonrisa con excelencia"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Subtítulo / Descripción de Portada</label>
                                                <textarea
                                                    rows={3}
                                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-[12px] text-slate-700 resize-none"
                                                    value={config.heroSubtitle || ""}
                                                    onChange={e => setConfig({ ...config, heroSubtitle: e.target.value })}
                                                    placeholder="Ej: Odontología integral con tecnología avanzada y profesionales dedicados."
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Botón Principal (CTA)</label>
                                                    <input
                                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-[12px] text-blue-600"
                                                        value={config.heroBtn1Text || ""}
                                                        onChange={e => setConfig({ ...config, heroBtn1Text: e.target.value })}
                                                        placeholder="Ej: Agendar Cita"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Botón Secundario</label>
                                                    <input
                                                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-[12px] text-slate-600"
                                                        value={config.heroBtn2Text || ""}
                                                        onChange={e => setConfig({ ...config, heroBtn2Text: e.target.value })}
                                                        placeholder="Ej: Ver Servicios"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: STYLE & BRAND */}
                            {activeTab === "style" && (
                                <div className="space-y-8">
                                    {/* Brand Identity / Nombre y Logo */}
                                    <div className="bg-white rounded-[32px] p-8 border border-slate-200/60 shadow-sm space-y-6">
                                        <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                                                <FiType size={18} />
                                            </div>
                                            Identidad de Marca
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Nombre Comercial de la Clínica</label>
                                                <input
                                                    className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl outline-none focus:bg-white transition-all font-bold text-[13px] text-slate-800"
                                                    value={config.name || ""}
                                                    onChange={e => setConfig({ ...config, name: e.target.value })}
                                                    placeholder="Ej: ATM, Clínica Odontológica Madrid"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Eslogan / Subtítulo Corporativo (Encabezado)</label>
                                                <input
                                                    className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl outline-none focus:bg-white transition-all font-semibold text-[12px] text-slate-700"
                                                    value={config.slogan || ""}
                                                    onChange={e => setConfig({ ...config, slogan: e.target.value })}
                                                    placeholder="Ej: Salud Oral & Odontología Especializada"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Color del Nombre en Encabezado</label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="color"
                                                        className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                                                        value={config.brandTextColor || "#0f172a"}
                                                        onChange={e => setConfig({ ...config, brandTextColor: e.target.value })}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="flex-1 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-700"
                                                        value={config.brandTextColor || "#0f172a"}
                                                        onChange={e => setConfig({ ...config, brandTextColor: e.target.value })}
                                                        placeholder="#0f172a"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Logotipo (Imagen)</label>
                                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    {config.logo ? (
                                                        <div className="relative w-16 h-16 bg-white rounded-xl border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                                            <img src={config.logo} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfig({ ...config, logo: "" })}
                                                                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 active:scale-90"
                                                            >
                                                                <FiTrash2 size={10} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-16 h-16 bg-slate-200/60 rounded-xl flex items-center justify-center text-slate-400 shrink-0 border border-slate-300/40">
                                                            <FiImage size={24} />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <label className="inline-flex px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl cursor-pointer shadow-md transition-all active:scale-95">
                                                            Subir Imagen
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={(e) => handleSimpleImageUpload(e, 'logo')}
                                                            />
                                                        </label>
                                                        <p className="text-[9px] font-medium text-slate-400 mt-2">Recomendado: Imagen PNG con fondo transparente (máx. 2MB).</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                                        <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2.5 pb-3 border-b border-slate-100">
                                            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                                                <FiZap size={16} />
                                            </div>
                                            Estética y Marca
                                        </h3>
                                        <div className="space-y-5 text-left">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Color Principal</label>
                                                    <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors">
                                                        <input 
                                                            type="color" 
                                                            className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer rounded-lg overflow-hidden shrink-0" 
                                                            value={config.primaryColor || "#022a63"} 
                                                            onChange={e => setConfig({ ...config, primaryColor: e.target.value })} 
                                                        />
                                                        <input 
                                                            type="text" 
                                                            className="w-full bg-transparent font-mono text-[11px] font-bold uppercase text-slate-800 outline-none" 
                                                            value={config.primaryColor || "#022a63"} 
                                                            onChange={e => setConfig({ ...config, primaryColor: e.target.value })} 
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Color Acento (Botones)</label>
                                                    <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors">
                                                        <input 
                                                            type="color" 
                                                            className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer rounded-lg overflow-hidden shrink-0" 
                                                            value={config.secondaryColor || config.accentColor || "#0d2a63"} 
                                                            onChange={e => setConfig({ ...config, secondaryColor: e.target.value, accentColor: e.target.value })} 
                                                        />
                                                        <input 
                                                            type="text" 
                                                            className="w-full bg-transparent font-mono text-[11px] font-bold uppercase text-slate-800 outline-none" 
                                                            value={config.secondaryColor || config.accentColor || "#0d2a63"} 
                                                            onChange={e => setConfig({ ...config, secondaryColor: e.target.value, accentColor: e.target.value })} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tipografía Corporativa</label>
                                                <select
                                                    className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 font-bold text-[12px] text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all cursor-pointer"
                                                    value={config.fontFamily || "Inter"}
                                                    onChange={e => setConfig({ ...config, fontFamily: e.target.value })}
                                                >
                                                    <option value="Inter">INTER (SUIZA MODERN)</option>
                                                    <option value="Roboto">ROBOTO (INDUSTRIAL)</option>
                                                    <option value="Playfair Display">PLAYFAIR (INSTITUTIONAL)</option>
                                                    <option value="Lato">LATO (SOFT GEOMETRIC)</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Video de Fondo Hero (Ruta o URL MP4)</label>
                                                <input 
                                                    type="text"
                                                    className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 font-medium text-[12px] text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all" 
                                                    placeholder="/assets/hero-video.mp4 o https://..." 
                                                    value={config.heroVideoUrl || ""} 
                                                    onChange={e => setConfig({ ...config, heroVideoUrl: e.target.value })} 
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1">Coloque su archivo MP4 en la carpeta <code>public/assets/hero-video.mp4</code> del proyecto o ingrese una URL web.</p>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* TAB: FOOTER & CONTACT */}
                            {activeTab === "footer" && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2 pb-2 border-b border-slate-100">
                                            <FiGlobe className="text-blue-600" size={16} />
                                            <span>Información de Contacto y Ubicación</span>
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Teléfono / WhatsApp Principal</label>
                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-semibold text-[13px] text-slate-800" value={config.contactPhone || ""} onChange={e => setConfig({ ...config, contactPhone: e.target.value })} placeholder="Ej: 3015768935" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Corporativo</label>
                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-semibold text-[13px] text-slate-800" value={config.contactEmail || ""} onChange={e => setConfig({ ...config, contactEmail: e.target.value })} placeholder="contacto@tuclinica.com" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Dirección Física</label>
                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-semibold text-[13px] text-slate-800" value={config.address || ""} onChange={e => setConfig({ ...config, address: e.target.value })} placeholder="Calle 123 # 45-67, Ciudad" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Descripción corta (Pie de Página)</label>
                                                <textarea className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-medium text-[12px] text-slate-700 resize-none" rows={3} value={config.footerDesc || ""} onChange={e => setConfig({ ...config, footerDesc: e.target.value })} placeholder="Breve mensaje institucional para el pie de página..." />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight pb-2 border-b border-slate-100">
                                            Redes Sociales y Enlaces
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">URL Facebook</label>
                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 text-[12px] text-blue-600" value={config.facebookUrl || ""} onChange={e => setConfig({ ...config, facebookUrl: e.target.value })} placeholder="https://facebook.com/tuclinica" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">URL Instagram</label>
                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 text-[12px] text-blue-600" value={config.instagramUrl || ""} onChange={e => setConfig({ ...config, instagramUrl: e.target.value })} placeholder="https://instagram.com/tuclinica" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: IDENTITY */}
                            {activeTab === "identity" && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2 pb-2 border-b border-slate-100">
                                            <FiHash className="text-blue-600" size={16} />
                                            <span>Identidad de la Clínica (ADN Organizacional)</span>
                                        </h3>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Título Institucional</label>
                                            <input
                                                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-[13px] text-slate-800"
                                                value={config.identityTitle || ""}
                                                onChange={e => setConfig({ ...config, identityTitle: e.target.value })}
                                                placeholder="Ej: Sobre Nuestra Clínica"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Descripción / Narrativa Institucional</label>
                                            <textarea
                                                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-[12px] text-slate-700 resize-none"
                                                rows={3}
                                                value={config.identitySubtitle || ""}
                                                onChange={e => setConfig({ ...config, identitySubtitle: e.target.value })}
                                                placeholder="Ej: Comprometidos con la calidad y la calidez en cada tratamiento dental."
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight pb-2 border-b border-slate-100">
                                            Misión y Visión
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Misión Institucional</label>
                                                <textarea
                                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-[12px] text-slate-700 resize-none"
                                                    rows={3}
                                                    value={config.identityMission || ""}
                                                    onChange={e => setConfig({ ...config, identityMission: e.target.value })}
                                                    placeholder="Ej: Brindar atención odontológica integral con calidez y tecnología de vanguardia..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Visión Institucional</label>
                                                <textarea
                                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all font-medium text-[12px] text-slate-700 resize-none"
                                                    rows={3}
                                                    value={config.identityVision || ""}
                                                    onChange={e => setConfig({ ...config, identityVision: e.target.value })}
                                                    placeholder="Ej: Ser la clínica líder en cuidado oral destacándonos por la excelencia..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: SERVICES */}
                            {activeTab === "services" && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2 pb-2 border-b border-slate-100">
                                            <FiMaximize className="text-blue-600" size={16} />
                                            <span>Sección Servicios</span>
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Título de Sección</label>
                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-bold text-[13px] text-slate-800" value={config.servicesSectionTitle || ""} onChange={e => setConfig({ ...config, servicesSectionTitle: e.target.value })} placeholder="Ej: Nuestros Servicios Odontológicos" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Breve Introducción</label>
                                                <textarea className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-medium text-[12px] text-slate-700 resize-none" rows={2} value={config.servicesSectionDesc || ""} onChange={e => setConfig({ ...config, servicesSectionDesc: e.target.value })} placeholder="Ej: Tratamientos personalizados diseñados para tu salud oral." />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[12px] font-bold text-slate-700">Catálogo de Servicios</h4>
                                            <button onClick={() => addItem('services', { title: "NUEVO SERVICIO", desc: "Resumen del servicio...", icon: "🦷" })} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer border-0">
                                                <FiPlus size={14} /> Añadir Servicio
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {config.services && config.services.map((svc, i) => (
                                                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-lg">{svc.icon || "🦷"}</span>
                                                            <span className="font-bold text-[13px] text-slate-800">{svc.title || "Servicio"}</span>
                                                        </div>
                                                        <button onClick={() => removeItem('services', i)} className="w-7 h-7 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer border-0 bg-transparent" title="Eliminar">
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2 pt-1 border-t border-slate-100">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Título del Servicio</label>
                                                            <input className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-[12px] font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500" value={svc.title || ""} onChange={e => updateItem('services', i, 'title', e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Resumen</label>
                                                            <input className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500" value={svc.desc || ""} onChange={e => updateItem('services', i, 'desc', e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: OUR TEAM */}
                            {activeTab === "team" && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2 pb-2 border-b border-slate-100">
                                            <FiUsers className="text-blue-600" size={16} />
                                            <span>Sección Nuestro Equipo</span>
                                        </h3>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Título de Sección</label>
                                            <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-bold text-[13px] text-slate-800" value={config.doctorsSectionTitle || ""} onChange={e => setConfig({ ...config, doctorsSectionTitle: e.target.value })} placeholder="Ej: Nuestros Especialistas" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[12px] font-bold text-slate-700">Profesionales</h4>
                                            <button onClick={() => addItem('doctors', { name: "Dr. Nombre Apellido", specialty: "Odontólogo General", image: "" })} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer border-0">
                                                <FiPlus size={14} /> Añadir Doctor
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {config.doctors && config.doctors.map((doc, i) => (
                                                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden relative group/img shrink-0">
                                                                {doc.image ? (
                                                                    <img src={doc.image} alt="Doctor" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-400"><FiUsers size={16} /></div>
                                                                )}
                                                                <label className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white text-[9px] font-bold opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer">
                                                                    Subir
                                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'doctors', i, 'image')} />
                                                                </label>
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-[13px] text-slate-800">{doc.name || "Doctor"}</div>
                                                                <div className="text-[11px] font-medium text-blue-600">{doc.specialty || "Especialidad"}</div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => removeItem('doctors', i)} className="w-7 h-7 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer border-0 bg-transparent" title="Eliminar">
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Nombre Completo</label>
                                                            <input className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-[12px] font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500" value={doc.name || ""} onChange={e => updateItem('doctors', i, 'name', e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Especialidad / Cargo</label>
                                                            <input className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500" value={doc.specialty || ""} onChange={e => updateItem('doctors', i, 'specialty', e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: TESTIMONIALS */}
                            {activeTab === "testimonials" && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2 pb-2 border-b border-slate-100">
                                            <FiMessageSquare className="text-blue-600" size={16} />
                                            <span>Sección Testimonios</span>
                                        </h3>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Título de Sección</label>
                                            <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-bold text-[13px] text-slate-800" value={config.testimonialsTitle || ""} onChange={e => setConfig({ ...config, testimonialsTitle: e.target.value })} placeholder="Ej: Opiniones de Nuestros Pacientes" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[12px] font-bold text-slate-700">Opiniones Registradas</h4>
                                            <button onClick={() => addItem('testimonials', { name: "Nombre Paciente", text: "Excelente atención y resultados...", role: "Paciente", image: "" })} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer border-0">
                                                <FiPlus size={14} /> Añadir Testimonio
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {config.testimonials && config.testimonials.map((test, i) => (
                                                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <div className="font-bold text-[13px] text-slate-800">{test.name || "Paciente"}</div>
                                                        <button onClick={() => removeItem('testimonials', i)} className="w-7 h-7 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer border-0 bg-transparent" title="Eliminar">
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Nombre</label>
                                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-[12px] font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500" value={test.name || ""} onChange={e => updateItem('testimonials', i, 'name', e.target.value)} />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Rol / Subtítulo</label>
                                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500" value={test.role || ""} onChange={e => updateItem('testimonials', i, 'role', e.target.value)} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Testimonio / Comentario</label>
                                                            <textarea className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 resize-none" rows={2} value={test.text || ""} onChange={e => updateItem('testimonials', i, 'text', e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: FINAL CTA */}
                            {activeTab === "cta_final" && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                                        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2 pb-2 border-b border-slate-100">
                                            <FiSend className="text-blue-600" size={16} />
                                            <span>Llamado a la Acción Final (Pie de Página)</span>
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Título de Cierre</label>
                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-bold text-[13px] text-slate-800" value={config.ctaTitle || ""} onChange={e => setConfig({ ...config, ctaTitle: e.target.value })} placeholder="Ej: ¿Listo para mejorar tu salud oral?" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Subtítulo de Cierre</label>
                                                <textarea className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-medium text-[12px] text-slate-700 resize-none" rows={2} value={config.ctaSubtitle || ""} onChange={e => setConfig({ ...config, ctaSubtitle: e.target.value })} placeholder="Ej: Agenda tu consulta de valoración y comienza tu camino..." />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Texto del Botón Final</label>
                                                <input className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-bold text-[12px] text-blue-600" value={config.ctaBtnText || ""} onChange={e => setConfig({ ...config, ctaBtnText: e.target.value })} placeholder="Ej: AGENDAR AHORA" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Compact Footer Note */}
                <div className="px-4 py-2 border-t border-slate-200 bg-slate-50/60 shrink-0 text-center">
                    <p className="text-[10px] font-semibold text-slate-400">
                        Los cambios guardados se publican en vivo en el sitio web de tu clínica.
                    </p>
                </div>
            </div>

            {/* PREVIEW PANEL (Right) */}
            <div className="flex-1 h-full bg-[#F1F5F9] relative overflow-hidden flex flex-col">
                
                {/* Top Control Bar / Preview Header */}
                <div className="h-14 px-8 flex items-center justify-between bg-white border-b border-slate-200 shrink-0 z-50 relative">
                    <div className="flex items-center gap-2">
                        <FiMonitor className="text-slate-400" size={14} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista Previa del Sitio</span>
                    </div>
                    {/* Device Switcher & Live Link */}
                    <div className="flex items-center gap-3">
                        {(() => {
                            const liveSlug = config?.slug || userProfile?.tenant?.slug || (userProfile?.empresaNombre || config?.name || "atm").toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
                            const liveUrl = isSuperAdmin ? `${import.meta.env.BASE_URL}` : `${import.meta.env.BASE_URL}c/${liveSlug}`;
                            return (
                                <a
                                    href={liveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 no-underline cursor-pointer border-0"
                                    title={`Abrir página web pública de la clínica (${liveSlug})`}
                                >
                                    <FiExternalLink size={14} />
                                    <span>Ver Sitio en Vivo ↗</span>
                                </a>
                            );
                        })()}

                        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <div
                                onClick={() => setViewMode("desktop")}
                                className={`p-1.5 px-3 rounded-lg cursor-pointer transition-all duration-200 flex items-center gap-1.5 ${viewMode === 'desktop' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Vista de Escritorio"
                            >
                                <FiMonitor size={14} />
                                <span className="text-[10px] font-bold">Escritorio</span>
                            </div>
                            <div
                                onClick={() => setViewMode("mobile")}
                                className={`p-1.5 px-3 rounded-lg cursor-pointer transition-all duration-200 flex items-center gap-1.5 ${viewMode === 'mobile' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Vista Móvil"
                            >
                                <FiSmartphone size={14} />
                                <span className="text-[10px] font-bold">Móvil</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Frame Container */}
                <div 
                    ref={previewContainerRef}
                    className="flex-1 relative bg-slate-100 overflow-hidden flex flex-col items-center justify-center p-4 md:p-6 select-none"
                >
                    {viewMode === 'desktop' ? (
                        /* DESKTOP BROWSER WINDOW MOCKUP */
                        <div className="w-full h-full max-w-[1280px] bg-white rounded-xl border border-slate-300 shadow-xl overflow-hidden flex flex-col relative z-10">
                            {/* Browser Top Bar / Toolbar */}
                            <div className="bg-slate-50 h-10 flex items-center px-4 gap-4 border-b border-slate-200 shrink-0 justify-between">
                                {/* macOS Window Control Dots */}
                                <div className="flex gap-1.5 shrink-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400 border border-red-500/30" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500/30" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-500/30" />
                                </div>

                                {/* URL Input Address Bar */}
                                <div className="flex-1 flex justify-center max-w-[450px]">
                                    <div className="flex items-center bg-white border border-slate-200 px-3 py-1 rounded-md text-[11px] font-mono text-slate-600 w-full justify-center gap-2 shadow-inner">
                                        <svg className="w-3 h-3 text-emerald-500 fill-current shrink-0" viewBox="0 0 24 24">
                                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                                        </svg>
                                        <span className="text-slate-400">https://</span>
                                        <span className="font-semibold text-slate-800">
                                            {isSuperAdmin ? "portal.odontocloud.pro" : `portal.odontocloud.pro/c/${config?.slug || userProfile?.tenant?.slug || (userProfile?.empresaNombre || config?.name || "atm").toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}`}
                                        </span>
                                    </div>
                                </div>

                                {/* External Live Link Button */}
                                <div className="flex items-center shrink-0">
                                    <button
                                        onClick={() => {
                                            const baseUrl = import.meta.env.BASE_URL;
                                            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
                                            const liveSlug = config?.slug || userProfile?.tenant?.slug || (userProfile?.empresaNombre || config?.name || "atm").toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
                                            const url = isSuperAdmin ? `${cleanBase}/` : `${cleanBase}/c/${liveSlug}`;
                                            window.open(url, '_blank');
                                        }}
                                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer border-0"
                                        title="Abrir en pestaña independiente"
                                    >
                                        <span>Ver Sitio Real</span>
                                        <FiExternalLink size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Responsive Live Iframe */}
                            <div className="flex-1 bg-white relative overflow-hidden">
                                <iframe
                                    src={`${import.meta.env.BASE_URL || "/odontocloudsaas/"}preview`}
                                    className="w-full h-full border-none"
                                    style={{ overflowY: "auto" }}
                                    scrolling="yes"
                                    title="OdontoCloud CMS Desktop Preview"
                                />
                            </div>
                        </div>
                    ) : (
                        /* MOBILE PHONE FRAME (IPHONE MOCKUP) */
                        <div className="w-[375px] h-full max-h-[680px] bg-slate-900 border-[10px] border-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative z-10 shrink-0 transition-all duration-300">
                            {/* Mobile Top Status Bar & Dynamic Island */}
                            <div className="bg-slate-100 h-10 flex items-center justify-between px-6 shrink-0 relative">
                                <span className="text-[10px] font-extrabold text-slate-800">9:41</span>
                                <div className="w-20 h-4 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
                                <div className="flex items-center gap-1.5 text-slate-800">
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M2 22h20V2z" /></svg>
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 21l-12-14.3c.4-.3 4.8-3.7 12-3.7s11.6 3.4 12 3.7l-12 14.3z" /></svg>
                                </div>
                            </div>

                            {/* Mobile Safari Address Bar */}
                            <div className="bg-slate-100 h-9 flex items-center justify-center px-4 border-b border-slate-200 shrink-0">
                                <div className="bg-slate-200/80 w-full h-6 rounded-md flex items-center justify-center text-[9px] text-slate-600 gap-1 font-mono">
                                    <svg className="w-2.5 h-2.5 text-slate-500 fill-current" viewBox="0 0 24 24">
                                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                                    </svg>
                                    <span>portal.odontocloud.pro</span>
                                </div>
                            </div>

                            {/* Mobile Live Iframe */}
                            <div className="flex-1 bg-white relative overflow-hidden">
                                <iframe
                                    src={`${import.meta.env.BASE_URL || "/odontocloudsaas/"}preview`}
                                    className="w-full h-full border-none"
                                    style={{ overflowY: "auto" }}
                                    scrolling="yes"
                                    title="OdontoCloud CMS Mobile Preview"
                                />
                            </div>

                            {/* Home Indicator */}
                            <div className="bg-white h-4 flex justify-center items-center shrink-0">
                                <div className="w-28 h-1 bg-slate-800 rounded-full" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

