import React, { useState } from "react";
import { FiPlusSquare, FiBriefcase, FiLayers } from "react-icons/fi";
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
        <div className="flex flex-col md:flex-row h-full w-full gap-5 animate-in fade-in duration-300">
            {/* Left side Sub-navigation menu */}
            <div className="w-full md:w-64 bg-white rounded-xl border border-slate-200 p-3 flex flex-col shrink-0 shadow-2xs h-fit space-y-3">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                    <FiLayers className="text-blue-600" size={15} />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Menú de Medicamentos
                    </span>
                </div>
                <div className="space-y-1">
                    {/* Medicamentos option */}
                    <button
                        onClick={() => {
                            setSubTab("medicamentos");
                            setViewMode("list");
                            setSelectedId(null);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-xs font-bold flex items-center justify-between cursor-pointer border-0 ${
                            subTab === "medicamentos"
                                ? "bg-blue-50 text-blue-600 font-bold border-l-4 border-blue-600 pl-2.5"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 bg-transparent"
                        }`}
                    >
                        <span>Medicamentos</span>
                    </button>

                    {/* Planes de formulación option */}
                    <button
                        onClick={() => {
                            setSubTab("planes");
                            setViewMode("list");
                            setSelectedId(null);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-xs font-bold flex items-center justify-between cursor-pointer border-0 ${
                            subTab === "planes"
                                ? "bg-blue-50 text-blue-600 font-bold border-l-4 border-blue-600 pl-2.5"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 bg-transparent"
                        }`}
                    >
                        <span>Planes de formulación</span>
                    </button>
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

