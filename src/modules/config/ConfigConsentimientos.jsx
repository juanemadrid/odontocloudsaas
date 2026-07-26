// src/modules/config/ConfigConsentimientos.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { FiFileText, FiPlus, FiTrash2, FiEdit3, FiSave, FiAlertCircle, FiChevronRight, FiSearch } from "react-icons/fi";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";

export default function ConfigConsentimientos() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    // Editor State
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ title: "", content: "" });
    const [saving, setSaving] = useState(false);

    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    useEffect(() => {
        if (inquilino) {
            loadTemplates();
        }
    }, [inquilino]);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await getConfigItems(inquilino, "consentimientos", "consentimientos");
            const formatted = data.map(d => ({
                id: d.id,
                title: d.titulo || d.title || "",
                content: d.contenido || d.content || ""
            }));
            setTemplates(formatted);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.content.trim()) {
            if (toast?.warning) toast.warning("El título y el contenido son obligatorios");
            return;
        }
        setSaving(true);
        try {
            await saveConfigItem(inquilino, "consentimientos", "consentimientos", {
                id: editingId || undefined,
                nombre: form.title.trim(),
                titulo: form.title.trim(),
                contenido: form.content.trim()
            });

            if (toast?.success) toast.success("Plantilla guardada en Supabase");
            setEditingId(null);
            setForm({ title: "", content: "" });
            loadTemplates();
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al guardar consentimiento");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`⚠️ ¿Eliminar la plantilla "${title || ''}" definitivamente?`)) return;
        try {
            await deleteConfigItem(inquilino, "consentimientos", "consentimientos", id);
            if (editingId === id) {
                setEditingId(null);
                setForm({ title: "", content: "" });
            }
            setTemplates(prev => prev.filter(t => t.id !== id));
            if (toast?.success) toast.success("Plantilla eliminada de Supabase");
            else alert("✅ Plantilla de consentimiento eliminada correctamente");
        } catch (e) {
            console.error(e);
            alert("❌ Error al eliminar plantilla: " + e.message);
        }
    };

    const handleEdit = (tmpl) => {
        setEditingId(tmpl.id);
        setForm({ title: tmpl.title, content: tmpl.content });
    };

    const filtered = templates.filter(t => (t.title || "").toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col gap-6 animate-fade-in p-4 max-w-6xl mx-auto">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <FiFileText className="text-blue-600" />
                        <span>Configuración</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-800">Consentimientos Informados</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                        Editor de <span className="text-blue-600">Plantillas</span>
                    </h2>
                    <p className="text-xs font-medium text-slate-500">Personaliza los documentos legales que tus pacientes deben firmar.</p>
                </div>
                <button 
                  onClick={() => { setEditingId(null); setForm({ title: "", content: "" }); }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer border-0 shrink-0"
                >
                    <FiPlus size={16} />
                    <span>Nueva Plantilla</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* List Sidebar */}
                <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text"
                            placeholder="Buscar plantilla..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="py-8 text-center text-slate-400 font-medium">Cargando plantillas...</div>
                        ) : filtered.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 font-medium">No hay plantillas creadas</div>
                        ) : (
                            filtered.map(t => (
                                <div 
                                    key={t.id}
                                    onClick={() => handleEdit(t)}
                                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${editingId === t.id ? 'bg-blue-50 border-blue-200 text-blue-800 font-bold' : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200 text-slate-700'}`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <FiFileText className={editingId === t.id ? 'text-blue-600' : 'text-slate-400'} size={16} />
                                        <span className="text-xs font-bold truncate uppercase">{t.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.title); }}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                        <FiChevronRight size={14} className="text-slate-400" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Form Editor */}
                <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                        {editingId ? "Editar Plantilla" : "Crear Nueva Plantilla"}
                    </h3>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Título del Documento *</label>
                        <input 
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            placeholder="Ej. Consentimiento de Extracción Dental"
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Texto Legal / Contenido *</label>
                        <textarea 
                            rows={12}
                            value={form.content}
                            onChange={e => setForm({ ...form, content: e.target.value })}
                            placeholder="Escribe aquí las cláusulas y cuerpo del documento de consentimiento..."
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all resize-none leading-relaxed"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button"
                            onClick={() => { setEditingId(null); setForm({ title: "", content: "" }); }}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white"
                        >
                            Limpiar
                        </button>
                        <button 
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-200 flex items-center gap-2 border-0 disabled:opacity-50"
                        >
                            <FiSave size={15} />
                            <span>{saving ? "Guardando..." : "Guardar Plantilla"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
