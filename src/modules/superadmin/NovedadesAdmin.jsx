// src/modules/superadmin/NovedadesAdmin.jsx
// Gestión de avisos/novedades del sistema OdontoCloud (solo SuperAdmin)
import React, { useState, useEffect, useCallback } from "react";
import supabase from "../../lib/supabaseClient";
import {
    FiPlus, FiEdit3, FiTrash2, FiX, FiSave, FiRefreshCw,
    FiZap, FiInfo, FiAlertTriangle, FiClock, FiStar, FiBell,
    FiEye, FiEyeOff, FiList, FiChevronUp, FiChevronDown
} from "react-icons/fi";

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
        contenido: aviso?.contenido || "",
        tipo: aviso?.tipo || "info",
        activo: aviso?.activo !== false,
        orden: aviso?.orden ?? 0,
    });
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.titulo.trim()) { alert("El título es obligatorio"); return; }
        setSaving(true);
        try { await onSave(form, aviso?.id); onClose(); }
        catch (e) { alert("Error al guardar: " + e.message); }
        finally { setSaving(false); }
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
                            placeholder="Ej. ✨ Nueva versión 2.6 — Mejoras de rendimiento"
                            autoFocus
                            onFocus={e => e.target.style.borderColor = "#2563eb"}
                            onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                        />
                    </div>

                    {/* Contenido */}
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Descripción</label>
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

    // ── Cargar todos los avisos (sin filtro activo — admin ve todo) ──
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("anuncios_sistema")
                .select("*")
                .order("orden", { ascending: false })
                .order("created_at", { ascending: false });

            if (error) {
                if (error.code === "42P01") {
                    // Tabla no existe aún
                    setAvisos([]);
                    return;
                }
                throw error;
            }
            setAvisos(data || []);
        } catch (e) {
            console.error("Error cargando avisos:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (form, id) => {
        if (id) {
            const { error } = await supabase.from("anuncios_sistema").update(form).eq("id", id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from("anuncios_sistema").insert([form]);
            if (error) throw error;
        }
        sessionStorage.removeItem("oc_avisos_sistema_v2");
        await load();
    };

    const handleDelete = async (id, titulo) => {
        if (!window.confirm(`¿Eliminar el aviso "${titulo}"?`)) return;
        await supabase.from("anuncios_sistema").delete().eq("id", id);
        sessionStorage.removeItem("oc_avisos_sistema_v2");
        setAvisos(prev => prev.filter(a => a.id !== id));
    };

    const toggleActivo = async (id, current) => {
        await supabase.from("anuncios_sistema").update({ activo: !current }).eq("id", id);
        sessionStorage.removeItem("oc_avisos_sistema_v2");
        setAvisos(prev => prev.map(a => a.id === id ? { ...a, activo: !current } : a));
    };

    const filtered = filter === "all" ? avisos : avisos.filter(a => filter === "activo" ? a.activo : !a.activo);

    return (
        <div>
            {/* ── Stats resumen ─────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                {[
                    { label: "Total publicadas", value: avisos.length, color: "#2563eb", bg: "#eff6ff" },
                    { label: "Visibles (activas)", value: avisos.filter(a => a.activo).length, color: "#059669", bg: "#ecfdf5" },
                    { label: "Ocultas (borradores)", value: avisos.filter(a => !a.activo).length, color: "#d97706", bg: "#fffbeb" },
                ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 14, padding: "14px 18px" }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ───────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                    {[["all", "Todas"], ["activo", "Activas"], ["inactivo", "Borradores"]].map(([k, l]) => (
                        <button key={k} onClick={() => setFilter(k)} style={{
                            padding: "6px 14px", borderRadius: 8, border: "1px solid",
                            borderColor: filter === k ? "#2563eb" : "#e2e8f0",
                            background: filter === k ? "#eff6ff" : "white",
                            color: filter === k ? "#2563eb" : "#64748b",
                            fontSize: 12, fontWeight: filter === k ? 800 : 600, cursor: "pointer"
                        }}>{l}</button>
                    ))}
                </div>
                <button
                    onClick={() => { setEditing(null); setShowModal(true); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#2563eb", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.3)", transition: "all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#1d4ed8"}
                    onMouseLeave={e => e.currentTarget.style.background = "#2563eb"}
                >
                    <FiPlus size={15} /> Nueva novedad
                </button>
            </div>

            {/* ── Lista ─────────────────────────────────── */}
            {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[1, 2, 3].map(n => (
                        <div key={n} style={{ height: 80, background: "#f1f5f9", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ background: "white", border: "1px dashed #e2e8f0", borderRadius: 16, padding: "60px 20px", textAlign: "center" }}>
                    <FiList size={36} style={{ color: "#cbd5e1", margin: "0 auto 12px", display: "block" }} />
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>
                        {filter === "all" ? "No hay novedades todavía" : filter === "activo" ? "No hay novedades activas" : "No hay borradores"}
                    </p>
                    <p style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>Crea tu primera novedad con el botón de arriba</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filtered.map((av) => {
                        const tipo = TIPOS[av.tipo] || TIPOS.info;
                        const Icon = tipo.icon;
                        const fecha = av.created_at ? new Date(av.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

                        return (
                            <div key={av.id} style={{
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
                                    {av.contenido && (
                                        <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                                            {av.contenido.length > 120 ? av.contenido.substring(0, 120) + "..." : av.contenido}
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
