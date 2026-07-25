// src/modules/config/ConfigConsecutivos.jsx
// ============================================================
// ⚙️ Configuración de Consecutivos - OdontoCloud
// Diseño estilizado, compacto y profesional.
// ============================================================
import React, { useState, useEffect } from "react";
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiHash, FiUsers, FiFilter } from "react-icons/fi";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import Input from "../../components/ui/Input";

import ConfigConsecutivosForm from "./ConfigConsecutivosForm";

export default function ConfigConsecutivos() {
    const { userProfile } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [consecutivos, setConsecutivos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadConsecutivos();
    }, [userProfile?.inquilino]);

    const loadConsecutivos = async () => {
        if (!userProfile?.inquilino) return;
        
        setLoading(true);
        try {
            const q = query(
                collection(db, "consecutivos"),
                where("inquilino", "==", userProfile.inquilino)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", undefined, { sensitivity: "base" }));
            setConsecutivos(data);
        } catch (error) {
            console.error("Error cargando consecutivos:", error);
            toast.error("Error al cargar consecutivos");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar este consecutivo?")) return;
        
        try {
            await deleteDoc(doc(db, "consecutivos", id));
            toast.success("Consecutivo eliminado");
            loadConsecutivos();
        } catch (error) {
            console.error("Error eliminando consecutivo:", error);
            toast.error("Error al eliminar: " + error.message);
        }
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingItem(null);
        loadConsecutivos();
    };

    const filteredData = consecutivos.filter(item => 
        item.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (showForm) {
        return (
            <div className="p-4 md:p-6 max-w-5xl mx-auto">
                <button
                    onClick={handleCloseForm}
                    className="mb-4 text-slate-500 hover:text-blue-600 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                    ← Volver a la lista
                </button>
                <ConfigConsecutivosForm onClose={handleCloseForm} initialData={editingItem} />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            
            {/* Header & Bar Acciones */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiHash size={20} />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-bold text-slate-800">Consecutivos</h1>
                        <p className="text-[12px] text-slate-500">Gestión y asignación de numeración de documentos</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                >
                    <FiPlus size={16} />
                    <span>Nuevo consecutivo</span>
                </button>
            </div>

            {/* Content Table Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                {/* Toolbar de búsqueda */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar consecutivo..."
                            className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    
                    <span className="text-[11px] font-medium text-slate-400 shrink-0">
                        {filteredData.length} registro{filteredData.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Tabla de Consecutivos */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[12px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70">
                                <th className="py-2.5 px-4 font-bold text-slate-600">Nombre</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600 text-center">Estado</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600 text-center">Asignación</th>
                                <th className="py-2.5 px-4 font-bold text-slate-600 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-[12px]">Cargando consecutivos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-3 px-4 font-semibold text-slate-800">
                                            {item.nombre}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                Disponible
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex justify-center">
                                                <div className="w-7 h-7 rounded bg-slate-100 text-slate-600 flex items-center justify-center" title="Usuarios asignados">
                                                    <FiUsers size={14} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button 
                                                    onClick={() => handleEdit(item)}
                                                    title="Editar consecutivo"
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id)}
                                                    title="Eliminar consecutivo"
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-0 bg-transparent"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-slate-400">
                                        <FiHash size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="font-medium text-[12px]">No se encontraron consecutivos</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}
