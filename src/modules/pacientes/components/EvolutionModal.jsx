import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiTrash2, FiPlus, FiActivity, FiLock } from 'react-icons/fi';
import supabase from '../../../lib/supabaseClient';
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

export default function EvolutionModal({ isOpen, onClose, onSave, patient, initialData = null }) {
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
            if (initialData.type === 'nota') {
                setActiveTab('nota');
            } else {
                setActiveTab('evolucion');
            }
            const safeDate = initialData.date?.toDate ? initialData.date.toDate() : new Date(initialData.date || Date.now());
            const tzoffset = safeDate.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(safeDate.getTime() - tzoffset)).toISOString();
            reset({
                ...initialData,
                fecha: localISOTime.slice(0, 10),
                horaInicio: localISOTime.slice(11, 16),
                horaFin: localISOTime.slice(11, 16),
                doctorId: initialData.doctorId || initialData.profesionalId || '',
                comentario: initialData.comentario || initialData.description || '',
                estadoEvolucion: initialData.estadoEvolucion || (initialData.isFinalized ? 'finalizado' : 'en_proceso'),
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
                estadoEvolucion: 'en_proceso',
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
                // ─── Cargar doctores des-normalizados (profesionales, profiles, website_config, patient, userProfile) ───
                const mapDoctors = new Map();
                const inquilino = userProfile?.inquilino || userProfile?.tenantId || patient?.inquilino || patient?.tenant_id;

                // A. Doctores asignados al paciente
                const assignedList = (Array.isArray(patient?.profesionales) && patient.profesionales.length > 0)
                    ? patient.profesionales
                    : (Array.isArray(patient?.historial_medico?.profesionales) && patient.historial_medico.profesionales.length > 0)
                        ? patient.historial_medico.profesionales
                        : (patient?.profesional_nombre ? [{ id: patient.profesional_id || 'default-doc', nombre: patient.profesional_nombre }] : []);

                assignedList.forEach(d => {
                    const name = d.nombreCompleto || d.nombre || `${d.nombres || ''} ${d.apellidos || ''}`.trim();
                    const docId = String(d.id || d.uid || (name ? name.toLowerCase() : ''));
                    if (name.trim() && docId) {
                        mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: d.email || '' });
                    }
                });

                // B. Cargar desde tabla profesionales
                try {
                    let query = supabase.from('profesionales').select('*');
                    if (inquilino) {
                        query = query.eq('tenant_id', inquilino);
                    }
                    const { data: profData } = await query;
                    if (profData && Array.isArray(profData)) {
                        profData.forEach(d => {
                            if (d.activo !== false) {
                                const name = d.nombre_completo || d.nombre || `${d.nombres || ''} ${d.apellidos || ''}`.trim();
                                const docId = String(d.id || d.uid || (name ? name.toLowerCase() : ''));
                                if (name.trim() && docId && !mapDoctors.has(docId)) {
                                    mapDoctors.set(docId, {
                                        id: docId,
                                        nombre: name,
                                        nombreCompleto: name,
                                        email: d.correo || d.email || '',
                                        raw: d
                                    });
                                }
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Error cargando profesionales:', e);
                }

                // C. Cargar desde tabla profiles
                try {
                    let query = supabase.from('profiles').select('*');
                    if (inquilino) query = query.eq('tenant_id', inquilino);
                    const { data: profsData } = await query;
                    if (profsData && Array.isArray(profsData)) {
                        profsData.forEach(u => {
                            const name = u.full_name || u.nombreCompleto || u.nombre || u.email || '';
                            const docId = String(u.id || (name ? name.toLowerCase() : ''));
                            if (name.trim() && docId && !mapDoctors.has(docId)) {
                                mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: u.email || '' });
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Error cargando profiles:', e);
                }

                // D. Cargar desde website_config (usuarios / user_details / doctores)
                try {
                    if (inquilino) {
                        const { data: cfgRow } = await supabase
                            .from("website_config")
                            .select("config")
                            .eq("tenant_id", inquilino)
                            .maybeSingle();

                        if (cfgRow?.config) {
                            const usuarios = cfgRow.config.usuarios || cfgRow.config.users || [];
                            const userDetails = cfgRow.config.user_details || {};
                            const doctores = cfgRow.config.doctores || cfgRow.config.profesionales || [];

                            usuarios.forEach(u => {
                                const name = u.nombreCompleto || u.nombre || u.displayName || u.email || "";
                                const docId = String(u.id || u.uid || (name ? name.toLowerCase() : ''));
                                if (name.trim() && docId && !mapDoctors.has(docId)) {
                                    mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: u.email || '' });
                                }
                            });

                            doctores.forEach(d => {
                                const name = d.nombreCompleto || d.nombre || d.displayName || d.email || "";
                                const docId = String(d.id || d.uid || (name ? name.toLowerCase() : ''));
                                if (name.trim() && docId && !mapDoctors.has(docId)) {
                                    mapDoctors.set(docId, { id: docId, nombre: name, nombreCompleto: name, email: d.email || '' });
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.warn('Error cargando website_config:', e);
                }

                // E. SIEMPRE incluir al usuario actual en sesión (ej. Carlos Madrid / Doctor)
                if (userProfile) {
                    const myId = String(userProfile.uid || userProfile.id || 'current_user');
                    const myName = userProfile.nombreCompleto ||
                        userProfile.nombre ||
                        `${userProfile.nombre || ''} ${userProfile.apellido || ''}`.trim() ||
                        userProfile.displayName ||
                        userProfile.email ||
                        "Doctor Principal";

                    if (myName.trim() && !mapDoctors.has(myId)) {
                        mapDoctors.set(myId, { id: myId, nombre: myName, nombreCompleto: myName, email: userProfile.email || '' });
                    }
                }

                // F. Fallback por si la clínica es completamente nueva
                if (mapDoctors.size === 0) {
                    mapDoctors.set('doc_default', { id: 'doc_default', nombre: 'Dr. Odontólogo Principal', nombreCompleto: 'Dr. Odontólogo Principal', email: '' });
                }

                let loadedDoctors = Array.from(mapDoctors.values());

                // Auto-seleccionar el primer doctor o el usuario actual si no hay nada seleccionado aún
                if (loadedDoctors.length > 0 && !watch("doctorId")) {
                    const currentUid = String(userProfile?.uid || userProfile?.id || '');
                    const matchedMyEntry = loadedDoctors.find(d => String(d.id) === currentUid);
                    setValue('doctorId', matchedMyEntry ? matchedMyEntry.id : loadedDoctors[0].id);
                }

                setDoctors(loadedDoctors);

                // Cargar medicamentos registrados de la clínica (con fallback silencioso)
                const DEFAULT_MEDS = ["Amoxicilina 500mg", "Ibuprofeno 600mg", "Paracetamol 500mg", "Clorhexidina 0.12%", "Naproxeno 500mg", "Azitromicina 500mg", "Clindamicina 300mg", "Ketorolaco 10mg", "Dexametasona 4mg"];
                try {
                    if (userProfile?.inquilino) {
                        const { data: invData, error: mErr } = await supabase
                            .from("medicamentos")
                            .select("nombre, name, principio_activo")
                            .eq("tenant_id", userProfile.inquilino);
                        if (!mErr && invData && invData.length > 0) {
                            const invList = (invData || [])
                                .map(d => d.nombre || d.name || d.principio_activo)
                                .filter(Boolean);
                            setInventarioMeds(invList);
                        } else {
                            setInventarioMeds(DEFAULT_MEDS);
                        }
                    } else {
                        setInventarioMeds(DEFAULT_MEDS);
                    }
                } catch (e) {
                    setInventarioMeds(DEFAULT_MEDS);
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
                         initDetails[s.id] = { 
                             checked: saved.checked !== undefined ? saved.checked : false,
                             realizado: saved.realizado !== undefined ? saved.realizado : (saved.checked || false),
                             observation: saved.observation || '',
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

                 if (!initialData) {
                     const { finalidad, dxPrincipal } = inferRIPSFields(srvs);
                     setValue('finalidad', finalidad);
                     setValue('dxPrincipal', dxPrincipal);
                     setValue('ambito', 'Ambulatorio');
                 }
             } else {
                 setServicios([]);
                 setPlantillaDetails({});
             }
        };

        loadServicios();
    }, [watchPlanId, planes, initialData, setValue]);

    // Load payments for selected plan to show status dots (Supabase native)
    useEffect(() => {
        const loadPlanPayments = async () => {
            if (!watchPlanId || !patient?.id) { setPlanPayments([]); return; }
            try {
                const { data: payData, error } = await supabase
                    .from("pagos")
                    .select("*")
                    .eq("paciente_id", patient.id);

                if (!error && payData) {
                    setPlanPayments(payData.filter(p => (p.plan_id === watchPlanId || p.planId === watchPlanId || p.tratamiento_id === watchPlanId || !p.planId) && p.estado !== 'Anulado'));
                } else {
                    setPlanPayments([]);
                }
            } catch (e) { console.error("Error loading plan payments:", e); }
        };
        loadPlanPayments();
    }, [watchPlanId, patient?.id]);

    // Load past evolutions using Supabase native query
    useEffect(() => {
        const loadPastEvolutions = async () => {
            if (!patient?.id) return;
            try {
                const { data: pastData, error } = await supabase
                    .from("evoluciones")
                    .select("*")
                    .eq("paciente_id", patient.id);

                if (!error && pastData) {
                    setPastEvolutions(pastData);
                }
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
            const docObj = doctors.find(d => String(d.id) === String(data.doctorId));
            const docName = docObj
                ? (docObj.nombreCompleto || docObj.nombre || `${docObj.nombres || ''} ${docObj.apellidos || ''}`.trim())
                : (userProfile?.nombreCompleto || userProfile?.nombre || "Doctor");

            const selectedPlan = planes.find(p => p.id === data.planId);
            const treatmentName = selectedPlan?.title || selectedPlan?.nombre || '';
            const recordType = activeTab === 'nota' ? 'nota' : 'evolution';

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
            
            const hasRealizedItems = Object.values(plantillaDetails || {}).some(
                item => item?.realizado === true
            );

            const evolutionData = {
                type: recordType,
                paciente_id: patient.id,
                patientId: patient.id,
                patientName: patient.nombreCompleto || patient.nombre || 'Paciente',
                profesional: docName,
                profesionalId: data.doctorId || docObj?.id || userProfile?.uid || "",
                treatment: recordType === 'nota' ? 'Nota aclaratoria' : treatmentName,
                description: data.comentario, 
                comentario: data.comentario,
                isFinalized: hasRealizedItems,
                ...data,
                plantillaItems: recordType === 'nota' ? {} : plantillaDetails,
                date: finalDate.toISOString(), 
                tenant_id: userProfile?.inquilino || userProfile?.tenantId || patient?.tenant_id || "",
                inquilino: userProfile?.inquilino || userProfile?.tenantId || patient?.tenant_id || "",
                updated_at: new Date().toISOString(),
                registeredBy: userProfile?.uid || "",
            };

            // DB Payload containing strictly existing table columns
            const dbPayload = {
                paciente_id: patient.id,
                tenant_id: userProfile?.inquilino || userProfile?.tenantId || patient?.tenant_id || "",
                profesional_id: data.doctorId || docObj?.id || userProfile?.uid || null,
                fecha: finalDate.toISOString(),
                tratamiento: JSON.stringify(evolutionData)
            };

            if (isEditing) {
                const { error: updateError } = await supabase
                    .from("evoluciones")
                    .update(dbPayload)
                    .eq("id", initialData.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from("evoluciones")
                    .insert([{
                        ...dbPayload,
                        created_at: new Date().toISOString()
                    }]);
                if (insertError) throw insertError;
            }

            const successMsg = isEditing 
                ? (recordType === 'nota' ? "Nota aclaratoria actualizada" : "Evolución actualizada")
                : (recordType === 'nota' ? "Nota aclaratoria registrada" : "Evolución registrada");
            toast.success(successMsg);
            if (onSave) onSave();
            onClose();
        } catch (error) {
            console.error("Error saving evolution:", error);
            toast.error("Error al guardar el registro");
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
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#8dc63f]/10 text-[#8dc63f] flex items-center justify-center font-bold">
                            <FiActivity size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                {initialData 
                                    ? (activeTab === 'nota' ? 'Editar Nota Aclaratoria' : 'Editar Evolución') 
                                    : (activeTab === 'nota' ? 'Nueva Nota Aclaratoria' : 'Nueva Evolución Clínica')
                                }
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Paciente: <span className="text-slate-600">{patient?.nombreCompleto || patient?.nombre || 'General'}</span>
                            </p>
                        </div>
                    </div>

                    {/* Selector de Pestaña: Evolución vs Nota Aclaratoria */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setActiveTab('evolucion')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                activeTab === 'evolucion' 
                                    ? 'bg-white text-slate-800 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Evolución
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('nota')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                activeTab === 'nota' 
                                    ? 'bg-purple-600 text-white shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            Nota Aclaratoria
                        </button>
                    </div>

                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all"
                    >
                        <FiX size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                    
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
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400"
                                >
                                    <option value="">Seleccione...</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.nombreCompleto || d.nombre || d.displayName || d.email || d.id}
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
                                                    <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Acciones Clínicas</th>
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
                                 max="9999-12-31" min="1900-01-01" />
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
                            type="submit"
                            disabled={saving} 
                            className="flex-1 sm:flex-none px-8 sm:px-10 py-3 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-lime-500/20"
                        >
                            {saving ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </form>
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
        </>
    );
}
