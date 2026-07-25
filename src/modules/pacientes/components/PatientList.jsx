import React, { useMemo, useState } from "react";
import Skeleton from "../../../components/ui/Skeleton";
import { FiUsers, FiSearch, FiFilter, FiPlus, FiEdit2, FiTrash2, FiUserX, FiUserCheck, FiUpload } from "react-icons/fi";

export default function PatientList({
    pacientes,
    loading,
    isSearching = false,
    onSelect,
    onEdit,
    searchTerm,
    onSearchChange,
    onCreateNew,
    onImportClick,
    onToggleStatus,
    onDelete
}) {
    const [showInactive, setShowInactive] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [patientToDelete, setPatientToDelete] = useState(null);
    const [showToggleConfirm, setShowToggleConfirm] = useState(false);
    const [patientToToggle, setPatientToToggle] = useState(null);

    const displayList = useMemo(() => {
        let res = pacientes;
        if (showInactive) {
            res = res.filter(p => p.activo === false);
        } else {
            res = res.filter(p => p.activo !== false);
        }
        return res;
    }, [pacientes, showInactive]);

    const handleToggleStatus = (e, p) => {
        e.stopPropagation();
        setPatientToToggle(p);
        setShowToggleConfirm(true);
    };

    const hasSearchTerm = Boolean(searchTerm && searchTerm.trim());

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiUsers size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Gestión de Pacientes</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Expedientes clínicos, historia odontológica y registro general de pacientes</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <button
                        onClick={() => setShowInactive(!showInactive)}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition-colors border cursor-pointer ${
                            showInactive
                                ? "bg-slate-800 text-white border-slate-800"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                        {showInactive ? "Ver Activos" : "Ver Inactivos"}
                    </button>

                    <button
                        onClick={onImportClick}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <FiUpload size={14} />
                        <span>Importar Excel</span>
                    </button>

                    <button
                        onClick={onCreateNew}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Paciente</span>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        placeholder="Buscar por nombre, documento de identidad, celular o correo..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        autoFocus
                    />
                </div>

                {hasSearchTerm && (
                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                        <span className="text-[11px] font-medium text-slate-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                            Resultados: {displayList.length}
                        </span>
                    </div>
                )}
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Paciente</th>
                            <th className="py-2.5 px-4">Identificación</th>
                            <th className="py-2.5 px-4 hidden md:table-cell">Fecha Registro</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {!hasSearchTerm ? (
                            <tr>
                                <td colSpan={4} className="py-14 text-center">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3">
                                        <FiSearch size={22} />
                                    </div>
                                    <h4 className="text-[14px] font-bold text-slate-800">Búsqueda de Pacientes</h4>
                                    <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
                                        Ingresa un nombre, apellido, documento de identidad, celular o correo en la barra superior para buscar un paciente.
                                    </p>
                                </td>
                            </tr>
                        ) : loading ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Buscando paciente en el sistema...
                                </td>
                            </tr>
                        ) : displayList.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron pacientes que coincidan con la búsqueda
                                </td>
                            </tr>
                        ) : (
                            displayList.map((p) => (
                                <tr
                                    key={p.id}
                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                    onClick={(e) => {
                                        if (e.target.closest('button')) return;
                                        onSelect(p);
                                    }}
                                >
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="relative shrink-0">
                                                {p.fotoUrl ? (
                                                    <img className="h-8 w-8 rounded-lg object-cover border border-slate-200" src={p.fotoUrl} alt="" />
                                                ) : (
                                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${getColorForName(p.nombreCompleto || "P")}`}>
                                                        {(p.nombreCompleto || p.paciente || "P")[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${p.activo !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-800 uppercase block">{p.nombreCompleto || "Sin Nombre"}</span>
                                                <span className="text-[10px] text-slate-400 block">{p.email || p.celular || "Sin contacto"}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">{p.tipoDocumento || "CC"}</span>
                                            <span className="font-medium text-slate-700">{p.nroDocumento || "—"}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 hidden md:table-cell text-slate-500 font-medium text-[11px]">
                                        {p.createdAt?.seconds
                                            ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
                                            : (p.creado?.seconds ? new Date(p.creado.seconds * 1000).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : "—")}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Paciente"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleStatus(e, p)}
                                                className={`w-7 h-7 rounded-lg text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0 ${
                                                    p.activo !== false ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'
                                                }`}
                                                title={p.activo !== false ? "Desactivar" : "Reactivar"}
                                            >
                                                {p.activo !== false ? <FiUserX size={13} /> : <FiUserCheck size={13} />}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPatientToDelete(p);
                                                    setShowDeleteConfirm(true);
                                                }}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Paciente"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL ELIMINAR */}
            {showDeleteConfirm && patientToDelete && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 text-center">
                        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                            <FiTrash2 size={20} />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold text-slate-800">¿Eliminar paciente?</h3>
                            <p className="text-[11px] text-slate-500 mt-1">
                                Esta acción eliminará a <strong className="text-slate-800">{patientToDelete.nombreCompleto}</strong>. Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-1.5 bg-slate-100 text-slate-700 font-semibold text-[12px] rounded-lg border border-slate-200 hover:bg-slate-200 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    onDelete(patientToDelete);
                                    setShowDeleteConfirm(false);
                                }}
                                className="flex-1 py-1.5 bg-rose-600 text-white font-bold text-[12px] rounded-lg hover:bg-rose-700 cursor-pointer border-0"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL INACTIVAR / REACTIVAR */}
            {showToggleConfirm && patientToToggle && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${
                            patientToToggle.activo !== false ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
                        }`}>
                            {patientToToggle.activo !== false ? <FiUserX size={20} /> : <FiUserCheck size={20} />}
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold text-slate-800">
                                {patientToToggle.activo !== false ? '¿Inactivar paciente?' : '¿Reactivar paciente?'}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-1">
                                Paciente: <strong className="text-slate-800">{patientToToggle.nombreCompleto}</strong>
                            </p>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                onClick={() => setShowToggleConfirm(false)}
                                className="flex-1 py-1.5 bg-slate-100 text-slate-700 font-semibold text-[12px] rounded-lg border border-slate-200 hover:bg-slate-200 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    onToggleStatus(patientToToggle);
                                    setShowToggleConfirm(false);
                                }}
                                className={`flex-1 py-1.5 text-white font-bold text-[12px] rounded-lg border-0 cursor-pointer ${
                                    patientToToggle.activo !== false ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'
                                }`}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function getColorForName(name) {
    const colors = [
        "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-lime-400",
        "bg-green-400", "bg-emerald-400", "bg-teal-400", "bg-cyan-400",
        "bg-sky-400", "bg-blue-400", "bg-indigo-400", "bg-violet-400",
        "bg-purple-400", "bg-fuchsia-400", "bg-pink-400", "bg-rose-400"
    ];
    const index = (name || "P").charCodeAt(0) % colors.length;
    return colors[index];
}
