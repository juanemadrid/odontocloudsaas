import React, { useState, useEffect } from "react";
import { FiCalendar, FiSearch, FiLayers, FiEye } from "react-icons/fi";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";

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
    const [searchTerm, setSearchTerm] = useState("");
    
    // Result states
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const loadProfessionals = async () => {
        if (!inquilino) return;
        try {
            const pSnap = await getDocs(query(collection(db, "profesionales"), where("inquilino", "==", inquilino)));
            const list = pSnap.docs.map(d => ({
                id: d.id,
                nombre: d.data().nombreCompleto || d.data().nombre || "Doctor",
                cedula: d.data().cedula || d.data().documento || ""
            }));
            list.sort((a, b) => a.nombre.localeCompare(b.nombre));
            setProfesionales(list);
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

    const parseLocalDate = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const handleGenerate = async () => {
        if (!selectedDoctorId) {
            alert("Por favor selecciona un profesional.");
            return;
        }

        setLoading(true);
        try {
            const start = parseLocalDate(desde);
            start.setHours(0, 0, 0, 0);
            const end = parseLocalDate(hasta);
            end.setHours(23, 59, 59, 999);

            const docObj = profesionales.find(p => p.id === selectedDoctorId);

            // Fetch payments (excluding SALDO A FAVOR, as those are credit advances and commission should only be calculated on treatments / evolution)
            const q = query(
                collection(db, "pagos"),
                where("inquilino", "==", inquilino),
                where("profesionalId", "==", selectedDoctorId)
            );
            const snap = await getDocs(q);
            const rawList = snap.docs.map(d => {
                const data = d.data();
                const ts = data.fecha;
                const dateObj = ts?.toDate ? ts.toDate() : new Date(ts);
                return {
                    id: d.id,
                    ...data,
                    fechaObj: dateObj
                };
            });

            // Filter locally by date range, state, concepts and liquidation status
            const filteredPayments = rawList.filter(p => {
                const inRange = p.fechaObj >= start && p.fechaObj <= end;
                const isActive = p.estado !== "Anulado";
                const isNotAdvance = p.concepto !== "SALDO A FAVOR";
                const isNotLiquidated = p.liquidado !== true;
                return inRange && isActive && isNotAdvance && isNotLiquidated;
            });

            const totalRecaudado = filteredPayments.reduce((sum, p) => sum + Number(p.monto || 0), 0);

            setResult({
                doctor: docObj,
                total: totalRecaudado,
                paymentsCount: filteredPayments.length
            });
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
                <p className="text-xs text-slate-400 font-medium">Consulte y genere cierres de comisiones pendientes por profesional médico en un rango de fechas.</p>
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
                            <option value="">Seleccione...</option>
                            {profesionales.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
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
                            className="w-full h-11 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/20 active:scale-95 transition-all disabled:opacity-40"
                        >
                            Generar
                        </button>
                    </div>

                </div>
            </div>

            {/* Results Grid / Table */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Reporte</h3>
                </div>
                {loading ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Generando liquidación...</p>
                    </div>
                ) : !result ? (
                    <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
                        <FiLayers size={36} className="text-slate-300 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">Configure los filtros y haga clic en Generar.</p>
                    </div>
                ) : result.total === 0 ? (
                    <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
                        <p className="text-xs font-bold uppercase tracking-widest">No hay recaudos pendientes para liquidar en el período seleccionado.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Profesional</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Recaudado</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="hover:bg-slate-50/30 transition-colors">
                                    <td className="py-5 px-6 text-xs font-black text-slate-700">
                                        {result.doctor.nombre}
                                    </td>
                                    <td className="py-5 px-6 text-xs font-black text-slate-700 text-right">
                                        {fmt(result.total)}
                                    </td>
                                    <td className="py-5 px-6 text-center">
                                        <button
                                            onClick={() => onSelectDoctor(result.doctor, { desde, hasta })}
                                            className="w-10 h-10 inline-flex items-center justify-center bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl transition-all border border-purple-100 shadow-sm"
                                            title="Ver detalles de liquidación"
                                        >
                                            <FiEye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}
