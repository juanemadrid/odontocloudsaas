import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import supabase from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { 
    FiX, FiCalendar, FiUser, FiDollarSign, FiCreditCard, 
    FiMessageSquare, FiCheck, FiLoader, FiBriefcase, FiPlusCircle
} from 'react-icons/fi';
import { formatCurrency } from '../../../utils/formatters';
import { isDoctorUser } from '../../../utils/doctorHelpers';

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
            valorDisplay: "",
            medio: "Efectivo",
            referencia: "",
            doctor: "",
            observaciones: ""
        }
    });

    const handleAmountChange = (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numValue = Number(rawValue);
        
        if (rawValue === "") {
            setValue("valor", "");
            setValue("valorDisplay", "");
            return;
        }

        setValue("valor", numValue);
        setValue("valorDisplay", formatCurrency(numValue));
    };

    const setQuickAmount = (amount) => {
        const currentVal = Number(watch("valor")) || 0;
        const newVal = currentVal + amount;
        setValue("valor", newVal);
        setValue("valorDisplay", formatCurrency(newVal));
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
                try {
                    const { data: docsData } = await supabase
                        .from("profiles")
                        .select("id, full_name, role")
                        .eq("tenant_id", userProfile.inquilino)
                        .eq("activo", true);
                    
                    setDoctors((docsData || []).filter(d => isDoctorUser(d)).map(d => ({
                        id: d.id,
                        nombre: d.full_name || d.nombre || "",
                        role: d.role
                    })));
                } catch (e) {
                    console.warn("No se pudieron cargar profesionales:", e.message);
                }

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
                    .map(m => m.nombre || m)
                    .filter(name => (name || "").toLowerCase() !== "saldo a favor");
                
                if (metodosList.length > 0) {
                    setPaymentMethods(metodosList);
                    setValue("medio", metodosList[0]);
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
            const now = new Date().toISOString();

            const creditData = {
                tenant_id: userProfile?.inquilino || "",
                fecha: new Date(data.fecha).toISOString(),
                paciente_id: patient?.id || "",
                monto: Number(data.valor) || 0,
                metodo: data.medio || "Efectivo",
                referencia: data.referencia ? `SALDO A FAVOR - Ref: ${data.referencia}` : "SALDO A FAVOR",
                notas: data.observaciones ? `SALDO A FAVOR - ${data.observaciones}` : "SALDO A FAVOR",
                created_at: now
            };

            if (!creditData.tenant_id) {
                throw new Error("ID de inquilino no encontrado. Verifique su sesión.");
            }
            if (!creditData.monto || creditData.monto <= 0) {
                throw new Error("El valor debe ser mayor que 0.");
            }

            const { error: insertError } = await supabase.from("pagos").insert([creditData]);
            if (insertError) throw insertError;

            try {
                const { data: pac } = await supabase
                    .from("pacientes")
                    .select("id, saldo_favor")
                    .eq("id", patient.id)
                    .single();
                if (pac) {
                    const nuevoSaldo = Number(pac.saldo_favor || 0) + creditData.monto;
                    await supabase
                        .from("pacientes")
                        .update({ saldo_favor: nuevoSaldo })
                        .eq("id", patient.id);
                }
            } catch (e) {
                console.warn("No se pudo actualizar saldo_favor en paciente:", e.message);
            }

            toast.success("Saldo a favor registrado exitosamente");
            onUpdate && onUpdate();
            reset();
            onClose();
        } catch (error) {
            console.error("Error saving credit:", error);
            toast.error(error.message || "Error al registrar el saldo a favor");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-fadeIn" onClick={onClose} />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-zoomIn border border-slate-100 max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#8CC63F]/10 text-[#8CC63F] flex items-center justify-center">
                            <FiPlusCircle size={18} />
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Adicionar Saldo a Favor</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Recibo de caja / Ingreso adelantado</p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="w-8 h-8 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-200 transition-all shadow-xs"
                    >
                        <FiX size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
                        
                        {/* Section 1: Datos de Registro */}
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1.5">
                                <FiCalendar size={12} className="text-[#8CC63F]" /> Información de Registro
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Fecha *
                                    </label>
                                    <input 
                                        type="date"
                                        {...register("fecha", { required: true })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#8CC63F] focus:ring-2 focus:ring-[#8CC63F]/20 transition-all"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Doctor / Responsable
                                    </label>
                                    <select 
                                        {...register("doctor")}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#8CC63F] focus:ring-2 focus:ring-[#8CC63F]/20 transition-all uppercase cursor-pointer"
                                    >
                                        <option value="">Seleccione profesional...</option>
                                        {doctors.map(d => (
                                            <option key={d.id} value={d.nombre}>{d.nombre.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Paciente & Monto */}
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1.5">
                                <FiUser size={12} className="text-[#8CC63F]" /> Paciente & Valor
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Paciente
                                    </label>
                                    <input 
                                        readOnly
                                        disabled
                                        value={patient?.nombreCompleto || `${patient?.nombres || ""} ${patient?.apellidos || ""}`.trim() || "Paciente"}
                                        className="w-full bg-slate-100/70 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-500 uppercase cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Monto a Ingresar *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">$</span>
                                        <input 
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            {...register("valorDisplay", { 
                                                required: "El monto es obligatorio",
                                                onChange: handleAmountChange
                                            })}
                                            className={"w-full bg-slate-50 border rounded-xl py-2.5 pl-8 pr-3.5 text-xs font-bold font-mono text-slate-800 outline-none focus:bg-white focus:ring-2 transition-all " + (errors.valorDisplay ? 'border-rose-300 focus:ring-rose-500/20' : 'border-slate-200 focus:border-[#8CC63F] focus:ring-[#8CC63F]/20')}
                                        />
                                        <input type="hidden" {...register("valor")} />
                                    </div>
                                    {errors.valorDisplay && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1">{errors.valorDisplay.message}</p>}
                                </div>
                            </div>

                            {/* Medio de Pago */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Medio de Pago *
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {paymentMethods.map(m => {
                                        const isSelected = watch("medio") === m;
                                        return (
                                            <button 
                                                key={m}
                                                type="button"
                                                onClick={() => {
                                                    setValue("medio", m);
                                                    setValue("referencia", "");
                                                }}
                                                className={`py-2 px-3 rounded-xl border text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                                                    isSelected 
                                                        ? 'bg-[#8CC63F] border-[#8CC63F] text-white shadow-md shadow-[#8CC63F]/20' 
                                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                                }`}
                                            >
                                                <span>{m}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Referencia opcional/requerida */}
                            {requiresReference && (
                                <div className="mt-3 space-y-1 animate-fadeIn">
                                    <label className="block text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                                        Número de Referencia / Comprobante *
                                    </label>
                                    <input 
                                        type="text"
                                        placeholder="EJ: 0012345678..."
                                        {...register("referencia", { required: requiresReference })}
                                        className={"w-full bg-amber-50/60 border rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 transition-all " + (errors.referencia ? 'border-rose-300 focus:ring-rose-500/20' : 'border-amber-200 focus:border-amber-400 focus:ring-amber-500/20')}
                                    />
                                    {errors.referencia && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1">La referencia es obligatoria</p>}
                                </div>
                            )}

                            {/* Observaciones */}
                            <div className="mt-3">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Notas / Observaciones
                                </label>
                                <textarea 
                                    rows={2}
                                    {...register("observaciones")}
                                    placeholder="Notas adicionales sobre este ingreso..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#8CC63F] focus:ring-2 focus:ring-[#8CC63F]/20 transition-all custom-scrollbar resize-none"
                                />
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50 shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            <FiBriefcase size={13} className="text-slate-400" />
                            <span>Operador: <strong className="text-slate-600">{userProfile?.nombreCompleto || 'Sistema'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button 
                                type="button"
                                onClick={onClose}
                                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full font-black text-[11px] uppercase tracking-wider transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                disabled={loading}
                                className="flex-1 sm:flex-initial px-5 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-wider shadow-lg shadow-[#8CC63F]/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                {loading ? <FiLoader className="animate-spin" size={14} /> : <FiCheck size={14} strokeWidth={3} />}
                                {loading ? "Guardando..." : "Guardar Saldo a Favor"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
