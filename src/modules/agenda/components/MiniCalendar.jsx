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
        <div className="bg-white p-2 w-full select-none rounded-xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 px-1">
                <div className="text-[12px] font-black text-slate-800 uppercase tracking-[0.1em]">
                    {MONTHS[month]} <span className="text-sky-500 font-black">{year}</span>
                </div>
                <div className="flex gap-1.5">
                    <button
                        onClick={handlePrevMonth}
                        className="text-slate-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-sky-50 transition-all border border-transparent hover:border-sky-100"
                    >
                        <FiChevronLeft size={16} />
                    </button>
                    <button
                        onClick={handleNextMonth}
                        className="text-slate-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-sky-50 transition-all border border-transparent hover:border-sky-100"
                    >
                        <FiChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 mb-3">
                {DAYS_SHORT.map(d => (
                    <div key={d} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest pb-2">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
                {prevMonthDays.map((d, i) => (
                    <div key={`prev-${i}`} className="text-center text-[10px] py-2.5 text-slate-200 font-bold opacity-50">
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
                                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 ring-4 ring-sky-600/10'
                                    : isToday
                                        ? 'text-sky-600 bg-sky-50 border border-sky-100'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                            `}
                        >
                            {day}
                            {isToday && !isSelected && (
                                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-sky-600" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
