import React, { useState, useEffect, useMemo } from "react";
import { FiCalendar, FiSearch } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

const MONTHS_SPANISH = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function TotalesResiduos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [types, setTypes] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const [year, setYear] = useState(new Date().getFullYear());
    const [appliedYear, setAppliedYear] = useState(new Date().getFullYear());

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
            console.error("Error loading totals data:", e);
            toast.error("Error al cargar la planilla de totales");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [inquilino]);

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        setAppliedYear(year);
    };

    // Matrix calculation
    const matrix = useMemo(() => {
        // Initialize matrix with 12 months, each having type names mapped to 0
        const rows = MONTHS_SPANISH.map((m, idx) => {
            const data = { mes: m, mesIndex: idx };
            types.forEach(t => {
                data[t.nombre] = 0;
            });
            return data;
        });

        // Totals mapping for footer
        const colTotals = {};
        types.forEach(t => {
            colTotals[t.nombre] = 0;
        });

        // Filter logs by appliedYear
        const yearLogs = logs.filter(log => {
            const dateStr = log.fecha || "";
            const logYear = new Date(dateStr).getFullYear();
            return logYear === parseInt(appliedYear);
        });

        // Aggregate logs
        yearLogs.forEach(log => {
            const dateStr = log.fecha || "";
            const logMonthIdx = new Date(dateStr).getMonth();
            const typeName = log.residuoNombre;
            const qty = log.cantidad || 0;

            if (logMonthIdx >= 0 && logMonthIdx < 12 && rows[logMonthIdx][typeName] !== undefined) {
                rows[logMonthIdx][typeName] += qty;
                colTotals[typeName] += qty;
            }
        });

        return { rows, colTotals };
    }, [logs, types, appliedYear]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300 font-sans text-slate-800">
            {/* Filter toolbar */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Año a totalizar</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                placeholder="Ej: 2026"
                                className="h-8 px-3 pl-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors w-36"
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

            {/* Matrix table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Planilla de Totales Anuales ({appliedYear})
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                <th className="py-2.5 px-3 w-28">Mes</th>
                                {types.map(t => (
                                    <th 
                                        key={t.id} 
                                        className="py-2 px-2.5 text-center text-[10px] border-l border-slate-100 font-semibold text-slate-700 whitespace-nowrap"
                                        title={t.nombre}
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            <span 
                                                className="w-1.5 h-1.5 rounded-full shrink-0" 
                                                style={{
                                                    backgroundColor: t.color === "Rojo" ? "#ef4444" :
                                                                     t.color === "Verde" ? "#22c55e" :
                                                                     t.color === "Blanco" ? "#94a3b8" :
                                                                     t.color === "Negro" ? "#0f172a" :
                                                                     t.color === "Amarillo" ? "#eab308" :
                                                                     t.color === "Azul" ? "#3b82f6" :
                                                                     t.color === "Gris" ? "#64748b" :
                                                                     t.color === "Púrpura" ? "#a855f7" : "#cbd5e1"
                                                }}
                                            />
                                            <span className="truncate max-w-[100px]">{t.nombre}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={types.length + 1} className="py-16 text-center text-slate-400 italic text-xs">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                            <span>Cargando matriz de totales anuales...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : matrix.rows.length === 0 ? (
                                <tr>
                                    <td colSpan={types.length + 1} className="py-16 text-center text-slate-400 italic text-xs">
                                        No hay datos disponibles.
                                    </td>
                                </tr>
                            ) : (
                                matrix.rows.map(row => (
                                    <tr key={row.mes} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-2 px-3 font-semibold text-slate-800">{row.mes}</td>
                                        {types.map(t => (
                                            <td key={t.id} className="py-2 px-2 text-center border-l border-slate-50 font-mono text-[11px] text-slate-600">
                                                {row[t.nombre] > 0 ? (
                                                    <span className="font-semibold text-emerald-600">{row[t.nombre].toFixed(1)}</span>
                                                ) : (
                                                    <span className="text-slate-400">0</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {/* Footer row */}
                        {!loading && types.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-100/70 font-bold text-xs text-slate-800 border-t border-slate-200">
                                    <td className="py-2.5 px-3 uppercase font-bold text-[11px] text-slate-800">Total Anual</td>
                                    {types.map(t => (
                                        <td key={t.id} className="py-2.5 px-2 text-center border-l border-slate-200 font-bold text-emerald-700 font-mono text-xs">
                                            {matrix.colTotals[t.nombre] > 0 ? matrix.colTotals[t.nombre].toFixed(1) : 0}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
