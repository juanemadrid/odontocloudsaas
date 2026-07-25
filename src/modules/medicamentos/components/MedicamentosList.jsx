import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

export default function MedicamentosList({ onNew, onEdit }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(true);
    const [medicamentos, setMedicamentos] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const loadMedicines = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const q = query(collection(db, "medicamentos"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            setMedicamentos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

    const handleDelete = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar este medicamento?")) return;
        try {
            await deleteDoc(doc(db, "medicamentos", id));
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
                (m.principio_activo || "").toLowerCase().includes(term) ||
                (m.descripcion || "").toLowerCase().includes(term) ||
                (m.marca || "").toLowerCase().includes(term)
            );
        });
    }, [medicamentos, searchTerm]);

    // Paginated
    const totalPages = Math.ceil(filteredMeds.length / itemsPerPage) || 1;
    const paginatedMeds = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredMeds.slice(start, start + itemsPerPage);
    }, [filteredMeds, currentPage]);

    // Handle page change safely
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Search */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
                <div className="relative w-full max-w-md">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por código, principio activo, descripción..."
                        className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                        value={searchTerm}
                        onChange={e => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <button 
                    onClick={onNew}
                    className="h-10 px-6 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 shrink-0"
                >
                    <FiPlus className="mr-1.5" size={14} />
                    Nuevo Medicamento
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-6 py-4 pl-8">Tipo medicamento</th>
                                <th className="px-6 py-4">Código</th>
                                <th className="px-6 py-4">Principio activo</th>
                                <th className="px-6 py-4">Descripción</th>
                                <th className="px-6 py-4">Marca</th>
                                <th className="px-6 py-4 text-center pr-8 w-28">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando medicamentos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedMeds.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-slate-400 italic">
                                        No se encontraron medicamentos registrados.
                                    </td>
                                </tr>
                            ) : (
                                paginatedMeds.map(med => (
                                    <tr key={med.id} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="px-6 py-4 pl-8 font-semibold text-slate-500">{med.tipo || "Otros"}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800">{med.codigo}</td>
                                        <td className="px-6 py-4 font-black text-blue-600 uppercase tracking-tight">{med.principio_activo}</td>
                                        <td className="px-6 py-4 text-slate-500 font-medium">{med.descripcion || "—"}</td>
                                        <td className="px-6 py-4 text-slate-400 font-bold">{med.marca || "—"}</td>
                                        <td className="px-6 py-4 text-center pr-8 flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => onEdit(med.id)}
                                                className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm"
                                                title="Editar"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(med.id)}
                                                className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all shadow-sm"
                                                title="Eliminar"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, idx) => (
                                <button
                                    key={idx + 1}
                                    onClick={() => setCurrentPage(idx + 1)}
                                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                                        currentPage === idx + 1 
                                            ? "bg-blue-600 text-white shadow-sm" 
                                            : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
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
