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
                    {/* Compact Header Actions */}
                    <div className="flex-none px-6 py-2.5 flex justify-between items-center border-b border-slate-100 bg-white shadow-xs sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#8CC63F]/10 text-[#8CC63F] rounded-xl flex items-center justify-center">
                                <FiFileText size={16} />
                            </div>
                            <div>
                                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider leading-none">Planes & Presupuestos</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Propuestas económicas &middot; {patient?.nombreCompleto}</p>
                            </div>
                        </div>
                    </div>

                    {/* Content View */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
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
