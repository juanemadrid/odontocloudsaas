import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

export default function PlanesFormulacionList({ onNew, onEdit }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(true);
    const [planes, setPlanes] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    const loadPlans = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const q = query(collection(db, "planes_formulacion"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            setPlanes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

    const handleDelete = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar este plan de formulación?")) return;
        try {
            await deleteDoc(doc(db, "planes_formulacion", id));
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Search */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
                <div className="relative w-full max-w-md">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o descripción de plan..."
                        className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                    onClick={onNew}
                    className="h-10 px-6 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 shrink-0"
                >
                    <FiPlus className="mr-1.5" size={14} />
                    Nuevo Plan
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-6 py-4 pl-8">Nombre del plan</th>
                                <th className="px-6 py-4">Descripción</th>
                                <th className="px-6 py-4">Medicamentos incluidos</th>
                                <th className="px-6 py-4 text-center pr-8 w-28">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando planes...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPlanes.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-8 py-20 text-center text-slate-400 italic">
                                        No se encontraron planes de formulación registrados.
                                    </td>
                                </tr>
                            ) : (
                                filteredPlanes.map(plan => (
                                    <tr key={plan.id} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="px-6 py-4 pl-8 font-black text-slate-800 uppercase tracking-tight">{plan.nombre}</td>
                                        <td className="px-6 py-4 text-slate-500 font-semibold">{plan.descripcion || "—"}</td>
                                        <td className="px-6 py-4 font-medium text-slate-400">
                                            <div className="flex flex-wrap gap-1">
                                                {(plan.medicamentos || []).map((m, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase">
                                                        {m.principio_activo || m.medicamento} ({m.dosis})
                                                    </span>
                                                ))}
                                                {(plan.medicamentos || []).length === 0 && "—"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center pr-8 flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => onEdit(plan.id)}
                                                className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm"
                                                title="Editar"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(plan.id)}
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
            </div>
        </div>
    );
}
