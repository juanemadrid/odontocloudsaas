import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import {
    getTiposResiduos,
    addOrUpdateTipoResiduo,
    deleteTipoResiduo
} from "../../../services/residuosService";

const COLORS = [
    "Amarillo", "Azul", "Beige", "Blanco", "Gris", "Negro", "Púrpura", "Rojo", "Verde"
];

export default function ConfigurarResiduos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [activeSubTab, setActiveSubTab] = useState("tipos"); // "tipos" o "indicadores_config"
    const [loading, setLoading] = useState(true);
    const [residues, setResidues] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [nombre, setNombre] = useState("");
    const [color, setColor] = useState("Rojo");
    const [saving, setSaving] = useState(false);

    const loadResidues = async (force = false) => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const list = await getTiposResiduos(inquilino, force);
            setResidues(list);
        } catch (e) {
            console.error("Error loading residues types:", e);
            toast.error("Error al cargar los tipos de residuos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadResidues();

        const handleTypesChanged = (e) => {
            if (e?.detail?.tenantId === inquilino && Array.isArray(e?.detail?.types)) {
                setResidues(e.detail.types);
            }
        };

        window.addEventListener("residuos_types_changed", handleTypesChanged);
        return () => window.removeEventListener("residuos_types_changed", handleTypesChanged);
    }, [inquilino]);

    const handleOpenAdd = () => {
        setEditId(null);
        setNombre("");
        setColor("Rojo");
        setShowModal(true);
    };

    const handleOpenEdit = (item) => {
        setEditId(item.id);
        setNombre(item.nombre || "");
        setColor(item.color || "Rojo");
        setShowModal(true);
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`¿Seguro que desea eliminar el tipo de residuo "${item.nombre}"?`)) return;
        try {
            await deleteTipoResiduo(inquilino, item.id);
            toast.success("Tipo de residuo eliminado");
            await loadResidues(true);
        } catch (e) {
            console.error("Error deleting residue:", e);
            toast.error("Error al eliminar");
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!nombre.trim()) {
            toast.error("Ingrese el nombre del residuo.");
            return;
        }

        setSaving(true);
        try {
            await addOrUpdateTipoResiduo(inquilino, {
                id: editId,
                nombre: nombre.trim(),
                color
            });

            toast.success(editId ? "Tipo de residuo actualizado" : "Tipo de residuo creado con éxito");
            setShowModal(false);
            await loadResidues(true);
        } catch (err) {
            console.error("Error saving residue:", err);
            toast.error(err?.message || "Error al guardar el tipo de residuo");
        } finally {
            setSaving(false);
        }
    };

    const filteredResidues = useMemo(() => {
        return residues.filter(r => 
            (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [residues, searchTerm]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300 font-sans text-slate-800">
            {/* Tabs choices */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveSubTab("tipos")}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                        activeSubTab === "tipos"
                            ? "border-[#7cb342] text-[#7cb342]"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Tipos de residuos
                </button>
                <button
                    onClick={() => setActiveSubTab("indicadores")}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                        activeSubTab === "indicadores"
                            ? "border-[#7cb342] text-[#7cb342]"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Indicadores
                </button>
            </div>

            {activeSubTab === "tipos" ? (
                <>
                    {/* Toolbar */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="relative w-full max-w-sm">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input 
                                type="text" 
                                placeholder="Buscar residuo..."
                                className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleOpenAdd}
                            className="h-8 px-3.5 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer gap-1.5"
                        >
                            <FiPlus size={13} />
                            Agregar residuo
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                        <th className="py-2.5 px-4">Nombre del residuo</th>
                                        <th className="py-2.5 px-3">Color</th>
                                        <th className="py-2.5 px-3 text-center w-24">Opciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="3" className="py-16 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-xs font-medium text-slate-400">Cargando tipos de residuos...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredResidues.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="py-16 text-center text-slate-400 italic text-xs">
                                                No se encontraron registros.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredResidues.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-2.5 px-4 font-bold text-slate-800">{item.nombre}</td>
                                                <td className="py-2.5 px-3">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                                        <span 
                                                            className="w-2 h-2 rounded-full" 
                                                            style={{
                                                                backgroundColor: item.color === "Rojo" ? "#ef4444" :
                                                                                 item.color === "Verde" ? "#22c55e" :
                                                                                 item.color === "Blanco" ? "#e2e8f0" :
                                                                                 item.color === "Negro" ? "#0f172a" :
                                                                                 item.color === "Amarillo" ? "#eab308" :
                                                                                 item.color === "Azul" ? "#3b82f6" :
                                                                                 item.color === "Gris" ? "#94a3b8" :
                                                                                 item.color === "Púrpura" ? "#a855f7" : "#cbd5e1"
                                                            }} 
                                                        />
                                                        {item.color}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => handleOpenEdit(item)}
                                                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                                            title="Editar"
                                                        >
                                                            <FiEdit2 size={12} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(item.id)}
                                                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer"
                                                            title="Eliminar"
                                                        >
                                                            <FiTrash2 size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xs text-center py-16">
                    <p className="text-slate-400 italic text-xs">Los indicadores se calculan automáticamente en base a las cargas diarias reportadas.</p>
                </div>
            )}

            {/* Modal Dialog */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[1000] animate-in fade-in duration-200 p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-800">
                                {editId ? "Editar residuo" : "Nuevo residuo"}
                            </h3>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <FiX size={14} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="p-4 space-y-3.5">
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-semibold text-slate-600">Tipo de residuo *</label>
                                <input 
                                    type="text"
                                    placeholder="Nombre del residuo"
                                    className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-semibold text-slate-600">Color *</label>
                                <select
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                                >
                                    {COLORS.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Buttons */}
                            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="h-8 px-3.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="h-8 px-4 rounded-lg text-xs font-semibold text-white bg-[#7cb342] hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
