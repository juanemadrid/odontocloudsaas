import React, { useState } from 'react';
import { FiCalendar, FiFilter, FiDownload, FiSearch } from 'react-icons/fi';
import Button from "../../../components/ui/Button";

export default function AgendaDetailView({ appointments, doctors }) {
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        status: '',
        doctor: ''
    });

    // Mock Export Function
    const handleExport = () => {
        alert("Generando reporte Excel...");
    };

    const filteredData = appointments.filter(apt => {
        // Implement filter logic here if needed for live preview
        // For now, showing all appointments or filtered by basic status
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden p-6 gap-6">
            {/* 1. FILTER PANEL (Glassmorphism Card) */}
            <div className="bg-white border border-slate-100 rounded-[24px] shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6">
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-full">
                        <FiFilter />
                    </span>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Filtros de Reporte</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Inicial</label>
                        <input
                            type="date"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-bold text-xs uppercase focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Final</label>
                        <input
                            type="date"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-bold text-xs uppercase focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Cita</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-bold text-xs uppercase focus:outline-none focus:border-blue-500 transition-all">
                            <option value="">Todos</option>
                            <option value="confirmed">Confirmada</option>
                            <option value="pending">Pendiente</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profesional</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-bold text-xs uppercase focus:outline-none focus:border-blue-500 transition-all">
                            <option value="">Todos los profesionales</option>
                            {doctors.map(d => {
                                const firstName = (d.nombre || d.nombres || "").trim().split(/\s+/)[0];
                                const firstLastName = (d.apellido || d.apellidos || "").trim().split(/\s+/)[0];
                                const displayName = `${firstName} ${firstLastName}`.trim() || d.nombre || "Doctor";
                                return (
                                    <option key={d.id} value={d.id}>{displayName}</option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 font-black text-[10px] uppercase tracking-widest"
                    >
                        <FiDownload size={14} /> Generar Reporte Excel
                    </button>
                </div>
            </div>

            {/* 2. PREVIEW TABLE */}
            <div className="flex-1 bg-white border border-slate-100 rounded-[24px] shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Vista Previa</h4>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Registros:</span>
                        <span className="text-sm font-black text-blue-600">{filteredData.length}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    <table className="w-full">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                                <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Profesional</th>
                                <th className="px-6 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.map(apt => (
                                <tr key={apt.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                                        {new Date(apt.start).toLocaleDateString()} {new Date(apt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-black text-slate-800 uppercase tracking-tight">
                                        {apt.pacienteNombre || apt.paciente}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                        {(() => {
                                            const doc = doctors.find(d => d.id === apt.doctorId);
                                            if (doc) {
                                                const firstName = (doc.nombre || doc.nombres || "").trim().split(/\s+/)[0];
                                                const firstLastName = (doc.apellido || doc.apellidos || "").trim().split(/\s+/)[0];
                                                return `${firstName} ${firstLastName}`.trim() || doc.nombre || "S/A";
                                            }
                                            const rawName = apt.doctor || apt.doctorName || "";
                                            if (rawName) {
                                                const parts = rawName.trim().split(/\s+/);
                                                if (parts.length >= 2) {
                                                    return `${parts[0]} ${parts[1]}`;
                                                }
                                                return rawName;
                                            }
                                            return "S/A";
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${apt.status === 'confirmed' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                            {apt.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
