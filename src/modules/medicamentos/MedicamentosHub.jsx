import React, { useState } from "react";
import { FiPlusSquare, FiBriefcase } from "react-icons/fi";
import MedicamentosList from "./components/MedicamentosList";
import MedicamentoForm from "./components/MedicamentoForm";
import PlanesFormulacionList from "./components/PlanesFormulacionList";
import PlanFormulacionForm from "./components/PlanFormulacionForm";

export default function MedicamentosHub() {
    const [subTab, setSubTab] = useState("medicamentos"); // "medicamentos" o "planes"
    const [viewMode, setViewMode] = useState("list"); // "list" o "form"
    const [selectedId, setSelectedId] = useState(null);

    const handleNew = () => {
        setSelectedId(null);
        setViewMode("form");
    };

    const handleEdit = (id) => {
        setSelectedId(id);
        setViewMode("form");
    };

    const handleCancel = () => {
        setSelectedId(null);
        setViewMode("list");
    };

    const handleSuccess = () => {
        setSelectedId(null);
        setViewMode("list");
    };

    return (
        <div className="flex h-full w-full bg-slate-50/10 gap-6 animate-in fade-in duration-500">
            {/* Left side Sub-navigation menu */}
            <div className="w-64 bg-white rounded-[28px] border border-slate-100 p-4 flex flex-col shrink-0 shadow-sm h-fit space-y-4">
                <div className="px-3 py-2 border-b border-slate-50 flex items-center gap-2">
                    <FiPlusSquare className="text-blue-600" size={16} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Información general
                    </span>
                </div>
                <div className="space-y-1">
                    {/* Medicamentos option */}
                    <div className="relative group">
                        <button
                            onClick={() => {
                                setSubTab("medicamentos");
                                setViewMode("list");
                                setSelectedId(null);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-wider ${
                                subTab === "medicamentos"
                                    ? "bg-blue-50 text-blue-600 font-black border-l-4 border-blue-600 pl-3"
                                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 font-bold"
                            }`}
                        >
                            Medicamentos
                        </button>
                        {/* Hover Tooltip */}
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-64 bg-slate-800 text-white text-[10px] font-semibold p-3 rounded-xl shadow-xl border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 leading-relaxed">
                            Desde acá se podrán crear los medicamentos para usarlos ya sea como parte de una receta o como un plan de medicamento que podrá ser usado.
                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-r-4 border-r-slate-800 border-b-4 border-b-transparent" />
                        </div>
                    </div>

                    {/* Planes de formulación option */}
                    <div className="relative group">
                        <button
                            onClick={() => {
                                setSubTab("planes");
                                setViewMode("list");
                                setSelectedId(null);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-wider ${
                                subTab === "planes"
                                    ? "bg-blue-50 text-blue-600 font-black border-l-4 border-blue-600 pl-3"
                                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 font-bold"
                            }`}
                        >
                            Planes de formulación
                        </button>
                        {/* Hover Tooltip */}
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-64 bg-slate-800 text-white text-[10px] font-semibold p-3 rounded-xl shadow-xl border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 leading-relaxed">
                            Es un conjunto de medicamentos que pueden ser usados para recetar a un paciente, los mismos pueden ser editados al momento de usarse.
                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-r-4 border-r-slate-800 border-b-4 border-b-transparent" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side Active Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {subTab === "medicamentos" ? (
                    viewMode === "list" ? (
                        <MedicamentosList onNew={handleNew} onEdit={handleEdit} />
                    ) : (
                        <MedicamentoForm id={selectedId} onCancel={handleCancel} onSuccess={handleSuccess} />
                    )
                ) : (
                    viewMode === "list" ? (
                        <PlanesFormulacionList onNew={handleNew} onEdit={handleEdit} />
                    ) : (
                        <PlanFormulacionForm id={selectedId} onCancel={handleCancel} onSuccess={handleSuccess} />
                    )
                )}
            </div>
        </div>
    );
}
