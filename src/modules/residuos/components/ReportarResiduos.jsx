import React, { useState, useEffect, useMemo, useRef } from "react";
import { FiSearch, FiCalendar, FiPlusCircle, FiTrash2, FiX, FiDownload, FiChevronDown } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import {
    getTiposResiduos,
    getRegistroResiduos,
    saveReporteResiduo,
    deleteReporteResiduo
} from "../../../services/residuosService";

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
    const [searchQuery, setSearchQuery] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Search state in reports table
    const [searchTerm, setSearchTerm] = useState("");

    const loadData = async (force = false) => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const [tList, lList] = await Promise.all([
                getTiposResiduos(inquilino, force),
                getRegistroResiduos(inquilino, force)
            ]);

            setTypes(tList);
            if (tList.length > 0 && !selectedTypeId) {
                setSelectedTypeId(tList[0].id);
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

    // Handle click outside combobox dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        setAppliedRange({ ...dateRange });
    };

    const handleOpenAdd = async () => {
        setFechaHora(new Date().toISOString().slice(0, 16).replace("T", " "));
        setPeso(0);
        setSearchQuery("");
        setIsDropdownOpen(false);

        let currentTypes = types;
        if (currentTypes.length === 0 && inquilino) {
            try {
                currentTypes = await getTiposResiduos(inquilino, true);
                setTypes(currentTypes);
            } catch (_) {}
        }

        if (currentTypes.length > 0) {
            setSelectedTypeId(currentTypes[0].id);
        } else {
            setSelectedTypeId("");
        }
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
        if (!selectedType) {
            toast.error("Tipo de residuo no encontrado.");
            return;
        }

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

            await saveReporteResiduo(inquilino, reportItem);

            toast.success("Reporte de residuo guardado con éxito");
            setLogs(prev => [reportItem, ...prev.filter(l => l.id !== reportId)]);
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
            await deleteReporteResiduo(inquilino, id);
            toast.success("Reporte de residuo eliminado");
            setLogs(prev => prev.filter(l => l.id !== id));
        } catch (e) {
            console.error("Error deleting residue report:", e);
            toast.error("Error al eliminar el reporte");
        }
    };

    const handleExportExcel = async () => {
        if (!filteredLogs || filteredLogs.length === 0) {
            toast.error("No hay registros de residuos para exportar en este periodo.");
            return;
        }

        try {
            const XLSX = await import("xlsx-js-style");

            const headers = ["Fecha", "Hora", "Tipo de Residuo", "Color / Caneca", "Peso (kg)"];

            const rows = filteredLogs.map((log) => {
                let fecha = log.fecha || "";
                let hora = "";
                if (log.fechaHora) {
                    const normalized = log.fechaHora.replace("T", " ");
                    const parts = normalized.split(" ");
                    if (!fecha && parts[0]) fecha = parts[0];
                    hora = parts[1]?.slice(0, 5) || "";
                }
                const pesoNum = Number(Number(log.cantidad || 0).toFixed(2));
                return [fecha, hora, log.residuoNombre || "", log.color || "", pesoNum];
            });

            // Summary Total
            const totalKg = rows.reduce((acc, r) => acc + (Number(r[4]) || 0), 0);
            const totalRow = ["TOTAL PERIODO", "", "", "", Number(totalKg.toFixed(2))];

            const aoa = [headers, ...rows, totalRow];
            const ws = XLSX.utils.aoa_to_sheet(aoa);

            // Styling definitions
            const borderThin = {
                top: { style: "thin", color: { rgb: "D1D5DB" } },
                bottom: { style: "thin", color: { rgb: "D1D5DB" } },
                left: { style: "thin", color: { rgb: "D1D5DB" } },
                right: { style: "thin", color: { rgb: "D1D5DB" } }
            };

            const borderTotal = {
                top: { style: "thin", color: { rgb: "64748B" } },
                bottom: { style: "double", color: { rgb: "0F172A" } },
                left: { style: "thin", color: { rgb: "D1D5DB" } },
                right: { style: "thin", color: { rgb: "D1D5DB" } }
            };

            // 1. Style Header Row
            headers.forEach((_, cIdx) => {
                const ref = XLSX.utils.encode_cell({ r: 0, c: cIdx });
                if (ws[ref]) {
                    ws[ref].s = {
                        font: { bold: true, name: "Calibri", sz: 11, color: { rgb: "0F172A" } },
                        fill: { fgColor: { rgb: "E2E8F0" } },
                        alignment: {
                            vertical: "center",
                            horizontal: cIdx === 4 ? "right" : (cIdx === 0 || cIdx === 1 ? "center" : "left")
                        },
                        border: borderThin
                    };
                }
            });

            // 2. Style Data Rows
            rows.forEach((_, rIdx) => {
                const r = rIdx + 1;
                headers.forEach((_, cIdx) => {
                    const ref = XLSX.utils.encode_cell({ r, c: cIdx });
                    if (ws[ref]) {
                        ws[ref].s = {
                            font: { name: "Calibri", sz: 11, color: { rgb: "334155" } },
                            alignment: {
                                vertical: "center",
                                horizontal: cIdx === 4 ? "right" : (cIdx === 0 || cIdx === 1 ? "center" : "left")
                            },
                            border: borderThin
                        };
                    }
                });
            });

            // 3. Style Total Row
            const totalR = rows.length + 1;
            headers.forEach((_, cIdx) => {
                const ref = XLSX.utils.encode_cell({ r: totalR, c: cIdx });
                if (ws[ref]) {
                    ws[ref].s = {
                        font: { bold: true, name: "Calibri", sz: 11, color: { rgb: "0F172A" } },
                        fill: { fgColor: { rgb: "F1F5F9" } },
                        alignment: {
                            vertical: "center",
                            horizontal: cIdx === 4 ? "right" : (cIdx === 0 ? "left" : "center")
                        },
                        border: borderTotal
                    };
                }
            });

            ws["!cols"] = [
                { wch: 15 }, // Fecha
                { wch: 12 }, // Hora
                { wch: 28 }, // Tipo de Residuo
                { wch: 18 }, // Color / Caneca
                { wch: 16 }  // Peso (kg)
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Residuos");
            const fileName = `Reporte_Residuos_${appliedRange.start}_al_${appliedRange.end}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success("Reporte de residuos exportado a Excel con éxito");
        } catch (err) {
            console.error("Error exporting residuos to Excel:", err);
            toast.error("Error al exportar a Excel");
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

    // Filter residue types in modal dropdown
    const filteredModalTypes = useMemo(() => {
        if (!searchQuery.trim()) return types;
        const term = searchQuery.toLowerCase().trim();
        return types.filter(t => 
            (t.nombre || "").toLowerCase().includes(term) || 
            (t.color || "").toLowerCase().includes(term)
        );
    }, [types, searchQuery]);

    const selectedType = useMemo(() => {
        return types.find(t => t.id === selectedTypeId) || null;
    }, [types, selectedTypeId]);

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
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="h-8 px-3 flex items-center justify-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer gap-1.5"
                            title="Exportar a Excel"
                        >
                            <FiDownload size={13} className="text-emerald-600" />
                            Exportar Excel
                        </button>
                        <button
                            onClick={handleOpenAdd}
                            className="h-8 px-3.5 flex items-center justify-center bg-[#7cb342] text-white rounded-lg text-xs font-semibold hover:bg-[#689f38] shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer gap-1.5"
                        >
                            <FiPlusCircle size={13} />
                            Reportar
                        </button>
                    </div>
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
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm overflow-visible animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
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

                            {/* Tipo de residuo (Buscador desplegable unificado en un solo campo) */}
                            <div className="flex flex-col gap-1 relative" ref={dropdownRef}>
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-semibold text-slate-600">Tipo de residuo *</label>
                                    {isDropdownOpen && searchQuery && (
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            {filteredModalTypes.length} encontrados
                                        </span>
                                    )}
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Escriba o seleccione un tipo de residuo..."
                                        value={isDropdownOpen ? searchQuery : (selectedType ? `${selectedType.nombre} (${selectedType.color})` : searchQuery)}
                                        onFocus={() => {
                                            setIsDropdownOpen(true);
                                            setSearchQuery("");
                                        }}
                                        onClick={() => {
                                            setIsDropdownOpen(true);
                                        }}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            if (!isDropdownOpen) setIsDropdownOpen(true);
                                        }}
                                        className="w-full h-8 px-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                                        autoComplete="off"
                                        required={!selectedTypeId}
                                    />
                                    <div 
                                        onClick={() => setIsDropdownOpen(prev => !prev)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer p-0.5 hover:text-slate-600"
                                    >
                                        <FiChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                                    </div>
                                </div>

                                {/* Menú desplegable flotante con las opciones filtradas al instante */}
                                {isDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-[1100] py-1 divide-y divide-slate-50 animate-in fade-in zoom-in-95 duration-150">
                                        {filteredModalTypes.length === 0 ? (
                                            <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                                                No hay residuos que coincidan con "{searchQuery}"
                                            </div>
                                        ) : (
                                            filteredModalTypes.map(t => {
                                                const isSelected = t.id === selectedTypeId;
                                                return (
                                                    <div
                                                        key={t.id}
                                                        onClick={() => {
                                                            setSelectedTypeId(t.id);
                                                            setSearchQuery("");
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                                            isSelected 
                                                                ? "bg-emerald-50 text-emerald-800 font-semibold" 
                                                                : "text-slate-700 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <span 
                                                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                                                style={{
                                                                    backgroundColor: t.color === "Rojo" ? "#ef4444" :
                                                                                     t.color === "Verde" ? "#22c55e" :
                                                                                     t.color === "Blanco" ? "#e2e8f0" :
                                                                                     t.color === "Negro" ? "#0f172a" :
                                                                                     t.color === "Amarillo" ? "#eab308" :
                                                                                     t.color === "Azul" ? "#3b82f6" :
                                                                                     t.color === "Gris" ? "#94a3b8" :
                                                                                     t.color === "Púrpura" ? "#a855f7" : "#cbd5e1"
                                                                }} 
                                                            />
                                                            <span>{t.nombre}</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-100">
                                                            {t.color}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
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
                                    disabled={saving || !selectedTypeId}
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
