import React, { useState, useEffect, useMemo } from "react";
import { FiCalendar } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

const MONTHS_SPANISH = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function IndicadoresResiduos() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [logs, setLogs] = useState([]);
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    const [year, setYear] = useState(new Date().getFullYear());
    const [appliedYear, setAppliedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (!inquilino) return;
        const loadData = async () => {
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
                setTypes(tList);

                // Load logs
                let lList = [];
                try {
                    const { data: snap } = await supabase
                        .from("registro_residuos")
                        .select("*")
                        .eq("tenant_id", inquilino);
                    if (snap && snap.length > 0) lList = snap;
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
                console.error("Error loading data for indicators:", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [inquilino]);

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        setAppliedYear(year);
    };

    // Calculate monthly indicators
    const monthlyStats = useMemo(() => {
        const months = MONTHS_SPANISH.map((m, idx) => ({
            mes: m,
            mesIndex: idx,
            total: 0,
            infectious: 0,   // For IDD
            sharps: 0,       // For IDI
            chemical: 0,     // For IDS
            recyclable: 0,   // For IDR
            radioactive: 0   // For IDRa
        }));

        // Filter logs by year
        const yearLogs = logs.filter(log => {
            const dateStr = log.fecha || "";
            const logYear = new Date(dateStr).getFullYear();
            return logYear === parseInt(appliedYear);
        });

        // Sum weights
        yearLogs.forEach(log => {
            const dateStr = log.fecha || "";
            const monthIdx = new Date(dateStr).getMonth();
            if (monthIdx >= 0 && monthIdx < 12) {
                const qty = log.cantidad || 0;
                const name = (log.residuoNombre || "").toLowerCase();
                const color = log.color || "";

                months[monthIdx].total += qty;

                // Biosafety indicator classifications (PGIRH Colombia):
                if (name.includes("biosanitario") || name.includes("anatomopatologico") || name.includes("sangre")) {
                    months[monthIdx].infectious += qty;
                } else if (name.includes("cortopunzante") || name.includes("aguja") || name.includes("bisturi")) {
                    months[monthIdx].sharps += qty;
                } else if (color === "Rojo" && (name.includes("quimico") || name.includes("reactivo") || name.includes("corrosivo") || name.includes("toxico") || name.includes("amalgama"))) {
                    months[monthIdx].chemical += qty;
                } else if (color === "Blanco" || name.includes("aprovechable") || name.includes("recicl")) {
                    months[monthIdx].recyclable += qty;
                } else if (color === "Rojo" && name.includes("radioactivo")) {
                    months[monthIdx].radioactive += qty;
                } else {
                    // Fallback by color just in case:
                    if (color === "Rojo" && months[monthIdx].infectious === 0) {
                        months[monthIdx].infectious += qty;
                    }
                }
            }
        });

        // Compute rates (percentage over total)
        return months.map(m => {
            const total = m.total;
            return {
                mes: m.mes,
                mesIndex: m.mesIndex,
                idd: total > 0 ? (m.infectious / total) * 100 : 0,
                idi: total > 0 ? (m.sharps / total) * 100 : 0,
                ids: total > 0 ? (m.chemical / total) * 100 : 0,
                idr: total > 0 ? (m.recyclable / total) * 100 : 0,
                idra: total > 0 ? (m.radioactive / total) * 100 : 0
            };
        });
    }, [logs, appliedYear]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300 font-sans text-slate-800">
            {/* Filter toolbar */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Año a consultar</label>
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
                        Planilla de Indicadores Mensuales ({appliedYear})
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                                <th className="py-2.5 px-4 w-28">Mes</th>
                                <th className="py-2.5 px-3 text-center border-l border-slate-100">IDD (Infecciosos)</th>
                                <th className="py-2.5 px-3 text-center border-l border-slate-100">IDI (Cortopunzantes)</th>
                                <th className="py-2.5 px-3 text-center border-l border-slate-100">IDS (Químicos)</th>
                                <th className="py-2.5 px-3 text-center border-l border-slate-100">IDR (Reciclables)</th>
                                <th className="py-2.5 px-3 text-center border-l border-slate-100">IDRa (Radioactivos)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-16 text-center text-slate-400 italic text-xs">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                            <span>Calculando planilla de indicadores...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                monthlyStats.map(row => (
                                    <tr key={row.mes} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-2 px-4 font-semibold text-slate-800">{row.mes}</td>
                                        <td className="py-2 px-3 text-center border-l border-slate-50 font-mono text-[11px]">
                                            {row.idd > 0 ? <span className="font-semibold text-rose-600">{row.idd.toFixed(2)}%</span> : <span className="text-slate-400">0.00%</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center border-l border-slate-50 font-mono text-[11px]">
                                            {row.idi > 0 ? <span className="font-semibold text-amber-600">{row.idi.toFixed(2)}%</span> : <span className="text-slate-400">0.00%</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center border-l border-slate-50 font-mono text-[11px]">
                                            {row.ids > 0 ? <span className="font-semibold text-blue-600">{row.ids.toFixed(2)}%</span> : <span className="text-slate-400">0.00%</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center border-l border-slate-50 font-mono text-[11px]">
                                            {row.idr > 0 ? <span className="font-semibold text-slate-700">{row.idr.toFixed(2)}%</span> : <span className="text-slate-400">0.00%</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center border-l border-slate-50 font-mono text-[11px]">
                                            {row.idra > 0 ? <span className="font-semibold text-emerald-600">{row.idra.toFixed(2)}%</span> : <span className="text-slate-400">0.00%</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Graphic Indicators Panel */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Indicador gráfico ({appliedYear})
                    </h3>
                </div>

                {/* Graphic Bars Wrapper */}
                <div className="h-64 w-full relative flex items-end justify-between border-b border-slate-200 pb-2 px-2 select-none">
                    {/* Y-axis gridlines */}
                    <div className="absolute inset-x-0 bottom-2 top-0 flex flex-col justify-between pointer-events-none opacity-20 text-[10px] font-medium text-slate-400">
                        <div className="border-b border-slate-300 w-full pt-1 flex justify-end">100%</div>
                        <div className="border-b border-slate-300 w-full flex justify-end">80%</div>
                        <div className="border-b border-slate-300 w-full flex justify-end">60%</div>
                        <div className="border-b border-slate-300 w-full flex justify-end">40%</div>
                        <div className="border-b border-slate-300 w-full flex justify-end">20%</div>
                        <div className="w-full flex justify-end">0%</div>
                    </div>

                    {/* Bars for each month */}
                    {monthlyStats.map(m => {
                        return (
                            <div key={m.mes} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 z-10 relative">
                                <div className="flex items-end gap-0.5 justify-center h-44 w-full max-w-[40px]">
                                    {/* IDD */}
                                    <div 
                                        className="w-1.5 bg-rose-500 rounded-t-sm transition-all duration-500 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.idd * 0.95}%` }}
                                        title={`IDD (${m.mes}): ${m.idd.toFixed(1)}%`}
                                    />
                                    {/* IDI */}
                                    <div 
                                        className="w-1.5 bg-amber-500 rounded-t-sm transition-all duration-500 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.idi * 0.95}%` }}
                                        title={`IDI (${m.mes}): ${m.idi.toFixed(1)}%`}
                                    />
                                    {/* IDS */}
                                    <div 
                                        className="w-1.5 bg-blue-500 rounded-t-sm transition-all duration-500 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.ids * 0.95}%` }}
                                        title={`IDS (${m.mes}): ${m.ids.toFixed(1)}%`}
                                    />
                                    {/* IDR */}
                                    <div 
                                        className="w-1.5 bg-slate-400 rounded-t-sm transition-all duration-500 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.idr * 0.95}%` }}
                                        title={`IDR (${m.mes}): ${m.idr.toFixed(1)}%`}
                                    />
                                    {/* IDRa */}
                                    <div 
                                        className="w-1.5 bg-emerald-500 rounded-t-sm transition-all duration-500 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.idra * 0.95}%` }}
                                        title={`IDRa (${m.mes}): ${m.idra.toFixed(1)}%`}
                                    />
                                </div>
                                <span className="text-[10px] font-medium text-slate-500">{m.mes.slice(0, 3)}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Legend keys */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-medium text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block" />
                        <span>IDD (Infecciosos)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block" />
                        <span>IDI (Cortopunzantes)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block" />
                        <span>IDS (Químicos)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-slate-400 rounded-full inline-block" />
                        <span>IDR (Reciclables)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" />
                        <span>IDRa (Radioactivos)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
