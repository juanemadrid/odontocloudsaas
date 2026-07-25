import React, { useState, useEffect, useMemo, useRef } from 'react';
import MEDICAMENTOS_COLOMBIA from '../../../data/medicamentosColombia.js';

/**
 * MedicamentoSearch
 * Buscador desplegable de medicamentos colombianos (INVIMA/OPS).
 * 
 * Props:
 *  value       – objeto seleccionado { code, name, group } o null
 *  onChange    – callback(item | null) al seleccionar o limpiar
 *  disabled    – boolean
 *  placeholder – string opcional
 */
const MedicamentoSearch = ({ value, onChange, disabled = false, placeholder = 'Escriba el nombre o el código del medicamento' }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    // Sync display when external value changes
    useEffect(() => {
        if (value) {
            setQuery(`${value.code} – ${value.name}`);
        } else {
            setQuery('');
        }
    }, [value]);

    const filteredItems = useMemo(() => {
        if (!query || query.length < 2) return [];
        const lower = query.toLowerCase();
        return MEDICAMENTOS_COLOMBIA.filter(item =>
            item.code.toLowerCase().includes(lower) ||
            item.name.toLowerCase().includes(lower) ||
            (item.group && item.group.toLowerCase().includes(lower))
        ).slice(0, 10);
    }, [query]);

    const handleSelect = (item) => {
        onChange(item);
        setQuery(`${item.code} – ${item.name}`);
        setOpen(false);
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        if (value) onChange(null); // reset selection when user types
        setOpen(true);
    };

    const handleClear = () => {
        setQuery('');
        onChange(null);
        setOpen(false);
    };

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showDropdown = open && query.length >= 2 && filteredItems.length > 0;

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Input */}
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => query.length >= 2 && setOpen(true)}
                    disabled={disabled}
                    placeholder={placeholder}
                    autoComplete="off"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 pr-8 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 placeholder:text-slate-400 placeholder:font-normal disabled:bg-slate-50 disabled:cursor-not-allowed transition-all"
                />
                {/* Clear button or search icon */}
                {query && !disabled ? (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 transition-colors text-xs font-black"
                    >
                        ×
                    </button>
                ) : (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                        </svg>
                    </span>
                )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-64 overflow-y-auto text-left">
                    {filteredItems.map((item) => (
                        <li
                            key={item.code}
                            onMouseDown={() => handleSelect(item)}
                            className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-none transition-colors"
                        >
                            {/* Code badge */}
                            <span className="flex-shrink-0 mt-0.5 min-w-[52px] text-center text-[10px] font-black bg-slate-100 text-slate-500 rounded-lg px-1.5 py-0.5 uppercase tracking-wider">
                                {item.code}
                            </span>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-slate-800 leading-snug">{item.name}</span>
                                {item.group && (
                                    <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5 truncate">{item.group}</span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* No results hint */}
            {open && query.length >= 2 && filteredItems.length === 0 && (
                <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 px-4 py-3 text-xs text-slate-400 text-center">
                    Sin resultados para «{query}»
                </div>
            )}
        </div>
    );
};

export default MedicamentoSearch;
