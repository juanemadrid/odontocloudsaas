import React, { useState } from "react";
import EvolutionList from "./EvolutionList";
import EvolutionModal from "./EvolutionModal";
import RemissionModal from "./RemissionModal";
import { FiPlus, FiPrinter, FiSearch, FiHome } from "react-icons/fi";
import { EvolutionPrintService } from "../../../services/EvolutionPrintService";
import { useAuth } from "../../../context/AuthContext";
import { isDoctorUser, isDoctorAssignedToPatient } from "../../../utils/doctorHelpers";
import supabase from "../../../lib/supabaseClient";
import { toast } from "sonner";

export default function EvolucionesTab({ patient }) {
    const { userProfile } = useAuth();
    const isDoctor = isDoctorUser(userProfile);
    const isAssigned = isDoctorAssignedToPatient(userProfile, patient);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null); // 'evolution' | 'remission'
    const [editingEvo, setEditingEvo] = useState(null);
    const [searchTerms, setSearchTerms] = useState("");
    const [isPrinting, setIsPrinting] = useState(false);

    const [refreshKey, setRefreshKey] = useState(0);

    const handleSaveSuccess = () => {
        setModalOpen(false);
        setEditingEvo(null);
        setRefreshKey(prev => prev + 1);
    };

    const handleOpenEvolution = () => {
        if (isDoctor && !isAssigned) {
            toast.error("No estás asignado como profesional tratante de este paciente. Solo los profesionales vinculados pueden registrar evoluciones.");
            return;
        }
        setEditingEvo(null);
        setModalType("evolution");
        setModalOpen(true);
    };

    const handleOpenRemission = () => {
        if (isDoctor && !isAssigned) {
            toast.error("No estás asignado como profesional tratante de este paciente. Solo los profesionales vinculados pueden registrar remisiones.");
            return;
        }
        setEditingEvo(null);
        setModalType("remission");
        setModalOpen(true);
    };

    const handleEdit = (evo) => {
        if (isDoctor) {
            if (!isAssigned) {
                toast.error("No estás asignado como profesional a este paciente.");
                return;
            }
            const currentUid = String(userProfile?.uid || userProfile?.id || '').toLowerCase();
            const evoDocId = String(evo.doctorId || evo.profesionalId || evo.profesional_id || '').toLowerCase();
            const currentName = (userProfile?.nombreCompleto || userProfile?.nombre || '').toLowerCase().trim();
            const evoDocName = (evo.profesional || evo.doctorName || '').toLowerCase().trim();
            
            const isOwn = (currentUid && evoDocId && currentUid === evoDocId) || 
                          (currentName && evoDocName && (currentName === evoDocName || currentName.includes(evoDocName) || evoDocName.includes(currentName)));
            
            if (!isOwn) {
                toast.error("No puedes modificar una evolución registrada por otro profesional.");
                return;
            }
        }
        setEditingEvo(evo);
        setModalType(evo.type === 'remission' ? 'remission' : 'evolution');
        setModalOpen(true);
    };

    const handlePrintAll = async () => {
        if (!patient?.id) {
            toast.error("Seleccione un paciente primero.");
            return;
        }

        setIsPrinting(true);
        try {
            const { data: evosData } = await supabase
                .from("evoluciones")
                .select("*")
                .eq("paciente_id", patient.id)
            const evos = (evosData || []).map(d => {
                let parsedTratamiento = {};
                if (d.tratamiento) {
                    if (typeof d.tratamiento === 'object') {
                        parsedTratamiento = d.tratamiento;
                    } else if (typeof d.tratamiento === 'string' && d.tratamiento.startsWith('{')) {
                        try {
                            parsedTratamiento = JSON.parse(d.tratamiento);
                        } catch (e) {}
                    }
                }

                return {
                    ...d,
                    ...parsedTratamiento,
                    id: d.id,
                    description: d.comentario || parsedTratamiento.description || parsedTratamiento.comentario || d.description || '',
                    date: d.fecha || d.created_at || new Date(),
                    profesional: parsedTratamiento.profesional || d.profesional || '',
                    profesionalId: parsedTratamiento.profesionalId || d.profesional_id || '',
                    plantillaItems: parsedTratamiento.plantillaItems || d.plantillaItems || {},
                    doctorSignature: parsedTratamiento.doctorSignature || d.doctorSignature || null,
                };
            });

            await EvolutionPrintService.generatePDF(evos, patient, {}, userProfile);
        } catch (error) {
            console.error("Error printing evolutions history:", error);
            toast.error("Error al obtener evoluciones para imprimir");
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/10 animate-fadeIn min-h-0 relative overflow-hidden">
            {/* Header */}
            <div className="flex-none px-4 sm:px-6 py-4 sm:py-6 md:px-10 flex flex-col gap-4 border-b border-slate-100 bg-white sticky top-0 z-20 shadow-sm">
                
                {/* Top Row: Title & Print */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                        <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase whitespace-nowrap">
                            Evoluciones & Remisiones
                        </h2>
                        <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-slate-400">
                           <FiHome size={12} className="text-slate-300" /> 
                           <span className="text-slate-300">-</span> 
                           <span className="uppercase tracking-widest">Pacientes</span> 
                           <span className="text-slate-300">-</span> 
                           <span className="text-slate-500 uppercase tracking-widest">Evoluciones & Remisiones</span>
                        </div>
                    </div>
                    
                    <button 
                        type="button" 
                        onClick={handlePrintAll}
                        disabled={isPrinting}
                        className="shrink-0 px-4 sm:px-6 py-2 bg-lime-500 hover:bg-lime-600 disabled:opacity-50 text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-lime-500/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                         <FiPrinter size={12} className="hidden sm:block" /> {isPrinting ? "Generando..." : "Imprimir"}
                    </button>
                </div>

                {/* Bottom Row: Search & Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                     <div className="relative w-full sm:w-80">
                         <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                         <input 
                             type="text" 
                             placeholder="Buscar..." 
                             value={searchTerms}
                             onChange={(e) => setSearchTerms(e.target.value)}
                             className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-[11px] font-bold text-slate-600 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder:text-slate-300 uppercase"
                         />
                     </div>
                     <div className="flex items-center gap-2 w-full sm:w-auto">
                         <button 
                             onClick={handleOpenEvolution}
                             title={isDoctor && !isAssigned ? "No asignado como profesional a este paciente" : "Nueva evolución"}
                             className={`flex-1 sm:flex-none px-5 sm:px-8 py-2.5 sm:py-3 rounded-full font-black text-[11px] uppercase tracking-widest shadow-md transition-all active:scale-95 text-center ${
                                 isDoctor && !isAssigned 
                                     ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none" 
                                     : "bg-[#8dc63f] hover:bg-[#7cb035] text-white shadow-lime-500/20"
                             }`}
                         >
                              Evolución
                         </button>
                         <button 
                             onClick={handleOpenRemission}
                             title={isDoctor && !isAssigned ? "No asignado como profesional a este paciente" : "Nueva remisión"}
                             className={`flex-1 sm:flex-none px-5 sm:px-8 py-2.5 sm:py-3 rounded-full font-black text-[11px] uppercase tracking-widest shadow-md transition-all active:scale-95 text-center ${
                                 isDoctor && !isAssigned 
                                     ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none" 
                                     : "bg-[#8dc63f] hover:bg-[#7cb035] text-white shadow-lime-500/20"
                             }`}
                         >
                              Remitir
                         </button>
                     </div>
                </div>

                {isDoctor && !isAssigned && (
                    <div className="bg-amber-50 border border-amber-200/80 text-amber-800 px-4 py-2.5 rounded-2xl text-[11px] font-bold flex items-center gap-2 shadow-sm">
                        <span className="text-amber-500 text-sm">⚠️</span>
                        <span>Modo de solo consulta: No estás vinculado como profesional tratante a este paciente. Solo los doctores asignados en la pestaña "Profesionales" pueden registrar evoluciones a su propio nombre.</span>
                    </div>
                )}
            </div>

            {/* Timeline Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                <EvolutionList patientId={patient?.id} patientName={patient?.nombreCompleto || patient?.nombre || ''} patientObj={patient} onEdit={handleEdit} searchTerm={searchTerms} refreshKey={refreshKey} />
            </div>

            {/* Float Modal Container */}
            {modalOpen && modalType === 'evolution' && (
                <EvolutionModal 
                    isOpen={modalOpen} 
                    onClose={() => {
                        setModalOpen(false);
                        setEditingEvo(null);
                    }} 
                    onSave={handleSaveSuccess}
                    patient={patient} 
                    initialData={editingEvo}
                />
            )}

            {/* Float Modal Remission */}
            {modalOpen && modalType === 'remission' && (
                <RemissionModal 
                    isOpen={modalOpen} 
                    onClose={() => {
                        setModalOpen(false);
                        setEditingEvo(null);
                    }} 
                    onSave={handleSaveSuccess}
                    patient={patient} 
                    initialData={editingEvo}
                />
            )}
        </div>
    );
}
