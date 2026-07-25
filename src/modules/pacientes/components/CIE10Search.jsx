import React, { useState, useEffect, useMemo } from 'react';
import CIE10_COMPLETO from '../../../data/cie10Completo.js';
import { useCombobox } from 'downshift'; // Optional, but usually better. Or raw input for minimal deps.
// Vamos a usar raw input + lista filtrada para no añadir dependencias si no es necesario, o podemos usar un datalist simple.

export default function CIE10Search({ onSelect, className, value, label }) {
    const [query, setQuery] = useState(value ? `${value.code} - ${value.name}` : "");
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (value) {
            setQuery(typeof value === 'string' ? value : `${value.code} - ${value.name}`);
        } else {
            setQuery("");
        }
    }, [value]);

    const filteredItems = useMemo(() => {
        if (!query || query.length < 2) return [];
        const lower = query.toLowerCase();
        return CIE10_COMPLETO.filter(item =>
            item.code.toLowerCase().includes(lower) ||
            item.name.toLowerCase().includes(lower)
        ).slice(0, 8); // Show up to 8 results for better coverage
    }, [query]);

    const handleSelect = (item) => {
        setQuery(`${item.code} - ${item.name}`);
        setIsOpen(false);
        onSelect(item);
    };

    return (
        <div className={`relative ${className}`}>
            {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>}
            <input
                type="text"
                className="w-full p-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-700"
                placeholder="Buscar código o nombre (ej: K02)"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)} // Delay to allow click
            />

            {isOpen && filteredItems.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
                    {filteredItems.map(item => (
                        <li
                            key={item.code}
                            className="p-3 hover:bg-indigo-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-0"
                            onClick={() => handleSelect(item)}
                        >
                            <span className="font-bold text-indigo-600">{item.code}</span> - {item.name}
                        </li>
                    ))}
                </ul>
            )}

            {isOpen && query && filteredItems.length === 0 && (
                <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 p-3 text-sm text-slate-400">
                    No se encontraron resultados
                </div>
            )}
        </div>
    );
}
