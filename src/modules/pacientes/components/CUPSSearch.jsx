import React, { useState, useEffect, useMemo } from 'react';

export default function CUPSSearch({ onSelect, className, value, label, placeholder = "Escriba la consulta, procedimiento o código CUPS (ej: 890201, 870112, hemograma...)" }) {
    const [query, setQuery] = useState(value ? `${value.code} - ${value.name}` : "");
    const [isOpen, setIsOpen] = useState(false);
    const [catalog, setCatalog] = useState(null);

    const loadCatalog = async () => {
        if (catalog) return;
        try {
            const module = await import('../../../data/cupsCompleto.js');
            setCatalog(module.default || module.CUPS_COMPLETO || []);
        } catch (e) {
            console.error("Error loading CUPS catalog:", e);
        }
    };

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
        return (catalog || []).filter(item =>
            (item.code && item.code.toLowerCase().includes(lower)) ||
            (item.name && item.name.toLowerCase().includes(lower))
        ).slice(0, 15); // Show up to 15 results for comprehensive medical/dental procedures
    }, [query, catalog]);

    const handleSelect = (item) => {
        setQuery(`${item.code} - ${item.name}`);
        setIsOpen(false);
        if (onSelect) onSelect(item);
    };

    return (
        <div className={`relative ${className || ''}`}>
            {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>}
            <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#8CC63F] focus:ring-1 focus:ring-[#8CC63F]/20 transition-all placeholder:text-slate-400 placeholder:font-normal"
                placeholder={placeholder}
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                    if (e.target.value.length >= 2) loadCatalog();
                }}
                onFocus={() => {
                    loadCatalog();
                    setIsOpen(true);
                }}
                onBlur={() => setTimeout(() => setIsOpen(false), 250)} // Delay to allow click
            />

            {isOpen && filteredItems.length > 0 && (
                <ul className="absolute z-[250] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
                    {filteredItems.map(item => (
                        <li
                            key={item.code}
                            className="p-3 hover:bg-emerald-50/70 cursor-pointer text-xs text-slate-700 transition-colors flex items-center justify-between gap-2"
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevents blur before click
                                handleSelect(item);
                            }}
                        >
                            <span>
                                <span className="font-bold text-[#8CC63F] mr-1.5">{item.code}</span>
                                <span className="font-semibold text-slate-700 uppercase">{item.name}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {isOpen && catalog && query && query.length >= 2 && filteredItems.length === 0 && (
                <div className="absolute z-[250] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 p-3 text-xs text-slate-400">
                    No se encontraron procedimientos CUPS para "{query}"
                </div>
            )}
        </div>
    );
}
