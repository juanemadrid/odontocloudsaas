import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiTrash2, FiPlus } from 'react-icons/fi';
import { collection, doc, setDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { getPlansByPatient } from '../../../services/planService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useForm } from 'react-hook-form';
import CIE10Search from './CIE10Search';
import ClinicalAIAssistant from './ClinicalAIAssistant';

// Helper function to automatically infer Scope (Ámbito), Purpose (Finalidad), and Diagnostic Code (CIE-10) based on selected treatments/procedures.
const inferRIPSFields = (servicesList) => {
    let inferredFinalidad = 'Terapéutico';
    let inferredDx = { code: "K029", name: "Caries dental, no especificada" }; // Default to Caries

    if (servicesList && servicesList.length > 0) {
        const text = servicesList.map(s => (s.desc || s.procedimiento || s.nombre || '').toLowerCase()).join(' ');
        
        // Finalidad y Diagnóstico sugerido
        if (text.includes("limpieza") || text.includes("profilaxis") || text.includes("flúor") || text.includes("fluor") || text.includes("sellante") || text.includes("prevencion") || text.includes("prevención")) {
            inferredFinalidad = 'Preventivo';
            inferredDx = { code: "Z012", name: "Examen odontológico" };
        } else if (text.includes("diagnostico") || text.includes("diagnóstico") || text.includes("consulta") || text.includes("valoracion") || text.includes("valoración")) {
            inferredFinalidad = 'Diagnóstico';
            inferredDx = { code: "Z012", name: "Examen odontológico" };
        } else if (text.includes("pulpitis") || text.includes("endodoncia") || text.includes("conducto")) {
            inferredFinalidad = 'Terapéutico';
            inferredDx = { code: "K040", name: "Pulpitis" };
        } else if (text.includes("gingivitis") || text.includes("periodonc") || text.includes("encias") || text.includes("encías")) {
            inferredFinalidad = 'Terapéutico';
            inferredDx = { code: "K051", name: "Gingivitis crónica" };
        } else if (text.includes("periodontitis")) {
            inferredFinalidad = 'Terapéutico';
            inferredDx = { code: "K053", name: "Periodontitis crónica" };
        } else if (text.includes("exodoncia") || text.includes("extraccion") || text.includes("extracción") || text.includes("cirugia") || text.includes("cirugía")) {
            inferredFinalidad = 'Terapéutico';
            inferredDx = { code: "K029", name: "Caries dental, no especificada" };
        }
    }
    return { finalidad: inferredFinalidad, dxPrincipal: inferredDx };
};

export default function EvolutionModal({ isOpen, onClose, patient, initialData = null }) {
    const { userProfile } = useAuth();
    const esDoctor = userProfile?.esDoctor ||
        userProfile?.rol === 'doctor' ||
        userProfile?.rol === 'odontologo';
    const toast = useToast();
    
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('evolucion'); // 'evolucion' | 'nota'
    const [showAIAssistant, setShowAIAssistant] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [planes, setPlanes] = useState([]);
    const [servicios, setServicios] = useState([]);
    const [plantillaDetails, setPlantillaDetails] = useState({});
    const [allChecked, setAllChecked] = useState(false);
    const [inventarioMeds, setInventarioMeds] = useState([]);
    const [planPayments, setPlanPayments] = useState([]); // payments for the selected plan
    const [showProcedureSelector, setShowProcedureSelector] = useState(false);
    const [pastEvolutions, setPastEvolutions] = useState([]);

    const getLocalISOStrings = () => {
        const d = new Date();
        const tzoffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString();
        const localDate = localISOTime.slice(0, 10);
        const localTime = localISOTime.slice(11, 16);
        return { localDate, localTime };
    };

    const { localDate, localTime } = getLocalISOStrings();

    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
        defaultValues: {
            doctorId: '',
            planId: '',
            serviciosIds: [],
            ambito: 'Ambulatorio',
            finalidad: 'Diagnóstico',
            personalAtiende: '',
            dxPrincipal: null,
            dxRelacionado: null,
            complicacion: null,
            formaCirugia: '',
            modalidadAtencion: 'Intramural',
            tipoServicio: '',
            fecha: localDate,
            horaInicio: localTime,
            horaFin: localTime,
            comentario: '',
            aplicaMedicamento: false,
            detalleMedicamento: '',
            controlEsterilizacion: false,
            medicamentos: [],
            esterilizaciones: []
        }
    });

    const watchPlanId = watch("planId");

    // Helper function to get formatted time
    const getCurrentTimeFormatted = () => {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    // Temporary states for multi-item additions
    const [tempMedicamento, setTempMedicamento] = useState('');
    const [tempVia, setTempVia] = useState('');
    const [tempDosis, setTempDosis] = useState('1');
    const [tempHora, setTempHora] = useState('');

    const [tempCiclo, setTempCiclo] = useState('');
    const [tempConcepto, setTempConcepto] = useState('');
    const [tempCantidad, setTempCantidad] = useState(1);

    const handleAddMedicamento = () => {
        if (!tempMedicamento.trim()) return toast.error("Debe ingresar el nombre del medicamento");
        if (!tempVia) return toast.error("Debe seleccionar la vía de administración");
        if (!tempDosis) return toast.error("Debe seleccionar la dosis");

        const currentMeds = watch("medicamentos") || [];
        setValue("medicamentos", [...currentMeds, {
            medicamento: tempMedicamento.trim(),
            via: tempVia,
            dosis: tempDosis,
            hora: tempHora || getCurrentTimeFormatted()
        }]);

        setTempMedicamento('');
        setTempVia('');
        setTempDosis('1');
        setTempHora(getCurrentTimeFormatted());
    };

    const handleRemoveMedicamento = (index) => {
        const currentMeds = watch("medicamentos") || [];
        setValue("medicamentos", currentMeds.filter((_, idx) => idx !== index));
    };

    const handleAddEsterilizacion = () => {
        if (!tempCiclo.trim()) return toast.error("Debe ingresar el ciclo de esterilización");
        if (!tempConcepto) return toast.error("Debe seleccionar el concepto");

        const currentEsts = watch("esterilizaciones") || [];
        setValue("esterilizaciones", [...currentEsts, {
            ciclo: tempCiclo.trim(),
            concepto: tempConcepto,
            cantidad: parseInt(tempCantidad) || 1
        }]);

        setTempCiclo('');
        setTempConcepto('');
        setTempCantidad(1);
    };

    const handleRemoveEsterilizacion = (index) => {
        const currentEsts = watch("esterilizaciones") || [];
        setValue("esterilizaciones", currentEsts.filter((_, idx) => idx !== index));
    };
    
    // Configurar estado inicial
    useEffect(() => {
        if (!isOpen) {
            reset({
                doctorId: '',
                planId: '',
                serviciosIds: [],
                ambito: 'Ambulatorio',
                finalidad: 'Diagnóstico',
                personalAtiende: '',
                dxPrincipal: null,
                dxRelacionado: null,
                complicacion: null,
                formaCirugia: '',
                modalidadAtencion: 'Intramural',
                tipoServicio: '',
                fecha: localDate,
                horaInicio: localTime,
                horaFin: localTime,
                comentario: '',
                aplicaMedicamento: false,
                detalleMedicamento: '',
                controlEsterilizacion: false,
                medicamentos: [],
                esterilizaciones: []
            });
            return;
        }

        // Si el usuario es doctor, pre-rellenar su ID directamente en el reset
        const esDoctor = userProfile?.esDoctor ||
            userProfile?.rol === 'doctor' ||
            userProfile?.rol === 'odontologo';
        const autoDoctor = esDoctor && userProfile?.uid ? userProfile.uid : undefined;

        const { localDate: currentLocalDate, localTime: currentLocalTime } = getLocalISOStrings();

        setTempHora(currentLocalTime);
        setTempMedicamento('');
        setTempVia('');
        setTempDosis('1');
        setTempCiclo('');
        setTempConcepto('');
        setTempCantidad(1);

        if (initialData) {
            const safeDate = initialData.date?.toDate ? initialData.date.toDate() : new Date(initialData.date || Date.now());
            const tzoffset = safeDate.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(safeDate.getTime() - tzoffset)).toISOString();
            reset({
                ...initialData,
                fecha: localISOTime.slice(0, 10),
                horaInicio: localISOTime.slice(11, 16),
                horaFin: localISOTime.slice(11, 16),
                doctorId: initialData.doctorId || '',
                medicamentos: initialData.medicamentos || [],
                esterilizaciones: initialData.esterilizaciones || []
            });
        } else {
            reset({
                ambito: 'Ambulatorio',
                finalidad: 'Diagnóstico',
                fecha: currentLocalDate,
                horaInicio: currentLocalTime,
                horaFin: currentLocalTime,
                doctorId: autoDoctor || '',
                medicamentos: [],
                esterilizaciones: []
            });
        }
    }, [isOpen, initialData, reset, userProfile]);

    // Fetch dependencies
    useEffect(() => {
        if (!isOpen) return;

        const fetchData = async () => {
            try {
                // ─── Cargar doctores desde colección 'profesionales' (datos normalizados) ───
                let loadedDoctors = [];
                const inquilino = userProfile?.inquilino || patient?.inquilino;

                if (inquilino) {
                    try {
                        // Primero intenta desde 'profesionales' (sincronizado por EmpresaUsuarios)
                        const profQ = query(
                            collection(db, 'profesionales'),
                            where('inquilino', '==', inquilino),
                            where('activo', '==', true)
                        );
                        const profSnap = await getDocs(profQ);
                        if (!profSnap.empty) {
                            loadedDoctors = profSnap.docs.map(d => {
                                const data = d.data();
                                return {
                                    id: d.id,
                                    nombre: data.nombreCompleto || data.nombre || data.displayName || '',
                                    nombreCompleto: data.nombreCompleto || data.nombre || data.displayName || '',
                                    email: data.correo || data.email || '',
                                };
                            });
                        } else {
                            // Fallback: buscar en 'usuarios' con esDoctor=true
                            const usrQ = query(
                                collection(db, 'usuarios'),
                                where('inquilino', '==', inquilino),
                                where('esDoctor', '==', true)
                            );
                            const usrSnap = await getDocs(usrQ);
                            loadedDoctors = usrSnap.docs.map(d => {
                                const data = d.data();
                                return {
                                    id: d.id,
                                    nombre: data.nombreCompleto || `${data.nombre || ''} ${data.apellido || ''}`.trim() || data.displayName || data.email || d.id,
                                    nombreCompleto: data.nombreCompleto || `${data.nombre || ''} ${data.apellido || ''}`.trim() || data.displayName || '',
                                    email: data.correo || data.email || '',
                                };
                            });
                        }
                    } catch (e) {
                        console.warn('Error cargando doctores desde Firestore:', e);
                    }
                }

                // ─── Si el usuario logueado ES doctor, asegurar que aparezca y esté seleccionado ───
                const esDoctor = userProfile?.esDoctor ||
                    userProfile?.rol === 'doctor' ||
                    userProfile?.rol === 'odontologo';

                if (esDoctor && userProfile?.uid) {
                    // Buscar por UID primero, luego por email (para el bypass de desarrollo)
                    const byUid = loadedDoctors.find(
                        d => d.id === userProfile.uid || d.uid === userProfile.uid
                    );
                    const byEmail = !byUid && userProfile.email
                        ? loadedDoctors.find(d =>
                            (d.email || d.correo || '').toLowerCase() === userProfile.email.toLowerCase()
                          )
                        : null;

                    const myDoctorEntry = byUid || byEmail;

                    if (myDoctorEntry) {
                        // Encontrado en la lista → seleccionarlo por su ID real de Firestore
                        setValue('doctorId', myDoctorEntry.id);
                    } else {
                        // No está en la lista → inyectarlo y seleccionarlo
                        const myName = userProfile.nombreCompleto ||
                            `${userProfile.nombre || ''} ${userProfile.apellido || ''}`.trim() ||
                            userProfile.displayName ||
                            userProfile.email || 'Doctor';
                        const myEntry = { id: userProfile.uid, nombre: myName, nombreCompleto: myName, email: userProfile.email || '' };
                        loadedDoctors = [myEntry, ...loadedDoctors];
                        setValue('doctorId', userProfile.uid);
                    }
                }

                setDoctors(loadedDoctors);

                // Cargar medicamentos registrados de la clínica
                try {
                    if (userProfile?.inquilino) {
                        const invQ = query(
                            collection(db, "medicamentos"),
                            where("inquilino", "==", userProfile.inquilino)
                        );
                        const invSnap = await getDocs(invQ);
                        const invList = invSnap.docs
                            .map(d => d.data().nombre || d.data().name || d.data().principio_activo)
                            .filter(Boolean);
                        setInventarioMeds(invList);
                    }
                } catch (e) {
                    console.warn("Error cargando medicamentos para autocompletado:", e);
                }

                // Planes de tratamiento
                if (patient?.id) {
                    try {
                        const plansData = await getPlansByPatient(patient.id);
                        setPlanes(plansData);
                    } catch (e) {
                        console.error("Error loading plans via service:", e);
                    }
                }
            } catch (err) {
                console.error("Error fetching dependencies", err);
            }
        };

        fetchData();
    }, [isOpen, patient, userProfile]);

    // Fetch Plan Items when Plan changes
    useEffect(() => {
        if (!watchPlanId || watchPlanId === '') {
            setServicios([]);
            setPlantillaDetails({});
            return;
        }

        const loadServicios = () => {
             const selectedPlan = planes.find(p => p.id === watchPlanId);
             if (selectedPlan && selectedPlan.items) {
                 const srvs = selectedPlan.items.map((i, idx) => ({ id: i.id || `item_${idx}`, ...i }));
                 setServicios(srvs);
                 
                 // Initialize checklist state
                 const initDetails = {};
                 srvs.forEach(s => {
                     if (initialData?.plantillaItems?.[s.id]) {
                         const saved = initialData.plantillaItems[s.id];
                         // Compatibilidad retroactiva: en el formato antiguo, checked=true significaba
                         // tanto "seleccionado" como "realizado". Ahora los separamos:
                         // checked = seleccionado para esta sesión (visible en tabla)
                         // realizado = procedimiento completamente terminado
                         initDetails[s.id] = { 
                             checked: saved.checked !== undefined ? saved.checked : false,
                             realizado: saved.realizado !== undefined ? saved.realizado : (saved.checked || false),
                             observation: saved.observation || '',
                             // Guardar nombre y dientes para mostrarlo en el historial
                             desc: saved.desc || s.desc || s.procedimiento || s.nombre || '',
                             dientes: saved.dientes || s.dientes || ''
                         };
                     } else {
                         initDetails[s.id] = {
                             checked: false,
                             realizado: false,
                             observation: '',
                             desc: s.desc || s.procedimiento || s.nombre || '',
                             dientes: s.dientes || ''
                         };
                     }
                 });
                 setPlantillaDetails(initDetails);
                 setAllChecked(false);

                 // Auto-inferir y pre-rellenar campos RIPS si es una evolución nueva
                 if (!initialData) {
                     const { finalidad, dxPrincipal } = inferRIPSFields(srvs);
                     setValue('finalidad', finalidad);
                     setValue('dxPrincipal', dxPrincipal);
                     setValue('ambito', 'Ambulatorio'); // Valor estándar por defecto
                 }
             } else {
                 setServicios([]);
                 setPlantillaDetails({});
             }
        };

        loadServicios();
    }, [watchPlanId, planes, initialData, setValue]);

    // Load payments for selected plan to show status dots
    useEffect(() => {
        const loadPlanPayments = async () => {
            if (!watchPlanId || !patient?.id) { setPlanPayments([]); return; }
            try {
                const q = query(
                    collection(db, "pagos"),
                    where("patientId", "==", patient.id),
                    where("planId", "==", watchPlanId)
                );
                const snap = await getDocs(q);
                setPlanPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.estado !== 'Anulado'));
            } catch (e) { console.error(e); }
        };
        loadPlanPayments();
    }, [watchPlanId, patient?.id]);

    // Load past evolutions to determine which items are already completed
    useEffect(() => {
        const loadPastEvolutions = async () => {
            if (!patient?.id) return;
            try {
                const q = query(
                    collection(db, "clinical_evolutions"),
                    where("patientId", "==", patient.id)
                );
                const snap = await getDocs(q);
                setPastEvolutions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error("Error loading past evolutions:", e);
            }
        };
        loadPastEvolutions();
    }, [patient?.id, isOpen]);

    const realizedItemIds = React.useMemo(() => {
        const completedSet = new Set();
        pastEvolutions.forEach(evo => {
            // Ignore the current evolution if we are in edit mode
            if (initialData?.id && evo.id === initialData.id) return;
            if (evo.plantillaItems) {
                Object.keys(evo.plantillaItems).forEach(itemId => {
                    const item = evo.plantillaItems[itemId];
                    // Compatibilidad retroactiva: registros nuevos usan `realizado`,
                    // registros antiguos usaban solo `checked` para indicar que fue completado.
                    if (item?.realizado === true || (item?.realizado === undefined && item?.checked === true)) {
                        completedSet.add(itemId);
                    }
                });
            }
        });
        return completedSet;
    }, [pastEvolutions, initialData?.id]);

    // Build paid map for selected plan items
    const planPaidMap = React.useMemo(() => {
        const map = {};
        servicios.forEach(s => { map[s.id] = 0; });
        planPayments.forEach(p => {
            if (p.itemPayments && p.itemPayments.length > 0) {
                p.itemPayments.forEach(ip => {
                    if (map[ip.itemId] !== undefined) map[ip.itemId] += Number(ip.monto || 0);
                });
            } else {
                // Legacy global payment: distribute sequentially
                let rem = Number(p.monto || 0);
                for (const s of servicios) {
                    if (rem <= 0) break;
                    const cost = (Number(s.amount || 0) * Number(s.qty || 1)) - Number(s.descuento || 0);
                    const cur = map[s.id] || 0;
                    const saldo = Math.max(0, cost - cur);
                    if (saldo > 0) { const alloc = Math.min(saldo, rem); map[s.id] += alloc; rem -= alloc; }
                }
            }
        });
        return map;
    }, [planPayments, servicios]);

    const getServiceStatus = (s) => {
        const cost = (Number(s.amount || 0) * Number(s.qty || 1)) - Number(s.descuento || 0);
        const paid = planPaidMap[s.id] || 0;
        if (cost <= 0) return 'none';
        if (paid <= 0) return 'unpaid';
        if (paid < cost) return 'partial';
        return 'paid';
    };

    const onSubmit = async (data) => {
        console.log("EvolutionModal: onSubmit triggered", data);
        if (!data.doctorId) return toast.error("Debe seleccionar un doctor");
        if (!data.comentario) return toast.error("El comentario es obligatorio");
        if (!data.fecha) return toast.error("La fecha es obligatoria");

        setSaving(true);
        try {
            if (!patient?.id) throw new Error("Paciente no identificado");
            const isEditing = !!initialData;
            
            // Reconstruct full doctor details to store flat data
            const docObj = doctors.find(d => d.id === data.doctorId);
            const docName = docObj ? `${docObj.nombre || docObj.nombres || ''} ${docObj.apellido || docObj.apellidos || ''}`.trim() : "Doctor";

            const selectedPlan = planes.find(p => p.id === data.planId);
            const treatmentName = selectedPlan?.title || selectedPlan?.nombre || '';

            // Robust date construction
            let finalDate = new Date(`${data.fecha}T00:00:00`);
            if (data.horaInicio) {
                const [h, m] = data.horaInicio.split(':');
                if (h && m) {
                    finalDate.setHours(parseInt(h), parseInt(m));
                }
            } else {
                finalDate.setHours(0, 0);
            }

            const evolutionData = {
                type: 'evolution',
                patientId: patient.id,
                patientName: patient.nombreCompleto || patient.nombre || 'Paciente',
                profesional: docName,
                profesionalId: data.doctorId,
                treatment: treatmentName,
                description: data.comentario, 
                ...data,
                plantillaItems: plantillaDetails, // Attach the new rich checklist data
                date: finalDate, 
                inquilino: userProfile?.inquilino || userProfile?.tenantId || "",
                updatedAt: serverTimestamp(),
                registeredBy: userProfile?.uid || "",
            };

            const targetId = isEditing ? initialData.id : doc(collection(db, "clinical_evolutions")).id;
            
            await setDoc(doc(db, "clinical_evolutions", targetId), {
                ...evolutionData,
                ...(isEditing ? {} : { createdAt: serverTimestamp() })
            }, { merge: true });

            toast.success(isEditing ? "Evolución actualizada" : "Evolución registrada");
            onClose();
        } catch (error) {
            console.error("Error saving evolution:", error);
            toast.error("Error al guardar la evolución");
        } finally {
            setSaving(false);
        }
    };

    const handleApplyAI = (aiData) => {
        let formattedComment = aiData.comentario || '';
        if (aiData.treatment) {
            formattedComment += `\n\nTratamiento: ${aiData.treatment}`;
        }
        if (aiData.prognosis) {
            formattedComment += `\nPronóstico: ${aiData.prognosis}`;
        }
        setValue('comentario', formattedComment);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 md:p-10 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className={`bg-white sm:rounded-[24px] rounded-t-[24px] shadow-2xl w-full flex flex-col h-[95vh] sm:h-full sm:max-h-[90vh] overflow-hidden transition-all duration-300 ${showAIAssistant ? 'max-w-7xl' : 'max-w-6xl'}`}>
                <div className="flex flex-col h-full">
                    {/* Header Custom Tabs like design */}
                    <div className="flex border-b border-slate-100/60 sticky top-0 bg-white z-10 shrink-0">
                        <div 
                            onClick={() => setActiveTab('evolucion')}
                            className={`w-1/2 flex items-center justify-center font-black text-[13px] py-4 cursor-pointer transition-colors ${activeTab === 'evolucion' ? 'border-b-[3px] border-[#8dc63f] text-[#8dc63f]' : 'text-slate-300 bg-slate-50/50 hover:bg-slate-50'}`}
                        >
                            Evolución
                        </div>
                        <div 
                            onClick={() => setActiveTab('nota')}
                            className={`w-1/2 flex items-center justify-center font-black text-[13px] py-4 cursor-pointer transition-colors ${activeTab === 'nota' ? 'border-b-[3px] border-[#8dc63f] text-[#8dc63f]' : 'text-slate-300 bg-slate-50/50 hover:bg-slate-50'}`}
                        >
                            Nota aclaratoria
                        </div>
                        <button type="button" onClick={onClose} disabled={saving} className="absolute right-4 top-4 text-slate-400 hover:text-rose-500">
                            <FiX size={20} />
                        </button>
                    </div>
                    
                    {/* Body Form Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 flex flex-col lg:flex-row gap-6">
                    
                    {/* COLUMNA IZQUIERDA (Oculta si es Nota Aclaratoria) */}
                    <div className={`flex-1 space-y-4 ${activeTab === 'nota' ? 'hidden' : 'block'}`}>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Seleccione doctor <span className="text-rose-500">*</span>
                                </label>
                                <select 
                                    {...register("doctorId")} 
                                    value={watch("doctorId") || ""}
                                    disabled={esDoctor}
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
                                >
                                    <option value="">Seleccione...</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.nombre || d.nombreCompleto || d.displayName || d.email || d.id}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Plan de tratamiento
                                </label>
                                <select 
                                    {...register("planId")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                >
                                    <option value="">Seleccione...</option>
                                    {planes.map(p => (
                                        <option key={p.id} value={p.id}>{p.title || p.nombre || `Plan #${p.id.slice(-4)}`}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Plantilla de Servicios Rica - Reemplazo del Antiguo Select Multiple */}
                        {watchPlanId && servicios.length > 0 && (
                            <div className="col-span-1 border border-slate-200 rounded-xl overflow-hidden bg-white mt-4">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                    <div>
                                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Procedimientos a Evolucionar</h5>
                                        <p className="text-[8px] text-slate-400 font-bold mt-1">Escriba las observaciones para los procedimientos completados hoy.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowProcedureSelector(true)}
                                        className="px-4 py-1.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-full font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1 shadow-md shadow-lime-500/10"
                                    >
                                        <FiPlus size={10} strokeWidth={3} /> Seleccionar ({servicios.filter(s => plantillaDetails[s.id]?.checked).length})
                                    </button>
                                </div>
                                <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                    {servicios.filter(s => plantillaDetails[s.id]?.checked).length === 0 ? (
                                        <div className="p-6 text-center text-slate-400">
                                            <p className="text-[11px] font-bold uppercase tracking-widest">No hay procedimientos seleccionados</p>
                                            <button
                                                type="button"
                                                onClick={() => setShowProcedureSelector(true)}
                                                className="mt-2 text-[#8dc63f] hover:text-[#7cb035] text-[10px] font-black uppercase tracking-wider underline focus:outline-none"
                                            >
                                                Haga clic aquí para seleccionar
                                            </button>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left table-fixed">
                                            <thead className="sticky top-0 bg-white shadow-sm z-10 hidden md:table-header-group">
                                                <tr>
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/2">Acciones Clínicas</th>
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/3">Observaciones</th>
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Realizado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {servicios.filter(s => plantillaDetails[s.id]?.checked).map((s, idx) => {
                                                    const svcStatus = getServiceStatus(s);
                                                    const cost = (Number(s.amount || 0) * Number(s.qty || 1)) - Number(s.descuento || 0);
                                                    const paid = planPaidMap[s.id] || 0;
                                                    const dotStyle = svcStatus === 'paid' ? 'bg-emerald-500 ring-emerald-200'
                                                        : svcStatus === 'partial' ? 'bg-amber-400 ring-amber-200'
                                                        : svcStatus === 'unpaid' ? 'bg-rose-500 ring-rose-200 animate-pulse'
                                                        : 'bg-slate-200 ring-slate-100';
                                                    const tooltip = svcStatus === 'paid' ? `Pagado en su totalidad ($${cost.toLocaleString('es-CO')})`
                                                        : svcStatus === 'partial' ? `Abono parcial: $${paid.toLocaleString('es-CO')} / $${cost.toLocaleString('es-CO')}`
                                                        : svcStatus === 'unpaid' ? `Sin pagar ($${cost.toLocaleString('es-CO')})`
                                                        : 'Sin valor definido';
                                                    return (
                                                    <tr key={s.id} className="group hover:bg-slate-50/50 transition-colors flex flex-col md:table-row py-2 md:py-0">
                                                        <td className="px-4 py-3 align-middle">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className={`w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 cursor-help ${dotStyle}`}
                                                                    title={tooltip}
                                                                />
                                                                <div className="text-[11px] font-bold text-slate-700 leading-tight">
                                                                    {idx + 1}. {s.desc || s.procedimiento || s.nombre || 'Servicio sin nombre'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 align-middle">
                                                            <input 
                                                                type="text"
                                                                placeholder="Anotaciones..."
                                                                className="w-full h-8 px-2 rounded-md border border-slate-200 text-[10px] font-bold text-slate-600 bg-white outline-none focus:border-[#8dc63f] focus:ring-1 focus:ring-[#8dc63f]/20 transition-all placeholder:text-slate-300 caret-slate-950"
                                                                value={plantillaDetails[s.id]?.observation || ''}
                                                                onChange={(e) => setPlantillaDetails(prev => ({
                                                                    ...prev,
                                                                    [s.id]: { ...prev[s.id], observation: e.target.value }
                                                                }))}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2 align-middle text-center">
                                                            <div className="flex items-center justify-start md:justify-center" title="Marque cuando este procedimiento quede completamente terminado en esta sesión">
                                                                <input 
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded text-[#8dc63f] border-slate-300 focus:ring-[#8dc63f] cursor-pointer"
                                                                    checked={plantillaDetails[s.id]?.realizado || false}
                                                                    onChange={(e) => setPlantillaDetails(prev => ({
                                                                        ...prev,
                                                                        [s.id]: { 
                                                                            ...prev[s.id], 
                                                                            checked: e.target.checked,
                                                                            realizado: e.target.checked,
                                                                            desc: s.desc || s.procedimiento || s.nombre || '',
                                                                            dientes: s.dientes || ''
                                                                        }
                                                                    }))}
                                                                />
                                                                <span className="md:hidden ml-2 text-[10px] font-bold tracking-widest uppercase text-slate-400">Finalizado</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 min-h-[24px] flex items-end">
                                    Ámbito realización
                                </label>
                                <select 
                                    {...register("ambito")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                >
                                    <option value="Ambulatorio">Ambulatorio</option>
                                    <option value="Hospitalario">Hospitalario</option>
                                    <option value="Urgencias">Urgencias</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 min-h-[24px] flex items-end">
                                    Finalidad del procedimiento
                                </label>
                                <select 
                                    {...register("finalidad")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                >
                                    <option value="Diagnóstico">Diagnóstico</option>
                                    <option value="Terapéutico">Terapéutico</option>
                                    <option value="Preventivo">Preventivo</option>
                                    <option value="Rehabilitación">Rehabilitación</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 min-h-[24px] flex items-end">
                                    Personal que atiende
                                </label>
                                <input 
                                    type="text"
                                    {...register("personalAtiende")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 caret-slate-950"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 min-h-[24px] flex items-end">
                                    Modalidad de atención <span className="text-rose-500 ml-1">*</span>
                                </label>
                                <select 
                                    {...register("modalidadAtencion")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                >
                                    <option value="Intramural">Intramural</option>
                                    <option value="Extramural">Extramural</option>
                                    <option value="Telemedicina">Telemedicina</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Diagnósticos (CIE-10)</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Cód dx principal <span className="text-rose-500">*</span></label>
                                    <CIE10Search value={watch("dxPrincipal")} onSelect={(item) => setValue('dxPrincipal', item)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Cód dx relacionado (Opcional)</label>
                                    <CIE10Search value={watch("dxRelacionado")} onSelect={(item) => setValue('dxRelacionado', item)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Complicación (Opcional)</label>
                                    <CIE10Search value={watch("complicacion")} onSelect={(item) => setValue('complicacion', item)} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Acto quirúrgico / Forma de cirugía (Opcional)
                            </label>
                            <select 
                                {...register("formaCirugia")} 
                                className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                            >
                                <option value="">Seleccione...</option>
                                <option value="Único">Único o Bilateral</option>
                                <option value="Múltiple">Múltiple</option>
                            </select>
                        </div>



                    </div>

                    {/* COLUMNA DERECHA (Siempre visible, pero expandida si es Nota) */}
                    <div className={`flex-1 space-y-5 ${activeTab === 'nota' ? '' : 'border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8'}`}>
                        
                        {/* Selector de doctor exclusivo para la vista Nota Aclaratoria */}
                        {activeTab === 'nota' && (
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Seleccione doctor <span className="text-rose-500">*</span>
                                </label>
                                <select 
                                    {...register("doctorId")} 
                                    value={watch("doctorId") || ""}
                                    disabled={esDoctor}
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
                                >
                                    <option value="">Seleccione...</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {`${d.nombre || d.nombres || ''} ${d.apellido || d.apellidos || ''}`.trim() || d.nombreCompleto}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Fecha <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="date"
                                    {...register("fecha")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 caret-slate-950"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Hora inicio
                                </label>
                                <input 
                                    type="time"
                                    {...register("horaInicio")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 caret-slate-950"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Hora fin
                                </label>
                                <input 
                                    type="time"
                                    {...register("horaFin")} 
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 caret-slate-950"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">
                                    Comentario <span className="text-rose-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowAIAssistant(!showAIAssistant)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all duration-300 shadow-sm border ${
                                        showAIAssistant 
                                            ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600 active:scale-95 shadow-rose-100' 
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 hover:shadow-md hover:shadow-indigo-100 active:scale-95'
                                    }`}
                                >
                                    🎙️ {showAIAssistant ? "Ocultar Asistente" : "Asistente Nova"}
                                </button>
                            </div>
                            


                            <textarea 
                                {...register("comentario")} 
                                className="w-full h-36 p-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 custom-scrollbar resize-none caret-slate-950"
                                placeholder="Escribe aquí los hallazgos subjetivos, objetivos y plan..."
                            />
                        </div>

                        {activeTab === 'evolucion' && (
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input type="checkbox" {...register("aplicaMedicamento")} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8dc63f]"></div>
                                    </div>
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors">Aplica medicamento</span>
                                </label>

                                {watch("aplicaMedicamento") && (
                                    <div className="pl-0 md:pl-14 space-y-4 animate-fadeIn">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap truncate h-4">
                                                    Medicamento correcto <span className="text-rose-500">*</span>
                                                </label>
                                                <input 
                                                    type="text"
                                                    list="meds-sug"
                                                    value={tempMedicamento}
                                                    onChange={(e) => setTempMedicamento(e.target.value)}
                                                    placeholder="Escriba o busque medicamento..."
                                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-[#8dc63f] focus:ring-1 focus:ring-[#8dc63f]/20 transition-all placeholder:text-slate-300 caret-slate-950"
                                                />
                                                <datalist id="meds-sug">
                                                    {inventarioMeds.map((med, idx) => (
                                                        <option key={`inv_sug_${idx}`} value={med} />
                                                    ))}
                                                </datalist>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap truncate h-4">
                                                    Vía correcta <span className="text-rose-500">*</span>
                                                </label>
                                                <input 
                                                    type="text"
                                                    list="via-sug"
                                                    value={tempVia}
                                                    onChange={(e) => setTempVia(e.target.value)}
                                                    placeholder="Oral, Infiltración..."
                                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-[#8dc63f] focus:ring-1 focus:ring-[#8dc63f]/20 transition-all placeholder:text-slate-300 caret-slate-950"
                                                />
                                                <datalist id="via-sug">
                                                    <option value="Oral" />
                                                    <option value="Tópica" />
                                                    <option value="Infiltración Local" />
                                                    <option value="Sublingual" />
                                                    <option value="Intramuscular" />
                                                    <option value="Intravenosa" />
                                                </datalist>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap truncate h-4">
                                                    Dosis <span className="text-rose-500">*</span>
                                                </label>
                                                <input 
                                                    type="text"
                                                    list="dosis-sug"
                                                    value={tempDosis}
                                                    onChange={(e) => setTempDosis(e.target.value)}
                                                    placeholder="1 cartucho, cada 8h..."
                                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-[#8dc63f] focus:ring-1 focus:ring-[#8dc63f]/20 transition-all placeholder:text-slate-300 caret-slate-950"
                                                />
                                                <datalist id="dosis-sug">
                                                    <option value="1 cartucho" />
                                                    <option value="2 cartuchos" />
                                                    <option value="1 tableta" />
                                                    <option value="Cada 8 horas" />
                                                    <option value="Cada 12 horas" />
                                                    <option value="Dosis única" />
                                                    <option value="Según dolor" />
                                                </datalist>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap truncate h-4">
                                                    Hora de aplicación
                                                </label>
                                                <input 
                                                    type="text"
                                                    value={tempHora}
                                                    onChange={(e) => setTempHora(e.target.value)}
                                                    placeholder="hh:mm am/pm"
                                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                                />
                                            </div>
                                        </div>

                                        <button 
                                            type="button" 
                                            onClick={handleAddMedicamento}
                                            className="h-10 px-6 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-[12px] font-black text-[11px] uppercase tracking-widest transition-all self-start shadow-md shadow-lime-500/10"
                                        >
                                            Agregar medicamento
                                        </button>

                                        {/* List Table for Medications */}
                                        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                            <table className="w-full text-left table-fixed">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider w-[35%]">Medicamento</th>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider w-[15%]">Vía</th>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider w-[20%]">Dosis</th>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider w-[20%]">Hora</th>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center w-[10%]">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                                                    {(watch("medicamentos") || []).length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="px-4 py-8 text-center text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                                                                Ningún medicamento ha sido añadido
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        (watch("medicamentos") || []).map((m, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="px-2 py-2.5 truncate text-[11px]" title={m.medicamento}>{m.medicamento}</td>
                                                                <td className="px-2 py-2.5 text-[11px]">{m.via}</td>
                                                                <td className="px-2 py-2.5 text-[11px]">{m.dosis}</td>
                                                                <td className="px-2 py-2.5 text-[11px]">{m.hora}</td>
                                                                <td className="px-2 py-2.5 text-center">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => handleRemoveMedicamento(idx)}
                                                                        className="text-rose-500 hover:text-rose-700 transition-colors p-1"
                                                                    >
                                                                        <FiTrash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <label className="flex items-center gap-3 cursor-pointer group pt-2">
                                    <div className="relative">
                                        <input type="checkbox" {...register("controlEsterilizacion")} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8dc63f]"></div>
                                    </div>
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors">Control de esterilización</span>
                                </label>

                                {watch("controlEsterilizacion") && (
                                    <div className="pl-0 md:pl-14 space-y-4 animate-fadeIn">
                                        <p className="text-[9px] text-slate-400 font-bold -mt-2 leading-relaxed">
                                            Registre el ciclo del autoclave o equipo de esterilización utilizado para certificar la bioseguridad del instrumental.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap truncate h-4">
                                                    Ciclo de esterilización (ej. Autoclave)
                                                </label>
                                                <input 
                                                    type="text"
                                                    list="ciclos-sug"
                                                    value={tempCiclo}
                                                    onChange={(e) => setTempCiclo(e.target.value)}
                                                    placeholder="Buscar ciclo de esterilización..."
                                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap truncate h-4">
                                                    Concepto / Resultado
                                                </label>
                                                <select 
                                                    value={tempConcepto}
                                                    onChange={(e) => setTempConcepto(e.target.value)}
                                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                                >
                                                    <option value="">Seleccione...</option>
                                                    <option value="Aprobado">Aprobado</option>
                                                    <option value="Rechazado">Rechazado</option>
                                                    <option value="En proceso">En proceso</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1 whitespace-nowrap truncate h-4">
                                                    Cantidad
                                                </label>
                                                <input 
                                                    type="number"
                                                    value={tempCantidad}
                                                    onChange={(e) => setTempCantidad(parseInt(e.target.value) || 0)}
                                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                                />
                                            </div>
                                        </div>

                                        <button 
                                            type="button" 
                                            onClick={handleAddEsterilizacion}
                                            className="h-10 px-6 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-[12px] font-black text-[11px] uppercase tracking-widest transition-all self-start shadow-md shadow-lime-500/10"
                                        >
                                            Agregar
                                        </button>

                                        {/* List Table for Sterilization Cycles */}
                                        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                            <table className="w-full text-left table-fixed">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider w-[50%]">Ciclo de esterilización</th>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider w-[22%]">Concepto</th>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider w-[18%]">Cantidad</th>
                                                        <th className="px-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center w-[10%]">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                                                    {(watch("esterilizaciones") || []).length === 0 ? (
                                                        <tr>
                                                            <td colSpan="4" className="px-4 py-8 text-center text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                                                                No hay datos añadidos
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        (watch("esterilizaciones") || []).map((e, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="px-2 py-2.5 truncate text-[11px]" title={e.ciclo}>{e.ciclo}</td>
                                                                <td className="px-2 py-2.5">
                                                                    <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full ${
                                                                        e.concepto === 'Aprobado' 
                                                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                            : e.concepto === 'Rechazado'
                                                                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                                                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                                    }`}>
                                                                        {e.concepto}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2.5 text-[11px]">{e.cantidad}</td>
                                                                <td className="px-2 py-2.5 text-center">
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => handleRemoveEsterilizacion(idx)}
                                                                        className="text-rose-500 hover:text-rose-700 transition-colors p-1"
                                                                    >
                                                                        <FiTrash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}



                                <datalist id="ciclos-sug">
                                    <option value="Ciclo Autoclave #1 - 121°C (20 min)" />
                                    <option value="Ciclo Autoclave #2 - 134°C (15 min)" />
                                    <option value="Ciclo Autoclave Rápido - 134°C (4 min)" />
                                    <option value="Ciclo Calor Seco - 180°C (60 min)" />
                                    <option value="Cámara de Rayos UV" />
                                </datalist>
                            </div>
                        )}
                    </div>
                    
                    {/* COLUMNA COPILOTO IA DE VOZ (SIDEBAR DEDICADO) */}
                    {showAIAssistant && (
                        <div className="w-full md:w-96 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-6 flex flex-col">
                            <ClinicalAIAssistant 
                                onApply={handleApplyAI} 
                                onClose={() => setShowAIAssistant(false)} 
                                doctors={doctors}
                                planes={planes}
                                setValue={setValue}
                                watch={watch}
                                onSubmitForm={handleSubmit(onSubmit)}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                plantillaDetails={plantillaDetails}
                                setPlantillaDetails={setPlantillaDetails}
                                servicios={servicios}
                            />
                        </div>
                    )}
                </div>

                {/* Footer Fixed */}
                <div className="p-4 sm:p-6 border-t border-slate-100/60 bg-white shrink-0 flex justify-between sm:justify-end gap-3 sm:gap-6 items-center">
                    <button type="button" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none py-3 px-4 border-2 border-slate-200 rounded-xl font-black text-[12px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors text-center">
                        Cerrar
                    </button>
                    <button 
                        type="button"
                        onClick={handleSubmit(onSubmit)}
                        disabled={saving} 
                        className="flex-1 sm:flex-none px-8 sm:px-10 py-3 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-lime-500/20"
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>

            {/* Procedure Selector Overlay Modal */}
            {showProcedureSelector && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden animate-scaleIn">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                            <div>
                                <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-wider">Seleccionar Procedimientos del Plan</h4>
                                <p className="text-[10px] text-slate-400 font-bold mt-1">Marque los tratamientos que desea agregar a esta sesión de evolución.</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowProcedureSelector(false)}
                                className="text-slate-400 hover:text-rose-500 p-1"
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
                            <table className="w-full text-left table-fixed">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest pb-2">
                                        <th className="py-2 w-24 text-center">Realizado</th>
                                        <th className="py-2 w-3/4">Procedimiento</th>
                                        <th className="py-2 text-center w-28">Estado Pago</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {servicios.map((s, idx) => {
                                        const svcStatus = getServiceStatus(s);
                                        const cost = (Number(s.amount || 0) * Number(s.qty || 1)) - Number(s.descuento || 0);
                                        const paid = planPaidMap[s.id] || 0;
                                        const dotStyle = svcStatus === 'paid' ? 'bg-emerald-500 ring-emerald-200'
                                            : svcStatus === 'partial' ? 'bg-amber-400 ring-amber-200'
                                            : svcStatus === 'unpaid' ? 'bg-rose-500 ring-rose-200 animate-pulse'
                                            : 'bg-slate-200 ring-slate-100';
                                        const tooltip = svcStatus === 'paid' ? `Pagado: $${cost.toLocaleString('es-CO')}`
                                            : svcStatus === 'partial' ? `Abono: $${paid.toLocaleString('es-CO')} / $${cost.toLocaleString('es-CO')}`
                                            : svcStatus === 'unpaid' ? `Deuda: $${cost.toLocaleString('es-CO')}`
                                            : 'Sin valor';

                                        const isPastRealized = realizedItemIds.has(s.id);
                                        const isChecked = isPastRealized || (plantillaDetails[s.id]?.checked || false);

                                        return (
                                            <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${isPastRealized ? 'opacity-60 bg-slate-50/40' : ''}`}>
                                                <td className="py-3 text-center align-middle">
                                                    {isPastRealized ? (
                                                        <div className="flex justify-center text-emerald-500" title="Procedimiento ya completado en una sesión anterior">
                                                            <FiCheck size={16} strokeWidth={3} />
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded text-[#8dc63f] border-slate-300 focus:ring-[#8dc63f] cursor-pointer"
                                                            checked={isChecked}
                                                            onChange={(e) => setPlantillaDetails(prev => ({
                                                                ...prev,
                                                                [s.id]: { 
                                                                    ...prev[s.id], 
                                                                    checked: e.target.checked,
                                                                    desc: s.desc || s.procedimiento || s.nombre || '',
                                                                    dientes: s.dientes || ''
                                                                }
                                                            }))}
                                                        />
                                                    )}
                                                </td>
                                                <td className="py-3 align-middle text-[11px] font-bold text-slate-700">
                                                    <div className="flex items-center gap-2">
                                                        <span>{idx + 1}. {s.desc || s.procedimiento || s.nombre || 'Servicio sin nombre'}</span>
                                                        {isPastRealized && (
                                                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[7px] font-black tracking-widest uppercase">
                                                                Ya Realizado
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 text-center align-middle">
                                                    <div className="flex justify-center">
                                                        <div
                                                            className={`w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 cursor-help ${dotStyle}`}
                                                            title={tooltip}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className="flex items-center mt-4">
                                <div className="w-24 flex justify-center shrink-0">
                                    <input 
                                        type="checkbox"
                                        id="marcar-realizadas-chk"
                                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                        checked={allChecked}
                                        onChange={(e) => {
                                            const val = e.target.checked;
                                            setAllChecked(val);
                                            setPlantillaDetails(prev => {
                                                const next = { ...prev };
                                                Object.keys(next).forEach(k => {
                                                    if (!realizedItemIds.has(k)) {
                                                        // "Marcar realizadas" marks as both selected AND realized
                                                        // Unmarking only removes the selection, not the realized status
                                                        // if it was already individually marked
                                                        next[k].checked = val;
                                                        next[k].realizado = val;
                                                    }
                                                });
                                                return next;
                                            });
                                        }}
                                    />
                                </div>
                                <label htmlFor="marcar-realizadas-chk" className="text-[11px] font-black text-slate-500 uppercase tracking-wider cursor-pointer select-none">
                                    Marcar realizadas
                                </label>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-slate-50/30">
                            <button
                                type="button"
                                onClick={() => setShowProcedureSelector(false)}
                                className="px-6 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md shadow-lime-500/10 active:scale-95 transition-all"
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
}
