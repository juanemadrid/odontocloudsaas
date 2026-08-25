import React, { useState } from "react";
import { FiSettings, FiPlusCircle, FiBarChart2, FiActivity, FiTrash2 } from "react-icons/fi";
import ConfigurarResiduos from "./components/ConfigurarResiduos";
import ReportarResiduos from "./components/ReportarResiduos";
import TotalesResiduos from "./components/TotalesResiduos";
import IndicadoresResiduos from "./components/IndicadoresResiduos";

export default function ResiduosHub() {
    const [subTab, setSubTab] = useState("configurar"); // "configurar", "reportar", "totales", "indicadores"

    return (
        <div className="max-w-7xl mx-auto space-y-4 font-sans text-slate-800 animate-in fade-in duration-300">
            {/* Breadcrumb Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <span>Administración</span>
                        <span>/</span>
                        <span className="text-slate-800 font-semibold">Residuos hospitalarios</span>
                    </div>
                    <h1 className="text-lg font-bold text-slate-800 tracking-tight mt-0.5">
                        Gestión de Residuos Hospitalarios
                    </h1>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-start gap-4">
                {/* Left Sub-Sidebar */}
                <div className="w-full md:w-56 bg-white rounded-xl border border-slate-200 p-3 flex flex-col shrink-0 shadow-2xs space-y-2">
                    <div className="px-2 py-1 border-b border-slate-100 flex items-center gap-2">
                        <FiTrash2 className="text-[#7cb342]" size={14} />
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                            Opciones
                        </span>
                    </div>
                    <div className="space-y-1">
                        {/* Configurar option */}
                        <button
                            onClick={() => setSubTab("configurar")}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-xs font-semibold cursor-pointer ${
                                subTab === "configurar"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <FiSettings size={13} />
                            Configurar
                        </button>

                        {/* Reportar option */}
                        <button
                            onClick={() => setSubTab("reportar")}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-xs font-semibold cursor-pointer ${
                                subTab === "reportar"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <FiPlusCircle size={13} />
                            Reportar
                        </button>

                        {/* Totales option */}
                        <button
                            onClick={() => setSubTab("totales")}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-xs font-semibold cursor-pointer ${
                                subTab === "totales"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <FiBarChart2 size={13} />
                            Totales
                        </button>

                        {/* Indicadores option */}
                        <button
                            onClick={() => setSubTab("indicadores")}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-xs font-semibold cursor-pointer ${
                                subTab === "indicadores"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <FiActivity size={13} />
                            Indicadores
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 w-full min-w-0 overflow-y-auto">
                    {subTab === "configurar" && <ConfigurarResiduos />}
                    {subTab === "reportar" && <ReportarResiduos />}
                    {subTab === "totales" && <TotalesResiduos />}
                    {subTab === "indicadores" && <IndicadoresResiduos />}
                </div>
            </div>
        </div>
    );
}
