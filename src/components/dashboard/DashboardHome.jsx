// src/components/dashboard/DashboardHome.jsx
import React, { useState, useEffect, useCallback } from "react";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import {
    FiZap, FiInfo, FiAlertTriangle, FiBell,
    FiPlus, FiEdit3, FiTrash2, FiX, FiSave,
    FiStar, FiRefreshCw, FiClock
} from "react-icons/fi";

// ── Tipos de aviso ──────────────────────────────────────────────
const TIPOS = {
    info:          { label: "Información",   bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   icon: FiInfo,          badge: "bg-blue-100 text-blue-700" },
    actualizacion: { label: "Actualización", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", icon: FiZap,           badge: "bg-violet-100 text-violet-700" },
    alerta:        { label: "Alerta",        bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  icon: FiAlertTriangle, badge: "bg-amber-100 text-amber-700" },
    mantenimiento: { label: "Mantenimiento", bg: "bg-slate-50",  border: "border-slate-200",  text: "text-slate-600",  icon: FiClock,         badge: "bg-slate-100 text-slate-600" },
    novedad:       { label: "Novedad",       bg: "bg-emerald-50",border: "border-emerald-200",text: "text-emerald-700",icon: FiStar,          badge: "bg-emerald-100 text-emerald-700" },
};

// ── Iniciales del nombre ────────────────────────────────────────
const getInitials = (name = "") =>
    name.trim().split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

// ── Tarjeta de aviso ────────────────────────────────────────────
function AvisoCard({ aviso, isSuperAdmin, onEdit, onDelete }) {
    const tipo = TIPOS[aviso.tipo] || TIPOS.info;
    const IconTipo = tipo.icon;
    const fecha = aviso.created_at
        ? new Date(aviso.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
        : "";

    return (
        <div className={`rounded-2xl border ${tipo.border} ${tipo.bg} p-4 relative group transition-all duration-200 hover:shadow-md`}>
            <div className="flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white shadow-sm border ${tipo.border}`}>
                    <IconTipo size={18} className={tipo.text} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${tipo.badge}`}>
                            {tipo.label}
                        </span>
                        {fecha && <span className="text-[10px] text-slate-400 font-medium">{fecha}</span>}
                    </div>
                    <h4 className={`text-[14px] font-bold ${tipo.text} mb-1 leading-snug`}>{aviso.titulo}</h4>
                    {aviso.contenido && (
                        <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-line">{aviso.contenido}</p>
                    )}
                </div>
                {isSuperAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                        <button onClick={() => onEdit(aviso)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer shadow-xs"
                            title="Editar"><FiEdit3 size={12} /></button>
                        <button onClick={() => onDelete(aviso.id)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer shadow-xs"
                            title="Eliminar"><FiTrash2 size={12} /></button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Modal aviso ─────────────────────────────────────────────────
function AvisoModal({ aviso, onClose, onSave }) {
    const [form, setForm] = useState({
        titulo: aviso?.titulo || "",
        contenido: aviso?.contenido || "",
        tipo: aviso?.tipo || "info",
        activo: aviso?.activo !== false,
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.titulo.trim()) return alert("El título es obligatorio");
        setSaving(true);
        try { await onSave(form, aviso?.id); onClose(); }
        catch (e) { alert("Error: " + e.message); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between rounded-t-2xl">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><FiBell size={16} /></div>
                        <h3 className="text-[14px] font-bold text-slate-800">{aviso ? "Editar aviso" : "Nuevo aviso del sistema"}</h3>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 cursor-pointer border-0 bg-transparent"><FiX size={16} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wide">Tipo</label>
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(TIPOS).map(([key, t]) => {
                                const Icon = t.icon;
                                return (
                                    <button key={key} onClick={() => setForm(f => ({ ...f, tipo: key }))}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-all ${form.tipo === key ? `${t.bg} ${t.border} ${t.text}` : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                                        <Icon size={11} />{t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Título *</label>
                        <input className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-400 transition-colors"
                            value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                            placeholder="Ej. Nueva versión 2.5 disponible" autoFocus />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Descripción</label>
                        <textarea className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-400 transition-colors resize-none"
                            rows={4} value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                            placeholder="Detalla el aviso..." />
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                        <div onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                            className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${form.activo ? "bg-blue-600" : "bg-slate-200"}`}>
                            <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow ${form.activo ? "translate-x-4" : "translate-x-[2px]"}`} />
                        </div>
                        <span className="text-[12px] font-semibold text-slate-600">Visible para todos los usuarios</span>
                    </label>
                </div>
                <div className="px-5 pb-5 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 bg-white cursor-pointer transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-bold flex items-center gap-1.5 cursor-pointer border-0 disabled:opacity-60 transition-all">
                        {saving ? <><FiRefreshCw size={12} className="animate-spin" />Guardando...</> : <><FiSave size={12} />{aviso ? "Actualizar" : "Publicar"}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ────────────────────────────────────────
export default function DashboardHome({ userName, companyName }) {
    const { userProfile } = useAuth();
    const isSuperAdmin = userProfile?.rol === "superadmin";
    const rol = userProfile?.rol || "usuario";
    const rolLabel = {
        administrador: "Administrador", odontologo: "Odontólogo", doctor: "Odontólogo",
        recepcionista: "Recepcionista", superadmin: "Super Admin", auxiliar: "Auxiliar",
    }[rol] || rol;

    const [avisos, setAvisos] = useState([]);
    const [loadingAvisos, setLoadingAvisos] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAviso, setEditingAviso] = useState(null);

    const now = new Date();
    const hora = now.getHours();
    const saludo = hora < 12 ? "¡Buenos días" : hora < 18 ? "¡Buenas tardes" : "¡Buenas noches";
    const dateLabel = now.toLocaleDateString("es-CO", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const initials = getInitials(userName || "U");

    // ── Título médico (Dr. / Dra.) e Identidad ────────────────────
    const rawName = (userName || userProfile?.full_name || userProfile?.nombre || "Usuario").trim();
    const cleanName = rawName.replace(/^(dr|dra|doctor|doctora)\.?\s+/i, "");
    const firstName = cleanName.split(" ")[0];

    const genderStr = (userProfile?.genero || userProfile?.sexo || "").toString().toLowerCase();
    const isFemale = genderStr.startsWith("f") || genderStr.includes("fem") || 
                     firstName.toLowerCase().endsWith("is") || 
                     firstName.toLowerCase().endsWith("a") || 
                     firstName.toLowerCase().endsWith("eth") ||
                     firstName.toLowerCase().endsWith("y");

    const isDoctorRole = rol === "doctor" || rol === "odontologo" || 
                         (rolLabel || "").toLowerCase().includes("odontól") || 
                         (rolLabel || "").toLowerCase().includes("doct");

    let titlePrefix = "";
    if (isDoctorRole) {
        if (/^dra\.?\s+/i.test(rawName)) {
            titlePrefix = "Dra. ";
        } else if (/^dr\.?\s+/i.test(rawName)) {
            titlePrefix = "Dr. ";
        } else {
            titlePrefix = isFemale ? "Dra. " : "Dr. ";
        }
    }
    const displayName = `${titlePrefix}${firstName}`;

    // ── Cargar avisos con caché ─────────────────────────────────
    const loadAvisos = useCallback(async () => {
        setLoadingAvisos(true);
        try {
            const cacheKey = "oc_avisos_sistema_v2";
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    const { data, ts } = JSON.parse(cached);
                    if (Date.now() - ts < 5 * 60 * 1000) { setAvisos(data); setLoadingAvisos(false); return; }
                }
            } catch (e) {}

            let dbList = [];
            try {
                const { data, error } = await supabase
                    .from("anuncios_sistema")
                    .select("*")
                    .eq("activo", true)
                    .order("orden", { ascending: false })
                    .order("created_at", { ascending: false });

                if (!error && Array.isArray(data)) dbList = data;
            } catch (e) {}

            let configList = [];
            try {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
                    .maybeSingle();

                if (cfgRow?.config?.system_announcements && Array.isArray(cfgRow.config.system_announcements)) {
                    configList = cfgRow.config.system_announcements.filter(a => a.activo !== false);
                }
            } catch (e) {}

            const mergedMap = new Map();
            configList.forEach(item => mergedMap.set(item.id || item.titulo, item));
            dbList.forEach(item => mergedMap.set(item.id || item.titulo, item));

            const list = Array.from(mergedMap.values()).sort((a, b) => {
                const ordA = Number(a.orden || 0);
                const ordB = Number(b.orden || 0);
                if (ordA !== ordB) return ordB - ordA;
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });

            setAvisos(list);
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: list, ts: Date.now() })); } catch (e) {}
        } catch (e) {
            console.warn("Avisos:", e.message);
            setAvisos([]);
        } finally { setLoadingAvisos(false); }
    }, []);

    useEffect(() => { loadAvisos(); }, [loadAvisos]);

    const handleSaveAviso = async (form, id) => {
        if (id) { const { error } = await supabase.from("anuncios_sistema").update(form).eq("id", id); if (error) throw error; }
        else { const { error } = await supabase.from("anuncios_sistema").insert([{ ...form, orden: 0 }]); if (error) throw error; }
        sessionStorage.removeItem("oc_avisos_sistema_v2");
        await loadAvisos();
    };

    const handleDeleteAviso = async (id) => {
        if (!window.confirm("¿Eliminar este aviso?")) return;
        await supabase.from("anuncios_sistema").delete().eq("id", id);
        sessionStorage.removeItem("oc_avisos_sistema_v2");
        setAvisos(prev => prev.filter(a => a.id !== id));
    };

    return (
        <div style={{ minHeight: "100%", background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f0fdf8 100%)" }}>
        <div className="w-full px-4 md:px-8 py-8 space-y-6">

                {/* ══════════════════════════════════════════════
                    HERO — Bienvenida
                ══════════════════════════════════════════════ */}
                <div
                    className="relative rounded-3xl overflow-hidden shadow-xl"
                    style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #4f46e5 75%, #7c3aed 100%)" }}
                >
                    {/* Decoración de fondo */}
                    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                        <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "260px", height: "260px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
                        <div style={{ position: "absolute", bottom: "-40px", left: "30%", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
                        <div style={{ position: "absolute", top: "20px", left: "42%", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                        {/* Grid decorativo */}
                        <svg style={{ position: "absolute", right: 0, top: 0, opacity: 0.07 }} width="320" height="200" viewBox="0 0 320 200">
                            {Array.from({ length: 8 }).map((_, r) =>
                                Array.from({ length: 12 }).map((_, c) => (
                                    <circle key={`${r}-${c}`} cx={c * 28 + 14} cy={r * 25 + 12} r="1.5" fill="white" />
                                ))
                            )}
                        </svg>
                    </div>

                    <div className="relative z-10 p-7 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                        {/* Avatar con Identidad Odontológica y Centrado Milimétrico */}
                        <div style={{ flexShrink: 0, position: "relative" }}>
                            <div style={{
                                width: 76, height: 76, borderRadius: 22,
                                background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)",
                                border: "2px solid rgba(255,255,255,0.35)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                backdropFilter: "blur(12px)",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                                position: "relative"
                            }}>
                                {/* Ícono de diente Odontología (Centrado Geométrico 100%) */}
                                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.3))" }}>
                                    <path d="M12 2C8.5 2 6 4 6 7c0 2.5 1 4.5 1.5 7.5.5 3 1.5 6.5 3.5 6.5 1.5 0 1.5-2 1.5-3.5 0-1.5 1-2 1.5-2s1.5.5 1.5 2c0 1.5 0 3.5 1.5 3.5 2 0 3-3.5 3.5-6.5C21 11.5 22 9.5 22 7c0-3-2.5-5-6-5-1.5 0-3 1-4 2-1-1-2.5-2-4-2z" fill="rgba(255,255,255,0.25)" />
                                </svg>
                            </div>

                            {/* Badge de Iniciales en esquina inferior derecha */}
                            <div style={{
                                position: "absolute",
                                bottom: -4, right: -4,
                                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                                border: "2px solid #ffffff",
                                borderRadius: 10,
                                padding: "2px 7px",
                                boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                <span style={{ fontSize: 10, fontWeight: 900, color: "#ffffff", letterSpacing: "0.05em", lineHeight: 1 }}>
                                    {initials}
                                </span>
                            </div>
                        </div>

                        {/* Texto */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{
                                    fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                                    textTransform: "uppercase", color: "rgba(196,181,253,0.9)",
                                    background: "rgba(255,255,255,0.1)", padding: "2px 10px",
                                    borderRadius: 20, border: "1px solid rgba(255,255,255,0.15)"
                                }}>{rolLabel}</span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>·</span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 500, textTransform: "capitalize" }}>{dateLabel}</span>
                            </div>
                            <h1 style={{ fontSize: 28, fontWeight: 900, color: "white", margin: "4px 0 2px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                                {saludo}, {displayName}! 👋
                            </h1>
                            {companyName && companyName !== "OdontoCloud" && (
                                <p style={{ fontSize: 13, color: "rgba(196,181,253,0.85)", fontWeight: 600, marginTop: 4 }}>
                                    🏥 {companyName}
                                </p>
                            )}
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8, fontWeight: 400 }}>
                                Bienvenido a tu panel de gestión clínica. Usa el menú para navegar entre módulos.
                            </p>
                        </div>

                        {/* Badge OdontoCloud */}
                        <div style={{ flexShrink: 0, textAlign: "center", display: "none" }} className="md:block">
                            <div style={{
                                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: 16, padding: "12px 20px", backdropFilter: "blur(8px)"
                            }}>
                                <div style={{ fontSize: 10, color: "rgba(196,181,253,0.7)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Sistema</div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>OdontoCloud</div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>v2.5 · 2026</div>
                            </div>
                        </div>
                    </div>

                    {/* Barra decorativa inferior */}
                    <div style={{ height: 3, background: "linear-gradient(90deg, #818cf8, #a78bfa, #34d399, #60a5fa)", opacity: 0.7 }} />
                </div>

                {/* ══════════════════════════════════════════════
                    AVISOS DEL SISTEMA
                ══════════════════════════════════════════════ */}
                <div style={{ background: "white", borderRadius: 20, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    {/* Header del panel */}
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FiBell size={15} style={{ color: "#2563eb" }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>Tablón de avisos</div>
                                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>Comunicados del sistema OdontoCloud</div>
                            </div>
                            {avisos.length > 0 && (
                                <span style={{ background: "#2563eb", color: "white", fontSize: 10, fontWeight: 900, padding: "1px 7px", borderRadius: 20 }}>
                                    {avisos.length}
                                </span>
                            )}
                        </div>
                        {isSuperAdmin && (
                            <button
                                onClick={() => { setEditingAviso(null); setShowModal(true); }}
                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "#2563eb", color: "white", borderRadius: 10, fontSize: 11, fontWeight: 800, border: "none", cursor: "pointer", transition: "all 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.background = "#1d4ed8"}
                                onMouseLeave={e => e.currentTarget.style.background = "#2563eb"}
                            >
                                <FiPlus size={13} /> Publicar aviso
                            </button>
                        )}
                    </div>

                    {/* Contenido */}
                    <div style={{ padding: "16px 20px" }}>
                        {loadingAvisos ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {[1, 2].map(n => <div key={n} style={{ height: 72, background: "#f1f5f9", borderRadius: 14 }} className="animate-pulse" />)}
                            </div>
                        ) : avisos.length === 0 ? (
                            <div style={{ padding: "48px 20px", textAlign: "center" }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                                    <FiBell size={24} style={{ color: "#cbd5e1" }} />
                                </div>
                                <p style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>Sin comunicados por el momento</p>
                                <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>Aquí aparecerán las actualizaciones y avisos del sistema</p>
                                {isSuperAdmin && (
                                    <button
                                        onClick={() => { setEditingAviso(null); setShowModal(true); }}
                                        style={{ marginTop: 16, padding: "8px 20px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                    >+ Crear primer aviso</button>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {avisos.map(av => (
                                    <AvisoCard
                                        key={av.id}
                                        aviso={av}
                                        isSuperAdmin={isSuperAdmin}
                                        onEdit={(av) => { setEditingAviso(av); setShowModal(true); }}
                                        onDelete={handleDeleteAviso}
                                    />
                                ))}
                                {isSuperAdmin && (
                                    <p style={{ fontSize: 10, color: "#cbd5e1", textAlign: "center", paddingTop: 4 }}>
                                        Pasa el cursor sobre un aviso para editarlo o eliminarlo
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Modal */}
            {showModal && (
                <AvisoModal
                    aviso={editingAviso}
                    onClose={() => { setShowModal(false); setEditingAviso(null); }}
                    onSave={handleSaveAviso}
                />
            )}
        </div>
    );
}
