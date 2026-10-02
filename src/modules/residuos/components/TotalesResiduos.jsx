import React, { useState, useEffect, useMemo } from "react";
import { FiCalendar, FiSearch, FiDownload } from "react-icons/fi";
import * as XLSX from "xlsx";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import { getTiposResiduos, getRegistroResiduos } from "../../../services/residuosService";

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

    const loadData = async (force = false) => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const [tList, lList] = await Promise.all([
                getTiposResiduos(inquilino, force),
                getRegistroResiduos(inquilino, force)
            ]);
            setTypes(tList);
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

        const handleTypesChanged = (e) => {
            if (e?.detail?.tenantId === inquilino && Array.isArray(e?.detail?.types)) {
                setTypes(e.detail.types);
            }
        };

        const handleLogsChanged = (e) => {
            if (e?.detail?.tenantId === inquilino && Array.isArray(e?.detail?.logs)) {
                setLogs(e.detail.logs);
            }
        };

        window.addEventListener("residuos_types_changed", handleTypesChanged);
        window.addEventListener("residuos_logs_changed", handleLogsChanged);
        return () => {
            window.removeEventListener("residuos_types_changed", handleTypesChanged);
            window.removeEventListener("residuos_logs_changed", handleLogsChanged);
        };
    }, [inquilino]);

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        setAppliedYear(year);
    };

    const handleExportExcel = () => {
        if (!types || types.length === 0) {
            toast.error("No hay tipos de residuos configurados para exportar.");
            return;
        }

        try {
            const exportRows = matrix.rows.map((r) => {
                const rowObj = { "Mes": r.mes };
                let monthTotal = 0;
                types.forEach((t) => {
                    const val = Number(r[t.nombre] || 0);
                    rowObj[`${t.nombre} (${t.color})`] = Number(val.toFixed(2));
                    monthTotal += val;
                });
                rowObj["Total Mensual (kg)"] = Number(monthTotal.toFixed(2));
                return rowObj;
            });

            // Fila de Total Anual
            const totalRow = { "Mes": "TOTAL ANUAL" };
            let grandTotal = 0;
            types.forEach((t) => {
                const val = Number(matrix.colTotals[t.nombre] || 0);
                totalRow[`${t.nombre} (${t.color})`] = Number(val.toFixed(2));
                grandTotal += val;
            });
            totalRow["Total Mensual (kg)"] = Number(grandTotal.toFixed(2));
            exportRows.push(totalRow);

            const ws = XLSX.utils.json_to_sheet(exportRows);
            ws["!cols"] = [
                { wch: 16 }, // Mes
                ...types.map(() => ({ wch: 20 })),
                { wch: 20 }  // Total Mensual
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Totales ${appliedYear}`);
            const fileName = `Planilla_Totales_Residuos_${appliedYear}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success("Planilla de totales exportada a Excel con éxito");
        } catch (err) {
            console.error("Error exporting totals to Excel:", err);
            toast.error("Error al exportar planilla a Excel");
        }
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
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
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
                    </div>

                    <button
                        type="button"
                        onClick={handleExportExcel}
                        className="h-8 px-3.5 flex items-center justify-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer gap-1.5 self-start sm:self-auto"
                        title="Exportar planilla a Excel"
                    >
                        <FiDownload size={13} className="text-emerald-600" />
                        Exportar Excel
                    </button>
                </form>
            </div>

            {/* Matrix table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
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
