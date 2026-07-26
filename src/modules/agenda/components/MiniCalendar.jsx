import React, { useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const DAYS_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function MiniCalendar({ selectedDate, onDateChange }) {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDay = (y, m) => new Date(y, m, 1).getDay();

    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getFirstDay(year, month);

    const prevMonthDays = [];
    const daysInPrevMonth = getDaysInMonth(year, month - 1);
    for (let i = startDay - 1; i >= 0; i--) {
        prevMonthDays.push(daysInPrevMonth - i);
    }

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const isSameDate = (d1, d2) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const handleDayClick = (day) => {
        const newDate = new Date(year, month, day);
        onDateChange(newDate);
    };

    return (
        <div className="bg-white p-3 w-full select-none rounded-2xl border border-slate-200/90 shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 px-1">
                <div className="text-[12px] font-black text-slate-900 uppercase tracking-[0.1em]">
                    {MONTHS[month]} <span className="text-blue-600 font-black">{year}</span>
                </div>
                <div className="flex gap-1.5">
                    <button
                        onClick={handlePrevMonth}
                        className="text-slate-500 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-all border border-slate-200/70 hover:border-blue-200"
                        title="Mes anterior"
                    >
                        <FiChevronLeft size={16} />
                    </button>
                    <button
                        onClick={handleNextMonth}
                        className="text-slate-500 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-all border border-slate-200/70 hover:border-blue-200"
                        title="Mes siguiente"
                    >
                        <FiChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Week Days Header */}
            <div className="grid grid-cols-7 mb-2 bg-slate-100/70 py-1.5 rounded-lg border border-slate-200/60">
                {DAYS_SHORT.map(d => (
                    <div key={d} className="text-center text-[9.5px] font-black text-slate-700 uppercase tracking-wider">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
                {prevMonthDays.map((d, i) => (
                    <div key={`prev-${i}`} className="text-center text-[10px] py-1.5 text-slate-300 font-bold opacity-60">
                        {d}
                    </div>
                ))}

                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const currentDate = new Date(year, month, day);
                    const isSelected = isSameDate(currentDate, selectedDate);
                    const isToday = isSameDate(currentDate, new Date());

                    return (
                        <div
                            key={day}
                            onClick={() => handleDayClick(day)}
                            className={`
                                text-center text-[11px] py-1.5 rounded-xl cursor-pointer transition-all font-black flex items-center justify-center relative
                                ${isSelected
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-600/20'
                                    : isToday
                                        ? 'text-blue-700 bg-blue-50 border-2 border-blue-300 font-black'
                                        : 'text-slate-800 hover:bg-slate-100 hover:text-slate-900 border border-transparent hover:border-slate-200'}
                            `}
                        >
                            {day}
                            {isToday && !isSelected && (
                                <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-blue-600" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
