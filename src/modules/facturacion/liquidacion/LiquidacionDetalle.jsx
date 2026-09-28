import React, { useState, useEffect, useMemo } from "react";
import { 
    FiArrowLeft, FiPlus, FiTrash2, FiSave, FiAlertCircle, 
    FiCheckCircle, FiUser, FiInfo, FiLayers, FiDollarSign, FiCalendar 
} from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { getItemsPendientesPorDoctor, crearLiquidacionGenerada } from "../../../services/liquidacionDoctorService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export default function LiquidacionDetalle({ doctor, dateRange, preloadedItems = null, onBack, onSuccess }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    // Professional data
    const [comisionPct, setComisionPct] = useState(doctor?.comisionPorcentaje || 35);

    // Items to liquidate
    const [items, setItems] = useState([]);
    const [selectedItemKeys, setSelectedItemKeys] = useState({});

    // Adjustments arrays
    // Gastos: tipo "laboratorio" (se resta antes de calcular el %) o "general"
    const [gastos, setGastos] = useState([]);
    const [bonificaciones, setBonificaciones] = useState([]);
    const [deducciones, setDeducciones] = useState([]);

    // Inputs for adding adjustments
    const [newGasto, setNewGasto] = useState({ valor: "", desc: "", tipo: "laboratorio" });
    const [newBono, setNewBono] = useState({ valor: "", desc: "" });
    const [newDeduccion, setNewDeduccion] = useState({ valor: "", desc: "" });

    // Toggles for active adjustment forms
    const [showGastoForm, setShowGastoForm] = useState(false);
    const [showBonoForm, setShowBonoForm] = useState(false);
    const [showDeduccionForm, setShowDeduccionForm] = useState(false);

    const loadData = async () => {
        if (!inquilino || !doctor) return;
        setLoading(true);
        try {
            setComisionPct(doctor.comisionPorcentaje || 35);

            let itemList = preloadedItems;
            if (!itemList || itemList.length === 0) {
                const res = await getItemsPendientesPorDoctor(inquilino, doctor.id, dateRange);
                itemList = res.items || [];
            }

            setItems(itemList);

            // Select all by default
            const initialSelection = {};
            itemList.forEach(it => {
                initialSelection[it.key] = true;
            });
            setSelectedItemKeys(initialSelection);

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
            items.forEach(it => {
                next[it.key] = true;
            });
        }
        setSelectedItemKeys(next);
    };

    const toggleSelectItem = (key) => {
        setSelectedItemKeys(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const isAllSelected = useMemo(() => {
        if (items.length === 0) return false;
        return items.every(it => selectedItemKeys[it.key]);
    }, [items, selectedItemKeys]);

    // Totals calculations
    const selectedItems = useMemo(() => {
        return items.filter(it => selectedItemKeys[it.key]);
    }, [items, selectedItemKeys]);

    const totalRecaudado = useMemo(() => {
        return selectedItems.reduce((sum, it) => sum + Number(it.valorPrestacion || 0), 0);
    }, [selectedItems]);

    // Gastos categorizados
    const gastosLaboratorio = useMemo(() => {
        return gastos.filter(g => g.tipo === "laboratorio" || !g.tipo);
    }, [gastos]);

    const otrosGastos = useMemo(() => {
        return gastos.filter(g => g.tipo === "general");
    }, [gastos]);

    const totalGastosLab = useMemo(() => {
        return gastosLaboratorio.reduce((sum, g) => sum + Number(g.valor || 0), 0);
    }, [gastosLaboratorio]);

    const totalOtrosGastos = useMemo(() => {
        return otrosGastos.reduce((sum, g) => sum + Number(g.valor || 0), 0);
    }, [otrosGastos]);

    const totalGastos = useMemo(() => {
        return gastos.reduce((sum, g) => sum + Number(g.valor || 0), 0);
    }, [gastos]);

    const totalBonificaciones = useMemo(() => {
        return bonificaciones.reduce((sum, b) => sum + Number(b.valor || 0), 0);
    }, [bonificaciones]);

    const totalDeducciones = useMemo(() => {
        return deducciones.reduce((sum, d) => sum + Number(d.valor || 0), 0);
    }, [deducciones]);

    // Subtotal de ítems con pago fijo vs ítems a comisionar por %
    const { totalItemsFijosPagar, baseItemsComisionables } = useMemo(() => {
        let fijos = 0;
        let baseCom = 0;
        selectedItems.forEach(it => {
            if (it.tipoLiquidacion === "fijo") {
                fijos += Number(it.pagoFijoValor || 0);
            } else {
                baseCom += Number(it.valorPrestacion || 0);
            }
        });
        return { totalItemsFijosPagar: fijos, baseItemsComisionables: baseCom };
    }, [selectedItems]);

    // Base de utilidad para el % = Base de ítems comisionables - Costos de laboratorio
    const baseUtilidadComisionable = useMemo(() => {
        return Math.max(0, baseItemsComisionables - totalGastosLab);
    }, [baseItemsComisionables, totalGastosLab]);

    // Total comisión: % sobre utilidad + ítems fijos
    const totalComision = useMemo(() => {
        const comisionCalculada = Math.round(baseUtilidadComisionable * comisionPct / 100);
        return comisionCalculada + totalItemsFijosPagar;
    }, [baseUtilidadComisionable, comisionPct, totalItemsFijosPagar]);

    // Neto a pagar = Comisión + Bonificaciones - Deducciones - Otros Gastos
    const totalNetoPagar = useMemo(() => {
        return totalComision + totalBonificaciones - totalDeducciones - totalOtrosGastos;
    }, [totalComision, totalBonificaciones, totalDeducciones, totalOtrosGastos]);

    // Adjustments helpers
    const addGasto = () => {
        const val = Number(newGasto.valor);
        if (!newGasto.desc.trim() || isNaN(val) || val <= 0) return;
        setGastos([...gastos, { valor: val, desc: newGasto.desc.trim(), tipo: newGasto.tipo || "laboratorio" }]);
        setNewGasto({ valor: "", desc: "", tipo: "laboratorio" });
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

    // Save Liquidation in state "Generada"
    const handleGenerarLiquidacion = async () => {
        if (selectedItems.length === 0) {
            setError("Debes seleccionar al menos un procedimiento realizado para liquidar.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const conceptosLiquidados = selectedItems.map(it => it.key);

            const payload = {
                doctor,
                dateRange,
                totalRecaudado,
                totalNetoPagar,
                totalComisiones: totalComision,
                comisionPct,
                totalGastosLab,
                totalGastos,
                gastos,
                totalBonificaciones,
                bonificaciones,
                totalDeducciones,
                deducciones,
                conceptosLiquidados,
                selectedItems
            };

            await crearLiquidacionGenerada(inquilino, payload, userProfile);

            setSuccess(true);
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess();
                } else {
                    onBack();
                }
            }, 1200);

        } catch (e) {
            console.error("Error saving liquidation:", e);
            setError("Error al guardar la liquidación. Inténtalo de nuevo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300">
            
            {/* Header / Nav */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-purple-600 border border-transparent hover:border-purple-100 active:scale-95 group cursor-pointer"
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
                            <span>Detalle de Liquidación</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mt-1">
                            Liquidación: {doctor.nombre}
                        </h2>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => setShowGastoForm(!showGastoForm)}
                        className={`h-10 px-4 rounded-full border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                            showGastoForm ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                    >
                        <FiPlus size={14} />
                        Gastos / Laboratorio
                    </button>
                    <button
                        onClick={() => setShowBonoForm(!showBonoForm)}
                        className={`h-10 px-4 rounded-full border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                            showBonoForm ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                    >
                        <FiPlus size={14} />
                        Bonificaciones
                    </button>
                    <button
                        onClick={() => setShowDeduccionForm(!showDeduccionForm)}
                        className={`h-10 px-4 rounded-full border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                            showDeduccionForm ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                    >
                        <FiPlus size={14} />
                        Deducciones
                    </button>
                    <button 
                        onClick={handleGenerarLiquidacion}
                        disabled={saving || selectedItems.length === 0}
                        className="h-10 px-7 flex items-center justify-center bg-purple-600 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-600/20 transition-all active:scale-95 disabled:opacity-45 cursor-pointer ml-auto sm:ml-0"
                    >
                        {saving ? "Generando..." : "Generar Liquidación"}
                    </button>
                </div>
            </div>

            {success && (
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[24px] flex items-center gap-4 animate-in zoom-in">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20">
                        <FiCheckCircle />
                    </div>
                    <div>
                        <h4 className="text-emerald-800 font-black uppercase text-sm">Liquidación Generada</h4>
                        <p className="text-emerald-600 text-xs font-medium uppercase tracking-wide">
                            La liquidación se guardó con éxito en estado "Generada" para su validación o pago.
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-[24px] flex items-center gap-4 animate-in zoom-in">
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
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest block">
                            Procedimientos Realizados por {doctor.nombre}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-medium">
                            Período: {dateRange.desde} al {dateRange.hasta} · Comisión configurada: {comisionPct}% · Modo: {doctor.formaPago || "Realizadas y pagadas"}
                        </span>
                    </div>

                    <div className="text-xs font-black text-slate-500">
                        Seleccionados: <strong className="text-purple-600">{selectedItems.length}</strong> de {items.length}
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando procedimientos...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-2">
                        <span className="text-4xl">🧾</span>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">
                            No se encontraron procedimientos pendientes en este período.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="py-4 px-4 text-center w-12">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                            className="w-4 h-4 text-purple-600 border-slate-200 rounded cursor-pointer focus:ring-purple-500"
                                        />
                                    </th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Procedimiento / Ítem</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Tratamiento</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fecha Realizado</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Ítem</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo Comisión</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Liquidar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((it) => {
                                    const isChecked = !!selectedItemKeys[it.key];
                                    const itemPayVal = it.tipoLiquidacion === "fijo" 
                                        ? it.pagoFijoValor 
                                        : Math.round(it.valorPrestacion * comisionPct / 100);

                                    return (
                                        <tr key={it.key} className={`hover:bg-slate-50/30 transition-colors ${isChecked ? "bg-purple-50/10" : "opacity-50"}`}>
                                            <td className="py-3 px-4 text-center align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleSelectItem(it.key)}
                                                    className="w-4 h-4 text-purple-600 border-slate-200 rounded cursor-pointer focus:ring-purple-500"
                                                />
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-black text-slate-800">{it.pacienteNombre}</div>
                                                {it.pacienteDocumento && (
                                                    <span className="text-[10px] text-slate-400 font-mono">{it.pacienteDocumento}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-slate-700">
                                                {it.prestacion}
                                                {it.codigoCups && it.codigoCups !== "—" && (
                                                    <span className="ml-1 text-[10px] text-slate-400 font-mono">[{it.codigoCups}]</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 font-medium font-mono text-[11px]">
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
                                                    {it.tipoLiquidacion === "fijo" ? `Fijo: ${fmt(it.pagoFijoValor)}` : `${comisionPct}%`}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-purple-700 whitespace-nowrap">
                                                {fmt(itemPayVal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Inline adjustments add forms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* CARD GASTOS / LABORATORIO */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Gastos / Costos</span>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Laboratorio u Otros</h4>
                        </div>
                        <span className="text-xs font-black text-rose-600 font-mono">-{fmt(totalGastos)}</span>
                    </div>

                    <div className="p-4 flex-1 space-y-3">
                        {showGastoForm && (
                            <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl space-y-3 animate-in fade-in">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Tipo de Gasto</label>
                                    <select
                                        value={newGasto.tipo}
                                        onChange={e => setNewGasto({ ...newGasto, tipo: e.target.value })}
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    >
                                        <option value="laboratorio">Costo Laboratorio (Resta antes del %)</option>
                                        <option value="general">Gasto General (Resta después del %)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Valor *</label>
                                    <input 
                                        type="number"
                                        value={newGasto.valor}
                                        onChange={e => setNewGasto({ ...newGasto, valor: e.target.value })}
                                        placeholder="0"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Descripción / Proveedor *</label>
                                    <input 
                                        type="text"
                                        value={newGasto.desc}
                                        onChange={e => setNewGasto({ ...newGasto, desc: e.target.value })}
                                        placeholder="Ej. Guía Laboratorio Dental"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowGastoForm(false)} 
                                        className="h-7 px-3 rounded-lg text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-500 cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={addGasto} 
                                        className="h-7 px-4 rounded-lg text-[10px] font-black uppercase bg-rose-500 text-white cursor-pointer"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>
                        )}

                        {gastos.length === 0 ? (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-6">
                                Sin gastos de laboratorio asociados.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {gastos.map((g, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50/50 border border-slate-100 rounded-xl">
                                        <div className="flex flex-col text-xs font-bold">
                                            <span className="text-slate-700">{g.desc}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {g.tipo === "laboratorio" ? "Laboratorio (antes de %)" : "General"}
                                            </span>
                                            <span className="text-rose-500 font-mono font-black mt-0.5">-{fmt(g.valor)}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeGasto(i)}
                                            className="w-6 h-6 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 rounded-lg text-slate-300 transition-colors cursor-pointer"
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
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Valores Adicionales</span>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Bonificaciones</h4>
                        </div>
                        <span className="text-xs font-black text-emerald-600 font-mono">+{fmt(totalBonificaciones)}</span>
                    </div>

                    <div className="p-4 flex-1 space-y-3">
                        {showBonoForm && (
                            <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl space-y-3 animate-in fade-in">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Valor *</label>
                                    <input 
                                        type="number"
                                        value={newBono.valor}
                                        onChange={e => setNewBono({ ...newBono, valor: e.target.value })}
                                        placeholder="0"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Descripción / Motivo *</label>
                                    <input 
                                        type="text"
                                        value={newBono.desc}
                                        onChange={e => setNewBono({ ...newBono, desc: e.target.value })}
                                        placeholder="Ej. Cumplimiento de meta"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowBonoForm(false)} 
                                        className="h-7 px-3 rounded-lg text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-500 cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={addBono} 
                                        className="h-7 px-4 rounded-lg text-[10px] font-black uppercase bg-emerald-600 text-white cursor-pointer"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>
                        )}

                        {bonificaciones.length === 0 ? (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-6">
                                Sin bonificaciones adicionales.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {bonificaciones.map((b, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50/50 border border-slate-100 rounded-xl">
                                        <div className="flex flex-col text-xs font-bold">
                                            <span className="text-slate-700">{b.desc}</span>
                                            <span className="text-emerald-600 font-mono font-black mt-0.5">+{fmt(b.valor)}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeBono(i)}
                                            className="w-6 h-6 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 rounded-lg text-slate-300 transition-colors cursor-pointer"
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
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Descuentos</span>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Deducciones</h4>
                        </div>
                        <span className="text-xs font-black text-rose-600 font-mono">-{fmt(totalDeducciones)}</span>
                    </div>

                    <div className="p-4 flex-1 space-y-3">
                        {showDeduccionForm && (
                            <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl space-y-3 animate-in fade-in">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Valor *</label>
                                    <input 
                                        type="number"
                                        value={newDeduccion.valor}
                                        onChange={e => setNewDeduccion({ ...newDeduccion, valor: e.target.value })}
                                        placeholder="0"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Descripción / Concepto *</label>
                                    <input 
                                        type="text"
                                        value={newDeduccion.desc}
                                        onChange={e => setNewDeduccion({ ...newDeduccion, desc: e.target.value })}
                                        placeholder="Ej. Anticipo o Préstamo"
                                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowDeduccionForm(false)} 
                                        className="h-7 px-3 rounded-lg text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-500 cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={addDeduccion} 
                                        className="h-7 px-4 rounded-lg text-[10px] font-black uppercase bg-rose-500 text-white cursor-pointer"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>
                        )}

                        {deducciones.length === 0 ? (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-6">
                                Sin deducciones aplicadas.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {deducciones.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50/50 border border-slate-100 rounded-xl">
                                        <div className="flex flex-col text-xs font-bold">
                                            <span className="text-slate-700">{d.desc}</span>
                                            <span className="text-rose-500 font-mono font-black mt-0.5">-{fmt(d.valor)}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeDeduccion(i)}
                                            className="w-6 h-6 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 rounded-lg text-slate-300 transition-colors cursor-pointer"
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
                    <p className="text-[11px] text-slate-400 font-medium">
                        Base: {fmt(baseUtilidadComisionable)} · Comisión ({fmt(totalComision)}) + Bonos ({fmt(totalBonificaciones)}) - Deducciones ({fmt(totalDeducciones)}) {totalOtrosGastos > 0 ? `- Gastos (${fmt(totalOtrosGastos)})` : ""}
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Neto a Liquidar al Doctor</span>
                        <strong className="text-purple-600 text-2xl font-black">{fmt(totalNetoPagar)}</strong>
                    </div>
                </div>
            </div>

        </div>
    );
}
