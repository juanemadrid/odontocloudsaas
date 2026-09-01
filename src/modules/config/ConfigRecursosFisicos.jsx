// src/modules/config/ConfigRecursosFisicos.jsx
import React, { useState, useEffect } from "react";
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiSave, FiX, FiBox, FiMapPin } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useSede } from "../../context/SedeContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";

export default function ConfigRecursosFisicos() {
    const { userProfile } = useAuth();
    const { sedesList } = useSede();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [items, setItems] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const [formData, setFormData] = useState({
        nombre: "",
        descripcion: "",
        sucursalId: ""
    });

    useEffect(() => {
        if (inquilino) {
            loadItems();
            loadBranches();
        }
    }, [inquilino]);

    const loadBranches = async () => {
        try {
            if (sedesList && sedesList.length > 0) {
                setBranches(sedesList);
                return;
            }
            const data = await getConfigItems(inquilino, "sucursales", "sucursales");
            setBranches(data || []);
        } catch (err) {
            console.error("Error loading branches in ConfigRecursosFisicos:", err);
        }
    };

    const loadItems = async () => {
        setLoading(true);
        try {
            const data = await getConfigItems(inquilino, "recursos_fisicos", "consultorios");
            setItems(data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        } catch (error) {
            console.error("Error loading resources:", error);
            if (toast?.error) toast.error("Error al cargar recursos físicos");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setCurrentItem(item);
            setFormData({
                nombre: item.nombre || "",
                descripcion: item.ubicacion || item.descripcion || "",
                sucursalId: item.sucursal_id || item.sucursalId || ""
            });
        } else {
            setCurrentItem(null);
            setFormData({ 
                nombre: "", 
                descripcion: "", 
                sucursalId: branches?.[0]?.id || "" 
            });
        }
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setCurrentItem(null);
        setFormData({ nombre: "", descripcion: "", sucursalId: "" });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            if (toast?.warning) toast.warning("El nombre es obligatorio");
            return;
        }

        setSaving(true);
        try {
            await saveConfigItem(inquilino, "recursos_fisicos", "consultorios", {
                ...(currentItem || {}),
                nombre: formData.nombre.trim(),
                ubicacion: formData.descripcion.trim(),
                sucursal_id: formData.sucursalId || null,
                sucursalId: formData.sucursalId || null,
                activo: true
            });

            if (toast?.success) toast.success("Recurso guardado en Supabase");
            handleCloseModal();
            loadItems();
        } catch (error) {
            console.error("Error saving resource:", error);
            if (toast?.error) toast.error("Error al guardar recurso");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`⚠️ ¿Seguro que deseas eliminar el recurso "${item.nombre}"?`)) return;

        setLoading(true);
        try {
            await deleteConfigItem(inquilino, "recursos_fisicos", "consultorios", item.id);
            setItems(prev => prev.filter(i => i.id !== item.id));
            if (toast?.success) toast.success("Recurso eliminado correctamente de Supabase");
            else alert("✅ Recurso eliminado correctamente");
        } catch (error) {
            console.error("Error deleting resource:", error);
            alert("❌ Error al eliminar recurso: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getBranchName = (sucursalId) => {
        if (!sucursalId) return "Todas las Sedes";
        const b = (branches || []).find(branch => String(branch.id) === String(sucursalId));
        return b?.nombre || "Sede Asignada";
    };

    const filteredItems = items.filter(item =>
        (item.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.ubicacion && item.ubicacion.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm.toLowerCase())) ||
        getBranchName(item.sucursal_id || item.sucursalId).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiBox size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Recursos Físicos y Consultorios</h1>
                        <p className="text-xs font-medium text-slate-500">Sillones odontológicos y espacios de atención por sede</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar recurso..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Recurso</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Nombre del Recurso</th>
                            <th className="py-3 px-4">Sede / Sucursal</th>
                            <th className="py-3 px-4">Descripción</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading && items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando recursos físicos...
                                </td>
                            </tr>
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No hay recursos físicos registrados
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => {
                                const branchId = item.sucursal_id || item.sucursalId;
                                const branchName = getBranchName(branchId);
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                    💺
                                                </div>
                                                <span className="font-bold text-slate-800 uppercase">{item.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                                                <FiMapPin size={11} className="text-blue-500" />
                                                <span>{branchName}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-slate-500 font-medium">{item.ubicacion || item.descripcion || "-"}</td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenModal(item)}
                                                    className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                    title="Editar"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={14} />
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
            {modalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                                    <FiBox size={18} />
                                </div>
                                <h3 className="text-base font-black text-slate-800 uppercase">
                                    {currentItem?.id ? "Editar Recurso" : "Nuevo Recurso Físico"}
                                </h3>
                            </div>
                            <button onClick={handleCloseModal} className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 font-bold">&times;</button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre del Sillón / Espacio *</label>
                                <input
                                    required
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    value={formData.nombre}
                                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    placeholder="Ej. Sillón 1, Consultorio Principal"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Sede / Sucursal *</label>
                                <select
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors uppercase"
                                    value={formData.sucursalId}
                                    onChange={e => setFormData({ ...formData, sucursalId: e.target.value })}
                                >
                                    <option value="">TODAS LAS SEDES (GLOBAL)</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Descripción / Ubicación</label>
                                <textarea
                                    rows={3}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                                    value={formData.descripcion}
                                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                    placeholder="Ubicación o notas técnicas..."
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-200 flex items-center gap-2 border-0 disabled:opacity-50"
                                >
                                    <FiSave size={15} />
                                    <span>{saving ? "Guardando..." : "Guardar Recurso"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

