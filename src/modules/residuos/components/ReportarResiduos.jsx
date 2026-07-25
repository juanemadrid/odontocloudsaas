import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiCalendar, FiPlusCircle, FiTrash2, FiX } from "react-icons/fi";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

export default function ReportarResiduos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [types, setTypes] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter date ranges (OralDrive style)
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
        end: new Date().toISOString().split("T")[0]
    });
    const [appliedRange, setAppliedRange] = useState({ ...dateRange });

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [fechaHora, setFechaHora] = useState(new Date().toISOString().slice(0, 16).replace("T", " "));
    const [selectedTypeId, setSelectedTypeId] = useState("");
    const [peso, setPeso] = useState(0);
    const [saving, setSaving] = useState(false);

    // Search state
    const [searchTerm, setSearchTerm] = useState("");

    const loadData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            // Load types
            const tQ = query(collection(db, "tipos_residuos"), where("inquilino", "==", inquilino));
            const tSnap = await getDocs(tQ);
            const tList = tSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre));
            setTypes(tList);
            if (tList.length > 0) setSelectedTypeId(tList[0].id);

            // Load logs
            const lQ = query(collection(db, "registro_residuos"), where("inquilino", "==", inquilino));
            const lSnap = await getDocs(lQ);
            setLogs(lSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("Error loading reporting logs:", e);
            toast.error("Error al cargar los reportes de residuos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [inquilino]);

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        setAppliedRange({ ...dateRange });
    };

    const handleOpenAdd = () => {
        setFechaHora(new Date().toISOString().slice(0, 16).replace("T", " "));
        setPeso(0);
        if (types.length > 0) setSelectedTypeId(types[0].id);
        setShowModal(true);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!selectedTypeId) {
            toast.error("Seleccione un tipo de residuo.");
            return;
        }
        if (parseFloat(peso) < 0 || isNaN(peso)) {
            toast.error("Ingrese un peso válido.");
            return;
        }

        const selectedType = types.find(t => t.id === selectedTypeId);
        if (!selectedType) return;

        setSaving(true);
        try {
            const reportItem = {
                fechaHora,
                fecha: fechaHora.split(" ")[0], // Extract just the date for query range filtering
                residuoId: selectedTypeId,
                residuoNombre: selectedType.nombre,
                color: selectedType.color,
                cantidad: parseFloat(peso),
                inquilino,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, "registro_residuos"), reportItem);
            toast.success("Pesaje de residuo reportado");
            setLogs(prev => [{ id: docRef.id, ...reportItem }, ...prev]);
            setShowModal(false);
        } catch (err) {
            console.error("Error saving residue report:", err);
            toast.error("Error al guardar el reporte");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar este reporte de residuo?")) return;
        try {
            await deleteDoc(doc(db, "registro_residuos", id));
            toast.success("Reporte de residuo eliminado");
            setLogs(prev => prev.filter(l => l.id !== id));
        } catch (e) {
            console.error("Error deleting residue report:", e);
            toast.error("Error al eliminar el reporte");
        }
    };

    // Filter by date range and search term
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const date = log.fecha || "";
            const matchesDate = date >= appliedRange.start && date <= appliedRange.end;
            if (!matchesDate) return false;

            const name = (log.residuoNombre || "").toLowerCase();
            const term = searchTerm.toLowerCase();
            return name.includes(term);
        }).sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
    }, [logs, appliedRange, searchTerm]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Upper filter card (OralDrive style) */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Fecha Inicial</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                            />
                            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Fecha Final</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                            />
                            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="h-11 px-8 flex items-center justify-center bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95"
                    >
                        Buscar
                    </button>
                </form>
            </div>

            {/* Lower table card */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="relative w-full max-w-md">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleOpenAdd}
                        className="h-10 px-6 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 shrink-0"
                    >
                        Reportar
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-6 py-4 pl-8">Fecha hora ingreso</th>
                                <th className="px-6 py-4">Tipo de residuo</th>
                                <th className="px-6 py-4">Peso (kg)</th>
                                <th className="px-6 py-4 text-center pr-8 w-28">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-8 py-10 text-center">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-8 py-14 text-center text-slate-400 italic">
                                        No se encontraron registros de residuos en este periodo.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="px-6 py-4 pl-8 font-semibold text-slate-500 font-mono">{log.fechaHora}</td>
                                        <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tight">{log.residuoNombre}</td>
                                        <td className="px-6 py-4 font-black text-blue-600 font-mono">{log.cantidad.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center pr-8">
                                            <button
                                                onClick={() => handleDelete(log.id)}
                                                className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all shadow-sm mx-auto"
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

            {/* Modal Dialog */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Nuevo reporte
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 flex items-center justify-center transition-all"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            {/* Fecha Hora */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha hora ingreso *</label>
                                <input
                                    type="text"
                                    className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    value={fechaHora}
                                    onChange={e => setFechaHora(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Tipo de residuo */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo de residuo *</label>
                                <select
                                    value={selectedTypeId}
                                    onChange={e => setSelectedTypeId(e.target.value)}
                                    className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                                    required
                                >
                                    <option value="">Seleccione...</option>
                                    {types.map(t => (
                                        <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Peso */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peso(kg) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full h-11 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    value={peso}
                                    onChange={e => setPeso(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="h-10 px-6 rounded-full text-xs font-black uppercase tracking-widest text-slate-400 border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || types.length === 0}
                                    className="h-10 px-8 rounded-full text-xs font-black uppercase tracking-widest text-white bg-[#8cc33f] hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95"
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
