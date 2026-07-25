import React, { useState } from 'react';
import { FiSearch, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { collection, setDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';

export default function ProfesionalesTab({ patient, onUpdate }) {
    const toast = useToast();
    const { userProfile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [catalogProfesionales, setCatalogProfesionales] = useState([]);
    const [especialidadesMap, setEspecialidadesMap] = useState({});
    const [selectedProfId, setSelectedProfId] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const profesionales = patient?.profesionales || [];

    // Load available professionals from DB
    React.useEffect(() => {
        const loadCatalog = async () => {
            if (!userProfile?.inquilino) return;
            try {
                const q = query(
                    collection(db, "profesionales"), 
                    where("inquilino", "==", userProfile.inquilino), 
                    where("activo", "==", true)
                );
                const snap = await getDocs(q);
                const data = snap.docs.map(doc => {
                    const d = doc.data();
                    return { 
                        id: doc.id, 
                        nombreCompleto: d.nombreCompleto || d.nombre || "",
                        ...d
                    };
                });
                setCatalogProfesionales(data.sort((a,b) => a.nombreCompleto?.localeCompare(b.nombreCompleto) || 0));

                // Cargar especialidades para el mapeo visual
                const espQ = query(
                    collection(db, "especialidades"), 
                    where("inquilino", "==", userProfile.inquilino)
                );
                const espSnap = await getDocs(espQ);
                const eMap = {};
                espSnap.forEach(e => {
                    eMap[e.id] = e.data().nombre || "Sin nombre";
                });
                setEspecialidadesMap(eMap);
            } catch (err) {
                console.error("Error cargando profesionales:", err);
            }
        };
        loadCatalog();
    }, [userProfile]);

    const handleAddSelect = async () => {
        let finalProfId = selectedProfId;

        // Auto-resolve if user just typed the name without clicking
        if (!finalProfId && searchTerm.trim()) {
            const matches = catalogProfesionales.filter(p => 
                (p.nombreCompleto || p.nombre || "").toLowerCase() === searchTerm.toLowerCase().trim() ||
                (p.nombreCompleto || p.nombre || "").toLowerCase().includes(searchTerm.toLowerCase().trim())
            );
            if (matches.length === 1) {
                finalProfId = matches[0].id;
            } else if (matches.length > 1) {
                return toast.warning("Hay varios profesionales con ese nombre, por favor seleccione uno de la lista.");
            }
        }

        if (!finalProfId) return toast.warning("Seleccione o escriba el nombre completo del profesional");
        
        const profData = catalogProfesionales.find(p => p.id === finalProfId);
        if (!profData) return;

        // Check if already assigned
        if (profesionales.some(p => p.id === profData.id)) {
            return toast.warning("Este profesional ya está asignado al paciente");
        }

        const newPro = {
            id: profData.id,
            nombre: profData.nombreCompleto || profData.nombre,
            especialidades: profData.especialidades || [],
            identificacion: profData.identificacion || "",
            ultimaActualizacion: new Date().toISOString(),
            createdAt: Date.now()
        };

        setIsSubmitting(true);
        try {
            const updatedList = [...profesionales, newPro];
            await setDoc(doc(db, "pacientes", patient.id), {
                profesionales: updatedList,
                actualizado: serverTimestamp()
            }, { merge: true });
            onUpdate && onUpdate({ ...patient, profesionales: updatedList });
            toast.success("Profesional vinculado al paciente");
            setSearchTerm("");
            setSelectedProfId("");
            setIsDropdownOpen(false);
        } catch (e) {
            console.error(e);
            toast.error("Error al vincular profesional");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (targetId) => {
        if (!window.confirm("¿Seguro que deseas eliminar a este profesional asociado?")) return;
        
        setIsSubmitting(true);
        try {
            const updatedList = profesionales.filter(p => p.id !== targetId);
            await setDoc(doc(db, "pacientes", patient.id), {
                profesionales: updatedList,
                actualizado: serverTimestamp()
            }, { merge: true });
            onUpdate && onUpdate({ ...patient, profesionales: updatedList });
            toast.success("Profesional desvinculado");
        } catch (e) {
            console.error(e);
            toast.error("Error al eliminar profesional");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtered = profesionales.filter(p => 
        p.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (isoString) => {
        if (!isoString) return '---';
        const date = new Date(isoString);
        return date.toLocaleString('es-ES', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        }).replace(',', '');
    };

    return (
        <div className="p-4 md:p-8 animate-fadeIn flex flex-col min-h-0 h-full">
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0 flex-1">
                
                {/* TOOLBAR */}
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center bg-white shrink-0 relative z-20">
                    <div className="relative w-full md:w-96">
                        <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-[13px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-700"
                            placeholder="Buscar profesional para agregar..." 
                            value={searchTerm}
                            onClick={() => setIsDropdownOpen(true)}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setIsDropdownOpen(true);
                                setSelectedProfId(""); // clear selection when typing
                            }}
                        />
                        <FiSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                        {/* DROPDOWN AUTOCOMPLETE */}
                        {isDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 overflow-x-hidden custom-scrollbar">
                                {(() => {
                                    const sugerencias = catalogProfesionales.filter(p => 
                                        (p.nombreCompleto || p.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
                                    );
                                    if (sugerencias.length === 0) {
                                        return <div className="p-4 text-xs text-slate-500 text-center">No hay coincidencias en el catálogo institucional</div>;
                                    }
                                    return sugerencias.map(prof => {
                                        const isLinked = profesionales.some(p => p.id === prof.id);
                                        const isSelected = selectedProfId === prof.id;
                                        return (
                                            <div 
                                                key={prof.id}
                                                onClick={() => {
                                                    if (isLinked) return;
                                                    setSelectedProfId(prof.id);
                                                    setSearchTerm(prof.nombreCompleto || prof.nombre);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`px-4 py-3 border-b last:border-0 border-slate-50 flex items-center justify-between transition-colors ${isLinked ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'} ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                                            >
                                                <div className="flex flex-col truncate">
                                                    <span className={`text-[12px] font-bold truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                        {prof.nombreCompleto || prof.nombre}
                                                    </span>
                                                    {prof.especialidades?.length > 0 && (
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                                                            {prof.especialidades.map(id => especialidadesMap[id] || id).join(", ")}
                                                        </span>
                                                    )}
                                                </div>
                                                {isLinked && (
                                                    <span className="text-[9px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded ml-2 shrink-0">Vinculado</span>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        )}
                        {isDropdownOpen && (
                            <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsDropdownOpen(false)} />
                        )}
                    </div>
                    <button 
                        onClick={handleAddSelect}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-lg font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 flex items-center gap-2 transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed relative z-50"
                    >
                        Agregar
                    </button>
                </div>

                {/* TABLE (OralDrive Style) */}
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar p-6 pt-0">
                    <table className="w-full text-left border-collapse min-w-[600px] mt-2">
                        <thead className="bg-[#f8fafc] sticky top-0 z-10">
                            <tr>
                                <th className="py-3 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Doctor</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Especialidades</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Última actualización</th>
                                <th className="py-3 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length > 0 ? (
                                filtered.map(pro => (
                                    <tr key={pro.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className="font-bold text-[12px] text-slate-800 uppercase tracking-tight">{pro.nombre}</span>
                                        </td>
                                        <td className="py-4 px-4 text-[11px] font-bold text-slate-500 uppercase">
                                            {pro.especialidades?.length > 0 ? pro.especialidades.map(id => especialidadesMap[id] || id).join(", ") : "—"}
                                        </td>
                                        <td className="py-4 px-4 text-[11px] text-slate-400 font-medium tracking-tight">
                                            {formatDate(pro.ultimaActualizacion)}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center">
                                                <button 
                                                    className="w-8 h-7 rounded-[8px] bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm shadow-red-500/20 active:scale-95"
                                                    onClick={() => handleDelete(pro.id)}
                                                    title="Desvincular profesional"
                                                >
                                                    <FiTrash2 size={13} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-16 text-center">
                                        <p className="text-xs font-black text-slate-300 uppercase tracking-widest">El paciente no tiene profesionales asociados</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
