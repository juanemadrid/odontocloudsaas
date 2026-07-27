import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import supabase from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useForm } from 'react-hook-form';

export default function RemissionModal({ isOpen, onClose, patient, initialData = null }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    
    const [saving, setSaving] = useState(false);
    const [allDoctors, setAllDoctors] = useState([]);
    const [patientDoctors, setPatientDoctors] = useState([]);

    const getLocalISOStrings = () => {
        const d = new Date();
        const tzoffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString();
        const localDate = localISOTime.slice(0, 10);
        const localTime = localISOTime.slice(11, 16);
        return { localDate, localTime };
    };

    const { localDate, localTime } = getLocalISOStrings();

    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
        defaultValues: {
            doctorId: '',
            doctorQuienRecibeId: '',
            fecha: localDate,
            horaInicio: localTime,
            comentario: '',
        }
    });

    const watchDoctorId = watch("doctorId");
    const watchComentario = watch("comentario");

    useEffect(() => {
        if (!isOpen) {
            reset({
                doctorId: '',
                doctorQuienRecibeId: '',
                fecha: localDate,
                horaInicio: localTime,
                comentario: '',
            });
            return;
        }

        if (initialData) {
            const safeDate = initialData.date?.toDate ? initialData.date.toDate() : new Date(initialData.date || Date.now());
            const tzoffset = safeDate.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(safeDate.getTime() - tzoffset)).toISOString();
            reset({
                ...initialData,
                fecha: localISOTime.slice(0, 10),
                horaInicio: localISOTime.slice(11, 16)
            });
        }
    }, [isOpen, initialData, reset]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchDoctors = async () => {
            try {
                const { data: profData } = await supabase
                    .from("profesionales")
                    .select("*")
                    .eq("tenant_id", userProfile?.inquilino || userProfile?.tenantId)
                    .eq("activo", true);
                const docs = (profData || []).map(d => ({
                    id: d.id,
                    nombreCompleto: d.nombre_completo || d.nombre || "",
                    ...d
                }));
                setAllDoctors(docs);
                
                // Patient assigned doctors for the sender field
                if (patient?.profesionales && Array.isArray(patient.profesionales) && patient.profesionales.length > 0) {
                    setPatientDoctors(patient.profesionales);
                } else {
                    setPatientDoctors(docs);
                }
            } catch (err) {
                console.error("Error fetching dependencies", err);
            }
        };

        fetchDoctors();
    }, [isOpen, userProfile]);

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            if (!patient?.id) throw new Error("Paciente no identificado");
            const isEditing = !!initialData;
            
            const docObj = patientDoctors.find(d => d.id === data.doctorId);
            const docName = docObj ? `${docObj.nombre || docObj.nombres || ''} ${docObj.apellido || docObj.apellidos || ''}`.trim() : "Doctor Remitente";

            const recvObj = allDoctors.find(d => d.id === data.doctorQuienRecibeId);
            const recvName = recvObj ? `${recvObj.nombre || recvObj.nombres || ''} ${recvObj.apellido || recvObj.apellidos || ''}`.trim() : "Doctor Receptor";

            // Robust date construction
            let finalDate = new Date(`${data.fecha}T00:00:00`);
            if (data.horaInicio) {
                const [h, m] = data.horaInicio.split(':');
                if (h && m) {
                    finalDate.setHours(parseInt(h), parseInt(m));
                }
            } else {
                finalDate.setHours(12, 0);
            }

            const remissionData = {
                type: 'remission',
                paciente_id: patient.id,
                patientId: patient.id,
                patientName: patient.nombreCompleto || patient.nombre || "Paciente",
                profesional: docName,
                profesionalId: data.doctorId,
                doctorQuienRecibeId: data.doctorQuienRecibeId,
                doctorQuienRecibeName: recvName,
                description: data.comentario, 
                ...data,
                date: finalDate, 
                tenant_id: userProfile?.inquilino || userProfile?.tenantId || "",
                inquilino: userProfile?.inquilino || userProfile?.tenantId || "",
                updated_at: new Date().toISOString(),
                registeredBy: userProfile?.uid || "",
            };

            if (isEditing) {
                const { error: updateError } = await supabase
                    .from("evoluciones")
                    .update(remissionData)
                    .eq("id", initialData.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from("evoluciones")
                    .insert([{
                        ...remissionData,
                        created_at: new Date().toISOString()
                    }]);
                if (insertError) throw insertError;
            }

            toast.success(isEditing ? "Remisión actualizada" : "Remisión registrada correctamente");
            onClose();
        } catch (error) {
            console.error("Error saving remission:", error);
            toast.error("Error al guardar la remisión");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header Simple Style */}
                <div className="flex border-b border-slate-100/60 sticky top-0 bg-white z-10 shrink-0 h-14 justify-between items-center px-6">
                    <span className="font-black text-slate-500 uppercase tracking-widest text-xs">Remitir</span>
                    <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-rose-500">
                        <FiX size={20} />
                    </button>
                </div>
                
                {/* Body Form */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col md:flex-row gap-8">
                    
                    {/* COLUMNA IZQUIERDA */}
                    <div className="flex-1 space-y-5">
                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Seleccione doctor <span className="text-rose-500">*</span>
                            </label>
                            <select 
                                {...register("doctorId", { required: true })} 
                                className={`w-full h-11 px-3 rounded-lg border text-sm font-bold bg-white outline-none transition-all ${errors.doctorId ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-200 focus:border-blue-400 text-slate-700'}`}
                            >
                                <option value="">Seleccione...</option>
                                {patientDoctors.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {`${d.nombre || d.nombres || ''} ${d.apellido || d.apellidos || ''}`.trim() || d.nombreCompleto}
                                    </option>
                                ))}
                            </select>
                            {errors.doctorId && <p className="text-[10px] font-black text-rose-500 uppercase mt-1">Requerido</p>}
                        </div>

                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Doctor quien recibe
                            </label>
                            <select 
                                {...register("doctorQuienRecibeId")} 
                                className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                            >
                                <option value="">Seleccione...</option>
                                {allDoctors.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {`${d.nombre || d.nombres || ''} ${d.apellido || d.apellidos || ''}`.trim() || d.nombreCompleto}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA */}
                    <div className="flex-1 space-y-5 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8 flex flex-col">
                        
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Fecha <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="date"
                                    {...register("fecha")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 caret-slate-950"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Hora inicio
                                </label>
                                <input 
                                    type="time"
                                    {...register("horaInicio")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 caret-slate-950"
                                />
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col min-h-[150px]">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Comentario <span className="text-rose-500">*</span>
                            </label>
                            <textarea 
                                {...register("comentario", { required: true })} 
                                className={`w-full flex-1 p-4 rounded-xl border text-sm font-bold bg-white outline-none custom-scrollbar resize-none transition-all caret-slate-950 ${errors.comentario ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-200 focus:border-blue-400 text-slate-700'}`}
                                placeholder="Escribe el motivo de la remisión..."
                            />
                            {errors.comentario && <p className="text-[10px] font-black text-rose-500 uppercase mt-1">Requerido</p>}
                        </div>
                    </div>
                </div>

                {/* Footer Fixed */}
                <div className="p-6 border-t border-slate-100/60 bg-white shrink-0 flex justify-end gap-6 items-center">
                    <button type="button" onClick={onClose} disabled={saving} className="font-black text-[12px] uppercase tracking-widest text-[#4aa5c8] hover:text-[#3285a3] transition-colors">
                        Cerrar
                    </button>
                    <button 
                        type="button"
                        onClick={handleSubmit(onSubmit)} 
                        disabled={saving} 
                        className="px-10 py-3 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-[12px] font-black text-[13px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-lime-500/20"
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
