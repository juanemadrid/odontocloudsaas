// src/modules/superadmin/NovedadesAdmin.jsx
// Gestión de avisos/novedades del sistema OdontoCloud (solo SuperAdmin)
import React, { useState, useEffect, useCallback } from "react";
import supabase from "../../lib/supabaseClient";
import {
    FiPlus, FiEdit3, FiTrash2, FiX, FiSave, FiRefreshCw,
    FiZap, FiInfo, FiAlertTriangle, FiClock, FiStar, FiBell,
    FiEye, FiEyeOff, FiList, FiChevronUp, FiChevronDown
} from "react-icons/fi";

const SUPERADMIN_TENANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// ── Tipos ────────────────────────────────────────────────────────
const TIPOS = {
    info:          { label: "Información",   color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: FiInfo },
    actualizacion: { label: "Actualización", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", icon: FiZap },
    alerta:        { label: "Alerta",        color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: FiAlertTriangle },
    mantenimiento: { label: "Mantenimiento", color: "#475569", bg: "#f8fafc", border: "#e2e8f0", icon: FiClock },
    novedad:       { label: "Novedad",       color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", icon: FiStar },
};

// ── Modal de creación / edición ──────────────────────────────────
function ModalAviso({ aviso, onClose, onSave }) {
    const [form, setForm] = useState({
        titulo: aviso?.titulo || "",
        contenido: aviso?.contenido || aviso?.descripcion || "",
        tipo: aviso?.tipo || "info",
        activo: aviso?.activo !== false,
        orden: aviso?.orden ?? 0,
    });
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.titulo.trim()) { alert("El título es obligatorio"); return; }
        setSaving(true);
        try { 
            await onSave(form, aviso?.id); 
            onClose(); 
        } catch (e) { 
            console.error("Save announcement error:", e);
            alert("Error al guardar: " + (e.message || e)); 
        } finally { 
            setSaving(false); 
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 20, boxShadow: "0 25px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: 560, border: "1px solid #e2e8f0", overflow: "hidden" }}>

                {/* Header */}
                <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FiBell size={15} style={{ color: "#2563eb" }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{aviso ? "Editar aviso" : "Nueva novedad del sistema"}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>Visible para todos los usuarios de OdontoCloud</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <FiX size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Tipo */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>Tipo de novedad</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {Object.entries(TIPOS).map(([key, t]) => {
                                const Icon = t.icon;
                                const active = form.tipo === key;
                                return (
                                    <button key={key} onClick={() => set("tipo", key)} style={{
                                        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                                        borderRadius: 10, border: `1px solid ${active ? t.border : "#e2e8f0"}`,
                                        background: active ? t.bg : "white", color: active ? t.color : "#94a3b8",
                                        fontSize: 11, fontWeight: active ? 800 : 600, cursor: "pointer",
                                        transition: "all 0.15s"
                                    }}>
                                        <Icon size={12} />{t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Título */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Título *</label>
                        <input
                            style={{ width: "100%", height: 40, padding: "0 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                            value={form.titulo}
                            onChange={e => set("titulo", e.target.value)}
                            placeholder="Ej. ✨ Nueva versión — Mejoras de rendimiento"
                            autoFocus
                            onFocus={e => e.target.style.borderColor = "#2563eb"}
                            onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                        />
                    </div>

                    {/* Contenido */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Descripción / Contenido</label>
                        <textarea
                            style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#374151", outline: "none", resize: "vertical", minHeight: 100, boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }}
                            value={form.contenido}
                            onChange={e => set("contenido", e.target.value)}
                            placeholder="Describe los detalles de la novedad o actualización..."
                            onFocus={e => e.target.style.borderColor = "#2563eb"}
                            onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                        />
                    </div>

                    {/* Opciones */}
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                        {/* Toggle activo */}
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <div
                                onClick={() => set("activo", !form.activo)}
                                style={{ width: 36, height: 20, borderRadius: 20, background: form.activo ? "#2563eb" : "#e2e8f0", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                                <div style={{ position: "absolute", top: 2, width: 16, height: 16, background: "white", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "transform 0.2s", transform: form.activo ? "translateX(18px)" : "translateX(2px)" }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                                {form.activo ? "Visible para usuarios" : "Oculto (borrador)"}
                            </span>
                        </label>

                        {/* Orden/prioridad */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Prioridad:</span>
                            <input
                                type="number" min={0} max={100}
                                style={{ width: 60, height: 28, padding: "0 8px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, textAlign: "center", outline: "none" }}
                                value={form.orden}
                                onChange={e => set("orden", Number(e.target.value))}
                            />
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>mayor = primero</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: "14px 20px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #e2e8f0", background: "white", fontSize: 12, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "#2563eb", color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.7 : 1, transition: "background 0.15s" }}
                        onMouseEnter={e => !saving && (e.currentTarget.style.background = "#1d4ed8")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#2563eb")}>
                        {saving ? <><FiRefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />Publicando...</> : <><FiSave size={12} />{aviso ? "Actualizar" : "Publicar novedad"}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────
export default function NovedadesAdmin() {
    const [avisos, setAvisos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [filter, setFilter] = useState("all"); // all | activo | inactivo

    // ── Cargar todos los avisos ──
    const load = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Intentar cargar desde la tabla anuncios_sistema
            let dbList = [];
            const { data: dbData, error: dbErr } = await supabase
                .from("anuncios_sistema")
                .select("*")
                .order("orden", { ascending: false })
                .order("created_at", { ascending: false });

            if (!dbErr && Array.isArray(dbData)) {
                dbList = dbData;
            }

            // 2. Cargar respaldos desde website_config
            let configList = [];
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", SUPERADMIN_TENANT_ID)
                .maybeSingle();

            if (cfgRow?.config?.system_announcements && Array.isArray(cfgRow.config.system_announcements)) {
                configList = cfgRow.config.system_announcements;
            }

            // 3. Fusionar ambas fuentes sin duplicados por ID o título
            const mergedMap = new Map();
            configList.forEach(item => mergedMap.set(item.id || item.titulo, item));
            dbList.forEach(item => mergedMap.set(item.id || item.titulo, item));

            const finalAvisos = Array.from(mergedMap.values()).sort((a, b) => {
                const ordA = Number(a.orden || 0);
                const ordB = Number(b.orden || 0);
                if (ordA !== ordB) return ordB - ordA;
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });

            setAvisos(finalAvisos);
        } catch (e) {
            console.error("Error cargando avisos:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (form, id) => {
        const cleanPayload = {
            titulo: form.titulo.trim(),
            contenido: form.contenido || "",
            tipo: form.tipo || "info",
            activo: form.activo !== false,
            orden: Number(form.orden) || 0
        };

        // 1. Intentar guardar en la tabla anuncios_sistema (ignorar silenciosamente si hay RLS error)
        try {
            if (id) {
                await supabase.from("anuncios_sistema").update(cleanPayload).eq("id", id);
            } else {
                await supabase.from("anuncios_sistema").insert([cleanPayload]);
            }
        } catch (dbErr) {
            console.warn("Notice DB insert fallback triggered:", dbErr);
        }

        // 2. Guardar en website_config (siempre garantizado para SuperAdmin)
        try {
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", SUPERADMIN_TENANT_ID)
                .maybeSingle();

            const existingConfig = cfgRow?.config || {};
            let currentList = Array.isArray(existingConfig.system_announcements) ? [...existingConfig.system_announcements] : [];

            if (id) {
                currentList = currentList.map(a => (a.id === id || a.titulo === form.titulo) ? { ...a, ...cleanPayload, updated_at: new Date().toISOString() } : a);
            } else {
                const newObj = {
                    id: "aviso-" + Date.now(),
                    ...cleanPayload,
                    created_at: new Date().toISOString()
                };
                currentList.unshift(newObj);
            }

            await supabase.from("website_config").upsert({
                tenant_id: SUPERADMIN_TENANT_ID,
                config: { ...existingConfig, system_announcements: currentList, updatedAt: new Date().toISOString() },
                updated_at: new Date().toISOString()
            });
        } catch (cfgErr) {
            console.error("Error al guardar en website_config:", cfgErr);
        }

        sessionStorage.removeItem("oc_avisos_sistema_v2");
        await load();
    };

    const handleDelete = async (id, titulo) => {
        if (!window.confirm(`¿Eliminar el aviso "${titulo}"?`)) return;

        try {
            await supabase.from("anuncios_sistema").delete().eq("id", id);
        } catch (e) {}

        try {
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", SUPERADMIN_TENANT_ID)
                .maybeSingle();

            if (cfgRow?.config?.system_announcements) {
                const updatedList = cfgRow.config.system_announcements.filter(a => a.id !== id && a.titulo !== titulo);
                await supabase.from("website_config").upsert({
                    tenant_id: SUPERADMIN_TENANT_ID,
                    config: { ...cfgRow.config, system_announcements: updatedList, updatedAt: new Date().toISOString() },
                    updated_at: new Date().toISOString()
                });
            }
        } catch (e) {}

        sessionStorage.removeItem("oc_avisos_sistema_v2");
        setAvisos(prev => prev.filter(a => a.id !== id && a.titulo !== titulo));
    };

    const toggleActivo = async (id, current) => {
        try {
            await supabase.from("anuncios_sistema").update({ activo: !current }).eq("id", id);
        } catch (e) {}

        try {
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", SUPERADMIN_TENANT_ID)
                .maybeSingle();

            if (cfgRow?.config?.system_announcements) {
                const updatedList = cfgRow.config.system_announcements.map(a => (a.id === id) ? { ...a, activo: !current } : a);
                await supabase.from("website_config").upsert({
                    tenant_id: SUPERADMIN_TENANT_ID,
                    config: { ...cfgRow.config, system_announcements: updatedList, updatedAt: new Date().toISOString() },
                    updated_at: new Date().toISOString()
                });
            }
        } catch (e) {}

        sessionStorage.removeItem("oc_avisos_sistema_v2");
        setAvisos(prev => prev.map(a => a.id === id ? { ...a, activo: !current } : a));
    };

    const filtered = filter === "all" ? avisos : avisos.filter(a => filter === "activo" ? a.activo : !a.activo);

    return (
        <div>
            {/* ── Stats resumen ─────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                {[
                    { label: "Total publicados", val: avisos.length, color: "#2563eb", bg: "#eff6ff" },
                    { label: "Visibles para clínicas", val: avisos.filter(a => a.activo).length, color: "#059669", bg: "#ecfdf5" },
                    { label: "Ocultos / Borradores", val: avisos.filter(a => !a.activo).length, color: "#64748b", bg: "#f8fafc" },
                ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, borderRadius: 14, padding: "14px 18px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.val}</div>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ───────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                {/* Filtros */}
                <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 3, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    {[
                        { key: "all", label: `Todos (${avisos.length})` },
                        { key: "activo", label: `Visibles (${avisos.filter(a => a.activo).length})` },
                        { key: "inactivo", label: `Borradores (${avisos.filter(a => !a.activo).length})` },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={{
                            padding: "6px 14px", borderRadius: 8, border: "none",
                            background: filter === f.key ? "white" : "transparent",
                            color: filter === f.key ? "#0f172a" : "#64748b",
                            fontWeight: filter === f.key ? 800 : 600, fontSize: 12,
                            cursor: "pointer", transition: "all 0.15s",
                            boxShadow: filter === f.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                        }}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Botón nuevo */}
                <button
                    onClick={() => { setEditing(null); setShowModal(true); }}
                    style={{
                        padding: "9px 18px", borderRadius: 10, border: "none",
                        background: "#2563eb", color: "white", fontWeight: 800, fontSize: 13,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                        boxShadow: "0 4px 14px rgba(37,99,235,0.35)", transition: "all 0.15s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#1d4ed8"}
                    onMouseLeave={e => e.currentTarget.style.background = "#2563eb"}
                >
                    <FiPlus size={16} /> Nueva novedad
                </button>
            </div>

            {/* ── Lista de avisos ────────────────────────── */}
            {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                    <FiRefreshCw size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Cargando novedades del sistema...</div>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", background: "#f8fafc", borderRadius: 16, border: "1px border-dashed #cbd5e1" }}>
                    <FiBell size={32} style={{ color: "#cbd5e1", marginBottom: 12 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>No hay avisos registrados</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Crea una nueva novedad para informar a todas las clínicas del sistema.</div>
                </div>
            ) : (
                <div style={{ display: "flex", flexContent: "column", flexDirection: "column", gap: 10 }}>
                    {filtered.map(av => {
                        const tipoKey = (av.tipo || "info").toLowerCase();
                        const tipo = TIPOS[tipoKey] || TIPOS.info;
                        const Icon = tipo.icon;
                        const fecha = av.created_at ? new Date(av.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
                        const textoContenido = av.contenido || av.descripcion || "";

                        return (
                            <div key={av.id || av.titulo} style={{
                                background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px",
                                display: "flex", alignItems: "flex-start", gap: 14,
                                opacity: av.activo ? 1 : 0.65,
                                transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
                            }}>
                                {/* Icono tipo */}
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: tipo.bg, border: `1px solid ${tipo.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Icon size={18} style={{ color: tipo.color }} />
                                </div>

                                {/* Contenido */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px", borderRadius: 20, background: tipo.bg, color: tipo.color, border: `1px solid ${tipo.border}` }}>
                                            {tipo.label}
                                        </span>
                                        <span style={{ fontSize: 10, background: av.activo ? "#ecfdf5" : "#f1f5f9", color: av.activo ? "#059669" : "#94a3b8", border: `1px solid ${av.activo ? "#a7f3d0" : "#e2e8f0"}`, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                                            {av.activo ? "● Visible" : "○ Borrador"}
                                        </span>
                                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{fecha}</span>
                                        {av.orden > 0 && <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700 }}>📌 Prioridad {av.orden}</span>}
                                    </div>
                                    <h4 style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", margin: "0 0 4px", lineHeight: 1.3 }}>{av.titulo}</h4>
                                    {textoContenido && (
                                        <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                                            {textoContenido.length > 120 ? textoContenido.substring(0, 120) + "..." : textoContenido}
                                        </p>
                                    )}
                                </div>

                                {/* Acciones */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                                    <button
                                        onClick={() => toggleActivo(av.id, av.activo)}
                                        style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: av.activo ? "#059669" : "#94a3b8", transition: "all 0.15s" }}
                                        title={av.activo ? "Ocultar" : "Publicar"}
                                        onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                                        onMouseLeave={e => e.currentTarget.style.background = "white"}
                                    >
                                        {av.activo ? <FiEye size={13} /> : <FiEyeOff size={13} />}
                                    </button>
                                    <button
                                        onClick={() => { setEditing(av); setShowModal(true); }}
                                        style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb", transition: "all 0.15s" }}
                                        title="Editar"
                                        onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                                        onMouseLeave={e => e.currentTarget.style.background = "white"}
                                    >
                                        <FiEdit3 size={13} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(av.id, av.titulo)}
                                        style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", transition: "all 0.15s" }}
                                        title="Eliminar"
                                        onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                        onMouseLeave={e => e.currentTarget.style.background = "white"}
                                    >
                                        <FiTrash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <ModalAviso
                    aviso={editing}
                    onClose={() => { setShowModal(false); setEditing(null); }}
                    onSave={handleSave}
                />
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
