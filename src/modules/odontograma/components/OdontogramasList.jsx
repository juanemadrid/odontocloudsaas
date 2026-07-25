import React from "react";
import { FiPlus, FiEye, FiEdit3, FiTrash2, FiCalendar, FiUser, FiClock } from "react-icons/fi";

export default function OdontogramasList({ sesiones, onSelect, onCreate, onDelete, loading }) {
    return (
        <div className="flex flex-col h-full bg-white animate-fadeIn">
            <header className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">Historial de <span className="text-indigo-600">Odontogramas</span></h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                        <FiClock className="text-indigo-500" /> Registro cronológico de sesiones clínicas
                    </p>
                </div>

                <button 
                    onClick={onCreate}
                    className="flex items-center gap-3 px-8 py-4 rounded-[22px] bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95"
                >
                    <FiPlus size={18} strokeWidth={3} />
                    Nuevo Odontograma
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Cargando registros...</span>
                    </div>
                ) : sesiones.length === 0 ? (
                    <div className="h-96 flex flex-col items-center justify-center text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[40px] px-10">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 mb-6">
                            <FiCalendar size={40} />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-2">No hay sesiones previas</h3>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-xs uppercase font-bold tracking-wider">Inicia un nuevo registro clínico para comenzar el seguimiento del paciente.</p>
                        <button 
                            onClick={onCreate}
                            className="mt-8 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                        >
                            + CREAR PRIMER REGISTRO
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {/* Table Header (Elite Style) */}
                        <div className="grid grid-cols-12 px-8 py-4 bg-slate-50 rounded-2xl text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <div className="col-span-3">Fecha de Sesión</div>
                            <div className="col-span-3">Creado por</div>
                            <div className="col-span-3">Estado</div>
                            <div className="col-span-3 text-right">Acciones</div>
                        </div>

                        {/* List Items */}
                        {sesiones.map((sesion) => (
                            <div key={sesion.id} className="grid grid-cols-12 items-center px-8 py-6 bg-white border border-slate-100 rounded-[28px] hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/20 transition-all group">
                                <div className="col-span-3 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                        <FiCalendar size={18} />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                            {sesion.fechaLabel || (sesion.creado?.toDate() || new Date()).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            {(sesion.creado?.toDate() || new Date()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-3 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <FiUser size={14} />
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tight truncate max-w-[150px]">
                                        {sesion.creadorNombre || "Profesional de Planta"}
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest
                                        ${sesion.estado === 'Finalizado' 
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${sesion.estado === 'Finalizado' ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`} />
                                        {sesion.estado || 'Abierto'}
                                    </div>
                                </div>

                                <div className="col-span-3 flex justify-end gap-2">
                                    <button 
                                        onClick={() => onSelect(sesion)}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-100"
                                    >
                                        {sesion.estado === 'Finalizado' ? <FiEye size={14} /> : <FiEdit3 size={14} />}
                                        {sesion.estado === 'Finalizado' ? "Ver" : "Continuar"}
                                    </button>
                                    <button 
                                        onClick={() => onDelete(sesion.id)}
                                        className="p-2.5 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all"
                                    >
                                        <FiTrash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <footer className="h-14 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-10">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Registros: {sesiones.length}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">© 2026 ODONTOCLOUD ELITE CORE</span>
            </footer>
        </div>
    );
}
