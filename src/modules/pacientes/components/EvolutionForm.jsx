import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useToast } from '../../../context/ToastContext';
import { addEvolution } from '../../../services/evolutionService';

export default function EvolutionForm({ patientId, onSaved }) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().slice(0, 16), // dateTime-local format
        description: "",
        treatment: "",
        prognosis: "Favorable"
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.description.trim()) {
            toast.error("La descripción es obligatoria");
            return;
        }

        setLoading(true);
        try {
            await addEvolution({
                patientId,
                ...formData
            });
            toast.success("Evolución guardada exitosamente");
            setFormData({
                date: new Date().toISOString().slice(0, 16),
                description: "",
                treatment: "",
                prognosis: "Favorable"
            });
            if (onSaved) onSaved();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h4 className="text-lg font-bold text-slate-800 mb-4 font-display flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">📝</span>
                Nueva Nota de Evolución
            </h4>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Input
                            label="Fecha y Hora"
                            type="datetime-local"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            className="bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Pronóstico</label>
                        <select
                            name="prognosis"
                            value={formData.prognosis}
                            onChange={handleChange}
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        >
                            <option value="Favorable">Favorable</option>
                            <option value="Reservado">Reservado</option>
                            <option value="Desfavorable">Desfavorable</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (Subjetivo/Objetivo)</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Paciente refiere dolor en..."
                        className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-y transition"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tratamiento / Procedimiento Realizado</label>
                    <textarea
                        name="treatment"
                        value={formData.treatment}
                        onChange={handleChange}
                        placeholder="Se realiza profilaxis..."
                        className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-y transition"
                    />
                </div>

                {/* Force visible heavy button styling */}
                <div className="flex justify-end pt-4 border-t border-slate-100 mt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto text-sm uppercase tracking-wide"
                    >
                        {loading ? "Guardando..." : "Guardar Evolución"}
                    </button>
                </div>
            </form>
        </div>
    );
}
