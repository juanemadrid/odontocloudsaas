import React, { useState, useEffect, useMemo } from "react";
import { FiSearch, FiCalendar, FiPlusCircle, FiTrash2, FiX } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
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
            let tList = [];
            try {
                const { data: tSnap } = await supabase
                    .from("tipos_residuos")
                    .select("*")
                    .eq("tenant_id", inquilino);
                if (tSnap && tSnap.length > 0) tList = tSnap;
            } catch (e) {}

            if (tList.length === 0) {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();
                tList = cfgRow?.config?.tipos_residuos || [];
            }

            setTypes(tList.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
            if (tList.length > 0) setSelectedTypeId(tList[0].id);

            // Load logs
            let lList = [];
            try {
                const { data: lSnap } = await supabase
                    .from("registro_residuos")
                    .select("*")
                    .eq("tenant_id", inquilino);
                if (lSnap && lSnap.length > 0) lList = lSnap;
            } catch (e) {}

            if (lList.length === 0) {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();
                lList = cfgRow?.config?.registro_residuos || [];
            }

            setLogs(lList);
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
            const reportId = crypto.randomUUID ? crypto.randomUUID() : `rep_${Date.now()}`;
            const reportItem = {
                id: reportId,
                fechaHora,
                fecha: fechaHora.split(" ")[0],
                residuoId: selectedTypeId,
                residuoNombre: selectedType.nombre,
                color: selectedType.color,
                cantidad: parseFloat(peso),
                tenant_id: inquilino,
                created_at: new Date().toISOString()
            };

            try {
                await supabase.from("registro_residuos").insert([reportItem]);
            } catch (e) {}

            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", inquilino)
                .maybeSingle();

            const currentConfig = cfgRow?.config || {};
            const currentList = Array.isArray(currentConfig.registro_residuos) ? currentConfig.registro_residuos : logs;
            const updatedList = [reportItem, ...currentList];

            await supabase.from("website_config").upsert(
                { tenant_id: inquilino, config: { ...currentConfig, registro_residuos: updatedList } },
                { onConflict: "tenant_id" }
            );

            toast.success("Reporte de residuo guardado con éxito");
            setLogs(prev => [reportItem, ...prev]);
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
            try {
                await supabase.from("registro_residuos").delete().eq("id", id);
            } catch (e) {}

            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", inquilino)
                .maybeSingle();

            const currentConfig = cfgRow?.config || {};
            const currentList = Array.isArray(currentConfig.registro_residuos) ? currentConfig.registro_residuos : logs;
            const updatedList = currentList.filter(l => l.id !== id);

            await supabase.from("website_config").upsert(
                { tenant_id: inquilino, config: { ...currentConfig, registro_residuos: updatedList } },
                { onConflict: "tenant_id" }
            );

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
        }).sort((a, b) => (b.fechaHora || "").localeCompare(a.fechaHora || ""));
    }, [logs, appliedRange, searchTerm]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300 font-sans text-slate-800">
            {/* Upper filter card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Fecha inicial</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full h-8 px-3 pl-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                                max="9999-12-31" min="1900-01-01" 
                            />
                            <FiCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Fecha final</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full h-8 px-3 pl-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                                max="9999-12-31" min="1900-01-01" 
                            />
                            <FiCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="h-8 px-4 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 cursor-pointer"
                    >
                        Buscar
                    </button>
                </form>
            </div>

            {/* Lower table card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative w-full max-w-sm">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        <input
                            type="text"
                            placeholder="Buscar en reportes..."
                            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleOpenAdd}
                        className="h-8 px-3.5 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer gap-1.5"
                    >
                        <FiPlusCircle size={13} />
                        Reportar
                    </button>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                    <th className="py-2.5 px-3">Fecha hora ingreso</th>
                                    <th className="py-2.5 px-3">Tipo de residuo</th>
                                    <th className="py-2.5 px-3 text-center">Peso (kg)</th>
                                    <th className="py-2.5 px-3 text-center w-24">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="py-16 text-center">
                                            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="py-16 text-center text-slate-400 italic text-xs">
                                            No se encontraron registros de residuos en este periodo.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{log.fechaHora}</td>
                                            <td className="py-2.5 px-3 font-bold text-slate-800">{log.residuoNombre}</td>
                                            <td className="py-2.5 px-3 text-center font-bold font-mono text-emerald-600">{Number(log.cantidad || 0).toFixed(2)}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <button
                                                    onClick={() => handleDelete(log.id)}
                                                    className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-slate-200 cursor-pointer mx-auto"
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={12} />
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

            {/* Modal Dialog */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[1000] animate-in fade-in duration-200 p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-800">
                                Nuevo reporte
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
                            {/* Fecha Hora */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-semibold text-slate-600">Fecha y hora ingreso *</label>
                                <input
                                    type="text"
                                    className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                                    value={fechaHora}
                                    onChange={e => setFechaHora(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Tipo de residuo */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-semibold text-slate-600">Tipo de residuo *</label>
                                <select
                                    value={selectedTypeId}
                                    onChange={e => setSelectedTypeId(e.target.value)}
                                    className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                                    required
                                >
                                    <option value="">Seleccione...</option>
                                    {types.map(t => (
                                        <option key={t.id} value={t.id}>{t.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Peso */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-semibold text-slate-600">Peso (kg) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                                    value={peso}
                                    onChange={e => setPeso(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Actions */}
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
                                    disabled={saving || types.length === 0}
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
