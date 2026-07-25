import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { db } from '../../../firebase/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { 
    FiX, FiCalendar, FiUser, FiDollarSign, FiCreditCard, 
    FiMessageSquare, FiCheck, FiLoader, FiBriefcase
} from 'react-icons/fi';
import { formatCurrency } from '../../../utils/formatters';

export default function AddCreditModal({ isOpen, onClose, patient, onUpdate }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState(['Efectivo', 'Tarjeta', 'Transferencia']);
    
    const { register, handleSubmit, watch, formState: { errors }, reset, setValue } = useForm({
        defaultValues: {
            fecha: new Date().toISOString().split('T')[0],
            valor: "",
            valorDisplay: "", // Added for masking
            medio: "Efectivo",
            referencia: "",
            doctor: "",
            observaciones: ""
        }
    });

    const handleAmountChange = (e) => {
        const rawValue = e.target.value.replace(/\D/g, ''); // Solo números
        const numValue = Number(rawValue);
        
        if (rawValue === "") {
            setValue("valor", "");
            setValue("valorDisplay", "");
            return;
        }

        setValue("valor", numValue);
        setValue("valorDisplay", formatCurrency(numValue));
    };

    const METHODS_REQUIRING_REFERENCE = ["Transferencia", "Cheque", "Consignación", "Nequi", "Daviplata", "PSE"];
    const watchMedio = watch("medio");
    const requiresReference = METHODS_REQUIRING_REFERENCE.some(m => 
        watchMedio?.toLowerCase().includes(m.toLowerCase())
    );

    useEffect(() => {
        const loadModalData = async () => {
            if (!userProfile?.inquilino) return;
            try {
                // Load doctors from profesionales (checking patient assigned list first)
                if (patient?.profesionales && Array.isArray(patient.profesionales) && patient.profesionales.length > 0) {
                    setDoctors(patient.profesionales.map(p => ({
                        id: p.id,
                        nombre: p.nombreCompleto || p.nombre || ""
                    })));
                } else {
                    const q = query(
                        collection(db, "profesionales"),
                        where("inquilino", "==", userProfile.inquilino),
                        where("activo", "==", true)
                    );
                    const snap = await getDocs(q);
                    setDoctors(snap.docs.map(d => ({
                        id: d.id,
                        nombre: d.data().nombreCompleto || d.data().nombre || ""
                    })));
                }

                // Load active payment methods
                const qMetodos = query(
                    collection(db, "metodos_pago"),
                    where("inquilino", "==", userProfile.inquilino),
                    where("activo", "==", true)
                );
                const snapMetodos = await getDocs(qMetodos);
                if (!snapMetodos.empty) {
                    const metodosList = snapMetodos.docs
                        .map(d => d.data().nombre)
                        .filter(name => (name || "").toLowerCase() !== "saldo a favor");
                    
                    if (metodosList.length > 0) {
                        setPaymentMethods(metodosList);
                        setValue("medio", metodosList[0]);
                    } else {
                        setPaymentMethods(['Efectivo', 'Tarjeta', 'Transferencia']);
                        setValue("medio", "Efectivo");
                    }
                } else {
                    setPaymentMethods(['Efectivo', 'Tarjeta', 'Transferencia']);
                    setValue("medio", "Efectivo");
                }
            } catch (err) {
                console.error("Error loading credit modal data:", err);
            }
        };
        if (isOpen) loadModalData();
    }, [isOpen, userProfile?.inquilino, setValue]);

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            const derivePatientName = () => {
                return patient?.nombreCompleto || `${patient?.nombres || ""} ${patient?.apellidos || ""}`.trim() || "Paciente Desconocido";
            };

            const creditData = {
                patientId: patient?.id || "",
                patientNombre: derivePatientName(),
                monto: Number(data.valor) || 0,
                medio: data.medio || "Efectivo",
                referencia: data.referencia || null,
                concepto: "SALDO A FAVOR",
                profesional: data.doctor || userProfile?.nombreCompleto || "Sistema",
                notas: data.observaciones || "",
                fecha: serverTimestamp(),
                fechaISO: new Date(data.fecha).toISOString(),
                inquilino: userProfile?.inquilino || userProfile?.tenantId || "",
                registradoPor: userProfile?.nombreCompleto || "Sistema",
                estado: "Completado",
                createdAt: serverTimestamp()
            };

            if (!creditData.inquilino) {
                 throw new Error("ID de inquilino no encontrado. Verifique su sesión.");
            }

            await addDoc(collection(db, "pagos"), creditData);
            
            toast.success("Saldo a favor registrado exitosamente");
            onUpdate && onUpdate();
            reset();
            onClose();
        } catch (error) {
            console.error("Error saving credit:", error);
            toast.error("Error al registrar el saldo a favor");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl shadow-slate-900/20 overflow-hidden animate-zoomIn border border-slate-100 max-h-[90vh] flex flex-col">
                
                {/* Header Elite */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Adicionar saldo a favor</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Captura de ingresos adelantados para tratamientos</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm">
                        <FiX size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="space-y-10">
                        
                        {/* Section 1: Datos Generales */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black">1</div>
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Datos Generales</h4>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FiCalendar size={12} className="text-blue-500" /> Fecha *
                                    </label>
                                    <input 
                                        type="date"
                                        {...register("fecha", { required: true })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[13px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 transition-all caret-slate-950"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FiBriefcase size={12} className="text-blue-500" /> Doctor / Responsable
                                    </label>
                                    <select 
                                        {...register("doctor")}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[13px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 transition-all uppercase"
                                    >
                                        <option value="">Seleccione profesional...</option>
                                        {doctors.map(d => (
                                            <option key={d.id} value={d.nombre}>{d.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Datos de Pago */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black">2</div>
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Datos del Tercero & Valor</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FiUser size={12} className="text-emerald-500" /> Tercero (Paciente)
                                    </label>
                                    <input 
                                        readOnly
                                        disabled
                                        value={patient?.nombreCompleto || `${patient?.nombres || ""} ${patient?.apellidos || ""}`.trim() || "Paciente"}
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-[11px] font-black text-slate-400 outline-none cursor-not-allowed uppercase"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FiDollarSign size={12} className="text-emerald-500" /> Valor a Ingresar *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300">$</span>
                                        <input 
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            {...register("valorDisplay", { 
                                                required: "El monto es obligatorio",
                                                onChange: handleAmountChange
                                            })}
                                            className={"w-full bg-slate-50 border rounded-2xl p-4 pl-10 text-xl font-black text-slate-800 outline-none focus:bg-white focus:ring-4 transition-all caret-slate-950 " + (errors.valorDisplay ? 'border-rose-200 focus:ring-rose-500/5 focus:border-rose-400' : 'border-slate-100 focus:ring-emerald-500/5 focus:border-emerald-200')}
                                        />
                                        {/* Hidden numeric field for RHF submit */}
                                        <input type="hidden" {...register("valor")} />
                                    </div>
                                    {errors.valorDisplay && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1 ml-1">{errors.valorDisplay.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FiCreditCard size={12} className="text-emerald-500" /> Medio de Pago
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {paymentMethods.map(m => (
                                            <button 
                                                key={m}
                                                type="button"
                                                onClick={() => {
                                                    setValue("medio", m);
                                                    setValue("referencia", ""); // Reset reference when method changes
                                                }}
                                                className={`py-3 px-4 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all
                                                    ${watch("medio") === m 
                                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20 translate-y-[-2px]' 
                                                        : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {requiresReference && (
                                    <div className="space-y-2 animate-fadeIn">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            Número de Referencia / Comprobante *
                                        </label>
                                        <input 
                                            type="text"
                                            placeholder="EJ: 0012345678..."
                                            {...register("referencia", { required: requiresReference })}
                                            className={"w-full bg-amber-50 border rounded-2xl p-4 text-[13px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 transition-all caret-slate-950 " + (errors.referencia ? 'border-rose-200 focus:ring-rose-500/5 focus:border-rose-400' : 'border-amber-200 focus:ring-amber-500/5 focus:border-amber-300')}
                                        />
                                        {errors.referencia && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1 ml-1">La referencia es obligatoria</p>}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <FiMessageSquare size={12} className="text-slate-400" /> Observaciones
                                    </label>
                                    <textarea 
                                        {...register("observaciones")}
                                        placeholder="Escribe notas adicionales sobre este ingreso..."
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[13px] font-medium text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-500/5 focus:border-slate-200 transition-all h-24 resize-none placeholder:text-slate-200 caret-slate-950"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                    {/* Footer Actions */}
                    <div className="p-8 border-t border-slate-100 flex gap-4 shrink-0 bg-slate-50/50">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-3xl font-black text-[13px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="flex-[2] py-4 bg-emerald-500 text-white rounded-3xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? <FiLoader className="animate-spin" size={20} /> : <FiCheck size={20} strokeWidth={3} />}
                            {loading ? "Procesando..." : "Guardar saldo a favor"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
