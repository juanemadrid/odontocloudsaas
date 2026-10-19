import React from "react";
import { FiHome, FiPieChart, FiPrinter, FiDownload, FiPlus } from "react-icons/fi";
export default function AgendaHeading({occupancyPercentage, can, handleDownload, setEditingApt, setSlotData, setModalOpen}) {
return (
            <div className="px-3 md:px-6 lg:px-8 pt-2 pb-4 shrink-0 no-print">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <FiHome className="text-blue-600" />
                                <span>Institucional</span>
                                <span className="text-slate-200">/</span>
                                <span className="text-slate-800">Agenda</span>
                            </div>
                            <div className="flex items-end gap-4">
                                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight leading-none">
                                    Gestión <span className="text-blue-600">Citas</span>
                                </h2>
                                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full border border-blue-100 mb-1">
                                    <FiPieChart className="text-blue-600" size={12} />
                                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                        Ocupación: {occupancyPercentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-12 h-1.5 bg-blue-600 rounded-full" />
                        </div>

                        <div className="flex items-center gap-3">
                            {can("Agenda", "Imprimir agenda", "consultar") && (
                                <button 
                                    onClick={() => handleDownload("print")}
                                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-90"
                                    title="Imprimir Agenda"
                                >
                                    <FiPrinter size={18} />
                                </button>
                            )}
                            {can("Agenda", "Exportar a excel", "consultar") && (
                                <button 
                                    onClick={() => handleDownload("download")}
                                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-90"
                                    title="Descargar Reporte PDF"
                                >
                                    <FiDownload size={18} />
                                </button>
                            )}
                            {can("Agenda", "Agenda", "crear") && (
                                <button 
                                    onClick={() => {
                                        setEditingApt(null);
                                        setSlotData(null);
                                        setModalOpen(true);
                                    }}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-[18px] font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                                >
                                    <FiPlus size={18} /> Nueva Cita
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
);
}
