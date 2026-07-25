import React from 'react';

export default function AgendaPrintReport({
    appointments,
    selectedDate,
    clinicInfo,
    selectedBranchName,
    selectedDoctorName
}) {
    const formatTime = (date) => {
        if (!date) return "--:--";
        const d = new Date(date);
        return d.toLocaleTimeString("es-CO", { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString("es-CO", {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).toUpperCase();
    };

    // Sort appointments by start time
    const sortedApts = [...appointments].sort((a, b) => new Date(a.start) - new Date(b.start));

    return (
        <div id="agenda-print-report" className="hidden print:block bg-white text-slate-900 font-sans p-[1.5cm] min-h-screen">
            {/* 1. HEADER INSTITUCIONAL PREMIUM */}
            <div className="flex justify-between items-start border-b-[3px] border-slate-900 pb-8 mb-10">
                <div className="flex items-center gap-8">
                    {clinicInfo?.logo ? (
                        <div className="w-28 h-28 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center justify-center p-2">
                            <img src={clinicInfo.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-24 h-24 bg-slate-900 text-white flex items-center justify-center font-black text-5xl rounded-3xl shadow-xl">O</div>
                    )}
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight text-slate-900 mb-1">
                            {clinicInfo?.name || "ODONTOCLOUD IPS"}
                        </h1>
                        <div className="flex items-center gap-3">
                            <span className="h-1 w-8 bg-blue-600 rounded-full"></span>
                            <p className="text-[11px] font-black text-blue-600/70 uppercase tracking-[0.4em]">
                                Excelencia en Planificación Clínica
                            </p>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 leading-none">Fecha del Reporte</div>
                    <div className="text-xl font-black text-slate-800 bg-slate-50 border border-slate-100 px-6 py-4 rounded-[20px] shadow-sm">
                        {formatDate(selectedDate)}
                    </div>
                </div>
            </div>

            {/* 2. BARRA DE FILTROS EJECUTIVA */}
            <div className="grid grid-cols-2 gap-6 mb-12">
                <div className="relative overflow-hidden bg-slate-50/50 border border-slate-200 p-6 rounded-[24px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/30 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 leading-none">Ubicación / Sede</span>
                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{selectedBranchName || "Todas las sedes"}</span>
                </div>
                <div className="relative overflow-hidden bg-slate-50/50 border border-slate-200 p-6 rounded-[24px]">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100/30 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 leading-none">Especialista Responsable</span>
                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{selectedDoctorName || "Todos los profesionales"}</span>
                </div>
            </div>

            {/* 3. TABLA DE REGISTROS CLÍNICOS - ALTA DENSIDAD */}
            <div className="overflow-hidden border border-slate-200 rounded-[28px] shadow-sm">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-900">
                            <th className="p-4 text-left text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Hora</th>
                            <th className="p-4 text-left text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Paciente</th>
                            <th className="p-4 text-left text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Cédula</th>
                            <th className="p-4 text-left text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Celular</th>
                            <th className="p-4 text-left text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Teléf.</th>
                            <th className="p-4 text-left text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Doctor</th>
                            <th className="p-4 text-left text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Espacio</th>
                            <th className="p-4 text-left text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Notas</th>
                            <th className="p-4 text-center text-[9px] font-black text-white/90 uppercase tracking-[0.1em] border-r border-slate-800">Est.</th>
                            <th className="p-4 text-right text-[9px] font-black text-white/90 uppercase tracking-[0.1em]">Actualidad</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedApts.length === 0 ? (
                            <tr>
                                <td colSpan="10" className="p-16 text-center">
                                    <div className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] mb-2 italic">Sin Actividad Programada</div>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">No se encontraron registros clínicos cargados para esta jornada</p>
                                </td>
                            </tr>
                        ) : (
                            sortedApts.map((apt) => (
                                <tr key={apt.id} className="text-[10px] leading-tight hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-black border-r border-slate-100 whitespace-nowrap bg-slate-50/30">
                                        {formatTime(apt.start)}
                                        <div className="text-[8px] font-bold text-slate-400 mt-0.5 tracking-tighter opacity-70">HASTA {formatTime(apt.end)}</div>
                                    </td>
                                    <td className="p-4 font-black text-slate-800 uppercase border-r border-slate-100 max-w-[140px]">
                                        {apt.paciente || apt.pacienteNombre || "S/REGISTRO"}
                                    </td>
                                    <td className="p-4 font-bold text-slate-500 border-r border-slate-100 tabular-nums">
                                        {apt.documento || "---"}
                                    </td>
                                    <td className="p-4 font-black text-blue-600/80 border-r border-slate-100 tabular-nums">
                                        {apt.celular || "---"}
                                    </td>
                                    <td className="p-4 font-bold text-slate-400 border-r border-slate-100 tabular-nums">
                                        {apt.telDomicilio || "---"}
                                    </td>
                                    <td className="p-4 font-black uppercase text-slate-600 border-r border-slate-100 text-[9px]">
                                        {apt.doctorName || "---"}
                                    </td>
                                    <td className="p-4 border-r border-slate-100">
                                        <span className="font-black text-slate-500 uppercase text-[9px]">{apt.consultorioName || "---"}</span>
                                    </td>
                                    <td className="p-4 border-r border-slate-100 italic text-slate-400 text-[8px] max-w-[120px] leading-tight">
                                        {apt.comentario || "Sin observaciones adicionales"}
                                    </td>
                                    <td className="p-4 text-center border-r border-slate-100">
                                        <div className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${apt.status === 'confirmed'
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                : 'bg-slate-50 text-slate-300 border border-slate-100'
                                            }`}>
                                            {apt.status === 'confirmed' ? '✓' : '—'}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-black whitespace-nowrap">
                                        {apt.pagoPendiente > 0 ? (
                                            <span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-md text-[9px]">DEUDA: ${apt.pagoPendiente.toLocaleString('es-CO')}</span>
                                        ) : (
                                            <span className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md text-[9px]">AL DÍA</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 4. CLINICAL FOOTER - CORPORATE STYLE */}
            <div className="mt-12 pt-8 border-t-[1px] border-slate-100 grid grid-cols-3 gap-12">
                <div className="space-y-4">
                    <span className="block text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Métricas de Jornada</span>
                    <div className="flex gap-8">
                        <div>
                            <span className="text-2xl font-black text-slate-800 leading-none">{sortedApts.length}</span>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mt-1">Pacientes</span>
                        </div>
                        <div>
                            <span className="text-2xl font-black text-emerald-500 leading-none">
                                {sortedApts.filter(a => a.status === 'confirmed').length}
                            </span>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mt-1">Confirmados</span>
                        </div>
                    </div>
                </div>

                <div className="col-span-2 text-right">
                    <div className="bg-slate-50 p-6 rounded-[24px] inline-block max-w-[450px]">
                        <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed tracking-wider mb-4 opacity-80">
                            DOCUMENTO CLÍNICO CONFIDENCIAL • PROTEGIDO POR LEY 1581 DE 2012
                            <br />
                            EL USO NO AUTORIZADO DE ESTA INFORMACIÓN CONLLEVA RESPONSABILIDAD LEGAL
                        </p>
                        <div className="flex justify-end items-center gap-3">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">SISTEMA INTEGRAL</span>
                            <span className="text-sm font-black italic tracking-tighter text-blue-600">OdontoCloud Pro</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. WATERMARK EFFECT (Digital Signature Placeholder) */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-[0.03] pointer-events-none select-none">
                <span className="text-[120px] font-black uppercase tracking-[0.2em]">VERIFICADO</span>
            </div>
        </div>
    );
}
