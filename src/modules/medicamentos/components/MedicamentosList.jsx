import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiBox } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import { getConfigItems, deleteConfigItem } from "../../../services/configPersistenceService";

export default function MedicamentosList({ onNew, onEdit }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || userProfile?.tenant_id || "juanemadrid/odontocloudsaas";

    const [loading, setLoading] = useState(true);
    const [medicamentos, setMedicamentos] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const loadMedicines = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const data = await getConfigItems(inquilino, "medicamentos", "medicamentos");
            const sorted = (data || []).sort((a, b) => 
                (a.principio_activo || a.nombre || "").localeCompare(b.principio_activo || b.nombre || "", undefined, { sensitivity: "base" })
            );
            setMedicamentos(sorted);
        } catch (e) {
            console.error("Error loading medicines:", e);
            toast.error("Error al cargar los medicamentos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMedicines();
    }, [inquilino]);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`¿Está seguro de eliminar el medicamento "${name || ''}"?`)) return;
        try {
            await deleteConfigItem(inquilino, "medicamentos", "medicamentos", id);
            toast.success("Medicamento eliminado");
            setMedicamentos(prev => prev.filter(m => m.id !== id));
        } catch (e) {
            console.error("Error deleting medicine:", e);
            toast.error("Error al eliminar el medicamento");
        }
    };

    // Filtered
    const filteredMeds = useMemo(() => {
        return medicamentos.filter(m => {
            const term = searchTerm.toLowerCase();
            return (
                (m.codigo || "").toLowerCase().includes(term) ||
                (m.principio_activo || m.nombre || "").toLowerCase().includes(term) ||
                (m.descripcion || "").toLowerCase().includes(term) ||
                (m.marca || "").toLowerCase().includes(term) ||
                (m.tipo || "").toLowerCase().includes(term)
            );
        });
    }, [medicamentos, searchTerm]);

    // Paginated
    const totalPages = Math.ceil(filteredMeds.length / itemsPerPage) || 1;
    const paginatedMeds = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredMeds.slice(start, start + itemsPerPage);
    }, [filteredMeds, currentPage]);

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
                        <FiBox size={20} />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-bold text-slate-800">Medicamentos</h1>
                        <p className="text-[12px] text-slate-500">Catálogo de medicamentos y principios activos</p>
                    </div>
                </div>

                <button 
                    onClick={onNew}
                    className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                >
                    <FiPlus size={16} />
                    <span>Nuevo medicamento</span>
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
                            placeholder="Buscar por código, principio activo, descripción o marca..."
                            className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-500 transition-colors"
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 shrink-0">
                        {filteredMeds.length} registro{filteredMeds.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70">
                                <th className="py-2.5 px-4 font-bold text-slate-600">Tipo</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600">Código</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600">Principio activo</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600">Descripción</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600">Marca</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-xs">Cargando medicamentos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedMeds.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-400">
                                        <FiBox size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="font-medium text-xs">No se encontraron medicamentos registrados</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedMeds.map(med => (
                                    <tr key={med.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-3 px-4 font-medium text-slate-600">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                                                {med.tipo || "Otros"}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-bold text-slate-800">{med.codigo}</td>
                                        <td className="py-3 px-4 font-bold text-blue-600 uppercase">
                                            {med.principio_activo || med.nombre}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">{med.descripcion || "—"}</td>
                                        <td className="py-3 px-4 text-slate-500 font-medium">{med.marca || "—"}</td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button 
                                                    onClick={() => onEdit(med.id)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Editar medicamento"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(med.id, med.principio_activo || med.nombre)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                    title="Eliminar medicamento"
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

