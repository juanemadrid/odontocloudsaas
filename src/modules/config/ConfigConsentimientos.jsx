import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { FiFileText, FiPlus, FiTrash2, FiEdit3, FiSave, FiAlertCircle, FiChevronRight, FiSearch } from "react-icons/fi";

export default function ConfigConsentimientos() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    // Editor State
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ title: "", content: "" });
    const [saving, setSaving] = useState(false);

    const { userProfile } = useAuth();

    useEffect(() => {
        if (userProfile?.inquilino) {
            loadTemplates();
        }
    }, [userProfile]);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "tenants", userProfile.inquilino, "config_consentimientos"));
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.title || !form.content) return;
        setSaving(true);
        const id = editingId || form.title.toLowerCase().replace(/\s+/g, '_').slice(0, 20);

        try {
            await setDoc(doc(db, "tenants", userProfile.inquilino, "config_consentimientos", id), {
                title: form.title,
                content: form.content,
                inquilino: userProfile.inquilino,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.email
            }, { merge: true });

            setEditingId(null);
            setForm({ title: "", content: "" });
            loadTemplates();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Eliminar esta plantilla definitivamente?")) return;
        try {
            await deleteDoc(doc(db, "tenants", userProfile.inquilino, "config_consentimientos", id));
            if (editingId === id) {
                setEditingId(null);
                setForm({ title: "", content: "" });
            }
            loadTemplates();
        } catch (e) {
            console.error(e);
        }
    };

    const handleEdit = (tmpl) => {
        setEditingId(tmpl.id);
        setForm({ title: tmpl.title, content: tmpl.content });
    };

    const filtered = templates.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            
            {/* Elite Header */}
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <FiFileText className="text-blue-600" />
                        <span>Configuración</span>
                        <span className="text-slate-200">/</span>
                        <span className="text-slate-800">Consentimientos Informados</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight leading-none">
                        Editor de <span className="text-blue-600">Plantillas</span>
                    </h2>
                    <p className="text-[13px] font-medium text-slate-400">Personaliza los documentos legales que tus pacientes deben firmar.</p>
                </div>
                <button 
                  onClick={() => { setEditingId(null); setForm({ title: "", content: "" }); }}
                  className="h-12 px-6 flex items-center gap-3 bg-blue-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <FiPlus size={18} /> Nueva Plantilla
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Sidebar - List of Templates */}
                <div className="lg:col-span-4 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col max-h-[600px]">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <div className="relative group">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input 
                              type="text" 
                              placeholder="Buscar plantilla..."
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                              className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-600 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                        {loading ? (
                            <div className="py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Cargando bibliotecas...</div>
                        ) : filtered.length === 0 ? (
                            <div className="py-10 text-center text-[12px] font-medium text-slate-400">No se encontraron plantillas.</div>
                        ) : (
                            filtered.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => handleEdit(t)}
                                    className={`group p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between
                                        ${editingId === t.id 
                                            ? 'bg-blue-50 border-blue-100 shadow-sm shadow-blue-500/5' 
                                            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                            ${editingId === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-blue-500'}`}>
                                            <FiFileText size={14} />
                                        </div>
                                        <span className={`text-[13px] font-black uppercase tracking-tight transition-colors
                                            ${editingId === t.id ? 'text-blue-700' : 'text-slate-600 group-hover:text-slate-900'}`}>{t.title}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Editor */}
                <div className="lg:col-span-8 bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                 <FiEdit3 size={20} />
                             </div>
                             <div>
                                 <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-widest">
                                     {editingId ? "Editando Plantilla" : "Diseñar Nueva Plantilla"}
                                 </h3>
                                 <p className="text-[11px] font-bold text-slate-400 uppercase">Configuración de contenido legal</p>
                             </div>
                         </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Título del Procedimiento</label>
                            <input 
                                type="text"
                                placeholder="Ej. Exodoncia Tercer Molar"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contenido del Documento</label>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase">
                                    <FiAlertCircle />
                                    <span>Usa [PACIENTE] para el nombre</span>
                                </div>
                            </div>
                            <textarea 
                                placeholder="Yo, [PACIENTE], mayor de edad..."
                                value={form.content}
                                onChange={e => setForm({ ...form, content: e.target.value })}
                                className="w-full h-[400px] p-8 bg-slate-50 border border-slate-200 rounded-3xl text-[15px] font-medium text-slate-600 leading-relaxed outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <button 
                            onClick={() => { setEditingId(null); setForm({ title: "", content: "" }); }}
                            className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                            Limpiar borrador
                        </button>
                        <div className="flex gap-3">
                            <button 
                                onClick={handleSave}
                                disabled={saving || !form.title || !form.content}
                                className="h-14 px-10 bg-blue-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Guardar Plantilla <FiSave size={18} /></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
