import React, { useState, useEffect, useMemo } from "react";
import { 
    FiArrowLeft, FiPlus, FiTrash2, FiSave, FiAlertCircle, 
    FiCheckCircle, FiUser, FiInfo, FiLayers, FiDollarSign 
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase/firebaseConfig";
import { 
    collection, addDoc, getDocs, query, where, 
    doc, getDoc, updateDoc, writeBatch, serverTimestamp, Timestamp 
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export default function LiquidacionDetalle({ doctor, dateRange, onBack }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    // Professional data
    const [comisionPct, setComisionPct] = useState(50); // Default to 50%

    // Payments to liquidate
    const [payments, setPayments] = useState([]);
    const [selectedPaymentIds, setSelectedPaymentIds] = useState({});

    // Adjustments arrays
    const [gastos, setGastos] = useState([]);
    const [bonificaciones, setBonificaciones] = useState([]);
    const [deducciones, setDeducciones] = useState([]);

    // Inputs for adding adjustments
    const [newGasto, setNewGasto] = useState({ valor: "", desc: "" });
    const [newBono, setNewBono] = useState({ valor: "", desc: "" });
    const [newDeduccion, setNewDeduccion] = useState({ valor: "", desc: "" });

    // Toggles for active adjustment forms
    const [showGastoForm, setShowGastoForm] = useState(false);
    const [showBonoForm, setShowBonoForm] = useState(false);
    const [showDeduccionForm, setShowDeduccionForm] = useState(false);

    const parseLocalDate = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const loadData = async () => {
        if (!inquilino || !doctor) return;
        setLoading(true);
        try {
            // 1. Load Doctor commission pct from DB
            const docRef = doc(db, "profesionales", doctor.id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const pct = Number(docSnap.data().comisionGeneral || docSnap.data().comisionEspecialista || 50);
                setComisionPct(pct);
            }

            // 2. Load all treatment plans for this tenant to cross-reference total costs
            const plansSnap = await getDocs(query(
                collection(db, "treatment_plans"),
                where("inquilino", "==", inquilino)
            ));
            const plansMap = {};
            plansSnap.docs.forEach(d => {
                const pData = d.data();
                plansMap[d.id] = {
                    id: d.id,
                    title: pData.title || pData.nombre || "Tratamiento",
                    total: Number(pData.total || pData.costoTotal || 0)
                };
            });

            // 3. Fetch payments
            const start = parseLocalDate(dateRange.desde);
            start.setHours(0, 0, 0, 0);
            const end = parseLocalDate(dateRange.hasta);
            end.setHours(23, 59, 59, 999);

            const q = query(
                collection(db, "pagos"),
                where("inquilino", "==", inquilino),
                where("profesionalId", "==", doctor.id)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => {
                const data = d.data();
                const ts = data.fecha;
                const dObj = ts?.toDate ? ts.toDate() : new Date(ts);
                return {
                    id: d.id,
                    ...data,
                    fechaObj: dObj
                };
            });

            // Filter locally
            const filtered = list.filter(p => {
                const inRange = p.fechaObj >= start && p.fechaObj <= end;
                const isActive = p.estado !== "Anulado";
                const isNotAdvance = p.concepto !== "SALDO A FAVOR";
                const isNotLiquidated = p.liquidado !== true;
                return inRange && isActive && isNotAdvance && isNotLiquidated;
            });

            // Group payments by patient and treatment plan
            const groups = {};
            filtered.forEach(p => {
                const planId = p.planId || "";
                const key = planId ? `${p.pacienteId}_${planId}` : `${p.pacienteId}_noplan_${p.id}`;

                if (!groups[key]) {
                    groups[key] = {
                        key,
                        pacienteId: p.pacienteId,
                        pacienteNombre: p.patientNombre || "Paciente",
                        planId: planId,
                        prestacion: planId && plansMap[planId] ? plansMap[planId].title : (p.concepto || "Abono"),
                        valorPrestado: planId && plansMap[planId] ? plansMap[planId].total : p.monto,
                        valorRecaudado: 0,
                        fechaObj: p.fechaObj,
                        paymentIds: []
                    };
                }

                groups[key].valorRecaudado += Number(p.monto || 0);
                groups[key].paymentIds.push(p.id);
                if (p.fechaObj > groups[key].fechaObj) {
                    groups[key].fechaObj = p.fechaObj;
                }
            });

            const groupedList = Object.values(groups);
            // Sort by date desc
            groupedList.sort((a, b) => b.fechaObj - a.fechaObj);

            setPayments(groupedList);

            // Select all by default
            const initialSelection = {};
            groupedList.forEach(g => {
                initialSelection[g.key] = true;
            });
            setSelectedPaymentIds(initialSelection);

        } catch (e) {
            console.error("Error loading liquidation details:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [doctor, dateRange, inquilino]);

    const toggleSelectAll = (checked) => {
        const next = {};
        if (checked) {
            payments.forEach(g => {
                next[g.key] = true;
            });
        }
        setSelectedPaymentIds(next);
    };

    const toggleSelectPayment = (key) => {
        setSelectedPaymentIds(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const isAllSelected = useMemo(() => {
        if (payments.length === 0) return false;
        return payments.every(g => selectedPaymentIds[g.key]);
    }, [payments, selectedPaymentIds]);

    // Totals calculations
    const selectedPayments = useMemo(() => {
        return payments.filter(g => selectedPaymentIds[g.key]);
    }, [payments, selectedPaymentIds]);

    const totalRecaudado = useMemo(() => {
        return selectedPayments.reduce((sum, g) => sum + Number(g.valorRecaudado || 0), 0);
    }, [selectedPayments]);

    const totalComision = useMemo(() => {
        return selectedPayments.reduce((sum, g) => sum + Math.round(Number(g.valorRecaudado || 0) * comisionPct / 100), 0);
    }, [selectedPayments, comisionPct]);

    const totalGastos = useMemo(() => {
        return gastos.reduce((sum, g) => sum + Number(g.valor || 0), 0);
    }, [gastos]);

    const totalBonificaciones = useMemo(() => {
        return bonificaciones.reduce((sum, b) => sum + Number(b.valor || 0), 0);
    }, [bonificaciones]);

    const totalDeducciones = useMemo(() => {
        return deducciones.reduce((sum, d) => sum + Number(d.valor || 0), 0);
    }, [deducciones]);

    const totalNetoPagar = useMemo(() => {
        return totalComision + totalBonificaciones - totalGastos - totalDeducciones;
    }, [totalComision, totalBonificaciones, totalGastos, totalDeducciones]);

    // Adjustments helpers
    const addGasto = () => {
        const val = Number(newGasto.valor);
        if (!newGasto.desc.trim() || isNaN(val) || val <= 0) return;
        setGastos([...gastos, { valor: val, desc: newGasto.desc.trim() }]);
        setNewGasto({ valor: "", desc: "" });
        setShowGastoForm(false);
    };

    const removeGasto = (idx) => {
        setGastos(gastos.filter((_, i) => i !== idx));
    };

    const addBono = () => {
        const val = Number(newBono.valor);
        if (!newBono.desc.trim() || isNaN(val) || val <= 0) return;
        setBonificaciones([...bonificaciones, { valor: val, desc: newBono.desc.trim() }]);
        setNewBono({ valor: "", desc: "" });
        setShowBonoForm(false);
    };

    const removeBono = (idx) => {
        setBonificaciones(bonificaciones.filter((_, i) => i !== idx));
    };

    const addDeduccion = () => {
        const val = Number(newDeduccion.valor);
        if (!newDeduccion.desc.trim() || isNaN(val) || val <= 0) return;
        setDeducciones([...deducciones, { valor: val, desc: newDeduccion.desc.trim() }]);
        setNewDeduccion({ valor: "", desc: "" });
        setShowDeduccionForm(false);
    };

    const removeDeduccion = (idx) => {
        setDeducciones(deducciones.filter((_, i) => i !== idx));
    };

    // Save Liquidation
    const handleLiquidar = async () => {
        if (selectedPayments.length === 0) {
            setError("Debes seleccionar al menos un recaudo / transacción.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const batch = writeBatch(db);

            // Collect all transaction payment IDs from selected groups
            const allPaymentIds = [];
            selectedPayments.forEach(g => {
                allPaymentIds.push(...g.paymentIds);
            });

            // 1. Create liquidation document
            const liqData = {
                inquilino,
                profesionalId: doctor.id,
                profesionalNombre: doctor.nombre,
                fechaInicio: dateRange.desde,
                fechaFin: dateRange.hasta,
                totalRecaudado,
                totalPagar: totalNetoPagar,
                comisionesTotal: totalComision,
                comisionPorcentaje: comisionPct,
                gastos,
                bonificaciones,
                deducciones,
                conceptosLiquidados: allPaymentIds,
                estado: "Pagado",
                registradoPor: userProfile?.nombre || userProfile?.email || "Administración",
                createdAt: serverTimestamp()
            };

            const liqRef = doc(collection(db, "liquidaciones"));
            batch.set(liqRef, liqData);

            // 2. Mark payments as liquidated
            allPaymentIds.forEach(id => {
                const pRef = doc(db, "pagos", id);
                batch.update(pRef, {
                    liquidado: true,
                    liquidacionId: liqRef.id
                });
            });

            await batch.commit();

            setSuccess(true);
            setTimeout(() => {
                onBack();
            }, 1500);

        } catch (e) {
            console.error("Error saving liquidation:", e);
            setError("Error al guardar la liquidación. Revisa la consola.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
            
            {/* Header / Nav */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-purple-600 border border-transparent hover:border-purple-100 active:scale-95 group"
                        title="Volver"
                    >
                        <FiArrowLeft className="group-hover:-translate-x-0.5 transition-transform" size={18} />
                    </button>
                    <div className="h-6 w-[1px] bg-slate-200" />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                            <span>🏠</span>
                            <span>-</span>
                            <span>Liquidaciones</span>
                            <span>-</span>
                            <span>Detalle liquidación</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mt-1">
                            Detalle liquidación
                        </h2>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="h-10 px-6 rounded-full bg-slate-50 border border-slate-100 text-xs font-black uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
                        Otros: <span className="text-purple-600 ml-1">{fmt(totalComision)}</span>
                    </div>
                    <button
                        onClick={() => setShowGastoForm(!showGastoForm)}
                        className="h-10 px-5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500 transition-all flex items-center justify-center gap-1"
                    >
                        Gastos
                    </button>
                    <button
                        onClick={() => setShowBonoForm(!showBonoForm)}
                        className="h-10 px-5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500 transition-all flex items-center justify-center gap-1"
                    >
                        Bonificaciones
                    </button>
                    <button
                        onClick={() => setShowDeduccionForm(!showDeduccionForm)}
                        className="h-10 px-5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500 transition-all flex items-center justify-center gap-1"
                    >
                        Deducciones
                    </button>
                    <button 
                        onClick={handleLiquidar}
                        disabled={saving || payments.length === 0}
                        className="h-10 px-8 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 disabled:opacity-45"
                    >
                        Liquidar
                    </button>
                </div>
            </div>

            {success && (
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[24px] flex items-center gap-4 animate-in zoom-in">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20">
                        <FiCheckCircle />
                    </div>
                    <div>
                        <h4 className="text-emerald-800 font-black uppercase text-sm">¡Liquidación Realizada!</h4>
                        <p className="text-emerald-600 text-xs font-medium uppercase tracking-wide">La liquidación de comisiones se guardó con éxito en el historial.</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-[24px] flex items-center gap-4 animate-in shake">
                    <div className="w-12 h-12 bg-rose-500 text-white rounded-full flex items-center justify-center text-xl shadow-lg shadow-rose-500/20">
                        <FiAlertCircle />
                    </div>
                    <div>
                        <h4 className="text-rose-800 font-black uppercase text-sm">Error de Liquidación</h4>
                        <p className="text-rose-600 text-xs font-medium uppercase tracking-wide">{error}</p>
                    </div>
                </div>
            )}

            {/* Main Table card */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest block">Recaudos de {doctor.nombre}</h3>
                        <span className="text-[10px] text-slate-400 font-medium">Período: {dateRange.desde} al {dateRange.hasta} (Comisión: {comisionPct}%)</span>
                    </div>
                </div>
                {loading ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando recaudos...</p>
                    </div>
                ) : payments.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-2">
                        <span className="text-4xl">🧾</span>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">No se encontraron recaudos pendientes en este período.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="py-4 px-6 text-center w-12">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                            className="w-4 h-4 text-purple-600 border-slate-200 rounded cursor-pointer focus:ring-purple-500"
                                        />
                                    </th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prestación</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan de Tratamiento</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor prestado</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Recaudado</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">%</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor a pagar</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payments.map((p) => (
                                    <tr key={p.key} className={`hover:bg-slate-50/20 transition-colors ${selectedPaymentIds[p.key] ? "bg-slate-50/10" : "opacity-60"}`}>
                                        <td className="py-3 px-6 text-center align-middle">
                                            <input
                                                type="checkbox"
                                                checked={!!selectedPaymentIds[p.key]}
                                                onChange={() => toggleSelectPayment(p.key)}
                                                className="w-4 h-4 text-purple-600 border-slate-200 rounded cursor-pointer focus:ring-purple-500"
                                            />
                                        </td>
                                        <td className="py-3.5 px-4 font-black text-slate-700">{p.pacienteNombre}</td>
                                        <td className="py-3.5 px-4 font-bold text-slate-500">{p.prestacion}</td>
                                        <td className="py-3.5 px-4 font-bold text-slate-400 font-mono">{p.planId ? `#${p.planId.slice(0, 8)}` : "—"}</td>
                                        <td className="py-3.5 px-4 font-bold text-slate-400">{p.fechaObj.toLocaleDateString("es-CO")}</td>
                                        <td className="py-3.5 px-4 text-right font-medium text-slate-400">{fmt(p.valorPrestado)}</td>
                                        <td className="py-3.5 px-4 text-right font-black text-slate-700">{fmt(p.valorRecaudado)}</td>
                                        <td className="py-3.5 px-4 text-center font-black text-slate-500 font-mono">{comisionPct}%</td>
                                        <td className="py-3.5 px-4 text-right font-black text-purple-600">{fmt(Math.round(p.valorRecaudado * comisionPct / 100))}</td>
                                        <td className="py-3.5 px-4 text-center">
                                            <a 
                                                href={`/odontocloud-react/dashboard/pacientes`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="h-7 px-3 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-100 hover:border-slate-200 rounded-lg inline-flex items-center justify-center font-bold"
                                            >
                                                Ver Ficha
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50/50 font-black border-t border-slate-100 text-slate-700">
                                    <td colSpan={6} className="py-4 px-4 text-right uppercase text-slate-400 tracking-wider">
                                        % Recau: {fmt(totalRecaudado)} | Total Comisión:
                                    </td>
                                    <td colSpan={3} className="py-4 px-4 text-right text-purple-700 text-sm">
                                        {fmt(totalComision)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Inline adjustments add forms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CARD GASTOS */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Gastos</h3>
                        <span className="text-xs font-black text-rose-500">-{fmt(totalGastos)}</span>
                    </div>
                    <div className="p-4 space-y-4">
                        {showGastoForm && (
                            <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Valor *</label>
                                    <input 
                                        type="number"
                                        value={newGasto.valor}
                                        onChange={e => setNewGasto({ ...newGasto, valor: e.target.value })}
                                        placeholder="0"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Descripción *</label>
                                    <input 
                                        type="text"
                                        value={newGasto.desc}
                                        onChange={e => setNewGasto({ ...newGasto, desc: e.target.value })}
                                        placeholder="Ej. Materiales extra"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowGastoForm(false)} 
                                        className="h-8 px-3 rounded-lg text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={addGasto} 
                                        className="h-8 px-4 rounded-lg text-[10px] font-black uppercase bg-rose-500 text-white"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>
                        )}
                        {gastos.length === 0 ? (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-4">No hay gastos añadidos.</p>
                        ) : (
                            <div className="space-y-2">
                                {gastos.map((g, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                                        <div className="flex flex-col text-xs font-bold">
                                            <span className="text-slate-600">{g.desc}</span>
                                            <span className="text-rose-500 font-mono mt-0.5">-{fmt(g.valor)}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeGasto(i)}
                                            className="w-7 h-7 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 border border-transparent rounded-lg text-slate-300 transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* CARD BONIFICACIONES */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Bonificaciones</h3>
                        <span className="text-xs font-black text-emerald-600">+{fmt(totalBonificaciones)}</span>
                    </div>
                    <div className="p-4 space-y-4">
                        {showBonoForm && (
                            <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Valor *</label>
                                    <input 
                                        type="number"
                                        value={newBono.valor}
                                        onChange={e => setNewBono({ ...newBono, valor: e.target.value })}
                                        placeholder="0"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Descripción *</label>
                                    <input 
                                        type="text"
                                        value={newBono.desc}
                                        onChange={e => setNewBono({ ...newBono, desc: e.target.value })}
                                        placeholder="Ej. Bono cumplimiento"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowBonoForm(false)} 
                                        className="h-8 px-3 rounded-lg text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={addBono} 
                                        className="h-8 px-4 rounded-lg text-[10px] font-black uppercase bg-[#8cc33f] text-white"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>
                        )}
                        {bonificaciones.length === 0 ? (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-4">No hay bonificaciones añadidas.</p>
                        ) : (
                            <div className="space-y-2">
                                {bonificaciones.map((b, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                                        <div className="flex flex-col text-xs font-bold">
                                            <span className="text-slate-600">{b.desc}</span>
                                            <span className="text-emerald-600 font-mono mt-0.5">+{fmt(b.valor)}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeBono(i)}
                                            className="w-7 h-7 flex items-center justify-center hover:bg-[#8cc33f]/10 hover:text-[#8cc33f] border border-transparent rounded-lg text-slate-300 transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* CARD DEDUCCIONES */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Deducciones</h3>
                        <span className="text-xs font-black text-rose-500">-{fmt(totalDeducciones)}</span>
                    </div>
                    <div className="p-4 space-y-4">
                        {showDeduccionForm && (
                            <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Valor *</label>
                                    <input 
                                        type="number"
                                        value={newDeduccion.valor}
                                        onChange={e => setNewDeduccion({ ...newDeduccion, valor: e.target.value })}
                                        placeholder="0"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Descripción *</label>
                                    <input 
                                        type="text"
                                        value={newDeduccion.desc}
                                        onChange={e => setNewDeduccion({ ...newDeduccion, desc: e.target.value })}
                                        placeholder="Ej. Retención de fuente"
                                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowDeduccionForm(false)} 
                                        className="h-8 px-3 rounded-lg text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={addDeduccion} 
                                        className="h-8 px-4 rounded-lg text-[10px] font-black uppercase bg-rose-500 text-white"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>
                        )}
                        {deducciones.length === 0 ? (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-4">No hay deducciones añadidas.</p>
                        ) : (
                            <div className="space-y-2">
                                {deducciones.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                                        <div className="flex flex-col text-xs font-bold">
                                            <span className="text-slate-600">{d.desc}</span>
                                            <span className="text-rose-500 font-mono mt-0.5">-{fmt(d.valor)}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeDeduccion(i)}
                                            className="w-7 h-7 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 border border-transparent rounded-lg text-slate-300 transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Total summary board card */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider block">Resumen de Liquidación</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Neto = Comisión ({fmt(totalComision)}) + Bonos ({fmt(totalBonificaciones)}) - Gastos ({fmt(totalGastos)}) - Deducciones ({fmt(totalDeducciones)})</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Neto a Liquidar al Doctor</span>
                        <strong className="text-purple-600 text-xl font-black">{fmt(totalNetoPagar)}</strong>
                    </div>
                </div>
            </div>

        </div>
    );
}
