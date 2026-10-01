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
import { getConfigSection } from '../../../services/configPersistenceService';

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

                const rawMetodos = await getConfigSection(userProfile.inquilino, "metodos_pago", [
                    { id: "1", nombre: "Efectivo", activo: true },
                    { id: "2", nombre: "Tarjeta", activo: true },
                    { id: "3", nombre: "Transferencia", activo: true }
                ]);

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
            const currentUserName = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "Administración";
            const referenceStr = data.referencia ? String(data.referencia).trim() : "";
            const observationsStr = data.observaciones ? String(data.observaciones).trim() : "";
            const currentInq = userProfile?.inquilino || patient?.inquilino || patient?.tenant_id || "";

            let nroConsecutivo = null;
            try {
                const { consumeNextConsecutivo, CONSECUTIVO_TYPES } = await import("../../../services/consecutivosService");
                nroConsecutivo = await consumeNextConsecutivo(currentInq, CONSECUTIVO_TYPES.RECIBO_CAJA);
            } catch (consErr) {
                console.warn("No se pudo obtener el consecutivo de recibo de caja:", consErr);
            }

            const notesPayload = JSON.stringify({
                concepto: "SALDO A FAVOR",
                referencia: referenceStr,
                observaciones: observationsStr,
                notas: observationsStr || (referenceStr ? `Ref: ${referenceStr}` : "SALDO A FAVOR"),
                nroConsecutivo: nroConsecutivo ? String(nroConsecutivo) : "",
                registradoPor: currentUserName,
                usuarioNombre: currentUserName,
                doctor: data.doctor || "",
                medio: data.medio || "Efectivo"
            });

            const creditData = {
                tenant_id: currentInq,
                fecha: new Date(data.fecha).toISOString(),
                paciente_id: patient?.id || "",
                monto: Number(data.valor) || 0,
                metodo: data.medio || "Efectivo",
                referencia: referenceStr ? `SALDO A FAVOR - Ref: ${referenceStr}` : "SALDO A FAVOR",
                nro_consecutivo: nroConsecutivo ? String(nroConsecutivo) : null,
                notas: notesPayload,
                created_at: new Date().toISOString()
            };

            if (!creditData.tenant_id) {
                throw new Error("ID de inquilino no encontrado. Verifique su sesión.");
            }
            if (!creditData.monto || creditData.monto <= 0) {
                throw new Error("El valor debe ser mayor que 0.");
            }

            const { error: insertError } = await supabase.from("pagos").insert([creditData]);
            if (insertError) throw insertError;

            // 1. Sincronizar saldo_favor en paciente
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
                    if (patient) {
                        patient.saldo_favor = nuevoSaldo;
                        patient.saldoFavor = nuevoSaldo;
                    }
                }
            } catch (e) {
                console.warn("No se pudo actualizar saldo_favor en paciente:", e.message);
            }

            // 2. Registrar en recibos_caja formalmente para Facturación -> Recibos de Caja
            const patientName = patient?.nombreCompleto || `${patient?.nombres || patient?.nombre || ""} ${patient?.apellidos || patient?.apellido || ""}`.trim() || "Paciente";
            const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ""));
            const finalConsStr = nroConsecutivo ? String(nroConsecutivo).padStart(4, "0") : null;
            const newReciboId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : null;

            let activeCajaObj = null;
            let validCajaId = null;
            try {
                const { getActiveCaja } = await import("../../../services/supabaseServices");
                const uId = userProfile?.uid || userProfile?.id || "";
                activeCajaObj = await getActiveCaja(currentInq, uId);
                if (activeCajaObj?.id && isUUID(activeCajaObj.id)) {
                    validCajaId = activeCajaObj.id;
                }
            } catch (cErr) {
                console.warn("Aviso al obtener caja activa en AddCreditModal:", cErr);
            }

            try {
                const reciboPayload = {
                    id: newReciboId,
                    tenant_id: currentInq,
                    inquilino: currentInq,
                    numero: finalConsStr,
                    nro_consecutivo: finalConsStr,
                    nroConsecutivo: finalConsStr,
                    fecha: new Date(data.fecha).toISOString(),
                    paciente_id: isUUID(patient?.id) ? patient.id : null,
                    pacienteId: isUUID(patient?.id) ? patient.id : null,
                    paciente_nombre: patientName,
                    pacienteNombre: patientName,
                    condicion_pago: "Contado",
                    condicionPago: "Contado",
                    medio_pago: data.medio || "Efectivo",
                    medioPago: data.medio || "Efectivo",
                    concepto: "SALDO A FAVOR",
                    conceptos: [{ concepto: "SALDO A FAVOR", precioUnitario: creditData.monto, cantidad: 1, total: creditData.monto }],
                    monto: creditData.monto,
                    subtotal: creditData.monto,
                    total: creditData.monto,
                    observaciones: observationsStr ? `SALDO A FAVOR - ${observationsStr}` : "Abono Saldo a Favor",
                    caja_id: validCajaId,
                    cajaId: validCajaId,
                    creado_por: currentUserName,
                    creadoPor: currentUserName,
                    created_at: new Date().toISOString()
                };
                if (!reciboPayload.id) delete reciboPayload.id;
                await supabase.from("recibos_caja").insert([reciboPayload]);
            } catch (rErr) {
                console.warn("Aviso insertando en recibos_caja:", rErr);
            }

            // 3. Registrar en Caja activa y movimientos_caja (Administración / Caja)
            if (activeCajaObj) {
                try {
                    const movData = {
                        id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `mov_${Date.now()}`,
                        tenant_id: currentInq,
                        tipo: "ingreso",
                        concepto: nroConsecutivo ? `[RC-${String(nroConsecutivo).padStart(4, "0")}] Saldo a favor` : "Abono Saldo a Favor",
                        monto: creditData.monto,
                        metodo_pago: data.medio || "Efectivo",
                        descripcion: `Saldo a favor para ${patientName}${referenceStr ? ' | Ref: ' + referenceStr : ''}`,
                        paciente_id: isUUID(patient?.id) ? patient.id : null,
                        paciente_nombre: patientName,
                        usuario_id: isUUID(userProfile?.uid || userProfile?.id) ? (userProfile?.uid || userProfile?.id) : null,
                        caja_id: validCajaId,
                        created_at: new Date().toISOString()
                    };
                    await supabase.from("movimientos_caja").insert([movData]);

                    if (validCajaId) {
                        const currentSaldo = Number(activeCajaObj.saldo_actual ?? activeCajaObj.saldoActual ?? 0);
                        const currentIngresos = Number(activeCajaObj.total_ingresos ?? activeCajaObj.totalIngresos ?? 0);
                        await supabase
                            .from("cajas")
                            .update({
                                saldo_actual: currentSaldo + creditData.monto,
                                total_ingresos: currentIngresos + creditData.monto,
                                updated_at: new Date().toISOString()
                            })
                            .eq("id", validCajaId);
                    }
                } catch (movErr) {
                    console.warn("Aviso al registrar movimiento en caja activa:", movErr);
                }
            }

            // 4. Sincronizar website_config como respaldo (pagos y saldos_favor)
            try {
                const { saveConfigSection } = await import("../../../services/configPersistenceService");
                const currentPagos = await getConfigSection(currentInq, "pagos", []);
                const currentSaldos = await getConfigSection(currentInq, "saldos_favor", []);
                const updatedPagos = [creditData, ...(Array.isArray(currentPagos) ? currentPagos.filter(p => p.id !== creditData.id) : [])];
                const updatedSaldos = [creditData, ...(Array.isArray(currentSaldos) ? currentSaldos.filter(s => s.id !== creditData.id) : [])];
                await saveConfigSection(currentInq, "pagos", updatedPagos);
                await saveConfigSection(currentInq, "saldos_favor", updatedSaldos);
            } catch (cfgErr) {
                console.warn("Aviso respaldando en website_config:", cfgErr);
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
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-zoomIn border border-slate-200/80 max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <FiDollarSign size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Adicionar Saldo a Favor</h3>
                            <p className="text-xs text-slate-500">Recibo de caja / Ingreso adelantado</p>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
                    >
                        <FiX size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
                        
                        {/* Section 1: Datos de Registro */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                                <FiCalendar size={13} className="text-blue-600" /> Información de Registro
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Fecha *
                                    </label>
                                    <input 
                                        type="date"
                                        {...register("fecha", { required: true })}
                                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-xs"
                                        max="9999-12-31" 
                                        min="1900-01-01" 
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Doctor / Responsable
                                    </label>
                                    <select 
                                        {...register("doctor")}
                                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all uppercase cursor-pointer shadow-xs"
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
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                                <FiUser size={13} className="text-blue-600" /> Paciente & Valor
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Paciente
                                    </label>
                                    <input 
                                        readOnly
                                        disabled
                                        value={patient?.nombreCompleto || `${patient?.nombres || ""} ${patient?.apellidos || ""}`.trim() || "Paciente"}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium text-slate-500 uppercase cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Monto a Ingresar *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                                        <input 
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            {...register("valorDisplay", { 
                                                required: "El monto es obligatorio",
                                                onChange: handleAmountChange
                                            })}
                                            className={"w-full bg-white border rounded-xl py-2 pl-7 pr-3 text-xs font-bold font-mono text-slate-800 outline-none focus:ring-4 transition-all shadow-xs " + (errors.valorDisplay ? 'border-rose-300 focus:ring-rose-500/20' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10')}
                                        />
                                        <input type="hidden" {...register("valor")} />
                                    </div>
                                    {errors.valorDisplay && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1">{errors.valorDisplay.message}</p>}
                                </div>
                            </div>

                            {/* Medio de Pago */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                                                className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                                    isSelected 
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' 
                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
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
                                    <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider">
                                        Número de Referencia / Comprobante *
                                    </label>
                                    <input 
                                        type="text"
                                        placeholder="EJ: 0012345678..."
                                        {...register("referencia", { required: requiresReference })}
                                        className={"w-full bg-amber-50/60 border rounded-xl py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:ring-4 transition-all " + (errors.referencia ? 'border-rose-300 focus:ring-rose-500/20' : 'border-amber-200 focus:border-amber-400 focus:ring-amber-500/10')}
                                    />
                                    {errors.referencia && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1">La referencia es obligatoria</p>}
                                </div>
                            )}

                            {/* Observaciones */}
                            <div className="mt-3">
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Notas / Observaciones
                                </label>
                                <textarea 
                                    rows={2}
                                    {...register("observaciones")}
                                    placeholder="Notas adicionales sobre este ingreso..."
                                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all custom-scrollbar resize-none shadow-xs"
                                />
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/70 shrink-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                            <FiBriefcase size={14} className="text-slate-400" />
                            <span>Operador: <strong className="text-slate-700 font-bold">{userProfile?.nombreCompleto || 'Sistema'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button 
                                type="button"
                                onClick={onClose}
                                className="flex-1 sm:flex-initial px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-xs"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                disabled={loading}
                                className="flex-1 sm:flex-initial px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {loading ? <FiLoader className="animate-spin" size={14} /> : <FiCheck size={14} strokeWidth={2.5} />}
                                {loading ? "Guardando..." : "Guardar Saldo a Favor"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
