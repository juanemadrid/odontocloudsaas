import React, { useState, useEffect, useMemo } from "react";
import { FiCalendar, FiSearch } from "react-icons/fi";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
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
            const tQ = query(collection(db, "tipos_residuos"), where("inquilino", "==", inquilino));
            const tSnap = await getDocs(tQ);
            setTypes(tSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre)));

            // Load logs
            const lQ = query(collection(db, "registro_residuos"), where("inquilino", "==", inquilino));
            const lSnap = await getDocs(lQ);
            setLogs(lSnap.docs.map(d => d.data()));
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
                    <table className="w-full text-left border-collapse min-w-[1600px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="px-4 py-4 pl-6 w-24">Mes</th>
                                {types.map(t => (
                                    <th 
                                        key={t.id} 
                                        className={`px-3 py-4 text-center text-[9px] border-l border-slate-100 text-white truncate max-w-[120px] ${
                                            t.color === "Rojo" ? "bg-rose-600" :
                                            t.color === "Verde" ? "bg-emerald-600" :
                                            t.color === "Negro" ? "bg-slate-800" :
                                            t.color === "Blanco" ? "bg-slate-400" :
                                            "bg-blue-600"
                                        }`}
                                        title={t.nombre}
                                    >
                                        {t.nombre}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-mono">
                            {loading ? (
                                <tr>
                                    <td colSpan={types.length + 1} className="px-8 py-20 text-center font-sans text-slate-400 italic">
                                        Cargando matriz de totales anuales...
                                    </td>
                                </tr>
                            ) : matrix.rows.length === 0 ? (
                                <tr>
                                    <td colSpan={types.length + 1} className="px-8 py-20 text-center font-sans text-slate-400 italic">
                                        No hay datos disponibles.
                                    </td>
                                </tr>
                            ) : (
                                matrix.rows.map(row => (
                                    <tr key={row.mes} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 pl-6 font-bold font-sans text-slate-800">{row.mes}</td>
                                        {types.map(t => (
                                            <td key={t.id} className="px-3 py-3 text-center border-l border-slate-50 font-bold text-slate-500">
                                                {row[t.nombre] > 0 ? row[t.nombre].toFixed(1) : 0}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {/* Footer row */}
                        {!loading && types.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-50 font-bold text-xs text-slate-800 border-t border-slate-200">
                                    <td className="px-4 py-4 pl-6 uppercase font-black text-[10px]">Total</td>
                                    {types.map(t => (
                                        <td key={t.id} className="px-3 py-4 text-center border-l border-slate-100 font-black text-blue-600 font-mono">
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
