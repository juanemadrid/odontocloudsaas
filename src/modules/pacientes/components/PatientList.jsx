import React, { useMemo, useState, useRef, useEffect } from "react";
import Skeleton from "../../../components/ui/Skeleton";
import {
    FiUsers,
    FiSearch,
    FiFilter,
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiUserX,
    FiUserCheck,
    FiUpload,
    FiAlertTriangle,
    FiCheckSquare,
    FiSquare
} from "react-icons/fi";
import { usePermissions } from "../../../hooks/usePermissions";
import { useToast } from "../../../context/ToastContext";

export default function PatientList({
    pacientes,
    loading,
    isSearching = false,
    page = 0,
    pageSize = 5,
    totalCount = 0,
    onPageChange,
    onSelect,
    onEdit,
    searchTerm,
    onSearchChange,
    onCreateNew,
    onImportClick,
    onToggleStatus,
    onDelete
}) {
    const toast = useToast();
    const [showInactive, setShowInactive] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        patients: [],
        isDeleting: false
    });
    const [showToggleConfirm, setShowToggleConfirm] = useState(false);
    const [patientToToggle, setPatientToToggle] = useState(null);

    const headerCheckboxRef = useRef(null);

    const { can } = usePermissions();
    const canCreate = can("Pacientes", "Paciente", "crear");
    const canEdit = can("Pacientes", "Paciente", "editar");
    const canToggle = can("Pacientes", "Paciente", "desactivar");
    const canDelete = can("Pacientes", "Paciente", "eliminar");

    // Limpiar selección al cambiar de página, búsqueda o filtro activo/inactivo
    useEffect(() => {
        setSelectedIds([]);
    }, [page, searchTerm, showInactive]);

    const displayList = useMemo(() => {
        let res = pacientes;
        if (showInactive) {
            res = res.filter(p => p.activo === false);
        } else {
            res = res.filter(p => p.activo !== false);
        }
        return res;
    }, [pacientes, showInactive]);

    const isAllSelected = displayList.length > 0 && displayList.every((p) => selectedIds.includes(p.id));
    const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

    useEffect(() => {
        if (headerCheckboxRef.current) {
            headerCheckboxRef.current.indeterminate = isSomeSelected;
        }
    }, [isSomeSelected]);

    const handleToggleSelect = (e, id) => {
        e.stopPropagation();
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (e) => {
        e.stopPropagation();
        if (isAllSelected) {
            const visibleIds = new Set(displayList.map((p) => p.id));
            setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
        } else {
            const visibleIds = displayList.map((p) => p.id);
            setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const handleOpenSingleDelete = (e, p) => {
        e.stopPropagation();
        setDeleteModal({
            isOpen: true,
            patients: [p],
            isDeleting: false
        });
    };

    const handleOpenBulkDelete = () => {
        if (selectedIds.length === 0) {
            toast?.info?.("Selecciona al menos un paciente para eliminar marcando su casilla.");
            return;
        }
        const patientsToDelete = (pacientes || []).filter((p) => selectedIds.includes(p.id));
        const list = patientsToDelete.length > 0 ? patientsToDelete : selectedIds.map((id) => ({ id, nombreCompleto: "Paciente seleccionado" }));
        setDeleteModal({
            isOpen: true,
            patients: list,
            isDeleting: false
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.patients.length) return;
        setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
        try {
            await onDelete(deleteModal.patients);
            const deletedIds = new Set(deleteModal.patients.map((p) => p.id));
            setSelectedIds((prev) => prev.filter((id) => !deletedIds.has(id)));
            setDeleteModal({ isOpen: false, patients: [], isDeleting: false });
        } catch (err) {
            console.error("Error al eliminar pacientes:", err);
            setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
        }
    };

    const handleToggleStatus = (e, p) => {
        e.stopPropagation();
        setPatientToToggle(p);
        setShowToggleConfirm(true);
    };

    const formatRegistrationDate = (p) => {
        const raw = p?.created_at || p?.createdAt || p?.creado || p?.fecha_creacion || p?.fecha_registro || p?.updated_at;
        if (!raw) return "—";
        if (typeof raw === "object" && raw?.seconds) {
            return new Date(raw.seconds * 1000).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        const d = new Date(raw);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const hasSearchTerm = Boolean(searchTerm && searchTerm.trim());

    return (
        <div className="p-4 md:p-6 w-full max-w-[1800px] mx-auto space-y-4">

            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiUsers size={18} />
                    </div>
                    <div>
                        <h2 className="text-[14px] font-extrabold text-slate-800 tracking-tight">Directorio de Pacientes</h2>
                        <p className="text-[11px] text-slate-500">Gestión de expedientes e historial clínico</p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={() => setShowInactive(!showInactive)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                            showInactive
                                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                        {showInactive ? "Ver Activos" : "Ver Inactivos"}
                    </button>


                    {canCreate && (
                        <>
                            <button
                                onClick={onImportClick}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                title="Importar Pacientes ATM o archivo Excel/CSV"
                            >
                                <FiUpload size={14} className="text-blue-600" />
                                <span>Importar Pacientes (Excel / ATM)</span>
                            </button>

                            <button
                                onClick={onCreateNew}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                            >
                                <FiPlus size={16} />
                                <span>Nuevo Paciente</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Selection Banner (cuando hay elementos seleccionados) */}
            {selectedIds.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[12px] text-rose-900 shadow-xs animate-fadeIn">
                    <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                        <span className="font-bold">
                            {selectedIds.length} {selectedIds.length === 1 ? "paciente seleccionado" : "pacientes seleccionados"}
                        </span>
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <button
                            type="button"
                            onClick={() => setSelectedIds([])}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer bg-transparent border-0"
                        >
                            Deseleccionar todos
                        </button>
                    </div>

                    {canDelete && (
                        <button
                            type="button"
                            onClick={handleOpenBulkDelete}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border-0"
                        >
                            <FiTrash2 size={13} />
                            <span>
                                {selectedIds.length === 1
                                    ? "Eliminar paciente seleccionado"
                                    : `Eliminar ${selectedIds.length} pacientes masivamente`}
                            </span>
                        </button>
                    )}
                </div>
            )}

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

                {hasSearchTerm ? (
                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                        <span className="text-[11px] font-medium text-slate-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                            Resultados: {displayList.length}
                        </span>
                    </div>
                ) : totalCount > 0 ? (
                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                            Total: <strong className="text-slate-800 font-bold">{totalCount}</strong> pacientes
                        </span>
                    </div>
                ) : null}
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-10 text-center">
                                <input
                                    ref={headerCheckboxRef}
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={handleSelectAll}
                                    disabled={loading || displayList.length === 0}
                                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer accent-rose-600 transition disabled:opacity-30 align-middle"
                                    title="Seleccionar / deseleccionar todos los visibles"
                                    aria-label="Seleccionar todos"
                                />
                            </th>
                            <th className="py-2.5 px-4">Paciente</th>
                            <th className="py-2.5 px-4">Identificación</th>
                            <th className="py-2.5 px-4 hidden md:table-cell">Fecha Registro</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    {hasSearchTerm ? "Buscando paciente en el sistema..." : "Cargando directorio de pacientes..."}
                                </td>
                            </tr>
                        ) : displayList.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-14 text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                                        <FiSearch size={22} />
                                    </div>
                                    <h4 className="text-[14px] font-bold text-slate-800">
                                        {hasSearchTerm ? "No se encontraron pacientes" : "No hay pacientes registrados"}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
                                        {hasSearchTerm
                                            ? "Intenta buscar por otro nombre, documento, teléfono o correo."
                                            : "Aún no hay pacientes en esta clínica. Puedes registrar uno nuevo o importarlos desde Excel."}
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            displayList.map((p) => {
                                const isSelected = selectedIds.includes(p.id);
                                return (
                                    <tr
                                        key={p.id}
                                        className={`transition-colors cursor-pointer ${
                                            isSelected ? 'bg-rose-50/50 hover:bg-rose-50/80' : 'hover:bg-slate-50/80'
                                        }`}
                                        onClick={(e) => {
                                            if (e.target.closest('button') || e.target.closest('input[type="checkbox"]')) return;
                                            onSelect(p);
                                        }}
                                    >
                                        <td className="py-2.5 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => handleToggleSelect(e, p.id)}
                                                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer accent-rose-600 transition align-middle"
                                                aria-label={`Seleccionar paciente ${p.nombreCompleto || 'paciente'}`}
                                            />
                                        </td>
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
                                            {formatRegistrationDate(p)}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                {canEdit && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                                                        className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                        title="Editar Paciente"
                                                    >
                                                        <FiEdit2 size={13} />
                                                    </button>
                                                )}
                                                {canToggle && (
                                                    <button
                                                        onClick={(e) => handleToggleStatus(e, p)}
                                                        className={`w-7 h-7 rounded-lg text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0 ${
                                                            p.activo !== false ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'
                                                        }`}
                                                        title={p.activo !== false ? "Desactivar" : "Reactivar"}
                                                    >
                                                        {p.activo !== false ? <FiUserX size={13} /> : <FiUserCheck size={13} />}
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={(e) => handleOpenSingleDelete(e, p)}
                                                        className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                        title="Eliminar Paciente"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Controles de Paginación */}
                {!hasSearchTerm && totalCount > 0 && (
                    <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-slate-600">
                        <div>
                            Mostrando <span className="font-bold text-slate-800">{Math.min(page * pageSize + 1, totalCount)}</span> a{" "}
                            <span className="font-bold text-slate-800">{Math.min((page + 1) * pageSize, totalCount)}</span> de{" "}
                            <span className="font-bold text-slate-800">{totalCount}</span> pacientes
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => onPageChange && onPageChange(page - 1)}
                                disabled={page === 0 || loading}
                                className="px-3 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs text-[11px]"
                            >
                                Anterior
                            </button>

                            <span className="px-2.5 py-1 font-bold text-slate-700 bg-white border border-slate-200 rounded-md text-[11px] shadow-2xs">
                                Página {page + 1} de {Math.max(1, Math.ceil(totalCount / pageSize))}
                            </span>

                            <button
                                onClick={() => onPageChange && onPageChange(page + 1)}
                                disabled={(page + 1) * pageSize >= totalCount || loading}
                                className="px-3 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs text-[11px]"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL CONFIRMACIÓN DE ELIMINACIÓN (INDIVIDUAL O MASIVO) */}
            {deleteModal.isOpen && deleteModal.patients.length > 0 && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-inner">
                            <FiTrash2 size={24} />
                        </div>

                        <div className="text-center space-y-2">
                            <h3 className="text-[16px] font-extrabold text-slate-800 tracking-tight">
                                {deleteModal.patients.length === 1
                                    ? "¿Eliminar paciente?"
                                    : `¿Eliminar ${deleteModal.patients.length} pacientes?`}
                            </h3>

                            {deleteModal.patients.length === 1 ? (
                                <div className="space-y-2">
                                    <p className="text-[12px] text-slate-600">
                                        ¿Estás seguro de que deseas eliminar permanentemente a este paciente?
                                    </p>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                                        <span className="font-bold text-slate-800 block text-[13px]">
                                            {deleteModal.patients[0]?.nombreCompleto || deleteModal.patients[0]?.paciente || "Sin Nombre"}
                                        </span>
                                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                                            <span>Doc: <strong className="text-slate-700">{deleteModal.patients[0]?.nroDocumento || deleteModal.patients[0]?.documento || "—"}</strong></span>
                                            <span>•</span>
                                            <span>{deleteModal.patients[0]?.celular || deleteModal.patients[0]?.telefono || deleteModal.patients[0]?.email || "Sin contacto"}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[12px] text-slate-600">
                                        Estás a punto de eliminar <strong className="text-rose-600 font-bold">{deleteModal.patients.length} pacientes</strong> seleccionados.
                                    </p>
                                    <div className="max-h-36 overflow-y-auto custom-scrollbar bg-slate-50 border border-slate-200 rounded-xl p-3 text-left divide-y divide-slate-100">
                                        {deleteModal.patients.map((p, idx) => (
                                            <div key={p.id || idx} className="py-1.5 flex items-center justify-between text-[11px]">
                                                <span className="font-semibold text-slate-800 truncate mr-2">
                                                    {p.nombreCompleto || p.paciente || "Paciente sin nombre"}
                                                </span>
                                                <span className="text-slate-500 font-mono shrink-0">
                                                    {p.nroDocumento || p.documento || "—"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] text-left">
                                <FiAlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={15} />
                                <span>
                                    <strong>Atención:</strong> Esta acción no se puede deshacer. Se eliminarán los expedientes, citas, evoluciones e historial clínico asociado.
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 pt-2">
                            <button
                                type="button"
                                disabled={deleteModal.isDeleting}
                                onClick={() => setDeleteModal({ isOpen: false, patients: [], isDeleting: false })}
                                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12px] rounded-xl border border-slate-200 cursor-pointer disabled:opacity-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={deleteModal.isDeleting}
                                onClick={handleConfirmDelete}
                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[12px] rounded-xl cursor-pointer border-0 shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {deleteModal.isDeleting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Eliminando...</span>
                                    </>
                                ) : (
                                    <span>
                                        {deleteModal.patients.length === 1
                                            ? "Sí, eliminar paciente"
                                            : `Sí, eliminar (${deleteModal.patients.length})`}
                                    </span>
                                )}
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
