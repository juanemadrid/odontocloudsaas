import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { FiClock } from "react-icons/fi";

const START_HOUR = 6;
const END_HOUR = 22;

function DroppableSlot({ id, children, onClick, active }) {
    const { setNodeRef, isOver } = useDroppable({ id });

    const style = {
        height: '60px', // Fixed height per 30min slot
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
                absolute left-[2px] right-[2px] rounded-[12px] p-2 text-[10px] shadow-sm transition-all overflow-hidden border-l-[4px]
                ${isConfirmed
                    ? 'bg-blue-600 border-blue-800 text-white shadow-blue-600/20'
                    : 'bg-white border-slate-200 text-slate-700 shadow-slate-200/40 border border-slate-100'}
                ${isDragging ? 'scale-95 shadow-2xl' : 'hover:scale-[1.02]'}
            `}
        >
            <div className="flex flex-col h-full justify-between leading-tight">
                <div className="font-black uppercase tracking-tight truncate">
                    {appointment.pacienteNombre || appointment.paciente || "PACIENTE"}
                </div>
                {/* Only show extra details if tall enough */}
                {parseInt(initialStyle.height) > 40 && (
                    <div className={`mt-auto text-[8px] font-bold uppercase tracking-wider opacity-70 truncate ${isConfirmed ? 'text-blue-100' : 'text-slate-400'}`}>
                        {appointment.doctorDisplayName || "S/A"}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AgendaWeeklyView({
    date,
    appointments,
    onSlotClick,
    onEventClick,
    doctors = []
}) {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff); // Set to Monday

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDays.push(d);
    }

    const timeSlots = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
        timeSlots.push(`${String(h).padStart(2, '0')}:00`);
        timeSlots.push(`${String(h).padStart(2, '0')}:30`);
    }

    const getEventStyle = (apt) => {
        const start = apt.start;
        const end = apt.end;
        if (!start || !end) return { display: 'none' };

        // Calculate vertical position (Time)
        const startMin = (start.getHours() * 60) + start.getMinutes();
        const dayStartMin = START_HOUR * 60;
        const offsetMin = Math.max(0, startMin - dayStartMin);
        const endMin = (end.getHours() * 60) + end.getMinutes();
        const duration = Math.max(15, endMin - startMin);

        return {
            top: `${offsetMin * 2}px`, // 2px per minute
            height: `${duration * 2}px`,
        };
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Header: Days of the Week */}
            <div className="flex bg-slate-50 border-b border-slate-200 divide-x divide-slate-100 sticky top-0 z-30">
                <div className="w-16 shrink-0 flex items-center justify-center bg-slate-50/50 border-r border-slate-100">
                    <FiClock className="text-slate-300" size={14} />
                </div>
                {weekDays.map((d, index) => {
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                        <div key={index} className={`flex-1 px-2 py-3 min-w-[120px] text-center ${isToday ? 'bg-blue-50/50' : ''}`}>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {d.toLocaleDateString('es-CO', { weekday: 'short' })}
                            </div>
                            <div className={`text-sm font-black ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                                {d.getDate()}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Body: Time Grid */}
            <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-white">
                <div className="flex relative" style={{ minHeight: `${(END_HOUR - START_HOUR) * 60 * 2}px` }}>

                    {/* Time Column */}
                    <div className="w-16 shrink-0 border-r border-slate-100 bg-slate-50/30 relative z-20">
                        {timeSlots.map((time) => {
                                const [hh, mm] = time.split(':').map(Number);
                                const ampm = hh >= 12 ? 'PM' : 'AM';
                                const h12 = hh % 12 || 12;
                                const label = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
                                return (
                                    <div key={time} className="h-[60px] border-b border-slate-50/50 flex items-start justify-center pt-1 group">
                                        <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-100 px-1.5 py-0.5 rounded-full shadow-sm font-mono translate-y-[-50%]">
                                            {label}
                                        </span>
                                    </div>
                                );
                            })}
                    </div>

                    {/* Day Columns */}
                    {weekDays.map((dayDate, dayIndex) => (
                        <div key={dayIndex} className="flex-1 border-r border-slate-100 last:border-0 relative min-w-[120px] bg-white">
                            {/* Grid Lines */}
                            <div className="absolute inset-x-0 w-full pointer-events-none opacity-[0.03]">
                                {timeSlots.map((t, i) => (
                                    <div key={i} className="h-[60px] border-b border-slate-900 last:border-0" />
                                ))}
                            </div>

                            {/* Droppable Slots */}
                            <div className="absolute inset-0 z-0">
                                {timeSlots.map((time) => {
                                    // Make ID specific to Date + Time
                                    // Use specific format for date to be parseable: YYYY-MM-DD
                                    const dateStr = dayDate.toISOString().split('T')[0];
                                    const slotId = `slot|${dateStr}|${time}`;

                                    return (
                                        <DroppableSlot
                                            key={time}
                                            id={slotId}
                                            onClick={() => onSlotClick(null, time, dayDate)} // Pass specific date
                                        />
                                    );
                                })}
                            </div>

                            {/* Appointments Layer */}
                            <div className="relative z-10 w-full h-full p-[1px]">
                                {appointments
                                    .filter(apt => {
                                        if (!apt.start) return false;
                                        if (apt.status === 'cancelled' || ['cancelada', 'cancelado'].includes((apt.estado || '').toLowerCase())) return false;
                                        const aptDate = new Date(apt.start);
                                        return aptDate.toDateString() === dayDate.toDateString();
                                    })
                                    .map(apt => {
                                        const doc = doctors.find(d => d.id === apt.doctorId);
                                        let doctorDisplayName = "S/A";
                                        if (doc) {
                                            const firstName = (doc.nombre || doc.nombres || "").trim().split(/\s+/)[0];
                                            const firstLastName = (doc.apellido || doc.apellidos || "").trim().split(/\s+/)[0];
                                            doctorDisplayName = `${firstName} ${firstLastName}`.trim() || doc.nombre || "S/A";
                                        } else {
                                            const rawName = apt.doctor || apt.doctorName || "";
                                            if (rawName) {
                                                const parts = rawName.trim().split(/\s+/);
                                                if (parts.length >= 2) {
                                                    doctorDisplayName = `${parts[0]} ${parts[1]}`;
                                                } else {
                                                    doctorDisplayName = rawName;
                                                }
                                            }
                                        }
                                        return (
                                            <DraggableEvent
                                                key={apt.id}
                                                appointment={{
                                                    ...apt,
                                                    doctorDisplayName
                                                }}
                                                style={getEventStyle(apt)}
                                                onClick={onEventClick}
                                            />
                                        );
                                    })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
