import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FiSave, FiActivity } from 'react-icons/fi';
import { useToast } from '../../../context/ToastContext';
import { savePhysicalExam, getPhysicalExam } from '../../../services/clinicalService';
import Input from '../../../components/ui/Input';

export default function ExamenFisicoTab({ patientId }) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, reset } = useForm();

    useEffect(() => {
        if (!patientId) return;
        getPhysicalExam(patientId).then(data => {
            if (data) reset(data);
        });
    }, [patientId, reset]);

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            await savePhysicalExam(patientId, data);
            toast.success("Examen físico guardado");
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-fadeIn">

            {/* Vital Signs Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <FiActivity className="text-blue-500" /> Signos Vitales
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">P. Arterial (mm Hg)</label>
                        <Input {...register("presionArterial")} placeholder="120/80" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">F. Cardíaca (lpm)</label>
                        <Input {...register("frecuenciaCardiaca")} type="number" placeholder="70" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">F. Respiratoria (rpm)</label>
                        <Input {...register("frecuenciaRespiratoria")} type="number" placeholder="18" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Temperatura (°C)</label>
                        <Input {...register("temperatura")} type="number" step="0.1" placeholder="36.5" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Peso (kg)</label>
                        <Input {...register("peso")} type="number" step="0.1" placeholder="70" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Talla (cm)</label>
                        <Input {...register("talla")} type="number" placeholder="170" />
                    </div>
                </div>
            </div>

            {/* Intra/Extra Oral Exam */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">Examen Extra-Oral</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Cabeza y Cuello</label>
                            <textarea {...register("cabezaCuello")} className="w-full text-sm p-3 border border-slate-200 rounded-xl resize-none h-24 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="Simetría, ganglios, ATM..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Piel y Faneras</label>
                            <textarea {...register("pielFaneras")} className="w-full text-sm p-3 border border-slate-200 rounded-xl resize-none h-20 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="Lesiones, coloración..." />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">Examen Intra-Oral</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Tejidos Blandos</label>
                            <textarea {...register("tejidosBlandos")} className="w-full text-sm p-3 border border-slate-200 rounded-xl resize-none h-24 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="Lengua, carrillos, piso de boca..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Periodonto</label>
                            <textarea {...register("periodonto")} className="w-full text-sm p-3 border border-slate-200 rounded-xl resize-none h-20 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="Encías, bolsas, movilidad..." />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-70"
                >
                    <FiSave />
                    {loading ? "Guardando..." : "Guardar Examen"}
                </button>
            </div>

        </form>
    );
}
