import React, { useState, useEffect, useRef } from "react";
import { FiChevronDown, FiSearch } from "react-icons/fi";

export default function SearchableSelect({
    value,
    onChange,
    options = [],
    placeholder = "Seleccione...",
    disabled = false,
    disabledPlaceholder = "Seleccione...",
    loading = false,
    loadingPlaceholder = "Cargando...",
    className = ""
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Filter options based on search term
    const filteredOptions = React.useMemo(() => {
        const term = (search || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (!term) return options;
        return options.filter(opt => {
            const normalizedOpt = (opt || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return normalizedOpt.includes(term);
        });
    }, [options, search]);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            // Slight timeout to ensure rendering
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        } else {
            setSearch("");
        }
    }, [isOpen]);

    const displayPlaceholder = loading
        ? loadingPlaceholder
        : disabled
        ? disabledPlaceholder
        : placeholder;

    return (
        <div ref={containerRef} className={`relative inline-block w-full md:w-64 ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                disabled={disabled || loading}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between bg-white border rounded-xl px-4 py-2 text-sm text-left font-medium transition-all ${
                    disabled || loading
                        ? "border-slate-100 bg-slate-50/50 text-slate-400 cursor-not-allowed"
                        : "border-slate-200 text-slate-800 hover:border-slate-300 active:scale-[0.99] cursor-pointer shadow-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30"
                }`}
            >
                <span className="truncate text-slate-700">
                    {value || displayPlaceholder}
                </span>
                <FiChevronDown
                    className={`text-slate-400 transition-transform duration-300 shrink-0 ml-2 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[999] p-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Search Input Container */}
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <FiSearch size={12} />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-400 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    {/* Scrollable options list */}
                    <div className="overflow-y-auto max-h-48 custom-scrollbar space-y-0.5 pr-0.5">
                        {filteredOptions.length === 0 ? (
                            <div className="text-center py-4 text-xs font-medium text-slate-400 leading-none">
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-200 ${
                                        value === opt
                                            ? "bg-blue-50 text-blue-600 font-bold"
                                            : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
