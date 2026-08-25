import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiFileText } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import { getConfigItems, deleteConfigItem } from "../../../services/configPersistenceService";

export default function PlanesFormulacionList({ onNew, onEdit }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || userProfile?.tenant_id || "juanemadrid/odontocloudsaas";

    const [loading, setLoading] = useState(true);
    const [planes, setPlanes] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const loadPlans = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const data = await getConfigItems(inquilino, "planes_formulacion", "planes_formulacion");
            const sorted = (data || []).sort((a, b) => 
                (a.nombre || "").localeCompare(b.nombre || "", undefined, { sensitivity: "base" })
            );
            setPlanes(sorted);
        } catch (e) {
            console.error("Error loading formulation plans:", e);
            toast.error("Error al cargar los planes de formulación");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, [inquilino]);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`¿Está seguro de eliminar el plan de formulación "${name || ''}"?`)) return;
        try {
            await deleteConfigItem(inquilino, "planes_formulacion", "planes_formulacion", id);
            toast.success("Plan de formulación eliminado");
            setPlanes(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            console.error("Error deleting plan:", e);
            toast.error("Error al eliminar el plan");
        }
    };

    const filteredPlanes = useMemo(() => {
        return planes.filter(p => {
            const term = searchTerm.toLowerCase();
            return (
                (p.nombre || "").toLowerCase().includes(term) ||
                (p.descripcion || "").toLowerCase().includes(term)
            );
        });
    }, [planes, searchTerm]);

    const totalPages = Math.ceil(filteredPlanes.length / itemsPerPage) || 1;
    const paginatedPlanes = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredPlanes.slice(start, start + itemsPerPage);
    }, [filteredPlanes, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Header & Bar Acciones */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiFileText size={20} />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-bold text-slate-800">Planes de Formulación</h1>
                        <p className="text-[12px] text-slate-500">Plantillas y paquetes predeterminados de recetas médicas</p>
                    </div>
                </div>

                <button 
                    onClick={onNew}
                    className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                >
                    <FiPlus size={16} />
                    <span>Nuevo plan</span>
                </button>
            </div>

            {/* Content Table Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                {/* Search toolbar */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre o descripción de plan..."
                            className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-500 transition-colors"
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 shrink-0">
                        {filteredPlanes.length} registro{filteredPlanes.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70">
                                <th className="py-2.5 px-4 font-bold text-slate-600">Nombre del plan</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600">Descripción</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600">Medicamentos incluidos</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-xs">Cargando planes...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedPlanes.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-slate-400">
                                        <FiFileText size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="font-medium text-xs">No se encontraron planes de formulación registrados</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedPlanes.map(plan => (
                                    <tr key={plan.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-3 px-4 font-bold text-slate-800 uppercase">
                                            {plan.nombre}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">{plan.descripcion || "—"}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {(plan.medicamentos || []).map((m, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[11px] font-semibold">
                                                        {m.principio_activo || m.medicamento || m.nombre} {m.dosis ? `(${m.dosis})` : ''}
                                                    </span>
                                                ))}
                                                {(!plan.medicamentos || plan.medicamentos.length === 0) && (
                                                    <span className="text-slate-400 italic">Sin medicamentos</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button 
                                                    onClick={() => onEdit(plan.id)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Editar plan"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(plan.id, plan.nombre)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Eliminar plan"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="bg-slate-50/50 border-t border-slate-100 px-4 py-3 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">
                            Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, idx) => (
                                <button
                                    key={idx + 1}
                                    onClick={() => setCurrentPage(idx + 1)}
                                    className={`w-7 h-7 rounded text-xs font-bold transition-all cursor-pointer border ${
                                        currentPage === idx + 1 
                                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs" 
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    {idx + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

