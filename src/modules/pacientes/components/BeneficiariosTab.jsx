import React, { useState, useEffect, useRef } from 'react';
import { FiAlertCircle, FiSearch, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import supabase from '../../../lib/supabaseClient';
import { useToast } from '../../../context/ToastContext';
import { searchPatients } from '../../../services/patientService';

export default function BeneficiariosTab({ patient, onUpdate, onSwitchTab }) {
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Autocomplete states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const dropdownRef = useRef(null);

    // Delete confirmation modal state
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    // Check if patient actually has a "convenioBeneficio" string or assigned field
    const hasConvenio = patient?.convenioBeneficio && patient.convenioBeneficio.trim() !== "";
    const currentHistorial = patient?.historial_medico || patient?.historialMedico || {};
    const beneficiarios = (Array.isArray(patient?.beneficiarios) && patient.beneficiarios.length > 0)
        ? patient.beneficiarios
        : (Array.isArray(currentHistorial?.beneficiarios) ? currentHistorial.beneficiarios : []);

    const handleAssignClick = () => {
        if (onSwitchTab) onSwitchTab('mark'); 
    };

    // Close search dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Search patients in the system
    useEffect(() => {
        let isCurrent = true;
        const fetchPatients = async () => {
            if (!searchQuery || searchQuery.trim().length < 1) {
                setSearchResults([]);
                return;
            }
            try {
                const tenantId = patient?.inquilino || patient?.tenant_id;
                const results = await searchPatients(tenantId, searchQuery);
                if (!isCurrent) return;
                // Exclude current patient and already added beneficiaries from results
                const currentBens = (Array.isArray(patient?.beneficiarios) && patient.beneficiarios.length > 0)
                    ? patient.beneficiarios
                    : (patient?.historial_medico?.beneficiarios || []);
                const filteredResults = (results || []).filter(p => p.id !== patient?.id && !currentBens.some(b => b.id === p.id));
                setSearchResults(filteredResults);
            } catch (e) {
                console.error("Error searching patients for beneficiaries:", e);
            }
        };

        fetchPatients();
        return () => {
            isCurrent = false;
        };
    }, [searchQuery, patient?.id, patient?.inquilino, patient?.tenant_id]);

    // Clear selected patient if user manually edits search query
    useEffect(() => {
        if (selectedPatient) {
            const nombre = selectedPatient.nombreCompleto || `${selectedPatient.nombres || ""} ${selectedPatient.apellidos || ""}`.trim();
            if (searchQuery !== nombre) {
                setSelectedPatient(null);
            }
        }
    }, [searchQuery, selectedPatient]);

    // Add selected autocomplete patient
    const handleAddClick = async () => {
        if (!selectedPatient) {
            toast.warn("Por favor busque y seleccione un paciente de la lista para agregarlo como beneficiario.");
            return;
        }

        // Check if already in the list
        const exists = beneficiarios.some(b => b.id === selectedPatient.id);
        if (exists) {
            toast.warn("Este beneficiario ya se encuentra agregado.");
            return;
        }

        setIsSubmitting(true);
        try {
            const newBen = {
                id: selectedPatient.id,
                nombre: selectedPatient.nombreCompleto || `${selectedPatient.nombres || ""} ${selectedPatient.apellidos || ""}`.trim(),
                documento: selectedPatient.nroDocumento || selectedPatient.documento || '',
                direccion: selectedPatient.direccion || selectedPatient.barrio || selectedPatient.lugarResidencia || '',
                telefono: selectedPatient.celular || selectedPatient.telefono || '',
                createdAt: Date.now()
            };
            const updatedList = [...beneficiarios, newBen];
            const currentHist = patient?.historial_medico || patient?.historialMedico || {};
            const newHistorial = {
                ...currentHist,
                beneficiarios: updatedList
            };

            const { error } = await supabase
                .from("pacientes")
                .update({
                    historial_medico: newHistorial,
                    updated_at: new Date().toISOString()
                })
                .eq("id", patient.id);

            if (error) throw error;

            onUpdate && onUpdate({
                ...patient,
                beneficiarios: updatedList,
                historial_medico: newHistorial,
                historialMedico: newHistorial
            });
            toast.success("Beneficiario agregado exitosamente");
            setSearchQuery('');
            setSelectedPatient(null);
        } catch (e) {
            console.error("Error al agregar beneficiario:", e);
            toast.error("Error al agregar beneficiario");
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async (targetId) => {
        if (!targetId) return;
        setIsSubmitting(true);
        try {
            const updatedList = beneficiarios.filter(b => b.id !== targetId);
            const currentHist = patient?.historial_medico || patient?.historialMedico || {};
            const newHistorial = {
                ...currentHist,
                beneficiarios: updatedList
            };

            const { error } = await supabase
                .from("pacientes")
                .update({
                    historial_medico: newHistorial,
                    updated_at: new Date().toISOString()
                })
                .eq("id", patient.id);

            if (error) throw error;

            onUpdate && onUpdate({
                ...patient,
                beneficiarios: updatedList,
                historial_medico: newHistorial,
                historialMedico: newHistorial
            });
            toast.success("Beneficiario eliminado correctamente");
            setDeleteConfirmId(null);
        } catch (e) {
            console.error("Error al eliminar beneficiario:", e);
            toast.error("Error al eliminar beneficiario");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Si NO tiene convenio, mostrar un "Modal" o Empty State bloqueante en vez de la tabla
    if (!hasConvenio) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 relative p-6 animate-fadeIn">
                <div className="bg-white p-10 md:p-14 rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] flex flex-col items-center max-w-lg w-full text-center border border-slate-100">
                    <div className="w-24 h-24 rounded-full bg-orange-50 border-[6px] border-white shadow-lg flex items-center justify-center mb-6">
                        <FiAlertCircle className="text-orange-400" size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Sin convenio</h3>
                    <p className="text-slate-500 font-medium mb-8">El paciente no tiene ningún convenio asignado.</p>
                    
                    <div className="flex items-center gap-4 w-full">
                        <button 
                            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase tracking-wider transition-all active:scale-95"
                            onClick={() => onSwitchTab && onSwitchTab('datos')}
                        >
                            No, cancelar!
                        </button>
                        <button 
                            className="flex-1 py-3.5 bg-red-400 hover:bg-red-500 text-white shadow-lg shadow-red-400/30 rounded-xl font-bold uppercase tracking-wider transition-all active:scale-95"
                            onClick={handleAssignClick}
                        >
                            Asignar!
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 animate-fadeIn flex flex-col min-h-0 h-full">
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0 flex-1">
                
                {/* TOOLBAR */}
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 shrink-0">
                    <div ref={dropdownRef} className="relative w-full md:w-96">
                        <input 
                            type="text" 
                            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-slate-700"
                            placeholder="Buscar beneficiario..." 
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowDropdown(true);
                            }}
                            onFocus={() => setShowDropdown(true)}
                        />
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />

                        {showDropdown && searchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto">
                                {searchResults.map(p => {
                                    const nombre = p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`.trim();
                                    const docText = p.tipoDocumento ? `${p.tipoDocumento} - ${p.nroDocumento || p.documento}` : (p.nroDocumento || p.documento ? `Doc: ${p.nroDocumento || p.documento}` : '');
                                    return (
                                        <button 
                                            key={p.id} 
                                            type="button" 
                                            onClick={() => {
                                                setSelectedPatient(p);
                                                setSearchQuery(nombre);
                                                setShowDropdown(false);
                                            }}
                                            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors flex flex-col"
                                        >
                                            <span className="text-xs font-bold text-slate-800">{nombre}</span>
                                            {docText && <span className="text-[10px] text-slate-400 font-medium mt-0.5">{docText}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={handleAddClick}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 flex items-center gap-2 transition-all active:scale-95 shrink-0"
                    >
                        <FiPlus size={14} /> Agregar
                    </button>
                </div>

                {/* TABLE */}
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="bg-[#f8fafc] sticky top-0 z-10 shadow-[0_1px_0_0_#f1f5f9]">
                            <tr>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Nombre</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Nro documento</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Dirección</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Teléfono</th>
                                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {beneficiarios.length > 0 ? (
                                beneficiarios.map(ben => (
                                    <tr key={ben.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6 font-bold text-sm text-slate-800">{ben.nombre}</td>
                                        <td className="py-4 px-6 text-sm text-slate-600">{ben.documento || '---'}</td>
                                        <td className="py-4 px-6 text-sm text-slate-600">{ben.direccion || '---'}</td>
                                        <td className="py-4 px-6 text-sm text-slate-600">{ben.telefono || '---'}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    type="button"
                                                    className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm active:scale-95"
                                                    onClick={() => setDeleteConfirmId(ben.id)}
                                                    title="Eliminar beneficiario"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="py-16 text-center">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No hay información disponible</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>

            {/* CONFIRMATION DELETE MODAL */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl w-full max-w-md border border-slate-100 shadow-2xl p-6 md:p-8 text-center animate-scaleUp">
                        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 border-4 border-red-100 flex items-center justify-center mx-auto mb-4">
                            <FiTrash2 size={28} />
                        </div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                            ¿Confirmar Eliminación?
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mb-6">
                            ¿Está seguro de que desea eliminar a este beneficiario del convenio?
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => confirmDelete(deleteConfirmId)}
                                disabled={isSubmitting}
                                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? "Eliminando..." : "Sí, Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
