import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiMapPin, FiCheck, FiSettings, FiPlus } from "react-icons/fi";
import { useSede } from "../context/SedeContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SedeSelector() {
    const { activeSede, sedesList, setActiveSede } = useSede();
    const { userProfile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const navigate = useNavigate();

    // Cerrar el dropdown al hacer clic afuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isAdmin = (userProfile?.rol || userProfile?.role || "").toLowerCase().includes("admin") || (userProfile?.rol || "").toLowerCase() === "superadmin";

    return (
        <div className="relative flex items-center" ref={containerRef}>
            {/* Botón Selector de Sede Activa */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="h-8 px-4 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full text-[11px] font-bold tracking-wide transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 select-none"
                title="Cambiar sucursal / sede activa"
            >
                <FiMapPin size={13} className="shrink-0 text-white/90" />
                <span className="truncate max-w-[220px] sm:max-w-[320px]">
                    {activeSede?.nombre || "SEDE PRINCIPAL"}
                </span>
                <FiChevronDown
                    size={14}
                    className={`transition-transform duration-200 shrink-0 text-white/80 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown flotante con flechita indicadora */}
            {isOpen && (
                <div className="absolute left-0 top-10 z-50 animate-fadeIn min-w-[260px] max-w-[340px]">
                    {/* Triangulito indicador */}
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white ml-6 -mb-[1px] drop-shadow-xs" />

                    {/* Contenedor del menú */}
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-100 p-1.5 overflow-hidden text-xs">
                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 flex items-center justify-between">
                            <span>Sedes de la clínica</span>
                            <span className="text-[10px] font-semibold text-slate-500">
                                {sedesList.length} {sedesList.length === 1 ? "sede" : "sedes"}
                            </span>
                        </div>

                        <div className="py-1 max-h-64 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
                            {sedesList.map((sede) => {
                                const isSelected = String(sede.id) === String(activeSede?.id) || sede.nombre === activeSede?.nombre;
                                return (
                                    <button
                                        key={sede.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveSede(sede);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                                            isSelected
                                                ? "bg-slate-50 text-slate-900 font-bold"
                                                : "text-slate-700 hover:bg-slate-50/80 font-medium"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 truncate">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                                isSelected ? "bg-[#8dc63f]/20 text-[#8dc63f]" : "bg-slate-100 text-slate-400"
                                            }`}>
                                                <FiMapPin size={12} />
                                            </div>
                                            <div className="truncate">
                                                <div className="truncate text-xs text-slate-800 font-semibold">{sede.nombre}</div>
                                                {(sede.ciudad || sede.direccion) && (
                                                    <div className="text-[10px] text-slate-400 font-normal truncate">
                                                        {sede.ciudad} {sede.direccion ? `• ${sede.direccion}` : ""}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <FiCheck className="text-[#8dc63f] shrink-0 ml-2" size={15} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Administrar sedes para administradores */}
                        {isAdmin && (
                            <div className="pt-1.5 mt-1 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        navigate("/dashboard_admin/Configuracion/sucursales");
                                    }}
                                    className="w-full text-left px-3 py-2 text-[11px] font-semibold text-blue-600 hover:bg-blue-50/60 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                    <FiSettings size={12} />
                                    <span>Administrar sucursales</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
