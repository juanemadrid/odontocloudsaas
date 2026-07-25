import React, { useState, useEffect } from "react";
import { FiSearch, FiTrash2, FiEdit2, FiPlus, FiArrowUp, FiArrowDown, FiX, FiList, FiClock, FiFileText, FiSave } from "react-icons/fi";
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

// Helper for sorting
const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
};

const MOMENTS = [
    { value: "before_exam", label: "ANTES DEL EXAMEN" },
    { value: "during_exam", label: "DURANTE EL EXAMEN" },
    { value: "after_exam", label: "DESPUÉS DEL EXAMEN" }
];

export default function ConfigPestanasMedicas() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();

    const [rows, setRows] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [momentoFilter, setMomentoFilter] = useState("all");

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nombre: "",
        descripcion: "",
        plantillaId: "",
        momento: "during_exam"
    });

    useEffect(() => {
        if (!inquilino) return;

        setLoading(true);
        const q = query(
            collection(db, "tenants", inquilino, "pestanas_medicas"),
            orderBy("orden", "asc")
        );

        const unsub = onSnapshot(q, (snap) => {
            setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            if (toast?.error) toast.error("Error al sincronizar pestañas");
            setLoading(false);
        });

        fetchTemplates();
        return () => unsub();
    }, [inquilino]);

    const fetchTemplates = async () => {
        try {
            const q = query(collection(db, "tenants", inquilino, "plantillas_clinicas"), orderBy("nombre", "asc"));
            const snap = await getDocs(q);
            setTemplates(snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre })));
        } catch (error) {
            console.error("Error fetching templates:", error);
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.nombre.trim()) {
            if (toast?.warning) toast.warning("Asigne un nombre a la pestaña");
            return;
        }
        if (!formData.plantillaId) {
            if (toast?.warning) toast.warning("Seleccione una plantilla base");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                nombre: formData.nombre.trim(),
                descripcion: formData.descripcion.trim(),
                plantillaId: formData.plantillaId,
                momento: formData.momento,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.email
            };

            if (editingId) {
                await updateDoc(doc(db, "tenants", inquilino, "pestanas_medicas", editingId), payload);
                if (toast?.success) toast.success("Pestaña médica actualizada");
            } else {
                await addDoc(collection(db, "tenants", inquilino, "pestanas_medicas"), {
                    ...payload,
                    orden: rows.length,
                    createdAt: serverTimestamp(),
                    createdBy: userProfile.email
                });
                if (toast?.success) toast.success("Nueva pestaña creada con éxito");
            }
            closeModal();
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al guardar la configuración");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que desea eliminar esta pestaña de la historia clínica?")) return;
        try {
            await deleteDoc(doc(db, "tenants", inquilino, "pestanas_medicas", id));
            if (toast?.success) toast.success("Registro eliminado correctamente");
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al eliminar");
        }
    };

    const handleMove = async (index, direction) => {
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= rows.length) return;

        const newRows = reorder(rows, index, newIndex);
        setRows(newRows);

        try {
            const updates = newRows.map((row, i) =>
                updateDoc(doc(db, "tenants", inquilino, "pestanas_medicas", row.id), { orden: i })
            );
            await Promise.all(updates);
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al reordenar");
        }
    };

    const openModal = (item = null) => {
        if (item) {
            setEditingId(item.id);
            setFormData({
                nombre: item.nombre,
                descripcion: item.descripcion || "",
                plantillaId: item.plantillaId || "",
                momento: item.momento || "during_exam"
            });
        } else {
            setEditingId(null);
            setFormData({
                nombre: "",
                descripcion: "",
                plantillaId: "",
                momento: "during_exam"
            });
        }
        setShowModal(true);
    };

    const closeModal = () => setShowModal(false);

    const filtered = rows.filter(r => {
        const matchesSearch = (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMomento = momentoFilter === "all" || r.momento === momentoFilter;
        return matchesSearch && matchesMomento;
    });

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiList size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Pestañas Médicas</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Estructura y secciones de la historia clínica médica</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {/* Moment Filters */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setMomentoFilter("all")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border-0 ${momentoFilter === "all" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-800 bg-transparent"}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setMomentoFilter("before_exam")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border-0 ${momentoFilter === "before_exam" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-800 bg-transparent"}`}
                        >
                            Antes
                        </button>
                        <button
                            onClick={() => setMomentoFilter("during_exam")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border-0 ${momentoFilter === "during_exam" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-800 bg-transparent"}`}
                        >
                            Durante
                        </button>
                        <button
                            onClick={() => setMomentoFilter("after_exam")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border-0 ${momentoFilter === "after_exam" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-800 bg-transparent"}`}
                        >
                            Después
                        </button>
                    </div>

                    <div className="relative flex-1 md:w-48">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar pestaña..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => openModal()}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva Pestaña</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4 w-12 text-center">Orden</th>
                            <th className="py-2.5 px-4">Sección / Nombre</th>
                            <th className="py-2.5 px-4">Plantilla Base</th>
                            <th className="py-2.5 px-4">Momento</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Sincronizando pestañas médicas...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron pestañas médicas definidas
                                </td>
                            </tr>
                        ) : (
                            filtered.map((row, index) => {
                                const m = MOMENTS.find(item => item.value === row.momento);
                                return (
                                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2.5 px-4 text-center font-bold text-slate-400">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    📑
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800 uppercase block">{row.nombre}</span>
                                                    {row.descripcion && (
                                                        <span className="text-[10px] text-slate-400 block">{row.descripcion}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                                                <FiFileText size={13} className="text-blue-500" />
                                                <span>{templates.find(t => t.id === row.plantillaId)?.nombre || "Sin Plantilla"}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            {m && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                                    <FiClock size={10} /> {m.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    disabled={index === 0}
                                                    onClick={() => handleMove(index, "up")}
                                                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 flex items-center justify-center transition-colors cursor-pointer border-0"
                                                    title="Mover arriba"
                                                >
                                                    <FiArrowUp size={12} />
                                                </button>
                                                <button
                                                    disabled={index === rows.length - 1}
                                                    onClick={() => handleMove(index, "down")}
                                                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 flex items-center justify-center transition-colors cursor-pointer border-0"
                                                    title="Mover abajo"
                                                >
                                                    <FiArrowDown size={12} />
                                                </button>
                                                <button
                                                    onClick={() => openModal(row)}
                                                    className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                    title="Editar Pestaña"
                                                >
                                                    <FiEdit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row.id)}
                                                    className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                    title="Eliminar Pestaña"
                                                >
                                                    <FiTrash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <FiList size={15} />
                                </div>
                                <h3 className="text-[14px] font-bold text-slate-800">
                                    {editingId ? "Editar Pestaña Médica" : "Nueva Pestaña Médica"}
                                </h3>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre de la Pestaña *</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="Ej. Anamnesis, Odontograma, Consentimiento"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Plantilla Base Asignada *</label>
                                <select
                                    required
                                    value={formData.plantillaId}
                                    onChange={(e) => setFormData({ ...formData, plantillaId: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value="">-- Seleccionar Plantilla --</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Momento de Atención *</label>
                                <select
                                    required
                                    value={formData.momento}
                                    onChange={(e) => setFormData({ ...formData, momento: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                >
                                    {MOMENTS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Descripción u Observación</label>
                                <textarea
                                    rows={2}
                                    placeholder="Breve descripción del propósito de esta pestaña..."
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-1.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 bg-white cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                                >
                                    {saving ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <FiSave size={15} />
                                    )}
                                    <span>{saving ? "Guardando..." : "Guardar Pestaña"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
