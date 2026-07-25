import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { FiClock } from "react-icons/fi";

const START_HOUR = 6;
const END_HOUR = 20;

function DroppableSlot({ id, children, onClick, active }) {
    const { setNodeRef, isOver } = useDroppable({ id });

    const style = {
        height: '60px',
        borderBottom: '1px solid #f1f5f9',
        backgroundColor: isOver ? '#f0f9ff' : undefined,
        transition: 'background-color 0.15s ease',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            className="w-full relative cursor-pointer group"
            title={active ? "Soltar para reprogramar" : "Click para agendar"}
        >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-sky-500/[0.02] transition-opacity" />
            {children}
        </div>
    );
}

function DraggableEvent({ appointment, style: initialStyle, onClick }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: appointment.id,
    });

    const isConfirmed = appointment.status === 'confirmed';

    const style = {
        ...initialStyle,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : 10,
        opacity: isDragging ? 0.6 : 1,
        cursor: 'grab',
        touchAction: 'none',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                if (!isDragging) {
                    e.stopPropagation();
                    onClick(appointment);
                }
            }}
            className={`
                absolute left-[4px] right-[4px] rounded-[16px] p-3 text-xs shadow-lg transition-all overflow-hidden border-l-[6px]
                ${isConfirmed
                    ? 'bg-blue-600 border-blue-800 text-white shadow-blue-600/20'
                    : 'bg-white border-slate-200 text-slate-700 shadow-slate-200/40 border border-slate-100'}
                ${isDragging ? 'scale-95 shadow-2xl' : 'hover:scale-[1.02]'}
            `}
        >
            <div className="flex flex-col h-full justify-between">
                <div>
                    <div className={`text-[10px] font-black uppercase tracking-tighter truncate leading-none mb-1.5 ${isConfirmed ? 'text-white' : 'text-slate-800'}`}>
                        {appointment.pacienteNombre || appointment.paciente || "PACIENTE"}
                    </div>
                    <div className={`text-[8px] font-bold uppercase tracking-widest leading-none truncate opacity-70 ${isConfirmed ? 'text-blue-100' : 'text-slate-400'}`}>
                        {appointment.doctorName || "S/A"}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-auto">
                    <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-[0.1em] ${isConfirmed ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {appointment.consultorioName || "BOX"}
                    </div>
                </div>
            </div>

            {/* Shimmer Effect for Premium look */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        </div>
    );
}

export default function AgendaGrid({
    date,
    appointments,
    doctors,
    onSlotClick,
    onEventClick
}) {
    const slots = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
    }

    const effectiveResources = (doctors && doctors.length > 0)
        ? doctors
        : [{ id: "general", nombre: "Box Principal", especialidad: "Agenda General" }];

    const getEventStyle = (apt) => {
        const start = apt.start;
        const end = apt.end;
        if (!start || !end) return { display: 'none' };

        const startMin = (start.getHours() * 60) + start.getMinutes();
        const dayStartMin = START_HOUR * 60;
        const offsetMin = Math.max(0, startMin - dayStartMin);

        const endMin = (end.getHours() * 60) + end.getMinutes();
        const duration = Math.max(15, endMin - startMin);

        return {
            top: `${offsetMin * 2}px`,
            height: `${duration * 2}px`,
        };
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Architectural Grid Header */}
            <div className="flex bg-slate-50 border-b border-slate-200 divide-x divide-slate-100">
                <div className="w-20 shrink-0 flex items-center justify-center bg-slate-50/50 border-r border-slate-100">
                    <FiClock className="text-slate-300" size={14} />
                </div>
                {effectiveResources.map(res => (
                    <div key={res.id} className="flex-1 px-6 py-4 min-w-[200px] border-r border-slate-100 last:border-0">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                            <div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] leading-none mb-1.5">{res.especialidad || "Especialidad"}</div>
                                <div className="font-black text-slate-800 text-xs uppercase tracking-tight">{res.nombre}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Precision Grid Body */}
            <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-white">
                <div className="flex relative" style={{ minHeight: `${(END_HOUR - START_HOUR) * 60 * 2}px` }}>

                    {/* Time Scales - High Density Glassmorphism */}
                    <div className="w-20 shrink-0 border-r border-slate-100 bg-slate-50/30 relative z-20">
                        {slots.map((time) => (
                            <div key={time} className="h-[60px] border-b border-slate-50/50 flex items-start justify-center pt-1 group">
                                <span className="text-[10px] font-black text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-full shadow-sm font-mono translate-y-[-50%] group-hover:text-blue-600 group-hover:border-blue-100 transition-all duration-300">
                                    {time}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Functional Columns */}
                    {effectiveResources.map((res) => (
                        <div key={res.id} className="flex-1 border-r border-slate-100 last:border-0 relative min-w-[200px] bg-white">
                            {/* Subtle Grid Lines Overlay */}
                            <div className="absolute inset-x-0 w-full pointer-events-none opacity-[0.03]">
                                {slots.map((t, i) => (
                                    <div key={i} className="h-[60px] border-b border-slate-900 last:border-0" />
                                ))}
                            </div>

                            <div className="absolute inset-0 z-0">
                                {slots.map((time) => {
                                    const slotId = `slot|${res.id}|${time}`;
                                    return (
                                        <DroppableSlot
                                            key={time}
                                            id={slotId}
                                            onClick={() => onSlotClick(res.id === "general" ? null : res.id, time)}
                                        />
                                    );
                                })}
                            </div>

                            <div className="relative z-10 w-full h-full p-[1px]">
                                {appointments
                                    .filter(a => {
                                        if (a.status === 'cancelled' || ['cancelada', 'cancelado'].includes((a.estado || '').toLowerCase())) return false;
                                        if (effectiveResources.length === 1 && effectiveResources[0].id === 'general') return true;
                                        return a.doctorId === res.id || (!a.doctorId && !res.id);
                                    })
                                    .map(apt => (
                                        <DraggableEvent
                                            key={apt.id}
                                            appointment={apt}
                                            style={getEventStyle(apt)}
                                            onClick={onEventClick}
                                        />
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Status Guide Footer - Slender Pro Pill Style */}
            <div className="bg-white border-t border-slate-100 px-10 py-3 flex items-center justify-end gap-10">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Confirmada</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-white border-2 border-slate-200" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Pendiente</span>
                </div>
            </div>
        </div>
    );
}
