import React, { useState, useEffect, useMemo } from "react";
import { FiPlus, FiCalendar, FiSearch, FiPrinter, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { ReceiptPrintService } from "../../../services/ReceiptPrintService";
import { buildDashboardPath } from "../../../utils/dashboardBasePath";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const formatDateOnly = (dObj) => {
  if (!dObj) return "—";
  try {
    const d = dObj.toDate ? dObj.toDate() : new Date(dObj);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch { return "—"; }
};

export default function SaldoFavorList({ onNew }) {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(true);
    const [pagos, setPagos] = useState([]);
    const [pacientes, setPacientes] = useState([]);

    // Toggles
    const [detalleMovimientos, setDetalleMovimientos] = useState(false);
    const [conSaldo, setConSaldo] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPaciente, setSelectedPaciente] = useState(null);
    const [searchTermTercero, setSearchTermTercero] = useState("");
    const [showTerceroDropdown, setShowTerceroDropdown] = useState(false);

    useEffect(() => {
        const handleClickOutside = () => {
            setShowTerceroDropdown(false);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    const filteredTerceros = useMemo(() => {
        if (!searchTermTercero.trim()) return pacientes.slice(0, 50);
        const q = searchTermTercero.toLowerCase();
        return pacientes.filter(p => {
            const name = (p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`).toLowerCase();
            const doc = (p.nroDocumento || p.cedula || "").toLowerCase();
            return name.includes(q) || doc.includes(q);
        });
    }, [pacientes, searchTermTercero]);

    const loadData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            // Load all payments for this tenant
            const pSnap = await getDocs(query(collection(db, "pagos"), where("inquilino", "==", inquilino)));
            const pList = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPagos(pList);

            // Load all patients
            const pacSnap = await getDocs(query(collection(db, "pacientes"), where("inquilino", "==", inquilino)));
            const pacList = pacSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPacientes(pacList);
        } catch (e) {
            console.error("Error loading credit balances:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [inquilino]);

    // Aggregate credit balance per patient
    const creditBalances = useMemo(() => {
        return pacientes.map(pac => {
            const pacPayments = pagos.filter(p => (p.pacienteId === pac.id || p.patientId === pac.id) && p.estado !== "Anulado");
            
            // Total credit added
            const totalCredits = pacPayments
                .filter(p => p.concepto === "SALDO A FAVOR")
                .reduce((sum, p) => sum + Number(p.monto || 0), 0);
            
            // Total credit used
            const usedCredits = pacPayments
                .filter(p => p.medio === "Saldo a favor")
                .reduce((sum, p) => sum + Number(p.monto || 0), 0);
            
            // Available credit
            const availableCredit = Math.max(0, totalCredits - usedCredits);

            // Get date of the latest credit top-up
            const creditDates = pacPayments
                .filter(p => p.concepto === "SALDO A FAVOR")
                .map(p => p.fecha || p.createdAt)
                .filter(Boolean);
            
            let latestDate = null;
            if (creditDates.length > 0) {
                // Find latest timestamp
                latestDate = creditDates.reduce((latest, current) => {
                    const timeL = latest.seconds || new Date(latest).getTime() / 1000;
                    const timeC = current.seconds || new Date(current).getTime() / 1000;
                    return timeC > timeL ? current : latest;
                });
            }

            return {
                id: pac.id,
                nombre: pac.nombreCompleto || `${pac.nombres || ""} ${pac.apellidos || ""}`.trim(),
                documento: pac.nroDocumento || pac.cedula || "—",
                fecha: latestDate,
                valorDisponible: availableCredit,
                valorUsado: usedCredits,
                valorTotal: totalCredits
            };
        });
    }, [pagos, pacientes]);

    // Filter list
    const filteredBalances = useMemo(() => {
        return creditBalances.filter(item => {
            // Con saldo filter
            if (conSaldo && item.valorDisponible <= 0) return false;

            // Search filter
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchesName = item.nombre.toLowerCase().includes(q);
                const matchesDoc = item.documento.toLowerCase().includes(q);
                if (!matchesName && !matchesDoc) return false;
            }

            // Exclude patients with absolutely no credit history (valorTotal === 0)
            if (item.valorTotal === 0) return false;

            return true;
        });
    }, [creditBalances, conSaldo, searchTerm]);

    // Sum column totals
    const columnTotals = useMemo(() => {
        return filteredBalances.reduce((acc, curr) => {
            acc.disponible += curr.valorDisponible;
            acc.usado += curr.valorUsado;
            acc.total += curr.valorTotal;
            return acc;
        }, { disponible: 0, usado: 0, total: 0 });
    }, [filteredBalances]);

    // Reactive calculations for selected patient in detailed view
    const selectedTotals = useMemo(() => {
        if (!selectedPaciente) return { disponible: 0, usado: 0, total: 0 };
        const pacPayments = pagos.filter(p => (p.pacienteId === selectedPaciente.id || p.patientId === selectedPaciente.id) && p.estado !== "Anulado");
        
        const total = pacPayments
            .filter(p => p.concepto === "SALDO A FAVOR")
            .reduce((sum, p) => sum + Number(p.monto || 0), 0);
            
        const usado = pacPayments
            .filter(p => p.medio === "Saldo a favor")
            .reduce((sum, p) => sum + Number(p.monto || 0), 0);
            
        const disponible = Math.max(0, total - usado);
        return { disponible, usado, total };
    }, [selectedPaciente, pagos]);

    const selectedMovements = useMemo(() => {
        if (!selectedPaciente) return [];
        const pacPayments = pagos.filter(p => (p.pacienteId === selectedPaciente.id || p.patientId === selectedPaciente.id));
        
        const list = pacPayments.map(p => {
            const isTopUp = p.concepto === "SALDO A FAVOR";
            return {
                id: p.id,
                fecha: p.fecha || p.createdAt,
                tipoMovimiento: isTopUp ? "Abono a saldo a favor" : "Consumo s. a favor",
                valor: p.monto || 0,
                tipoDocumento: isTopUp ? "Recibo de saldo" : "Recibo de caja",
                documento: p.nroConsecutivo || "S/N",
                planTratamiento: p.planTitle || "—",
                estado: p.estado || "Activo",
                pagoOriginal: p
            };
        });

        list.sort((a, b) => {
            const timeA = a.fecha?.seconds || new Date(a.fecha).getTime() / 1000;
            const timeB = b.fecha?.seconds || new Date(b.fecha).getTime() / 1000;
            return timeB - timeA;
        });

        return list;
    }, [selectedPaciente, pagos]);

    const handlePrint = async (pago) => {
        try {
            const pId = pago.pacienteId || pago.patientId;
            if (!pId) return;
            const { doc, getDoc } = await import("firebase/firestore");
            const patientSnap = await getDoc(doc(db, "pacientes", pId));
            if (!patientSnap.exists()) {
                alert("No se pudo cargar la información del paciente");
                return;
            }
            const patientData = { id: patientSnap.id, ...patientSnap.data() };
            
            const clinic = userProfile?.tenant || {
                nombre: userProfile?.tenantNombre || userProfile?.clinica || "Clínica",
                inquilino: userProfile?.inquilino || userProfile?.tenantId
            };
            
            await ReceiptPrintService.generatePDF(pago, patientData, clinic, userProfile);
        } catch (e) {
            console.error("Error printing receipt:", e);
            alert("Error al preparar la impresión");
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Filter Toggle Cards */}
            <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm flex flex-col gap-6 max-w-xl">
                
                {/* Toggle 1: Detalle movimientos */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest text-right w-44">
                        Detalle de movimientos por tercero
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setDetalleMovimientos(!detalleMovimientos);
                            setSelectedPaciente(null);
                        }}
                        className={`w-14 h-8 flex items-center rounded-full p-1 transition-all duration-300 ${
                            detalleMovimientos ? "bg-[#8cc33f]" : "bg-slate-200"
                        }`}
                    >
                        <div
                            className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-all duration-300 ${
                                detalleMovimientos ? "translate-x-6" : "translate-x-0"
                            }`}
                        />
                    </button>
                </div>

                {/* Toggle 2: ¿Con saldo? */}
                {!detalleMovimientos && (
                    <div className="flex items-center justify-between animate-fadeIn">
                        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest text-right w-44">
                            ¿Con saldo?
                        </span>
                        <button
                            type="button"
                            onClick={() => setConSaldo(!conSaldo)}
                            className={`w-14 h-8 flex items-center rounded-full p-1 transition-all duration-300 ${
                                conSaldo ? "bg-[#8cc33f]" : "bg-slate-200"
                            }`}
                        >
                            <div
                                className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-all duration-300 ${
                                    conSaldo ? "translate-x-6" : "translate-x-0"
                                }`}
                            />
                        </button>
                    </div>
                )}

            </div>

            {/* Selector and Financial stats for detailed view */}
            {detalleMovimientos ? (
                <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm flex flex-col gap-6 max-w-xl animate-fadeIn">
                    <div className="flex flex-col gap-2 relative" onClick={e => e.stopPropagation()}>
                        <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Tercero *</label>
                        {selectedPaciente ? (
                            <div className="flex items-center gap-3 w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50 text-sm font-bold text-slate-700">
                                <FiUser className="text-slate-400 shrink-0" />
                                <span className="flex-1 truncate uppercase">
                                    {(selectedPaciente.nombreCompleto || `${selectedPaciente.nombres || ""} ${selectedPaciente.apellidos || ""}`).trim()} (CC: {selectedPaciente.nroDocumento || selectedPaciente.cedula || ""})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPaciente(null)}
                                    className="text-xs font-black text-rose-500 hover:text-rose-700 uppercase tracking-wider bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm"
                                >
                                    Cambiar
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Escriba nombre o cédula para buscar..."
                                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                    value={searchTermTercero}
                                    onChange={(e) => {
                                        setSearchTermTercero(e.target.value);
                                        setShowTerceroDropdown(true);
                                    }}
                                    onFocus={() => setShowTerceroDropdown(true)}
                                />
                                {showTerceroDropdown && (
                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-50">
                                        {filteredTerceros.length === 0 ? (
                                            <div className="px-4 py-3 text-xs text-slate-400 italic">No se encontraron resultados</div>
                                        ) : (
                                            filteredTerceros.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedPaciente(p);
                                                        setSearchTermTercero("");
                                                        setShowTerceroDropdown(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                >
                                                    <span className="text-xs font-black text-slate-800 uppercase">
                                                        {(p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`).trim()}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold">CC: {p.nroDocumento || p.cedula || "—"}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {selectedPaciente && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 animate-fadeIn">
                            <div className="flex flex-col bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Saldo total</span>
                                <span className="text-lg font-black text-slate-800 font-mono">{fmt(selectedTotals.total)}</span>
                            </div>
                            <div className="flex flex-col bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Saldo usado</span>
                                <span className="text-lg font-black text-rose-500 font-mono">{fmt(selectedTotals.usado)}</span>
                            </div>
                            <div className="flex flex-col bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Saldo a favor</span>
                                <span className="text-lg font-black text-emerald-600 font-mono">{fmt(selectedTotals.disponible)}</span>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Search Input */
                <div className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-sm max-w-md animate-fadeIn">
                    <div className="relative">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar por tercero o documento..."
                            className="w-full h-10 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Balances Table */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {detalleMovimientos ? (
                                    <>
                                        <th className="px-6 py-4 pl-8">Fecha</th>
                                        <th className="px-6 py-4">Tipo de movimiento</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                        <th className="px-6 py-4">Tipo documento</th>
                                        <th className="px-6 py-4">Documento</th>
                                        <th className="px-6 py-4">F. de trat</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4 text-center pr-8 w-24">Acciones</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-4 pl-8">Fecha</th>
                                        <th className="px-6 py-4">Tercero</th>
                                        <th className="px-6 py-4">Documento</th>
                                        <th className="px-6 py-4 text-right">Valor disponible</th>
                                        <th className="px-6 py-4 text-right">Valor usado</th>
                                        <th className="px-6 py-4 text-right">Valor total</th>
                                        <th className="px-6 py-4 text-center pr-8 w-24">Acciones</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={detalleMovimientos ? 8 : 7} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-[#8cc33f] border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando saldos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : detalleMovimientos ? (
                                // Detailed Patient View
                                !selectedPaciente ? (
                                    <tr>
                                        <td colSpan="8" className="px-8 py-20 text-center text-slate-400 italic">
                                            Seleccione un tercero para ver el detalle de movimientos.
                                        </td>
                                    </tr>
                                ) : selectedMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-8 py-20 text-center text-slate-400 italic">
                                            No se registran movimientos para el tercero seleccionado.
                                        </td>
                                    </tr>
                                ) : (
                                    selectedMovements.map(mov => (
                                        <tr key={mov.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-4 pl-8 font-semibold text-slate-500">
                                                {formatDateOnly(mov.fecha)}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 uppercase tracking-tight">
                                                {mov.tipoMovimiento}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black font-mono ${mov.tipoMovimiento.includes("Abono") ? "text-emerald-600" : "text-rose-500"}`}>
                                                {fmt(mov.valor)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-semibold uppercase">
                                                {mov.tipoDocumento}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-500">
                                                # {mov.documento}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-semibold uppercase">
                                                {mov.planTratamiento}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${mov.estado === "Anulado" ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"}`}>
                                                    {mov.estado}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center pr-8">
                                                <button 
                                                    className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm mx-auto"
                                                    title="Imprimir Recibo"
                                                    onClick={() => handlePrint(mov.pagoOriginal)}
                                                >
                                                    <FiPrinter size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                // General Balances View
                                filteredBalances.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-8 py-20 text-center text-slate-400 italic">
                                            No se encontraron terceros con saldo a favor registrado.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {filteredBalances.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-6 py-4 pl-8 font-semibold text-slate-500">
                                                    {formatDateOnly(item.fecha)}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-800 uppercase tracking-tight">
                                                    {item.nombre}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-500">
                                                    {item.documento}
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-emerald-600 font-mono">
                                                    {fmt(item.valorDisponible)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-rose-500 font-mono">
                                                    {fmt(item.valorUsado)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 font-mono">
                                                    {fmt(item.valorTotal)}
                                                </td>
                                                <td className="px-6 py-4 text-center pr-8">
                                                    <button 
                                                        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm mx-auto"
                                                        title="Ver historial en Ficha"
                                                        onClick={() => navigate(buildDashboardPath(`pacientes?id=${item.id}&tab=saldo`))}
                                                    >
                                                        <FiUser size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Totals Row */}
                                        <tr className="bg-slate-50 font-black text-slate-800 text-[13px] border-t border-slate-200">
                                            <td colSpan="3" className="px-6 py-4 pl-8 text-right uppercase">Totales</td>
                                            <td className="px-6 py-4 text-right text-emerald-600 font-mono">{fmt(columnTotals.disponible)}</td>
                                            <td className="px-6 py-4 text-right text-rose-500 font-mono">{fmt(columnTotals.usado)}</td>
                                            <td className="px-6 py-4 text-right text-slate-900 font-mono">{fmt(columnTotals.total)}</td>
                                            <td></td>
                                        </tr>
                                    </>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
