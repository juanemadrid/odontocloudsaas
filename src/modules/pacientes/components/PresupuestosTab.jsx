import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import PlanList from './PlanList';
import PlanEditor from './PlanEditor';
import { FiPlus, FiFileText, FiArrowRight } from "react-icons/fi";

export default function PresupuestosTab({ patient: dbPatient }) {
    const { watch } = useFormContext();
    // Mode: 'list' | 'create' | 'edit'
    const [mode, setMode] = useState('list');
    const [editingPlan, setEditingPlan] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Merge DB patient with LIVE form data to ensure PDF has the latest name/doc
    const patient = {
        ...dbPatient,
        nombreCompleto: watch("nombreCompleto") || dbPatient?.nombreCompleto,
        nroDocumento: watch("nroDocumento") || dbPatient?.nroDocumento,
        celular: watch("celular") || dbPatient?.celular,
        email: watch("email") || dbPatient?.email
    };

    const handleSaved = () => {
        setMode('list');
        setEditingPlan(null);
        setRefreshKey(prev => prev + 1);
    };

    const handleNew = () => {
        // NOTE: PlanList calls setEditingPlan({...}) before calling onNew(),
        // so we must NOT reset editingPlan here.
        setMode('create');
    };

    const handleEdit = (plan) => {
        setEditingPlan(plan);
        setMode('edit');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/20 animate-fadeIn min-h-0 relative overflow-hidden">
            {mode === 'list' ? (
                <>
                    {/* Elite Header Actions */}
                    <div className="flex-none p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-100 bg-white/40 backdrop-blur-md sticky top-0 z-20">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                                <FiFileText size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase">Planes & <span className="text-indigo-600 underline decoration-indigo-100 decoration-8 underline-offset-4">Presupuestos</span></h2>
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                   <span>Propuestas económicas para el paciente</span>
                                   <FiArrowRight size={10} className="text-slate-200" />
                                   <span className="text-slate-500">{patient?.nombreCompleto}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content View */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
                        <PlanList
                            patient={patient}
                            refreshKey={refreshKey}
                            onEdit={handleEdit}
                            onNew={handleNew}
                            setEditingPlan={setEditingPlan}
                        />
                    </div>
                </>
            ) : (
                <PlanEditor
                    patient={patient}
                    initialData={editingPlan}
                    onClose={() => { 
                        setMode('list'); 
                        setEditingPlan(null); 
                        setRefreshKey(prev => prev + 1);
                    }}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
