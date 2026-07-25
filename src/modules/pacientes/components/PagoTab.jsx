import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
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
    const [profesional, setProfesional] = useState(userProfile?.nombreCompleto || "");
    const [profesionalId, setProfesionalId] = useState("");
    const [profesionales, setProfesionales] = useState([]);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadProfesionales = async () => {
            if (!userProfile?.inquilino) return;
            try {
                if (patient?.profesionales && Array.isArray(patient.profesionales) && patient.profesionales.length > 0) {
                    const list = patient.profesionales.map(p => ({
                        id: p.id,
                        nombre: p.nombreCompleto || p.nombre || ""
                    }));
                    setProfesionales(list);
                    
                    const matchesMe = list.find(p => p.nombre.toLowerCase() === (userProfile?.nombreCompleto || "").toLowerCase());
                    if (matchesMe) {
                        setProfesionalId(matchesMe.id);
                        setProfesional(matchesMe.nombre);
                    }
                    return;
                }

                const q = query(
                    collection(db, "profesionales"),
                    where("inquilino", "==", userProfile.inquilino)
                );
                const snap = await getDocs(q);
                const list = snap.docs.map(doc => ({
                    id: doc.id,
                    nombre: doc.data().nombreCompleto || doc.data().nombre || ""
                }));
                setProfesionales(list);
                
                const matchesMe = list.find(p => p.nombre.toLowerCase() === (userProfile?.nombreCompleto || "").toLowerCase());
                if (matchesMe) {
                    setProfesionalId(matchesMe.id);
                    setProfesional(matchesMe.nombre);
                }
            } catch (err) {
                console.error("Error loading profesionales in PagoTab:", err);
            }
        };
        loadProfesionales();
    }, [userProfile?.inquilino, userProfile?.nombreCompleto, patient?.profesionales]);

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
            const q = query(collection(db, "pagos"), where("patientId", "==", patient.id));
            const snap = await getDocs(q);
            const paymentsData = snap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(p => p.estado !== "Anulado");
            setPayments(paymentsData);

            // Load dynamic active payment methods from configuration
            if (userProfile?.inquilino) {
                const qMetodos = query(
                    collection(db, "metodos_pago"),
                    where("inquilino", "==", userProfile.inquilino),
                    where("activo", "==", true)
                );
                const snapMetodos = await getDocs(qMetodos);
                if (!snapMetodos.empty) {
                    const metodosList = snapMetodos.docs.map(d => d.data().nombre);
                    setPaymentMethods(metodosList);
                    if (metodosList.length > 0) {
                        setMethod(metodosList[0]);
                    }
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
    const totalCredits = payments.filter(p => p.concepto === "SALDO A FAVOR").reduce((sum, p) => sum + Number(p.monto || 0), 0);
    const usedCredits = payments.filter(p => p.medio === "Saldo a favor").reduce((sum, p) => sum + Number(p.monto || 0), 0);
    const availableCredit = Math.max(0, totalCredits - usedCredits);

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
            // 1. Fetch active Caja session for this user
            const cSnap = await getDocs(query(
                collection(db, "cajas"), 
                where("inquilino", "==", userProfile?.inquilino || "nop"),
                where("estado", "==", "abierta"),
                where("usuarioId", "==", userProfile?.uid)
            ));
            let activeCaja = null;
            if (!cSnap.empty) {
                activeCaja = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() };
            }

            // 2. If paid in cash, active cash session is strictly required
            if (method === "Efectivo" && !activeCaja) {
                setLoading(false);
                return toast.error("No tienes una caja abierta para registrar el pago en efectivo.");
            }

            const pagoData = {
                patientId: patient.id,
                patientNombre: patient.nombreCompleto,
                monto: paymentAmount,
                medio: method,
                referencia: reference || null,
                concepto: concept,
                profesional,
                profesionalId: profesionalId || null,
                profesionalNombre: profesional || null,
                notas: notes,
                fecha: serverTimestamp(),
                fechaISO: new Date().toISOString(),
                inquilino: userProfile?.inquilino || "",
                registradoPor: userProfile?.nombreCompleto || userProfile?.nombre || "Sistema",
                estado: "Completado",
                cajaId: activeCaja ? activeCaja.id : null
            };

            if (selectedPlan) {
                pagoData.planId = selectedPlan.id;
                pagoData.planTitle = selectedPlan.title || selectedPlan.nombre || "";

                // Distribute payment to items
                let remaining = paymentAmount;
                const itemPayments = [];

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
                pagoData.itemPayments = itemPayments;
            }

            // 2.5. Fetch and assign consecutive number (contReciboCaja)
            let nroConsecutivo = "";
            let consDocId = null;
            let consNextCount = 1;
            try {
                const qCons = query(
                    collection(db, "consecutivos"),
                    where("inquilino", "==", userProfile?.inquilino || "")
                );
                const snapCons = await getDocs(qCons);
                if (!snapCons.empty) {
                    const consDoc = snapCons.docs[0];
                    consDocId = consDoc.id;
                    const currentCount = parseInt(String(consDoc.data().contReciboCaja || 1), 10) || 1;
                    consNextCount = currentCount + 1;
                    nroConsecutivo = String(currentCount).padStart(2, '0');
                } else {
                    nroConsecutivo = "01";
                    consNextCount = 2;
                }
            } catch (consErr) {
                console.warn("No se pudo obtener el consecutivo:", consErr);
                nroConsecutivo = "";
            }

            if (nroConsecutivo) {
                pagoData.nroConsecutivo = nroConsecutivo;
            }

            // 3. Write payment doc
            const docRef = await addDoc(collection(db, "pagos"), pagoData);

            // 3.1. Increment consecutive counter (write plain number, not increment())
            if (consDocId) {
                try {
                    await updateDoc(doc(db, "consecutivos", consDocId), {
                        contReciboCaja: consNextCount
                    });
                } catch (incErr) {
                    console.warn("No se pudo actualizar el consecutivo:", incErr);
                }
            }
            
            // 4. Synchronize with active Caja session
            if (activeCaja) {
                const movData = {
                    inquilino: userProfile?.inquilino || "",
                    tipo: "ingreso",
                    concepto: concept || "Abono a tratamiento",
                    monto: paymentAmount,
                    metodoPago: method,
                    descripcion: `Abono de ${patient.nombreCompleto}. Plan: ${selectedPlan ? `"${selectedPlan.title || selectedPlan.nombre}"` : "General"}`,
                    pacienteId: patient.id,
                    pacienteNombre: patient.nombreCompleto,
                    pagoId: docRef.id,
                    usuarioId: userProfile?.uid,
                    usuarioNombre: userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email || "Sistema",
                    fecha: serverTimestamp(),
                };
                
                await addDoc(collection(db, "cajas", activeCaja.id, "movimientos"), movData);
                
                // Update balance and total ingresos of the active caja session
                await updateDoc(doc(db, "cajas", activeCaja.id), {
                    saldoActual: increment(paymentAmount),
                    totalIngresos: increment(paymentAmount)
                });
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

    const filteredPlans = plans.filter(p => {
        const paid = getPlanPayments(p.id);
        const total = Number(p.total || 0);
        const balance = total - paid;
        const matchesSearch = (p.title || p.nombre || "").toLowerCase().includes(searchTerm.toLowerCase());
        return balance > 0 && matchesSearch;
    });

    if (loadingData) {
        return <div className="p-10 text-center text-slate-400 font-bold animate-pulse">Cargando datos contables...</div>;
    }

    return (
        <div className="flex-1 p-6 md:p-10 animate-fadeIn bg-slate-50/20 custom-scrollbar overflow-y-auto">
            {view === "list" ? (
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-[#8CC63F] rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-[#8CC63F]/20">
                                <FiDollarSign size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase">Recibo de <span className="text-[#8CC63F] underline decoration-[#8CC63F]/20 decoration-8 underline-offset-4">caja</span></h2>
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                   <span>Listado de planes y abonos</span>
                                   <FiAlertCircle size={10} className="text-amber-500" />
                                   <span className="text-slate-500">Módulo contable activo</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleAddCredit}
                            className="px-6 py-4 bg-[#8CC63F] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 hover:bg-[#7bb335] transition-all flex items-center gap-2 active:scale-95"
                        >
                            <FiPlusCircle size={14} strokeWidth={3} /> Adicionar saldo a favor
                        </button>
                    </div>

                    {/* Search & Stats */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="relative w-full md:max-w-xs">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                placeholder="Buscar plan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-slate-200 transition-all"
                            />
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Total planes de tratamiento: <span className="text-slate-700 font-mono text-sm">{plans.length}</span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left table-auto">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-black text-slate-400 tracking-widest">
                                        <th className="px-6 py-4">Nombre</th>
                                        <th className="px-6 py-4">Sucursal</th>
                                        <th className="px-6 py-4 text-right">Costo total</th>
                                        <th className="px-6 py-4 text-right">Pagado</th>
                                        <th className="px-6 py-4 text-right">Saldo</th>
                                        <th className="px-6 py-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[12px] font-bold text-slate-600">
                                    {filteredPlans.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="p-12 text-center text-slate-400 uppercase tracking-widest text-[10px]">
                                                No hay planes de tratamiento registrados
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPlans.map(p => {
                                            const paid = getPlanPayments(p.id);
                                            const total = Number(p.total || 0);
                                            const balance = Math.max(0, total - paid);

                                            return (
                                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 font-black uppercase text-slate-700">
                                                        {p.title || p.nombre}
                                                    </td>
                                                    <td className="px-6 py-4 uppercase text-[10px] text-slate-400 font-black">
                                                        {userProfile?.tenant?.nombre || "Sede Principal"}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-slate-900 font-mono">
                                                        {formatCurrency(total)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-[#8CC63F] font-mono">
                                                        {formatCurrency(paid)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-rose-500 font-mono">
                                                        {formatCurrency(balance)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                         {balance <= 0 ? (
                                                             <span className="inline-flex items-center justify-center px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-wider leading-none shadow-sm">
                                                                 Pagado
                                                             </span>
                                                         ) : (
                                                             <button 
                                                                 onClick={() => handleSelectPlan(p)}
                                                                 className="p-2.5 bg-[#8CC63F] text-white rounded-xl hover:bg-[#7bb335] hover:scale-105 active:scale-95 transition-all shadow-md shadow-[#8CC63F]/10 flex items-center justify-center mx-auto"
                                                                 title="Registrar Pago"
                                                             >
                                                                 <FiCreditCard size={15} />
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
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                        <div className="flex items-center gap-5">
                            <button 
                                type="button"
                                onClick={() => { setView("list"); setSelectedPlan(null); }}
                                className="w-14 h-14 bg-slate-100 hover:bg-slate-200 rounded-[22px] flex items-center justify-center text-slate-500 transition-all active:scale-95 shadow-sm"
                            >
                                <FiArrowLeft size={24} />
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase">Registro de <span className="text-[#8CC63F] underline decoration-[#8CC63F]/20 decoration-8 underline-offset-4">Pago</span></h2>
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                   <span>Adicionar Saldo a Favor</span>
                                   <FiAlertCircle size={10} className="text-amber-500" />
                                   <span className="text-slate-500">Protocolo de caja activa</span>
                                </div>
                            </div>
                         </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Main Card */}
                        <div className="bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                            
                            <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-50">
                                
                                {/* Left: Amount Input (Heavy) */}
                                <div className="lg:col-span-2 p-10 bg-slate-50/30 flex flex-col justify-center items-center">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 block">Monto a Recibir</label>
                                    <div className="relative group">
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-black text-slate-200 group-focus-within:text-[#8CC63F] transition-colors leading-none">$</span>
                                        <input 
                                            required
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={abonoInput === "" ? "" : Number(abonoInput).toLocaleString('es-CO')}
                                            onChange={(e) => handleAmountChangeForm(e.target.value)}
                                            className="bg-transparent border-none p-0 pl-10 text-6xl font-black text-slate-800 tracking-tighter outline-none focus:ring-0 w-full placeholder:text-slate-100 placeholder:animate-pulse caret-slate-950"
                                        />
                                    </div>
                                    <div className="mt-8 flex flex-wrap justify-center gap-2">
                                         {[10000, 50000, 100000, 500000].map(val => (
                                             <button key={val} type="button" onClick={() => handleAmountChangeForm(val)} className="px-4 py-2 bg-white text-[10px] font-black text-slate-400 border border-slate-100 rounded-full hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                                 + {formatCurrency(val)}
                                             </button>
                                         ))}
                                    </div>
                                </div>

                                {/* Right: Selectors */}
                                <div className="lg:col-span-3 p-10 space-y-10">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block items-center gap-2 flex">
                                            <FiCreditCard className="text-[#8CC63F]" /> Medio de Pago
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: "Efectivo", icon: FiDollarSign },
                                                { id: "Tarjeta", icon: FiCreditCard },
                                                { id: "Transferencia", icon: FiSmartphone }
                                            ].map(m => (
                                                <button 
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setMethod(m.id)}
                                                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border transition-all duration-300
                                                        ${method === m.id ? 'bg-[#8CC63F] border-[#8CC63F] text-white shadow-xl shadow-[#8CC63F]/20 translate-y-[-4px]' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200'}`}
                                                >
                                                    <m.icon size={20} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{m.id}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Concepto del Pago</label>
                                            <select 
                                                value={concept}
                                                onChange={(e) => setConcept(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[11px] font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-[#8CC63F]/5 transition-all uppercase"
                                            >
                                        <option value="SALDO A FAVOR">Saldo a Favor</option>
                                                <option value="PAGO DE CONSULTA">Pago de Consulta</option>
                                                <option value="PAGO DE RADIOGRAFÍA">Pago de Radiografía</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Profesional / Responsable</label>
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
                                        {requiresReference && (
                                            <div className="md:col-span-2 animate-fadeIn">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                    Número de Referencia / Comprobante <span className="text-rose-500">*</span>
                                                </label>
                                                <input 
                                                    type="text"
                                                    required
                                                    placeholder="EJ: 0012345678..."
                                                    value={reference}
                                                    onChange={(e) => setReference(e.target.value)}
                                                    className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[11px] font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all placeholder:text-amber-300 caret-slate-950"
                                                />
                                            </div>
                                        )}
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Notas Adicionales / Referencia</label>
                                            <div className="relative">
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                                    <FiFileText size={16} />
                                                </div>
                                                <input 
                                                    placeholder="DETALLES DE LA TRANSACCIÓN..."
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pr-12 text-[11px] font-black text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-[#8CC63F]/5 transition-all placeholder:text-slate-200 caret-slate-950"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Guard */}
                            <div className="p-10 bg-slate-900 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 group">
                                 <div className="flex items-center gap-4 grayscale group-hover:grayscale-0 transition-all">
                                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/10">
                                           <FiBriefcase size={20} />
                                      </div>
                                      <div>
                                           <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] block mb-1">Operador de Caja</span>
                                           <span className="text-[11px] font-black text-white uppercase tracking-widest">{userProfile?.nombreCompleto || 'Cajero Sistema'}</span>
                                      </div>
                                 </div>
                                 
                                 <button 
                                    disabled={loading}
                                    type="submit"
                                    className="w-full md:w-auto px-12 py-5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-[24px] font-black text-[13px] uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(140,198,63,0.3)] transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50"
                                 >
                                    <FiCheck size={20} strokeWidth={3} /> {loading ? "Procesando..." : "Finalizar Transacción"}
                                 </button>
                            </div>
                        </div>

                        <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Esta transacción genera un registro de auditoría inmutable en el libro contable de OdontoCloud</p>
                    </form>
                </div>
            )}
        </div>
    );
}
