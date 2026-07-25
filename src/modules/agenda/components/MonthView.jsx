// src/modules/agenda/components/MonthView.jsx
import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// --- DnD Components ---

function DroppableDay({ dateStr, children, isCurrentMonth, isToday }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `month-day|${dateStr}`,
        disabled: !isCurrentMonth, // Only allow dropping on current month days if desired
    });

    const style = {
        backgroundColor: isOver ? '#eff6ff' : undefined, // Light blue on hover
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                border-r border-b border-slate-100 p-2 min-h-[80px] relative transition-colors
                ${isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 text-slate-300'}
                ${isToday ? 'bg-indigo-50/30' : ''}
            `}
        >
            {children}
        </div>
    );
}

function DraggableMonthAppointment({ appointment }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: appointment.id,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.7 : 1,
        cursor: 'grab',
        touchAction: 'none',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="text-[10px] truncate px-1 rounded bg-sky-100 text-sky-800 border border-sky-200 cursor-grab active:cursor-grabbing hover:bg-sky-200 transition-colors"
            title={`${appointment.pacienteNombre} - ${appointment.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        >
            {appointment.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {appointment.pacienteNombre}
        </div>
    );
}

// --- Helper Functions ---

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    // Mon start: 0(Sun) -> 6, 1(Mon) -> 0...
    return day === 0 ? 6 : day - 1;
};

const formatYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const DAYS_HEADER = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function MonthView({ date, appointments, onDateClick }) {
    const year = date.getFullYear();
    const month = date.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIdx = getFirstDayOfMonth(year, month);

    // Prev Month
    const prevMonthDays = [];
    const prevMonthTotal = new Date(year, month, 0).getDate();
    for (let i = firstDayIdx - 1; i >= 0; i--) {
        prevMonthDays.push({ day: prevMonthTotal - i, type: 'prev' });
    }

    // Current Month
    const currentMonthDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
        currentMonthDays.push({ day: i, type: 'current' });
    }

    // Grid Construction
    let allCells = [...prevMonthDays, ...currentMonthDays];
    const totalSlots = Math.ceil(allCells.length / 7) * 7;
    const remaining = totalSlots - allCells.length;

    for (let i = 1; i <= remaining; i++) {
        allCells.push({ day: i, type: 'next' });
    }

    const isToday = (d, type) => {
        if (type !== 'current') return false;
        const today = new Date();
        return d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const getDayAppointments = (day, type) => {
        // Calculate date for the cell
        let cellDate = new Date(year, month, day);
        if (type === 'prev') cellDate = new Date(year, month - 1, day);
        if (type === 'next') cellDate = new Date(year, month + 1, day);

        const currentMs = cellDate.setHours(0, 0, 0, 0);
        const nextMs = cellDate.setHours(23, 59, 59, 999); // approximate end of day

        // More robust filtering: check if appointment falls on this day
        return appointments.filter(a => {
            if (a.status === 'cancelled' || ['cancelada', 'cancelado'].includes((a.estado || '').toLowerCase())) return false;
            const aStart = a.start.getTime();
            // Create start/end for comparison based on cellDate
            const cellStart = new Date(cellDate); cellStart.setHours(0, 0, 0, 0);
            const cellEnd = new Date(cellDate); cellEnd.setHours(23, 59, 59, 999);
            return aStart >= cellStart.getTime() && aStart <= cellEnd.getTime();
        });
    };

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Header Days */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {DAYS_HEADER.map(d => (
                    <div key={d} className="py-2 text-center text-xs font-bold text-slate-500 uppercase">
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-auto">
                {allCells.map((cell, idx) => {
                    const cellDate = new Date(year, month, cell.day);
                    if (cell.type === 'prev') cellDate.setMonth(month - 1);
                    if (cell.type === 'next') cellDate.setMonth(month + 1);

                    const dayApts = getDayAppointments(cell.day, cell.type);
                    const isCurrent = cell.type === 'current';
                    const isDayToday = isToday(cell.day, cell.type);

                    return (
                        <DroppableDay
                            key={`${cell.type}-${cell.day}-${idx}`}
                            dateStr={formatYMD(cellDate)}
                            isCurrentMonth={isCurrent}
                            isToday={isDayToday}
                        >
                            <div
                                onClick={(e) => {
                                    e.stopPropagation(); // Avoid triggering drop on click sometimes
                                    if (isCurrent) onDateClick(new Date(year, month, cell.day));
                                }}
                                className="h-full flex flex-col cursor-pointer"
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`
                                        text-sm font-semibold 
                                        ${isDayToday ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center -ml-1 -mt-1' : 'text-slate-700'}
                                    `}>
                                        {cell.day}
                                    </span>
                                    {dayApts.length > 0 && (
                                        <span className="text-[10px] font-bold text-slate-400">{dayApts.length}</span>
                                    )}
                                </div>

                                <div className="mt-1 flex flex-col gap-1 overflow-hidden max-h-[60px]">
                                    {dayApts.slice(0, 3).map(apt => (
                                        <DraggableMonthAppointment key={apt.id} appointment={apt} />
                                    ))}
                                    {dayApts.length > 3 && (
                                        <div className="text-[9px] text-slate-400 text-center font-medium">+{dayApts.length - 3} más</div>
                                    )}
                                </div>
                            </div>
                        </DroppableDay>
                    );
                })}
            </div>
        </div>
    );
}
