import React, { useState, useMemo } from 'react';
import { FiChevronDown, FiFilter, FiSearch, FiMapPin, FiUser, FiX } from 'react-icons/fi';
import MiniCalendar from './MiniCalendar';

// Acordeón colapsable - cerrado por defecto
const FilterAccordion = ({ title, icon: Icon, isOpen, onToggle, count, children }) => (
    <div className="border-b border-slate-100 last:border-0">
        <button
            onClick={onToggle}
            className="w-full flex justify-between items-center py-3 px-3 hover:bg-slate-50/80 rounded-xl transition-all duration-200 group"
        >
            <div className="flex items-center gap-2">
                <Icon size={14} className={`transition-colors ${isOpen ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isOpen ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'}`}>
                    {title}
                </span>
                {count > 0 && (
                    <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                        {count}
                    </span>
                )}
            </div>
            <FiChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
            />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pb-3 px-1">
                {children}
            </div>
        </div>
    </div>
);

export default function AgendaSidebar({
    selectedDate, onDateChange,
    doctors,
    selectedDoctor, onSelectDoctor,
    branches = [],
    selectedBranch, onSelectBranch,
    chairs = [],
    appointments = []
}) {
    // Ambas secciones CERRADAS por defecto
    const [openSections, setOpenSections] = useState({ sucursal: false, profesionales: false });
    const [doctorSearch, setDoctorSearch] = useState('');
    const [branchSearch, setBranchSearch] = useState('');

    const toggleSection = (sec) => {
        setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
    };

    // Dynamic Chair Occupancy Stats based on appointments
    const chairStats = useMemo(() => {
        const totalSlotsPerDay = 16; // 8am to 4pm
        if (!chairs || chairs.length === 0) {
            const count = appointments.length;
            const pct = Math.min(100, Math.round((count / totalSlotsPerDay) * 100));
            return [
                { id: '1', nombre: 'Sillón Principal', percent: pct, color: 'bg-emerald-500', textColor: 'text-emerald-600' }
            ];
        }
        return chairs.map((c, i) => {
            const count = appointments.filter(a => a.consultorioId === c.id || a.consultorioName === c.nombre).length;
            const pct = Math.min(100, Math.round((count / totalSlotsPerDay) * 100));
            const color = i % 2 === 0 ? 'bg-emerald-500' : 'bg-blue-500';
            const textColor = i % 2 === 0 ? 'text-emerald-600' : 'text-blue-600';
            return {
                id: c.id,
                nombre: c.nombre || `Sillón ${i + 1}`,
                percent: pct,
                color,
                textColor
            };
        });
    }, [chairs, appointments]);

    // Filtrar doctores mientras se escribe
    const filteredDoctors = useMemo(() => {
        if (!doctorSearch.trim()) return doctors;
        const q = doctorSearch.toLowerCase();
        return doctors.filter(d => (d.nombre || '').toLowerCase().includes(q));
    }, [doctors, doctorSearch]);

    // Filtrar sedes mientras se escribe
    const filteredBranches = useMemo(() => {
        if (!branchSearch.trim()) return branches;
        const q = branchSearch.toLowerCase();
        return branches.filter(b => (b.nombre || '').toLowerCase().includes(q));
    }, [branches, branchSearch]);

    // Build the name robustly directly from the node
    const getFullName = (u) => {
        if (!u) return "?";
        return `${u.nombre || u.nombres || ''} ${u.apellido || u.apellidos || ''}`.trim() || u.nombreCompleto || u.email || "Doctor";
    };

    const selectedBranchName = branches.find(b => b.id === selectedBranch)?.nombre;
    const selectedDoctorObj = doctors.find(d => d.id === selectedDoctor);
    const selectedDoctorName = getFullName(selectedDoctorObj);

    return (
        <div className="w-full h-full flex flex-col gap-3">
            {/* Calendar Card */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-2 shrink-0">
                <MiniCalendar selectedDate={selectedDate} onDateChange={onDateChange} />
            </div>

            {/* Filters Card */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/30 shrink-0">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                        <FiFilter className="text-blue-600" size={12} />
                        <span>Filtros de Agenda</span>
                    </div>
                </div>

                {/* Accordion list */}
                <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">

                    {/* ─── SEDE / SUCURSAL ─── */}
                    <FilterAccordion
                        title={selectedBranch ? selectedBranchName : "Sede / Sucursal"}
                        icon={FiMapPin}
                        isOpen={openSections.sucursal}
                        onToggle={() => toggleSection('sucursal')}
                        count={selectedBranch ? 1 : 0}
                    >
                        {/* Buscador de sedes */}
                        {branches.length > 3 && (
                            <div className="relative mb-2 mt-1">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                <input
                                    type="text"
                                    placeholder="Buscar sede..."
                                    value={branchSearch}
                                    onChange={e => setBranchSearch(e.target.value)}
                                    className="w-full pl-8 pr-8 py-2 text-[10px] bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-300 placeholder:text-slate-300 font-bold uppercase transition-all"
                                />
                                {branchSearch && (
                                    <button onClick={() => setBranchSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                        <FiX size={11} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* "Todas las sedes" siempre visible */}
                        <div className="flex flex-col gap-1 mt-1">
                            <button
                                onClick={() => { onSelectBranch(''); toggleSection('sucursal'); }}
                                className={`text-left text-[10px] py-2 px-3 rounded-xl transition-all font-black uppercase tracking-tight flex items-center gap-2 ${
                                    !selectedBranch
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                            >
                                <FiMapPin size={11} />
                                Todas las sedes
                            </button>

                            {filteredBranches.map(branch => (
                                <button
                                    key={branch.id}
                                    onClick={() => { onSelectBranch(branch.id); toggleSection('sucursal'); }}
                                    className={`text-left text-[10px] py-2 px-3 rounded-xl transition-all font-black uppercase tracking-tight flex items-center gap-2 ${
                                        selectedBranch === branch.id
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                    }`}
                                >
                                    <FiMapPin size={11} />
                                    {branch.nombre}
                                </button>
                            ))}

                            {filteredBranches.length === 0 && branchSearch && (
                                <p className="text-[9px] text-slate-300 font-bold uppercase text-center py-2">Sin resultados</p>
                            )}
                        </div>
                    </FilterAccordion>

                    {/* ─── PROFESIONALES ─── */}
                    <FilterAccordion
                        title={selectedDoctor ? selectedDoctorName : (doctors.length === 1 ? getFullName(doctors[0]) : "Profesionales")}
                        icon={FiUser}
                        isOpen={openSections.profesionales}
                        onToggle={() => toggleSection('profesionales')}
                        count={selectedDoctor || doctors.length === 1 ? 1 : 0}
                    >
                        {doctors.length > 1 ? (
                            <>
                                {/* Buscador funcional */}
                                <div className="relative mb-2 mt-1">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                    <input
                                        type="text"
                                        placeholder="Buscar profesional..."
                                        value={doctorSearch}
                                        onChange={e => setDoctorSearch(e.target.value)}
                                        className="w-full pl-8 pr-8 py-2 text-[10px] bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-300 placeholder:text-slate-300 font-bold uppercase transition-all"
                                    />
                                    {doctorSearch && (
                                        <button onClick={() => setDoctorSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                            <FiX size={11} />
                                        </button>
                                    )}
                                </div>

                                {/* Lista filtrada */}
                                <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto custom-scrollbar pr-0.5">
                                    {/* "Todos" solo si no hay búsqueda activa */}
                                    {!doctorSearch && (
                                        <button
                                            onClick={() => { onSelectDoctor(null); toggleSection('profesionales'); }}
                                            className={`text-left text-[10px] py-2 px-3 rounded-xl transition-all font-black uppercase tracking-tight flex items-center gap-2 ${
                                                !selectedDoctor
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                            }`}
                                        >
                                            <FiUser size={11} />
                                            Todos los profesionales
                                        </button>
                                    )}

                                    {filteredDoctors.map(doc => (
                                        <button
                                            key={doc.id}
                                            onClick={() => { onSelectDoctor(doc.id); setDoctorSearch(''); toggleSection('profesionales'); }}
                                            className={`text-left text-[10px] py-2 px-3 rounded-xl transition-all font-black uppercase tracking-tight flex items-center gap-2 ${
                                                selectedDoctor === doc.id
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                            }`}
                                        >
                                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[8px] font-black shrink-0">
                                                {(getFullName(doc) || '?')[0].toUpperCase()}
                                            </span>
                                            <span className="truncate">{getFullName(doc)}</span>
                                        </button>
                                    ))}

                                    {filteredDoctors.length === 0 && (
                                        <p className="text-[9px] text-slate-300 font-bold uppercase text-center py-3">
                                            {doctorSearch ? 'Sin resultados' : 'No hay doctores registrados'}
                                        </p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-1 p-1">
                                <div className="text-left text-[10px] py-2 px-3 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200 font-black uppercase tracking-tight flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[8px] font-black shrink-0">
                                        {(getFullName(doctors[0]) || '?')[0].toUpperCase()}
                                    </span>
                                    <span className="truncate">{getFullName(doctors[0])}</span>
                                </div>
                            </div>
                        )}
                    </FilterAccordion>

                </div>

            </div>
        </div>
    );
}
