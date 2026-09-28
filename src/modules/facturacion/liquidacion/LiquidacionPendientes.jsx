import React, { useState, useEffect } from "react";
import { FiCalendar, FiSearch, FiLayers, FiEye, FiCheckCircle, FiUser, FiInfo, FiDollarSign } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { getDoctoresParaLiquidacion, getItemsPendientesPorDoctor } from "../../../services/liquidacionDoctorService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export default function LiquidacionPendientes({ onSelectDoctor }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    // Dates state
    const [desde, setDesde] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0]);
    const [hoyToggle, setHoyToggle] = useState(false);

    // Lookups
    const [profesionales, setProfesionales] = useState([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState("");
    
    // Result states
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const loadProfessionals = async () => {
        if (!inquilino) return;
        try {
            const list = await getDoctoresParaLiquidacion(inquilino);
            setProfesionales(list);
            if (list.length > 0 && !selectedDoctorId) {
                // Pre-select first doctor if available
                setSelectedDoctorId(list[0].id);
            }
        } catch (e) {
            console.error("Error loading professionals:", e);
        }
    };

    useEffect(() => {
        loadProfessionals();
    }, [inquilino]);

    // Handle "Hoy" toggle
    useEffect(() => {
        if (hoyToggle) {
            const todayStr = new Date().toISOString().split('T')[0];
            setDesde(todayStr);
            setHasta(todayStr);
        }
    }, [hoyToggle]);

    const handleGenerate = async () => {
        if (!selectedDoctorId) {
            alert("Por favor selecciona un profesional médico.");
            return;
        }

        setLoading(true);
        try {
            const res = await getItemsPendientesPorDoctor(inquilino, selectedDoctorId, { desde, hasta });
            setResult(res);
        } catch (e) {
            console.error("Error generating liquidation pending:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto space-y-6">
            <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Liquidaciones Pendientes</h2>
                <p className="text-xs text-slate-400 font-medium">
                    Consulte y liquide los ítems realizados por el doctor en el rango de fechas según su configuración.
                </p>
            </div>

            {/* Filters Dashboard Card */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Desde</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <FiCalendar size={14} />
                            </span>
                            <input
                                type="date"
                                value={desde}
                                disabled={hoyToggle}
                                onChange={(e) => setDesde(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold text-slate-600 focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 transition-all outline-none"
                                max="9999-12-31" min="1900-01-01" 
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Hasta</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <FiCalendar size={14} />
                            </span>
                            <input
                                type="date"
                                value={hasta}
                                disabled={hoyToggle}
                                onChange={(e) => setHasta(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold text-slate-600 focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 transition-all outline-none"
                                max="9999-12-31" min="1900-01-01" 
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 md:col-span-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Filtrar por profesional *</label>
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            className="w-full h-11 px-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold text-slate-600 focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 transition-all outline-none cursor-pointer"
                        >
                            <option value="">Seleccione profesional...</option>
                            {profesionales.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre} ({p.comisionPorcentaje}% - {p.formaPago?.toLowerCase().includes("pagad") ? "Realizado y Pagado" : "Realizado"})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center justify-center gap-2 h-11 pb-2 md:col-span-2">
                        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Hoy</span>
                        <button
                            type="button"
                            onClick={() => setHoyToggle(!hoyToggle)}
                            className={`w-12 h-7 flex items-center rounded-full p-1 transition-all duration-300 ${
                                hoyToggle ? "bg-purple-600" : "bg-slate-200"
                            }`}
                        >
                            <div
                                className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-all duration-300 ${
                                    hoyToggle ? "translate-x-5" : "translate-x-0"
                                }`}
                            />
                        </button>
                    </div>

                    <div className="md:col-span-2">
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !selectedDoctorId}
                            className="w-full h-11 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/20 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                        >
                            {loading ? "Calculando..." : "Generar"}
                        </button>
                    </div>

                </div>
            </div>

            {/* Results Grid / Table */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        Ítems Pendientes por Liquidar
                    </h3>
                    {result && result.doctor && (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <span>Forma de liquidación:</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-100">
                                {result.doctor.formaPago?.toLowerCase().includes("pagad") ? "Realizado y Pagado por cliente" : "Realizado (Al evolucionar)"}
                            </span>
                            <span className="text-purple-600 font-black">({result.doctor.comisionPorcentaje}%)</span>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Buscando procedimientos y evoluciones médicas del doctor...
                        </p>
                    </div>
                ) : !result ? (
                    <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
                        <FiLayers size={36} className="text-slate-300 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">
                            Seleccione el profesional, defina las fechas y haga clic en Generar.
                        </p>
                    </div>
                ) : result.items.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center max-w-lg mx-auto">
                        <span className="text-4xl mb-3">📋</span>
                        <p className="text-xs font-black text-slate-600 uppercase tracking-wider">
                            No hay ítems pendientes de liquidar para {result.doctor?.nombre} en este rango.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                            {result.doctor?.formaPago?.toLowerCase().includes("pagad")
                                ? "Nota: Este doctor está configurado para liquidar 'Realizado y Pagado'. Los ítems deben estar realizados con su evolución clínica y pagados por el paciente."
                                : "Nota: Los ítems deben estar marcados como realizados y con evolución clínica en el período seleccionado."}
                        </p>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Summary Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-purple-50/40 rounded-2xl border border-purple-100/60">
                            <div>
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">
                                    Resumen para {result.doctor?.nombre}
                                </span>
                                <h4 className="text-lg font-black text-slate-800 tracking-tight mt-0.5">
                                    {result.totalItems} procedimiento(s) realizado(s) pendiente(s)
                                </h4>
                                <span className="text-xs text-slate-400 font-medium">
                                    Total valor procedimientos: <strong>{fmt(result.totalValor)}</strong>
                                </span>
                            </div>

                            <button
                                onClick={() => onSelectDoctor(result.doctor, { desde, hasta }, result.items)}
                                className="h-11 px-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                            >
                                <FiEye size={16} />
                                Liquidar Profesional
                            </button>
                        </div>

                        {/* Items Table Preview */}
                        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="py-3 px-4">Paciente</th>
                                        <th className="py-3 px-4">Procedimiento / Ítem</th>
                                        <th className="py-3 px-4">Plan Tratamiento</th>
                                        <th className="py-3 px-4 text-center">Fecha Realizado</th>
                                        <th className="py-3 px-4 text-right">Valor Ítem</th>
                                        <th className="py-3 px-4 text-center">Cálculo</th>
                                        <th className="py-3 px-4 text-right">Valor a Liquidar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {result.items.map((it) => (
                                        <tr key={it.key} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-black text-slate-800">{it.pacienteNombre}</div>
                                                {it.pacienteDocumento && (
                                                    <span className="text-[10px] text-slate-400 font-mono">{it.pacienteDocumento}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-slate-700">
                                                {it.prestacion}
                                                {it.codigoCups && it.codigoCups !== "—" && (
                                                    <span className="ml-1.5 text-[10px] text-slate-400 font-mono font-normal">[{it.codigoCups}]</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 font-medium">
                                                {it.planTitulo}
                                            </td>
                                            <td className="py-3 px-4 text-center text-slate-500 font-medium whitespace-nowrap">
                                                {it.fechaFormateada}
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-slate-700 whitespace-nowrap">
                                                {fmt(it.valorPrestacion)}
                                            </td>
                                            <td className="py-3 px-4 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                                    it.tipoLiquidacion === "fijo" 
                                                        ? "bg-amber-50 text-amber-600 border border-amber-100" 
                                                        : "bg-purple-50 text-purple-600 border border-purple-100"
                                                }`}>
                                                    {it.tipoLiquidacion === "fijo" ? `Fijo: ${fmt(it.pagoFijoValor)}` : `${it.porcentaje}%`}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-purple-600 whitespace-nowrap">
                                                {fmt(it.valorAPagar)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
