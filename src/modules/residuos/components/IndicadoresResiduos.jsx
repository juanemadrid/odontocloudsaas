import React, { useState, useEffect, useMemo } from "react";
import { FiCalendar } from "react-icons/fi";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
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
                const tQ = query(collection(db, "tipos_residuos"), where("inquilino", "==", inquilino));
                const tSnap = await getDocs(tQ);
                setTypes(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                // Load logs
                const snap = await getDocs(query(collection(db, "registro_residuos"), where("inquilino", "==", inquilino)));
                setLogs(snap.docs.map(d => d.data()));
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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Filter toolbar */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row md:items-end gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Año a totalizar</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                placeholder="Ej: 2026"
                                className="h-11 px-4 pl-11 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all w-48"
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

            {/* Matrix table */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="px-6 py-4 pl-8 w-24">Mes</th>
                                <th className="px-6 py-4 text-center border-l border-slate-100 bg-rose-600/90 text-white w-32">IDD</th>
                                <th className="px-6 py-4 text-center border-l border-slate-100 bg-orange-500/90 text-white w-32">IDI</th>
                                <th className="px-6 py-4 text-center border-l border-slate-100 bg-blue-500/90 text-white w-32">IDS</th>
                                <th className="px-6 py-4 text-center border-l border-slate-100 bg-slate-500/90 text-white w-32">IDR</th>
                                <th className="px-6 py-4 text-center border-l border-slate-100 bg-emerald-600/90 text-white w-32">IDRa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center font-sans text-slate-400 italic">
                                        Calculando planilla de indicadores...
                                    </td>
                                </tr>
                            ) : (
                                monthlyStats.map(row => (
                                    <tr key={row.mes} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-3 pl-8 font-bold font-sans text-slate-800">{row.mes}</td>
                                        <td className="px-6 py-3 text-center border-l border-slate-50 font-bold text-slate-500">{row.idd > 0 ? row.idd.toFixed(2) : 0}</td>
                                        <td className="px-6 py-3 text-center border-l border-slate-50 font-bold text-slate-500">{row.idi > 0 ? row.idi.toFixed(2) : 0}</td>
                                        <td className="px-6 py-3 text-center border-l border-slate-50 font-bold text-slate-500">{row.ids > 0 ? row.ids.toFixed(2) : 0}</td>
                                        <td className="px-6 py-3 text-center border-l border-slate-50 font-bold text-slate-500">{row.idr > 0 ? row.idr.toFixed(2) : 0}</td>
                                        <td className="px-6 py-3 text-center border-l border-slate-50 font-bold text-slate-500">{row.idra > 0 ? row.idra.toFixed(2) : 0}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Graphic Indicators Panel */}
            <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm space-y-8">
                <div className="border-b border-slate-50 pb-3 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        Indicador gráfico
                    </h3>
                </div>

                {/* Graphic Bars Wrapper */}
                <div className="h-80 w-full relative flex items-end justify-between border-b border-slate-200 pb-2 px-4 select-none">
                    {/* Y-axis gridlines */}
                    <div className="absolute inset-x-0 bottom-2 top-0 flex flex-col justify-between pointer-events-none opacity-20 text-[10px] font-bold text-slate-400">
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
                            <div key={m.mes} className="flex-1 flex flex-col items-center justify-end h-full gap-2 z-10 relative">
                                <div className="flex items-end gap-0.5 justify-center h-56 w-full max-w-[48px]">
                                    {/* IDD */}
                                    <div 
                                        className="w-1.5 bg-rose-500 rounded-t-sm transition-all duration-700 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.idd * 0.95}%` }}
                                        title={`IDD (${m.mes}): ${m.idd.toFixed(1)}%`}
                                    />
                                    {/* IDI */}
                                    <div 
                                        className="w-1.5 bg-orange-500 rounded-t-sm transition-all duration-700 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.idi * 0.95}%` }}
                                        title={`IDI (${m.mes}): ${m.idi.toFixed(1)}%`}
                                    />
                                    {/* IDS */}
                                    <div 
                                        className="w-1.5 bg-blue-500 rounded-t-sm transition-all duration-700 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.ids * 0.95}%` }}
                                        title={`IDS (${m.mes}): ${m.ids.toFixed(1)}%`}
                                    />
                                    {/* IDR */}
                                    <div 
                                        className="w-1.5 bg-slate-400 rounded-t-sm transition-all duration-700 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.idr * 0.95}%` }}
                                        title={`IDR (${m.mes}): ${m.idr.toFixed(1)}%`}
                                    />
                                    {/* IDRa */}
                                    <div 
                                        className="w-1.5 bg-emerald-500 rounded-t-sm transition-all duration-700 hover:scale-x-125 cursor-help"
                                        style={{ height: `${m.idra * 0.95}%` }}
                                        title={`IDRa (${m.mes}): ${m.idra.toFixed(1)}%`}
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 tracking-tight">{m.mes.slice(0, 3)}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Legend keys */}
                <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] font-black uppercase tracking-wider text-slate-500 pt-2">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-rose-500 rounded-full inline-block" />
                        <span>IDD (Infecciosos / Biosanitarios)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-orange-500 rounded-full inline-block" />
                        <span>IDI (Cortopunzantes)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-blue-500 rounded-full inline-block" />
                        <span>IDS (Químicos)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-slate-400 rounded-full inline-block" />
                        <span>IDR (Reciclables)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-emerald-500 rounded-full inline-block" />
                        <span>IDRa (Radioactivos)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
