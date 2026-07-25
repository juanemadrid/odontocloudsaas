import React, { useState } from "react";
import { FiSettings, FiPlusCircle, FiBarChart2, FiActivity } from "react-icons/fi";
import ConfigurarResiduos from "./components/ConfigurarResiduos";
import ReportarResiduos from "./components/ReportarResiduos";
import TotalesResiduos from "./components/TotalesResiduos";
import IndicadoresResiduos from "./components/IndicadoresResiduos";

export default function ResiduosHub() {
    const [subTab, setSubTab] = useState("configurar"); // "configurar", "reportar", "totales", "indicadores"

    return (
        <div className="flex h-full w-full bg-slate-50/10 gap-6 animate-in fade-in duration-500">
            {/* Left Sub-Sidebar */}
            <div className="w-64 bg-white rounded-[28px] border border-slate-100 p-4 flex flex-col shrink-0 shadow-sm h-fit space-y-4">
                <div className="px-3 py-2 border-b border-slate-50 flex items-center gap-2">
                    <FiSettings className="text-blue-600" size={16} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Gestión de residuos
                    </span>
                </div>
                <div className="space-y-1">
                    {/* Configurar option */}
                    <button
                        onClick={() => setSubTab("configurar")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-wider ${
                            subTab === "configurar"
                                ? "bg-blue-50 text-blue-600 font-black border-l-4 border-blue-600 pl-3"
                                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 font-bold"
                        }`}
                    >
                        <FiSettings size={14} />
                        Configurar
                    </button>

                    {/* Reportar option */}
                    <button
                        onClick={() => setSubTab("reportar")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-wider ${
                            subTab === "reportar"
                                ? "bg-blue-50 text-blue-600 font-black border-l-4 border-blue-600 pl-3"
                                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 font-bold"
                        }`}
                    >
                        <FiPlusCircle size={14} />
                        Reportar
                    </button>

                    {/* Totales option */}
                    <button
                        onClick={() => setSubTab("totales")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-wider ${
                            subTab === "totales"
                                ? "bg-blue-50 text-blue-600 font-black border-l-4 border-blue-600 pl-3"
                                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 font-bold"
                        }`}
                    >
                        <FiBarChart2 size={14} />
                        Totales
                    </button>

                    {/* Indicadores option */}
                    <button
                        onClick={() => setSubTab("indicadores")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-wider ${
                            subTab === "indicadores"
                                ? "bg-blue-50 text-blue-600 font-black border-l-4 border-blue-600 pl-3"
                                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 font-bold"
                        }`}
                    >
                        <FiActivity size={14} />
                        Indicadores
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {subTab === "configurar" && <ConfigurarResiduos />}
                {subTab === "reportar" && <ReportarResiduos />}
                {subTab === "totales" && <TotalesResiduos />}
                {subTab === "indicadores" && <IndicadoresResiduos />}
            </div>
        </div>
    );
}
