// src/modules/config/EmpresaPlanes.jsx
import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiArrowLeft, FiSave, FiDollarSign, FiFileText } from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";

const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
        return new Date(isoString).toLocaleString("es-CO");
    } catch (e) {
        return isoString;
    }
};

export default function EmpresaPlanes() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [listas, setListas] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal state
    const [showNewModal, setShowNewModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [planName, setPlanName] = useState("");
    const [planListId, setPlanListId] = useState("");

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const [pData, lRes] = await Promise.all([
                getConfigItems(inquilino, "planes", "planes"),
                supabase.from("listas_precios").select("*").eq("tenant_id", inquilino)
            ]);

            setRows(pData.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
            if (lRes.data) setListas(lRes.data);
        } catch (error) {
            console.error("Error fetching planes:", error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [inquilino]);

    const handleSave = async () => {
        if (!planName.trim()) return alert("El nombre del plan es obligatorio.");
        if (!inquilino) return alert("No se identificó la clínica activa.");

        setLoading(true);
        try {
            const listaObj = listas.find(l => l.id === planListId);
            await saveConfigItem(inquilino, "planes", "planes", {
                ...(editingItem || {}),
                nombre: planName.trim(),
                listaId: planListId,
                listaNombre: listaObj?.nombre || ""
            });

            if (toast?.success) toast.success("Plan guardado correctamente en Supabase");
            setShowNewModal(false);
            setEditingItem(null);
            setPlanName("");
            setPlanListId("");
            fetchData();
        } catch (e) {
            console.error(e);
            alert("Error al guardar plan: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`⚠️ ¿Seguro que deseas eliminar el plan "${row.nombre}"?`)) return;
        setLoading(true);
        try {
            await deleteConfigItem(inquilino, "planes", "planes", row.id);
            setRows(prev => prev.filter(r => r.id !== row.id));
            if (toast?.success) toast.success("Plan eliminado correctamente");
            else alert("✅ Plan eliminado correctamente");
        } catch (e) {
            console.error("Error al eliminar plan:", e);
            alert("❌ Error al eliminar plan: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredRows = rows.filter(r =>
        (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <FiFileText size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Planes de Venta y Tarifarios</h1>
                        <p className="text-xs font-medium text-slate-500">Convenios y tarifas especiales asignadas</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:flex-none">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar plan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setPlanName("");
                            setPlanListId("");
                            setShowNewModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Plan</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Nombre del Plan</th>
                            <th className="py-3 px-4">Lista de Precios Base</th>
                            <th className="py-3 px-4">Última Modificación</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando planes...
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No hay planes registrados
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                <FiFileText size={15} />
                                            </div>
                                            <span className="font-bold text-slate-800 uppercase">{row.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-slate-600">
                                        {row.listaNombre || "Sin lista vinculada"}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-slate-500">
                                        {formatDate(row.actualizado || row.created_at)}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(row);
                                                    setPlanName(row.nombre);
                                                    setPlanListId(row.listaId || "");
                                                    setShowNewModal(true);
                                                }}
                                                className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                title="Editar Plan"
                                            >
                                                <FiEdit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                title="Eliminar Plan"
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

            {/* Modal de Creación / Edición */}
            {showNewModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                                    <FiFileText size={18} />
                                </div>
                                <h3 className="text-base font-black text-slate-800 uppercase">
                                    {editingItem ? "Editar Plan" : "Nuevo Plan de Venta"}
                                </h3>
                            </div>
                            <button onClick={() => setShowNewModal(false)} className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 font-bold">&times;</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre del Plan *</label>
                                <input
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    value={planName}
                                    onChange={e => setPlanName(e.target.value)}
                                    placeholder="Ej. Plan Colectivo 2026"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Lista de Precios Base</label>
                                <select
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    value={planListId}
                                    onChange={e => setPlanListId(e.target.value)}
                                >
                                    <option value="">Seleccione lista de precio...</option>
                                    {listas.map(l => (
                                        <option key={l.id} value={l.id}>{l.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowNewModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-200 flex items-center gap-2 border-0"
                                >
                                    <FiSave size={15} />
                                    <span>Guardar Plan</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
