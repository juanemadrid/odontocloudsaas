import React, { useState, useEffect } from 'react';
import supabase from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { 
    FiDollarSign, 
    FiPlusCircle, 
    FiCreditCard, 
    FiSmartphone, 
    FiBriefcase, 
    FiAlertCircle, 
    FiCheck, 
    FiFileText, 
    FiUser, 
    FiArrowLeft, 
    FiSearch 
} from "react-icons/fi";
import { formatCurrency } from '../../../utils/formatters';
import { getPlansByPatient } from '../../../services/planService';
import { getConfigItems, saveConfigItem } from '../../../services/configPersistenceService';
import { getDoctorsList, getActiveCaja } from '../../../services/supabaseServices';

// Módulo de Realizar Pago y Saldo a Favor del Paciente - OdontoCloud
export default function PagoTab({ patient }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    
    // View state
    const [view, setView] = useState("list"); // 'list' | 'checkout' | 'form'
    const [plans, setPlans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState(["Efectivo", "Tarjeta", "Transferencia"]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Checkout form state
    const [abonoInput, setAbonoInput] = useState("");
    const [method, setMethod] = useState("Efectivo");
    const [reference, setReference] = useState("");
    const [concept, setConcept] = useState("ABONO A TRATAMIENTO");
    const [profesional, setProfesional] = useState("");
    const [profesionalId, setProfesionalId] = useState("");
    const [profesionales, setProfesionales] = useState([]);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadProfesionales = async () => {
            try {
                const list = await getDoctorsList(userProfile, patient);
                const formatted = list.map(d => ({
                    id: d.id,
                    nombre: d.nombreCompleto || d.nombre || ""
                }));
                setProfesionales(formatted);

                if (formatted.length > 0) {
                    const myId = String(userProfile?.uid || userProfile?.id || '');
                    const me = formatted.find(p => String(p.id) === myId);
                    if (me) {
                        setProfesionalId(me.id);
                        setProfesional(me.nombre);
                    } else {
                        setProfesionalId(formatted[0].id);
                        setProfesional(formatted[0].nombre);
                    }
                }
            } catch (err) {
                console.error("Error loading profesionales in PagoTab:", err);
            }
        };
        loadProfesionales();
    }, [userProfile, patient]);

    // Payment methods that require a reference number
    const METHODS_REQUIRING_REFERENCE = ["Transferencia", "Cheque", "Consignación", "Nequi", "Daviplata", "PSE"];
    const requiresReference = METHODS_REQUIRING_REFERENCE.some(m => 
        method?.toLowerCase().includes(m.toLowerCase())
    );

    const loadData = async () => {
        if (!patient?.id) return;
        setLoadingData(true);
        try {
            // Load plans
            const plansData = await getPlansByPatient(patient.id);
            const activePlans = plansData.filter(p => p.type === 'plan');
            setPlans(activePlans);

            // Load payments
            const { data: payData } = await supabase
                .from("pagos")
                .select("*")
                .eq("paciente_id", patient.id);
            const paymentsData = (payData || []).map(p => {
                let parsedNotes = {};
                if (p.notas && typeof p.notas === 'string' && p.notas.trim().startsWith('{')) {
                    try {
                        parsedNotes = JSON.parse(p.notas);
                    } catch (e) {}
                }
                return {
                    ...p,
                    ...parsedNotes,
                    medio: p.metodo || p.medio || "Efectivo",
                    metodo: p.metodo || p.medio || "Efectivo",
                    planId: parsedNotes.planId || p.planId || p.plan_id,
                    itemPayments: parsedNotes.itemPayments || p.itemPayments || [],
                    concepto: parsedNotes.concepto || p.concepto || (p.referencia === "SALDO A FAVOR" ? "SALDO A FAVOR" : "ABONO A TRATAMIENTO"),
                    nroConsecutivo: parsedNotes.nroConsecutivo || p.nroConsecutivo,
                    registradoPor: parsedNotes.registradoPor || p.registradoPor || "Sistema"
                };
            }).filter(p => (p.estado || "").toLowerCase() !== "anulado");
            setPayments(paymentsData);

            // Load dynamic active payment methods from website_config
            if (userProfile?.inquilino) {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", userProfile.inquilino)
                    .maybeSingle();

                const rawMetodos = cfgRow?.config?.metodos_pago || [
                    { id: "1", nombre: "Efectivo", activo: true },
                    { id: "2", nombre: "Tarjeta", activo: true },
                    { id: "3", nombre: "Transferencia", activo: true }
                ];

                const metodosList = rawMetodos
                    .filter(m => m.activo !== false)
                    .map(m => m.nombre || m);

                if (metodosList.length > 0) {
                    setPaymentMethods(metodosList);
                    setMethod(metodosList[0]);
                } else {
                    setPaymentMethods(["Efectivo", "Tarjeta", "Transferencia"]);
                    setMethod("Efectivo");
                }
            }
        } catch (error) {
            console.error("Error loading payment data:", error);
            toast.error("Error al cargar datos de pago");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [patient?.id]);

    const getPaidMap = (planItems, planPayments) => {
        const paidMap = {};
        planItems.forEach(it => {
            paidMap[it.id] = 0;
        });

        const oldPayments = [];
        const newPayments = [];
        planPayments.forEach(p => {
            if (p.itemPayments && p.itemPayments.length > 0) {
                newPayments.push(p);
            } else {
                oldPayments.push(p);
            }
        });

        // 1. Process explicit item payments
        newPayments.forEach(p => {
            p.itemPayments.forEach(ip => {
                if (paidMap[ip.itemId] !== undefined) {
                    paidMap[ip.itemId] += Number(ip.monto || 0);
                }
            });
        });

        // 2. Process legacy payments (sequentially distribute to items with remaining balance)
        oldPayments.forEach(p => {
            let remaining = Number(p.monto || 0);
            for (let i = 0; i < planItems.length; i++) {
                if (remaining <= 0) break;
                const it = planItems[i];
                const totalCost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                const currentPaid = paidMap[it.id];
                const currentSaldo = Math.max(0, totalCost - currentPaid);
                if (currentSaldo > 0) {
                    const allocated = Math.min(currentSaldo, remaining);
                    paidMap[it.id] += allocated;
                    remaining -= allocated;
                }
            }
        });

        return paidMap;
    };

    // Calculate map of paid amounts for selected plan dynamically
    const planPayments = selectedPlan ? payments.filter(p => p.planId === selectedPlan.id) : [];
    const paidMap = selectedPlan ? getPaidMap(selectedPlan.items || [], planPayments) : {};

    // Calculate net credit balance (Saldo a favor)
    const isNotAnulado = (p) => (p.estado || "").toLowerCase() !== "anulado";
    const totalCredits = payments.filter(p => {
        const ref = (p.referencia || p.concepto || "").toUpperCase();
        const notes = (p.notas || p.notes || "").toUpperCase();
        const m = (p.metodo || p.medio || "").toLowerCase();
        return m !== "saldo a favor" && (ref === "SALDO A FAVOR" || notes.includes("SALDO A FAVOR")) && isNotAnulado(p);
    }).reduce((sum, p) => sum + Number(p.monto || 0), 0);

    const usedCredits = payments.filter(p => {
        const m = (p.metodo || p.medio || "").toLowerCase();
        return m === "saldo a favor" && isNotAnulado(p);
    }).reduce((sum, p) => sum + Number(p.monto || 0), 0);

    const patientSaldoFavor = Number(patient?.saldo_favor || patient?.saldoFavor || 0);
    const availableCredit = Math.max(0, Math.max(patientSaldoFavor, totalCredits) - usedCredits);

    const getPlanPayments = (planId) => {
        return payments
            .filter(p => p.planId === planId)
            .reduce((sum, p) => sum + Number(p.monto || 0), 0);
    };

    const handleSelectPlan = (plan) => {
        setSelectedPlan(plan);
        // Start with empty selections per user request
        setSelectedItemIds([]);
        setAbonoInput("");
        const defaultMethod = paymentMethods.length > 0 ? paymentMethods[0] : "Efectivo";
        setMethod(defaultMethod);
        setConcept("ABONO A TRATAMIENTO");
        setNotes("");
        setView("checkout");
    };

    const handleAddCredit = () => {
        setSelectedPlan(null);
        setAbonoInput("");
        const defaultMethod = paymentMethods.length > 0 ? paymentMethods[0] : "Efectivo";
        setMethod(defaultMethod);
        setConcept("SALDO A FAVOR");
        setNotes("SALDO A FAVOR");
        setView("form");
    };

    const handleToggleItem = (itemId) => {
        if (selectedItemIds.includes(itemId)) {
            setSelectedItemIds(selectedItemIds.filter(id => id !== itemId));
        } else {
            setSelectedItemIds([...selectedItemIds, itemId]);
        }
    };

    const selectedTotal = selectedPlan ? (selectedPlan.items || [])
        .filter(it => selectedItemIds.includes(it.id))
        .reduce((sum, it) => {
            const totalCost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
            const paid = paidMap[it.id] || 0;
            return sum + Math.max(0, totalCost - paid);
        }, 0) : 0;

    const totalToPay = abonoInput !== "" ? Number(abonoInput) : selectedTotal;

    const handleAbonoInputChange = (val) => {
        const rawValue = val.toString().replace(/\D/g, '');
        const numValue = Number(rawValue);
        
        if (rawValue === "") {
            setAbonoInput("");
            return;
        }

        let maxAllowed = selectedTotal;
        if (method === "Saldo a favor") {
            maxAllowed = Math.min(availableCredit, selectedTotal);
        }

        if (numValue > maxAllowed) {
            setAbonoInput(maxAllowed.toString());
            if (method === "Saldo a favor") {
                if (maxAllowed === availableCredit) {
                    toast.warning("El monto no puede exceder el saldo a favor disponible");
                } else {
                    toast.warning("El monto no puede exceder el total seleccionado");
                }
            } else {
                toast.warning("El monto no puede exceder el total seleccionado");
            }
        } else {
            setAbonoInput(numValue.toString());
        }
    };

    const handleAmountChangeForm = (val) => {
        const rawValue = val.toString().replace(/\D/g, '');
        const numValue = Number(rawValue);
        
        if (rawValue === "") {
            setAbonoInput("");
            return;
        }
        setAbonoInput(numValue.toString());
    };

    const handleMethodChange = (newMethod) => {
        setMethod(newMethod);
        setReference(""); // Reset reference when method changes
        if (newMethod === "Saldo a favor") {
            // Apply only the minimum needed: min(availableCredit, selectedTotal)
            const maxToApply = Math.min(availableCredit, selectedTotal);
            if (maxToApply > 0) {
                setAbonoInput(maxToApply.toString());
                if (maxToApply < selectedTotal) {
                    toast.info(`Saldo a favor disponible: ${formatCurrency(maxToApply)} — se ajustará el pago.`);
                }
            }
        }
    };

    // Reactive validator to cap payment when item selection or payment method changes
    useEffect(() => {
        if (method === "Saldo a favor") {
            const maxAllowed = Math.min(availableCredit, selectedTotal);
            const currentVal = Number(abonoInput || 0);
            if (currentVal > maxAllowed || currentVal === 0) {
                setAbonoInput(maxAllowed > 0 ? maxAllowed.toString() : "");
            }
        }
    }, [selectedItemIds, method, selectedTotal, availableCredit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const paymentAmount = totalToPay;
        if (!paymentAmount || paymentAmount <= 0) return toast.error("Monto inválido");

        if (method === "Saldo a favor" && paymentAmount > availableCredit) {
            return toast.error("El monto excede el saldo a favor disponible");
        }
        
        setLoading(true);
        try {
            // 1. Fetch active Caja session for this user (with fallback to website_config)
            const uId = userProfile?.uid || userProfile?.id || "";
            const inq = userProfile?.inquilino || "";
            let activeCaja = await getActiveCaja(inq, uId);

            // 2. If paid in cash, active cash session is strictly required
            if (method === "Efectivo" && !activeCaja) {
                setLoading(false);
                return toast.error("No tienes una caja abierta para registrar el pago en efectivo.");
            }

            let itemPayments = [];
            if (selectedPlan) {
                let remaining = paymentAmount;
                const itemsToPay = (selectedPlan.items || [])
                    .filter(it => selectedItemIds.includes(it.id))
                    .map(it => {
                        const totalCost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                        const paid = paidMap[it.id] || 0;
                        return {
                            id: it.id,
                            desc: it.desc,
                            saldo: Math.max(0, totalCost - paid)
                        };
                    });

                for (let i = 0; i < itemsToPay.length; i++) {
                    if (remaining <= 0) break;
                    const item = itemsToPay[i];
                    const allocated = Math.min(item.saldo, remaining);
                    if (allocated > 0) {
                        itemPayments.push({
                            itemId: item.id,
                            desc: item.desc,
                            monto: allocated
                        });
                        remaining -= allocated;
                    }
                }
            }

            // 2.5. Fetch and assign consecutive number (contReciboCaja)
            let nroConsecutivo = "";
            let consDoc = null;
            let consNextCount = 1;
            try {
                const consData = await getConfigItems(
                    userProfile?.inquilino,
                    "consecutivos",
                    "consecutivos"
                );
                consDoc = consData.find(item => item.activo !== false) || consData[0] || null;
                if (consDoc) {
                    const currentCount = parseInt(
                        String(consDoc.contReciboCaja ?? consDoc.cont_recibo_caja ?? 1),
                        10
                    ) || 1;
                    consNextCount = currentCount + 1;
                    nroConsecutivo = String(currentCount).padStart(2, "0");
                } else {
                    nroConsecutivo = "01";
                    consNextCount = 2;
                }
            } catch (consErr) {
                console.warn("No se pudo obtener el consecutivo:", consErr);
                nroConsecutivo = "";
            }

            // Build schema-compliant payload for pagos table
            const patientName = patient.nombreCompleto || `${patient.nombres || patient.nombre || ""} ${patient.apellidos || patient.apellido || ""}`.trim() || "Paciente";
            const metadataNotas = {
                concepto: concept || "ABONO A TRATAMIENTO",
                profesional: profesional || "",
                profesionalId: profesionalId || null,
                planId: selectedPlan?.id || null,
                planTitle: selectedPlan?.title || selectedPlan?.nombre || "",
                itemPayments: itemPayments,
                nroConsecutivo: nroConsecutivo,
                pacienteNombre: patientName,
                patientNombre: patientName,
                registradoPor: userProfile?.nombreCompleto || userProfile?.nombre || "Sistema",
                cajaId: activeCaja ? activeCaja.id : null,
                observaciones: notes || ""
            };

            const pagoPayload = {
                tenant_id: userProfile?.inquilino || "",
                paciente_id: patient.id,
                factura_id: null,
                monto: paymentAmount,
                metodo: method,
                referencia: reference || (method === "Saldo a favor" ? "USO SALDO A FAVOR" : null),
                fecha: new Date().toISOString(),
                notas: JSON.stringify(metadataNotas)
            };

            // 3. Write payment doc to Supabase
            const { data: newPago, error: pagoErr } = await supabase
                .from("pagos")
                .insert([pagoPayload])
                .select()
                .single();
            if (pagoErr) throw pagoErr;

            // 3.1. Deduct or increment saldo_favor on patient profile
            if (method === "Saldo a favor") {
                const newSaldo = Math.max(0, availableCredit - paymentAmount);
                await supabase
                    .from("pacientes")
                    .update({ saldo_favor: newSaldo })
                    .eq("id", patient.id);
                
                if (patient) {
                    patient.saldo_favor = newSaldo;
                    patient.saldoFavor = newSaldo;
                }
            } else if (concept === "SALDO A FAVOR" || reference === "SALDO A FAVOR") {
                const newSaldo = availableCredit + paymentAmount;
                await supabase
                    .from("pacientes")
                    .update({ saldo_favor: newSaldo })
                    .eq("id", patient.id);
                
                if (patient) {
                    patient.saldo_favor = newSaldo;
                    patient.saldoFavor = newSaldo;
                }
            }

            // 3.2. Increment consecutive counter
            if (consDoc) {
                const isUsoSaldo = method === "Saldo a favor";
                const currentUsoSaldo = parseInt(String(consDoc.contUsoSaldoFavor || 0), 10) || 0;
                await saveConfigItem(
                    userProfile.inquilino,
                    "consecutivos",
                    "consecutivos",
                    {
                        ...consDoc,
                        contReciboCaja: consNextCount,
                        cont_recibo_caja: consNextCount,
                        ...(isUsoSaldo ? { contUsoSaldoFavor: currentUsoSaldo + 1 } : {})
                    }
                );
            }
            
            // 4. Synchronize with active Caja session (for cash / bank methods)
            if (activeCaja && method !== "Saldo a favor") {
                const movData = {
                    tenant_id: userProfile?.inquilino || "",
                    caja_id: activeCaja.id,
                    usuario_id: userProfile?.uid || userProfile?.id || null,
                    tipo: "ingreso",
                    concepto: nroConsecutivo ? `[RC-${String(nroConsecutivo).padStart(4, "0")}] ${concept || "Abono a tratamiento"}` : (concept || "Abono a tratamiento"),
                    monto: paymentAmount,
                    metodo_pago: method,
                    referencia: `Paciente: ${patientName}${reference ? ' | ' + reference : ''}`,
                    created_at: new Date().toISOString()
                };
                
                try {
                    await supabase.from("movimientos_caja").insert([movData]);
                } catch (e) {
                    console.warn("No se pudo insertar movimiento de caja:", e);
                }
                
                try {
                    await supabase
                        .from("cajas")
                        .update({ updated_at: new Date().toISOString() })
                        .eq("id", activeCaja.id);
                } catch (e) {}

                // Sincronizar website_config si la caja está en la configuración
                try {
                    const { data: cfgRow } = await supabase
                        .from("website_config")
                        .select("config")
                        .eq("tenant_id", userProfile?.inquilino)
                        .maybeSingle();
                    if (cfgRow?.config?.cajas) {
                        const updatedCajas = cfgRow.config.cajas.map(c => {
                            if (c.id === activeCaja.id) {
                                const newSaldo = (Number(c.saldo_actual || c.saldoActual || 0)) + paymentAmount;
                                const newIngresos = (Number(c.total_ingresos || c.totalIngresos || 0)) + paymentAmount;
                                return {
                                    ...c,
                                    saldo_actual: newSaldo,
                                    saldoActual: newSaldo,
                                    total_ingresos: newIngresos,
                                    totalIngresos: newIngresos
                                };
                            }
                            return c;
                        });
                        await supabase
                            .from("website_config")
                            .upsert({
                                tenant_id: userProfile?.inquilino,
                                config: { ...cfgRow.config, cajas: updatedCajas }
                            }, { onConflict: "tenant_id" });
                    }
                } catch (e) {}
            }

            toast.success("Pago registrado exitosamente");
            setAbonoInput("");
            setNotes("");
            setReference("");
            setSelectedPlan(null);

            await loadData();
            setView("list");
        } catch (error) {
            console.error("Error saving payment:", error);
            toast.error("Error al registrar pago");
        } finally {
            setLoading(false);
        }
    };

    // Filter plans with pending balance only (balance > 0)
    const plansWithPendingBalance = plans.filter(p => {
        const paid = getPlanPayments(p.id);
        const total = Number(p.total || 0);
        const balance = Math.max(0, total - paid);
        return balance > 0;
    });

    const filteredPlans = plansWithPendingBalance.filter(p => {
        const matchesSearch = (p.title || p.nombre || "").toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    if (loadingData) {
        return (
            <div className="flex flex-col items-center justify-center p-20 opacity-30 animate-pulse">
                <FiDollarSign size={48} className="text-slate-400 mb-4" />
                <h5 className="text-[14px] font-black uppercase tracking-widest text-slate-500">Cargando módulo contable...</h5>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50/20 animate-fadeIn overflow-hidden">
            {view === "list" ? (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30">
                    
                    {/* TOOLBAR */}
                    <div className="px-6 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50 backdrop-blur-sm border-b border-slate-100/50 shrink-0">
                        <div className="relative w-full sm:w-96">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                            <input 
                                type="text"
                                placeholder="Buscar plan de tratamiento..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold text-slate-600 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder:text-slate-300 uppercase"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">
                                Planes pendientes: <span className="text-slate-700 font-mono text-sm">{plansWithPendingBalance.length}</span>
                            </div>
                            <button 
                                onClick={handleAddCredit}
                                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <FiPlusCircle size={15} strokeWidth={2.5} /> Adicionar saldo a favor
                            </button>
                        </div>
                    </div>

                    {/* TABLE AREA */}
                    <div className="flex-1 overflow-auto custom-scrollbar p-6">
                        <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead className="bg-slate-50/80 border-b border-slate-100">
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="py-4 px-6">Nombre del Plan</th>
                                            <th className="py-4 px-6">Sucursal</th>
                                            <th className="py-4 px-6 text-right">Costo Total</th>
                                            <th className="py-4 px-6 text-right">Pagado</th>
                                            <th className="py-4 px-6 text-right">Saldo Pendiente</th>
                                            <th className="py-4 px-6 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-[12px] font-bold text-slate-600">
                                        {filteredPlans.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="py-16 text-center text-slate-400 uppercase tracking-widest text-[11px]">
                                                    No hay planes de tratamiento con saldo pendiente
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPlans.map(p => {
                                                const paid = getPlanPayments(p.id);
                                                const total = Number(p.total || 0);
                                                const balance = Math.max(0, total - paid);

                                                return (
                                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-6 font-black uppercase text-slate-800">
                                                            {p.title || p.nombre}
                                                        </td>
                                                        <td className="py-4 px-6 uppercase text-[10px] text-slate-400 font-black">
                                                            {userProfile?.tenant?.nombre || "Sede Principal"}
                                                        </td>
                                                        <td className="py-4 px-6 text-right font-black text-slate-900 font-mono">
                                                            ${formatCurrency(total)}
                                                        </td>
                                                        <td className="py-4 px-6 text-right font-black text-emerald-600 font-mono">
                                                            ${formatCurrency(paid)}
                                                        </td>
                                                        <td className={`py-4 px-6 text-right font-black font-mono ${balance > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                            ${formatCurrency(balance)}
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                             {balance <= 0 ? (
                                                                 <span className="inline-flex items-center justify-center px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100/60 rounded-full text-[10px] font-black uppercase tracking-wider leading-none">
                                                                     Pagado
                                                                 </span>
                                                             ) : (
                                                                 <button 
                                                                     onClick={() => handleSelectPlan(p)}
                                                                     className="px-4 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md shadow-[#8CC63F]/20 flex items-center justify-center gap-1.5 mx-auto transition-all active:scale-95"
                                                                     title="Registrar Pago"
                                                                 >
                                                                     <FiCreditCard size={13} /> Pagar / Abonar
                                                                 </button>
                                                             )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : view === "checkout" && selectedPlan ? (
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-5">
                            <button 
                                type="button"
                                onClick={() => { setView("list"); setSelectedPlan(null); }}
                                className="w-14 h-14 bg-slate-100 hover:bg-slate-200 rounded-[22px] flex items-center justify-center text-slate-500 transition-all active:scale-95 shadow-sm"
                            >
                                <FiArrowLeft size={24} />
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase">Prestaciones</h2>
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                   <span>Pacientes &gt; Facturación &gt; Pago de prestaciones</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                        {/* Left Column: Items Table */}
                        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-6">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-6">
                                {selectedPlan.title || selectedPlan.nombre}
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left table-auto">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="pb-3 w-8 text-center">#</th>
                                            <th className="pb-3 w-10 text-center">Seleccionar</th>
                                            <th className="pb-3">Acciones clínicas</th>
                                            <th className="pb-3">Observ.</th>
                                            <th className="pb-3 text-right">Total</th>
                                            <th className="pb-3 text-right">Pagado</th>
                                            <th className="pb-3 text-right">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-[12px] font-bold text-slate-600">
                                        {(selectedPlan.items || [])
                                             .filter(it => {
                                                 const total = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                                                 const paid = paidMap[it.id] || 0;
                                                 return total - paid > 0;
                                             })
                                             .map((it, idx) => {
                                            const total = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                                            const paid = paidMap[it.id] || 0;
                                            const balance = Math.max(0, total - paid);
                                            const isSelected = selectedItemIds.includes(it.id);
                                            const hasPending = balance > 0;

                                            return (
                                                <tr key={it.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 text-center text-slate-400 font-black">{idx + 1}</td>
                                                    <td className="py-4 text-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            disabled={!hasPending}
                                                            onChange={() => handleToggleItem(it.id)}
                                                            className="w-4 h-4 text-[#8CC63F] border-slate-200 rounded focus:ring-[#8CC63F] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                                        />
                                                    </td>
                                                    <td className="py-4 uppercase text-slate-700 font-black leading-tight max-w-[200px]">
                                                        {it.desc}
                                                    </td>
                                                    <td className="py-4 text-slate-400 font-semibold text-[10px] uppercase">
                                                        {it.line_obs || "—"}
                                                    </td>
                                                    <td className="py-4 text-right font-black font-mono text-slate-700">{formatCurrency(total)}</td>
                                                    <td className="py-4 text-right font-black font-mono text-emerald-500">{formatCurrency(paid)}</td>
                                                    <td className="py-4 text-right font-black font-mono text-rose-500">{formatCurrency(balance)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right Column: Calculations & Form */}
                        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 space-y-8">
                            {/* Summary list */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                                    <span className="uppercase text-[11px] tracking-wider">Valor seleccionado</span>
                                    <span className="font-mono text-slate-800">{formatCurrency(selectedTotal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold text-rose-500">
                                    <span className="uppercase text-[11px] tracking-wider">Total</span>
                                    <span className="font-mono text-rose-600 font-black text-lg">{formatCurrency(selectedTotal)}</span>
                                </div>
                                <div className="h-px bg-slate-100" />
                                
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">Abono parcial</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                                        <input 
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            disabled={selectedTotal <= 0}
                                            value={abonoInput === "" ? "" : Number(abonoInput).toLocaleString('es-CO')}
                                            onChange={(e) => {
                                                const cleanVal = e.target.value.replace(/\D/g, '');
                                                handleAbonoInputChange(cleanVal);
                                            }}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-10 text-[13px] font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-right font-mono disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        {method === "Saldo a favor" 
                                            ? "Puedes ajustar el monto a debitar de tu saldo a favor."
                                            : "Deje en cero o vacío para pagar el total seleccionado."}
                                    </p>
                                </div>

                                <div className="flex justify-between items-center bg-[#8CC63F]/5 border border-[#8CC63F]/10 rounded-2xl p-4 mt-4">
                                    <span className="text-[11px] font-black text-[#8CC63F] uppercase tracking-widest">Total a pagar</span>
                                    <span className="text-2xl font-black text-[#8CC63F] font-mono">{formatCurrency(totalToPay)}</span>
                                </div>
                            </div>

                            {/* Form block */}
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                                    Información de Pago
                                </h4>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Medio de Pago</label>
                                    <select 
                                        value={method}
                                        onChange={(e) => handleMethodChange(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[12px] font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-[#8CC63F]/5 transition-all"
                                    >
                                        {paymentMethods.map(m => (
                                            <option key={m} value={m}>{m.toUpperCase()}</option>
                                        ))}
                                        <option value="Saldo a favor">SALDO A FAVOR ({formatCurrency(availableCredit)})</option>
                                    </select>
                                </div>

                                {/* Reference field — shown when payment method requires it */}
                                {requiresReference && (
                                    <div className="space-y-2 animate-fadeIn">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Número de Referencia / Comprobante <span className="text-rose-500">*</span>
                                        </label>
                                        <input 
                                            type="text"
                                            required
                                            placeholder="Ej: 0012345678..."
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[12px] font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all placeholder:text-amber-300 caret-slate-950"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Profesional / Responsable</label>
                                    <div className="relative">
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                                            <FiUser size={16} />
                                        </div>
                                        <select 
                                            value={profesionalId}
                                            onChange={(e) => {
                                                const pId = e.target.value;
                                                setProfesionalId(pId);
                                                const found = profesionales.find(p => p.id === pId);
                                                setProfesional(found ? found.nombre : "");
                                            }}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pr-12 text-[11px] font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-[#8CC63F]/5 transition-all appearance-none cursor-pointer uppercase"
                                        >
                                            <option value="">SELECCIONE PROFESIONAL...</option>
                                            {profesionales.map(p => (
                                                <option key={p.id} value={p.id}>{p.nombre.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones</label>
                                    <textarea 
                                        placeholder="DETALLES DE LA TRANSACCIÓN..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full h-24 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[11px] font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-[#8CC63F]/5 transition-all placeholder:text-slate-200 caret-slate-950 resize-none"
                                    />
                                </div>

                                <div className="flex justify-end mt-6">
                                    <button 
                                        disabled={loading}
                                        type="submit"
                                        className="px-8 py-4 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.15em] shadow-md shadow-[#8CC63F]/20 hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50"
                                    >
                                        <FiCheck size={16} strokeWidth={4} /> {loading ? "Procesando..." : "Finalizar Transacción"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-4 md:p-8 animate-fadeIn flex flex-col h-full min-h-0 bg-slate-50/50 overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6 max-w-4xl mx-auto w-full">
                        <div className="flex items-center gap-3">
                            <button 
                                type="button" 
                                onClick={() => { setView("list"); setSelectedPlan(null); }}
                                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest flex items-center gap-2"
                            >
                                &larr; Volver
                            </button>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                Registrar Saldo a Favor / Recibo de Caja
                            </h2>
                        </div>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-8 max-w-4xl mx-auto w-full space-y-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">
                                Información Básica del Recibo
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Monto */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Monto a recibir *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                                        <input 
                                            required
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={abonoInput === "" ? "" : Number(abonoInput).toLocaleString('es-CO')}
                                            onChange={(e) => handleAmountChangeForm(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-9 pr-4 text-base font-bold font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Medio de pago */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Medio de pago *</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: "Efectivo", icon: FiDollarSign },
                                            { id: "Tarjeta", icon: FiCreditCard },
                                            { id: "Transferencia", icon: FiSmartphone }
                                        ].map(m => {
                                            const isSel = method === m.id;
                                            return (
                                                <button 
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setMethod(m.id)}
                                                    className={`py-3 px-3 rounded-xl border text-xs font-bold uppercase transition-all flex flex-col items-center justify-center gap-1.5 ${
                                                        isSel 
                                                            ? 'bg-[#8CC63F] border-[#8CC63F] text-white shadow-md shadow-[#8CC63F]/20' 
                                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                                    }`}
                                                >
                                                    <m.icon size={16} />
                                                    <span className="text-[10px]">{m.id}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Concepto */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Concepto del pago</label>
                                    <select 
                                        value={concept}
                                        onChange={(e) => setConcept(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 uppercase cursor-pointer"
                                    >
                                        <option value="SALDO A FAVOR">Saldo a Favor</option>
                                        <option value="PAGO DE CONSULTA">Pago de Consulta</option>
                                        <option value="PAGO DE RADIOGRAFÍA">Pago de Radiografía</option>
                                    </select>
                                </div>

                                {/* Profesional */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Profesional responsable *</label>
                                    <select 
                                        value={profesionalId}
                                        onChange={(e) => {
                                            const pId = e.target.value;
                                            setProfesionalId(pId);
                                            const found = profesionales.find(p => p.id === pId);
                                            setProfesional(found ? found.nombre : "");
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 uppercase cursor-pointer"
                                    >
                                        <option value="">Seleccione profesional...</option>
                                        {profesionales.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Referencia si requiere */}
                                {requiresReference && (
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2">
                                            Número de Referencia / Comprobante *
                                        </label>
                                        <input 
                                            type="text"
                                            required
                                            placeholder="Ej: 0012345678..."
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            className="w-full bg-amber-50/60 border border-amber-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-400"
                                        />
                                    </div>
                                )}

                                {/* Observaciones */}
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Notas / Observaciones</label>
                                    <textarea 
                                        rows={3}
                                        placeholder="Detalles adicionales sobre el recibo de caja..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 custom-scrollbar"
                                    />
                                </div>
                            </div>

                            {/* Footer de la tarjeta */}
                            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                                    <FiBriefcase size={14} className="text-slate-400" />
                                    <span>Operador: <strong className="text-slate-700">{userProfile?.nombreCompleto || 'Sistema'}</strong></span>
                                </div>
                                <button 
                                    disabled={loading}
                                    type="submit"
                                    className="w-full sm:w-auto px-8 py-3 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <FiCheck size={16} strokeWidth={3} /> {loading ? "Procesando..." : "Finalizar Transacción"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
