import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { createOrUpdatePatient } from "../../../services/patientService";
import { useAudit } from "../../../hooks/useAudit";
import supabase from "../../../lib/supabaseClient";

const DEFAULT_SPECIALTIES = [
    { id: "Ortodoncia", nombre: "Ortodoncia" },
    { id: "Endodoncia", nombre: "Endodoncia" },
    { id: "Periodoncia", nombre: "Periodoncia" },
    { id: "Odontopediatría", nombre: "Odontopediatría" },
    { id: "Cirugía Oral", nombre: "Cirugía Oral" },
    { id: "Estética Dental", nombre: "Estética Dental" },
    { id: "Odontología General", nombre: "Odontología General" },
    { id: "Implantología", nombre: "Implantología" },
    { id: "Rehabilitación Oral", nombre: "Rehabilitación Oral" }
];

const DEFAULT_BRANCHES = [
    { id: "principal", nombre: "Sede Principal" }
];

const DEFAULT_CHAIRS = [
    { id: "consultorio-1", nombre: "Consultorio 1" },
    { id: "consultorio-2", nombre: "Consultorio 2" }
];

// Utils
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => {
    const x = new Date(d);
    const day = x.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
};

const mapTipoDocumento = (tipo) => {
    if (!tipo) return "";
    const mapping = {
        "CC": "Cédula de ciudadanía",
        "TI": "Tarjeta de identidad",
        "RC": "Registro civil de nacimiento",
        "CE": "Cédula de extranjería",
        "PA": "Pasaporte",
        "PE": "Permiso por protección temporal",
        "PEP": "PEP"
    };
    return mapping[tipo] || tipo;
};

const calculateAgeStr = (birthDateStr) => {
    if (!birthDateStr) return "";
    const birth = new Date(birthDateStr);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) { years--; months += 12; }
    if (today.getDate() < birth.getDate()) { months--; if (months < 0) { months += 12; years--; } }
    let numStr = "";
    if (years >= 0) numStr = `${years} años`;
    if (months > 0) numStr += ` y ${months} meses`;
    return numStr;
};

export function useAgenda() {
    const { userProfile } = useAuth();
    const { logAction } = useAudit();
    const inquilino = userProfile?.inquilino;

    const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
    const [viewMode, setViewMode] = useState("day"); // 'day', 'week'
    const [loading, setLoading] = useState(true);
    const [appointments, setAppointments] = useState([]);

    // Catalogs
    const [doctors, setDoctors] = useState([]);
    const [chairs, setChairs] = useState([]);
    const [branches, setBranches] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [entities, setEntities] = useState([]);
    const [priceList, setPriceList] = useState([]);
    const [patientsMap, setPatientsMap] = useState({});

    // Filters
    const [filterDocId, setFilterDocId] = useState("");
    const [filterBranchId, setFilterBranchId] = useState("");

    // === Role & Permission Check for Doctor Isolation ===
    const rolActual = (userProfile?.rol || "").trim().toLowerCase();
    const isAdmin = rolActual === "administrador" || rolActual === "superadmin";
    const isDoctor = userProfile?.esDoctor === true || 
                     ["doctor", "odontologo", "especialista"].includes(rolActual) || 
                     (typeof userProfile?.profileName === 'string' && userProfile.profileName.toLowerCase().includes('octor'));
    const isDoctorOnly = isDoctor && !isAdmin;

    const currentUserId = userProfile?.uid || userProfile?.id;
    const currentDoctorObj = useMemo(() => {
        if (!doctors || doctors.length === 0) return null;
        return doctors.find(d => 
            d.id === currentUserId || 
            (currentUserId && d.uid === currentUserId) ||
            (userProfile?.email && d.email?.toLowerCase() === userProfile.email.toLowerCase())
        );
    }, [doctors, currentUserId, userProfile?.email]);

    const loggedInDoctorId = currentDoctorObj?.id || currentUserId;

    // Filtered doctor list exposed to the app: if isDoctorOnly, restrict to only the current doctor
    const effectiveDoctors = useMemo(() => {
        if (!isDoctorOnly) return doctors;
        if (currentDoctorObj) return [currentDoctorObj];
        return [{
            id: loggedInDoctorId,
            nombre: userProfile?.nombreCompleto || userProfile?.nombre || "Mi Agenda",
            especialidad: userProfile?.especialidad || "Odontología"
        }];
    }, [isDoctorOnly, doctors, currentDoctorObj, loggedInDoctorId, userProfile]);

    // Keep filterDocId sync'd for doctor-only users
    useEffect(() => {
        if (isDoctorOnly && loggedInDoctorId && filterDocId !== loggedInDoctorId) {
            setFilterDocId(loggedInDoctorId);
        }
    }, [isDoctorOnly, loggedInDoctorId, filterDocId]);

    // === Load Catalogs ===
    useEffect(() => {
        if (!inquilino) return;

        const loadCatalogs = async () => {
            try {
                const [profRes, sucRes, conRes, entRes, pacRes, cfgRes] = await Promise.all([
                    supabase.from("profiles").select("*").eq("tenant_id", inquilino),
                    supabase.from("sucursales").select("*").eq("tenant_id", inquilino),
                    supabase.from("consultorios").select("*").eq("tenant_id", inquilino),
                    supabase.from("entidades").select("*").eq("tenant_id", inquilino),
                    supabase.from("pacientes").select("id,documento,nombres,apellidos,telefono").eq("tenant_id", inquilino),
                    supabase.from("website_config").select("config").eq("tenant_id", inquilino).maybeSingle()
                ]);

                // Doctors — from profiles table (only doctors/odontologists, exclude admins)
                const userDetailsMap = cfgRes.data?.config?.user_details || {};

                const docsList = (profRes.data || [])
                    .filter(u => u.activo !== false)
                    .filter(u => {
                        const roleLower = (u.role || '').toLowerCase();
                        const detail = userDetailsMap[u.id] || {};
                        return roleLower.includes('doctor') || 
                               roleLower.includes('odontólog') || 
                               roleLower.includes('odontolog') || 
                               roleLower.includes('especialista') ||
                               detail.esDoctor === true ||
                               !!u.especialidad;
                    })
                    .map(u => {
                        const detail = userDetailsMap[u.id] || {};
                        const userNombre = detail.nombre || (u.full_name || '').split(' ')[0] || '';
                        const userApellido = detail.apellido || (u.full_name || '').split(' ').slice(1).join(' ') || '';
                        const updatedFullName = (detail.nombre || detail.apellido) 
                            ? `${detail.nombre || ''} ${detail.apellido || ''}`.trim() 
                            : (u.full_name || '');

                        return {
                            id: u.id,
                            nombre: userNombre,
                            apellido: userApellido,
                            nombreCompleto: updatedFullName,
                            email: u.email,
                            rol: u.role,
                            especialidad: u.especialidad || (detail.especialidades ? detail.especialidades.join(', ') : ''),
                            activo: u.activo !== false
                        };
                    });
                if (docsList.length > 0) setDoctors(docsList);

                // Branches — sucursales table
                const supSuc = (sucRes.data || []);
                if (supSuc.length > 0) setBranches(supSuc);
                else setBranches(DEFAULT_BRANCHES);

                // Chairs — consultorios table
                const supChairs = (conRes.data || []);
                if (supChairs.length > 0) setChairs(supChairs);
                else setChairs(DEFAULT_CHAIRS);

                // Specialties — from website_config or defaults
                const rawCfgSpecs = cfgRes.data?.config?.especialidades || [];
                const cfgSpecs = rawCfgSpecs
                    .map(e => typeof e === 'string' ? { id: e, nombre: e } : { id: e.id || e.nombre, nombre: e.nombre || e.id })
                    .filter(e => e.id && e.nombre);
                if (cfgSpecs.length > 0) setSpecialties(cfgSpecs);
                else setSpecialties(DEFAULT_SPECIALTIES);

                // Entities
                setEntities(entRes.data || []);

                // Patients map
                const map = {};
                (pacRes.data || []).forEach(p => {
                    map[p.id] = p;
                    if (p.documento) map[String(p.documento).trim()] = p;
                    const nameKey = `${p.nombres || ''} ${p.apellidos || ''}`.trim().toLowerCase();
                    if (nameKey) map[nameKey] = p;
                });
                setPatientsMap(map);

            } catch (err) {
                console.error("Error cargando catálogos en useAgenda:", err);
            }
        };

        loadCatalogs();

        // Real-time subscription for patients
        const channel = supabase
            .channel(`agenda-patients-${inquilino}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes', filter: `tenant_id=eq.${inquilino}` }, loadCatalogs)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [inquilino]);

    // === Load Appointments ===
    useEffect(() => {
        if (!inquilino) {
            setLoading(false);
            return;
        }

        setLoading(true);
        let start, end;
        if (viewMode === 'day') {
            start = startOfDay(selectedDate);
            end = endOfDay(selectedDate);
        } else {
            start = startOfWeek(selectedDate);
            end = addDays(start, 6);
            end.setHours(23, 59, 59, 999);
        }

        console.log("useAgenda - Fetching appointments for range:", { start, end, inquilino });
        let isCurrent = true;

        let supabaseRaw = [];

        const updateCombinedAppointments = () => {
            if (!isCurrent) return;

            const visible = supabaseRaw.filter(ev => {
                const inRange = ev.start >= start && ev.start <= end;
                const activeDocFilter = isDoctorOnly ? loggedInDoctorId : filterDocId;
                const matchDoc = !activeDocFilter || ev.doctorId === activeDocFilter || ev.resourceId === activeDocFilter || ev.profesional_id === activeDocFilter;
                const matchBranch = !filterBranchId || ev.sucursalId === filterBranchId || ev.sucursal_id === filterBranchId;
                return inRange && matchDoc && matchBranch;
            }).sort((a, b) => (a.start || 0) - (b.start || 0));

            console.log("useAgenda - Combined visible appointments:", visible.length);
            setAppointments(visible);
            setLoading(false);
        };

        // 1. Fetch & Subscribe to Supabase Appointments
        const fetchSupabaseCitas = async () => {
            try {
                const { data, error } = await supabase
                    .from("citas")
                    .select("*, paciente:pacientes(nombres, apellidos, documento, telefono)")
                    .eq("tenant_id", inquilino);

                if (error) throw error;

                supabaseRaw = (data || []).map(c => {
                    const startObj = c.fecha_inicio ? new Date(c.fecha_inicio) : new Date();
                    const endObj = c.fecha_fin ? new Date(c.fecha_fin) : new Date(startObj.getTime() + (c.duracion || 30) * 60000);
                    const statusMap = {
                        'pending': 'SIN CONFIRMAR',
                        'confirmed': 'CONFIRMADA',
                        'attended': 'ATENDIDO',
                        'urgencia': 'URGENCIA',
                        'sin-cont-web': 'SIN CONT. WEB',
                        'no-show': 'NO ASISTE',
                        'cancelled': 'CANCELADO',
                        'waiting': 'EN ESPERA'
                    };
                    const normStatus = (c.estado || "").toLowerCase().includes("cancel") ? "cancelled" : (statusMap[c.estado] ? c.estado : "confirmed");

                    return {
                        id: c.id,
                        inquilino: c.tenant_id,
                        pacienteId: c.paciente_id,
                        doctorId: c.profesional_id,
                        resourceId: c.profesional_id,
                        consultorioId: c.consultorio_id,
                        sucursalId: c.sucursal_id || "",
                        fecha: c.fecha_inicio ? c.fecha_inicio.split("T")[0] : "",
                        horaInicio: c.fecha_inicio ? new Date(c.fecha_inicio).toTimeString().substring(0, 5) : "",
                        horaFin: c.fecha_fin ? new Date(c.fecha_fin).toTimeString().substring(0, 5) : "",
                        start: startObj,
                        end: endObj,
                        duracion: Math.max(5, Math.round((endObj.getTime() - startObj.getTime()) / 60000)),
                        status: normStatus,
                        estado: c.estado || "CONFIRMADA",
                        comentario: c.notas || c.motivo || "",
                        motivo: c.motivo || "",
                        paciente: c.paciente ? `${c.paciente.nombres || ''} ${c.paciente.apellidos || ''}`.trim() : (c.motivo || "Paciente"),
                        pacienteNombre: c.paciente ? `${c.paciente.nombres || ''} ${c.paciente.apellidos || ''}`.trim() : (c.motivo || "Paciente"),
                        celular: c.paciente?.telefono || "",
                        nroDocumento: c.paciente?.documento || ""
                    };
                });

                updateCombinedAppointments();
            } catch (err) {
                console.error("Error al obtener citas de Supabase en useAgenda:", err);
            }
        };

        fetchSupabaseCitas();

        const channel = supabase
            .channel(`citas-agenda-${inquilino}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'citas', filter: `tenant_id=eq.${inquilino}` },
                () => {
                    fetchSupabaseCitas();
                }
            )
            .subscribe();

        return () => {
            isCurrent = false;
            supabase.removeChannel(channel);
        };
    }, [inquilino, selectedDate, viewMode, filterDocId, filterBranchId, isDoctorOnly, loggedInDoctorId]);

    // Actions
    const createAppointment = async (data) => {
        const y = data.start.getFullYear();
        const m = String(data.start.getMonth() + 1).padStart(2, '0');
        const d = String(data.start.getDate()).padStart(2, '0');
        const hh = String(data.start.getHours()).padStart(2, '0');
        const mm = String(data.start.getMinutes()).padStart(2, '0');

        let pacienteId = data.pacienteId;

        // Si es un paciente nuevo desde la agenda, creamos el registro base en la colección de pacientes
        if (data.isNewPatient && !pacienteId) {
            try {
                // Preparamos los datos mínimos para el paciente
                const newPatientData = {
                    nombres: data.nombres,
                    apellidos: data.apellidos,
                    nombreCompleto: `${data.nombres} ${data.apellidos}`,
                    tipoDocumento: mapTipoDocumento(data.tipoDocumento),
                    nroDocumento: data.nroDocumento,
                    celular: data.celular,
                    email: data.email || "",
                    fechaNacimiento: data.fechaNacimiento,
                    edad: calculateAgeStr(data.fechaNacimiento),
                    sexo: data.sexo === 'M' ? 'Masculino' : data.sexo === 'F' ? 'Femenino' : 'Otros',
                    estadoCivil: "",
                    paisNacimiento: "Colombia",
                    ciudadNacimiento: "",
                    paisDomicilio: "Colombia",
                    ciudadDomicilio: "",
                    barrio: "",
                    lugarResidencia: "",
                    ocupacion: "",
                    activo: true,
                    registroCompleto: false // Marcamos que le falta información
                };
                
                const created = await createOrUpdatePatient(inquilino, newPatientData, true);
                pacienteId = created.id;
            } catch (err) {
                console.error("Error creating patient from agenda:", err);
                // Si falla la creación del paciente (ej: ya existe), lanzamos el error
                throw err;
            }
        }

        const rawPayload = {
            tenant_id: inquilino,
            paciente_id: pacienteId || null,
            profesional_id: data.doctorId || null,
            consultorio_id: data.consultorioId || null,
            sucursal_id: data.sucursalId || null,
            fecha_inicio: (data.start || new Date()).toISOString(),
            fecha_fin: (data.end || new Date((data.start || new Date()).getTime() + (data.duracion || 30) * 60000)).toISOString(),
            estado: data.estado || "CONFIRMADA",
            motivo: data.comentario || data.motivo || "Consulta odontológica",
            notas: data.comentario || ""
        };

        const { data: inserted, error: insertErr } = await supabase.from("citas").insert([rawPayload]).select().single();
        if (insertErr) throw insertErr;
        const newId = inserted?.id;

        // Audit log
        await logAction(pacienteId || "unknown", "CREATE_APPOINTMENT", {
            fecha: `${y}-${m}-${d}`,
            horaInicio: `${hh}:${mm}`,
            doctor: doctors.find(d => d.id === data.doctorId)?.nombreCompleto || data.doctorId || "No asignado",
            citaId: newId
        });

        if (pacienteId) {
            try {
                // Notify Patient via Supabase
                await supabase.from("notificaciones").insert([{
                    tenant_id: inquilino,
                    target: "patient",
                    paciente_id: pacienteId,
                    title: "Nueva Cita Agendada 📅",
                    message: `Tu cita ha sido programada para el ${y}-${m}-${d} a las ${hh}:${mm}.`,
                    type: "appointment_scheduled",
                    read: false
                }]);
            } catch (nErr) {
                console.warn("Could not send notification:", nErr);
            }
        }
        return newId;
    };

    const updateAppointment = async (id, patch) => {
        let finalPatch = { ...patch };

        // Synchronize status and estado fields (convert English keys to standard uppercase Spanish)
        const statusMap = {
            'pending': 'SIN CONFIRMAR',
            'confirmed': 'CONFIRMADA',
            'attended': 'ATENDIDO',
            'urgencia': 'URGENCIA',
            'sin-cont-web': 'SIN CONT. WEB',
            'no-show': 'NO ASISTE',
            'cancelled': 'CANCELADO',
            'waiting': 'EN ESPERA'
        };
        if (patch.status !== undefined && patch.estado === undefined) {
            finalPatch.estado = statusMap[patch.status] || patch.status.toUpperCase();
        }
        if (patch.estado !== undefined && patch.status === undefined) {
            const matchedKey = Object.keys(statusMap).find(key => statusMap[key] === patch.estado.toUpperCase());
            finalPatch.status = matchedKey || patch.estado.toLowerCase();
        }

        // Synchronize string fields if start date is updated (e.g. via drag & drop)
        if (patch.start && patch.start instanceof Date) {
            const y = patch.start.getFullYear();
            const m = String(patch.start.getMonth() + 1).padStart(2, '0');
            const d = String(patch.start.getDate()).padStart(2, '0');
            const hh = String(patch.start.getHours()).padStart(2, '0');
            const mm = String(patch.start.getMinutes()).padStart(2, '0');

            finalPatch.fecha = `${y}-${m}-${d}`;
            finalPatch.horaInicio = `${hh}:${mm}`;
        }

        // ✅ VALIDACIÓN: Prevenir conflictos de solapamiento al mover citas y verificar disponibilidad del doctor
        if (finalPatch.fecha && finalPatch.horaInicio) {
        // Get current appointment from Supabase for validation
        const { data: currentDbData } = await supabase.from("citas").select("*").eq("id", id).maybeSingle();
        const currentData = currentDbData || {};
            
            // Si la cita se está cancelando o ya estaba cancelada, no requiere validación de horarios ni solapamientos
            const isCancelled = finalPatch.status === 'cancelled' || 
                                ['cancelada', 'cancelado'].includes((finalPatch.estado || '').toLowerCase()) ||
                                currentData.status === 'cancelled' ||
                                ['cancelada', 'cancelado'].includes((currentData.estado || '').toLowerCase());

            if (!isCancelled) {
                const doctorId = patch.doctorId || currentData.doctorId;
            const consultorioId = patch.consultorioId || currentData.consultorioId;
            const duracion = patch.duracion || currentData.duracion || 30;
            
            // Calcular rango de tiempo de la cita movida
            const [hh, mm] = finalPatch.horaInicio.split(':').map(Number);
            const [y, m, d] = finalPatch.fecha.split('-').map(Number);
            const nuevaInicio = new Date(y, m - 1, d, hh, mm).getTime();
            const nuevaFin = nuevaInicio + (duracion * 60000);
            
            // 1. ✅ VALIDACIÓN DE DISPONIBILIDAD DEL DOCTOR (Horarios Predefinidos, Aperturas, No Disponibles)
            if (doctorId) {
                // Fetch doctor schedule from Supabase
                const [predRes, openRes, unavailRes] = await Promise.all([
                    supabase.from("horarios_predefinidos").select("*").eq("usuario_id", doctorId).eq("tenant_id", inquilino),
                    supabase.from("agenda_abierta").select("*").eq("usuario_id", doctorId).eq("tenant_id", inquilino),
                    supabase.from("no_disponibles").select("*").eq("usuario_id", doctorId).eq("tenant_id", inquilino)
                ]);

                const predefined = predRes.data || [];
                const openAgenda = openRes.data || [];
                const unavailable = unavailRes.data || [];

                const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                const dateObj = new Date(y, m - 1, d);
                const dayName = days[dateObj.getDay()];

                const parseTimeToMinutes = (timeStr) => {
                    if (!timeStr) return 0;
                    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                    if (match12) {
                        let [_, hStr, mStr, ampm] = match12;
                        let h = parseInt(hStr, 10);
                        const m = parseInt(mStr, 10);
                        if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
                        if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
                        return h * 60 + m;
                    }
                    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
                    if (match24) {
                        return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
                    }
                    return 0;
                };

                const apptStartMin = hh * 60 + mm;
                const apptEndMin = apptStartMin + duracion;

                // Check unavailable slots first
                for (const slot of unavailable) {
                    if (slot.fecha === finalPatch.fecha && slot.active !== false) {
                        const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                        const slotEndMin = parseTimeToMinutes(slot.horaFin);
                        if (apptStartMin < slotEndMin && apptEndMin > slotStartMin) {
                            const motivoStr = slot.motivo ? ` por motivo de: "${slot.motivo}"` : "";
                            throw new Error(`El doctor no está disponible en este horario${motivoStr}.`);
                        }
                    }
                }

                // Solo validar si el doctor tiene horarios configurados (opt-in)
                const hasScheduleConfig = predefined.length > 0 || openAgenda.length > 0;

                if (hasScheduleConfig) {
                    let isAvailable = false;

                    // Check open agenda custom dates
                    for (const slot of openAgenda) {
                        if (slot.fecha === finalPatch.fecha && slot.active !== false) {
                            const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                            const slotEndMin = parseTimeToMinutes(slot.horaFin);
                            if (apptStartMin >= slotStartMin && apptEndMin <= slotEndMin) {
                                isAvailable = true;
                                break;
                            }
                        }
                    }

                    // Check predefined weekly schedule slots
                    if (!isAvailable) {
                        const compareDays = (d1, d2) => {
                            if (!d1 || !d2) return false;
                            return d1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
                                   d2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        };

                        for (const slot of predefined) {
                            if (compareDays(slot.dia, dayName) && slot.activo !== false) {
                                const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                                const slotEndMin = parseTimeToMinutes(slot.horaFin);
                                if (apptStartMin >= slotStartMin && apptEndMin <= slotEndMin) {
                                    // Time matches predefined slot. Check physical resource:
                                    if (slot.recursoId === "todos" || slot.recursoId === consultorioId) {
                                        isAvailable = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if (!isAvailable) {
                        let hasPredefinedTimeButWrongResource = false;
                        let scheduledResourceName = "";
                        
                        const compareDays = (d1, d2) => {
                            if (!d1 || !d2) return false;
                            return d1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
                                   d2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        };

                        for (const slot of predefined) {
                            if (compareDays(slot.dia, dayName) && slot.activo !== false) {
                                const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                                const slotEndMin = parseTimeToMinutes(slot.horaFin);
                                if (apptStartMin >= slotStartMin && apptEndMin <= slotEndMin) {
                                    hasPredefinedTimeButWrongResource = true;
                                    scheduledResourceName = slot.recursoNombre || "otro consultorio";
                                    break;
                                }
                            }
                        }

                        const doctorName = doctors.find(d => d.id === doctorId)?.nombreCompleto || 
                                          `${doctors.find(d => d.id === doctorId)?.nombre || ''} ${doctors.find(d => d.id === doctorId)?.apellido || ''}`.trim() || 
                                          'El doctor';

                        if (hasPredefinedTimeButWrongResource) {
                            throw new Error(`${doctorName} no está programado para atender en este consultorio en ese horario. Está asignado a: ${scheduledResourceName}.`);
                        } else {
                            const formattedEndTime = new Date(nuevaFin);
                            const endTimeStr = `${String(formattedEndTime.getHours()).padStart(2, '0')}:${String(formattedEndTime.getMinutes()).padStart(2, '0')}`;
                            throw new Error(`${doctorName} no tiene agenda habilitada para el día ${dayName} en el horario de ${finalPatch.horaInicio} a ${endTimeStr}.`);
                        }
                    }
                }
            }

            // 1.5 ✅ VALIDACIÓN DE DISPONIBILIDAD DEL CONSULTORIO (Recurso Físico)
            if (consultorioId) {
                // Fetch consultorio schedule from Supabase
                const [resPredRes, resOpenRes, resUnavailRes] = await Promise.all([
                    supabase.from("horarios_predefinidos").select("*").eq("consultorio_id", consultorioId).eq("tenant_id", inquilino),
                    supabase.from("agenda_abierta").select("*").eq("consultorio_id", consultorioId).eq("tenant_id", inquilino),
                    supabase.from("no_disponibles").select("*").eq("consultorio_id", consultorioId).eq("tenant_id", inquilino)
                ]);

                const resPredefined = resPredRes.data || [];
                const resOpenAgenda = resOpenRes.data || [];
                const resUnavailable = resUnavailRes.data || [];

                const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                const dateObj = new Date(y, m - 1, d);
                const dayName = days[dateObj.getDay()];

                const parseTimeToMinutes = (timeStr) => {
                    if (!timeStr) return 0;
                    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                    if (match12) {
                        let [_, hStr, mStr, ampm] = match12;
                        let h = parseInt(hStr, 10);
                        const m = parseInt(mStr, 10);
                        if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
                        if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
                        return h * 60 + m;
                    }
                    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
                    if (match24) {
                        return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
                    }
                    return 0;
                };

                const apptStartMin = hh * 60 + mm;
                const apptEndMin = apptStartMin + duracion;

                // Check unavailable slots first
                for (const slot of resUnavailable) {
                    if (slot.fecha === finalPatch.fecha && slot.active !== false) {
                        const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                        const slotEndMin = parseTimeToMinutes(slot.horaFin);
                        if (apptStartMin < slotEndMin && apptEndMin > slotStartMin) {
                            const motivoStr = slot.motivo ? ` por motivo de: "${slot.motivo}"` : "";
                            throw new Error(`El consultorio no está disponible en este horario${motivoStr}.`);
                        }
                    }
                }

                // If schedules are configured, check availability
                if (resPredefined.length > 0 || resOpenAgenda.length > 0) {
                    let isResAvailable = false;

                    // Check open agenda
                    for (const slot of resOpenAgenda) {
                        if (slot.fecha === finalPatch.fecha && slot.active !== false) {
                            const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                            const slotEndMin = parseTimeToMinutes(slot.horaFin);
                            if (apptStartMin >= slotStartMin && apptEndMin <= slotEndMin) {
                                isResAvailable = true;
                                break;
                            }
                        }
                    }

                    // Check predefined slots
                    if (!isResAvailable) {
                        const compareDays = (d1, d2) => {
                            if (!d1 || !d2) return false;
                            return d1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
                                   d2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        };

                        for (const slot of resPredefined) {
                            if (compareDays(slot.dia, dayName) && slot.activo !== false) {
                                const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                                const slotEndMin = parseTimeToMinutes(slot.horaFin);
                                if (apptStartMin >= slotStartMin && apptEndMin <= slotEndMin) {
                                    isResAvailable = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (!isResAvailable) {
                        const consultorioName = chairs.find(c => c.id === consultorioId)?.nombre || 'El consultorio seleccionado';
                        const formattedEndTime = new Date(nuevaFin);
                        const endTimeStr = `${String(formattedEndTime.getHours()).padStart(2, '0')}:${String(formattedEndTime.getMinutes()).padStart(2, '0')}`;
                        throw new Error(`${consultorioName} no tiene horario de atención habilitado para el día ${dayName} de ${finalPatch.horaInicio} a ${endTimeStr}.`);
                    }
                }
            }

            // 2. ✅ VALIDACIÓN: Prevenir solapamiento con otras citas del mismo Doctor (excluyendo la cita actual)
            if (doctorId) {
                const { data: doctorCitas } = await supabase
                    .from("citas")
                    .select("*")
                    .eq("tenant_id", inquilino)
                    .eq("profesional_id", doctorId)
                    .gte("fecha_inicio", new Date(y, m - 1, d).toISOString())
                    .lt("fecha_inicio", new Date(y, m - 1, d + 1).toISOString());
                
                for (const citaExistente of (doctorCitas || [])) {
                    if (citaExistente.id === id) continue;
                    if (['cancelada', 'cancelado', 'cancelled'].includes((citaExistente.estado || '').toLowerCase())) continue;
                    
                    const citaInicio = new Date(citaExistente.fecha_inicio).getTime();
                    const citaFin = new Date(citaExistente.fecha_fin).getTime();
                    
                    if (nuevaInicio < citaFin && nuevaFin > citaInicio) {
                        const doctorName = doctors.find(d => d.id === doctorId)?.nombreCompleto || 'El doctor';
                        const horaFinStr = new Date(citaFin).toTimeString().substring(0, 5);
                        const horaIniStr = new Date(citaInicio).toTimeString().substring(0, 5);
                        throw new Error(`${doctorName} ya tiene una cita desde las ${horaIniStr} hasta las ${horaFinStr}.`);
                    }
                }
            }
            
            // Validar que el consultorio no tenga solapamiento (excluyendo la cita actual)
            if (consultorioId) {
                const { data: consulCitas } = await supabase
                    .from("citas")
                    .select("*")
                    .eq("tenant_id", inquilino)
                    .eq("consultorio_id", consultorioId)
                    .gte("fecha_inicio", new Date(y, m - 1, d).toISOString())
                    .lt("fecha_inicio", new Date(y, m - 1, d + 1).toISOString());
                
                for (const citaExistente of (consulCitas || [])) {
                    if (citaExistente.id === id) continue;
                    if (['cancelada', 'cancelado', 'cancelled'].includes((citaExistente.estado || '').toLowerCase())) continue;
                    
                    const citaInicio = new Date(citaExistente.fecha_inicio).getTime();
                    const citaFin = new Date(citaExistente.fecha_fin).getTime();
                    
                    if (nuevaInicio < citaFin && nuevaFin > citaInicio) {
                        const consultorioName = chairs.find(c => c.id === consultorioId)?.nombre || 'El consultorio';
                        const horaFinStr = new Date(citaFin).toTimeString().substring(0, 5);
                        const horaIniStr = new Date(citaInicio).toTimeString().substring(0, 5);
                        throw new Error(`${consultorioName} está ocupado desde las ${horaIniStr} hasta las ${horaFinStr}.`);
                    }
                }
            }
        }
    }

        const cleanPatch = Object.fromEntries(
            Object.entries(finalPatch).filter(([_, v]) => v !== undefined)
        );

        // Update in Supabase
        const supPatch = {};
        if (finalPatch.doctorId !== undefined) supPatch.profesional_id = finalPatch.doctorId;
        if (finalPatch.consultorioId !== undefined) supPatch.consultorio_id = finalPatch.consultorioId;
        if (finalPatch.sucursalId !== undefined) supPatch.sucursal_id = finalPatch.sucursalId;
        if (finalPatch.estado !== undefined) supPatch.estado = finalPatch.estado;
        if (finalPatch.status !== undefined) supPatch.estado = statusMap[finalPatch.status] || finalPatch.status.toUpperCase();
        if (finalPatch.comentario !== undefined) supPatch.notas = finalPatch.comentario;
        if (finalPatch.start) supPatch.fecha_inicio = new Date(finalPatch.start).toISOString();
        if (finalPatch.end) supPatch.fecha_fin = new Date(finalPatch.end).toISOString();
        if (finalPatch.fecha && finalPatch.horaInicio) {
            supPatch.fecha_inicio = new Date(`${finalPatch.fecha}T${finalPatch.horaInicio}:00`).toISOString();
        }

        if (Object.keys(supPatch).length > 0) {
            await supabase.from("citas").update(supPatch).eq("id", id);
        }

        // Notify patient if status/date changed
        try {
            const pacienteId = currentData.paciente_id;

            // Audit log
            await logAction(pacienteId || "unknown", "UPDATE_APPOINTMENT", {
                fecha: cleanPatch.fecha || currentData.fecha,
                horaInicio: cleanPatch.horaInicio || currentData.horaInicio || "",
                status: cleanPatch.status || cleanPatch.estado || currentData.status || "",
                citaId: id
            });

            if (pacienteId) {
                let title = "Tu Cita ha sido Actualizada";
                let message = `Tu cita del ${currentData.fecha} ha sido actualizada.`;
                
                if (cleanPatch.status || cleanPatch.estado) {
                    const statusText = (cleanPatch.status || cleanPatch.estado).toLowerCase();
                    if (statusText === 'cancelled' || ['cancelada', 'cancelado'].includes(statusText)) {
                        title = "Cita Cancelada ⚠️";
                        message = `Tu cita del ${currentData.fecha} a las ${currentData.horaInicio || currentData.hora || ""} ha sido cancelada.`;
                    } else if (statusText === 'completed' || ['completada', 'completado'].includes(statusText)) {
                        title = "Cita Completada ✅";
                        message = `Tu cita del ${currentData.fecha} ha sido registrada como completada. ¡Gracias por asistir!`;
                    } else if (statusText === 'confirmed' || ['confirmada', 'confirmado'].includes(statusText)) {
                        title = "Cita Confirmada 👍";
                        message = `Tu cita del ${currentData.fecha} a las ${currentData.horaInicio || currentData.hora || ""} ha sido confirmada.`;
                    }
                } else if (cleanPatch.fecha || cleanPatch.horaInicio) {
                    title = "Cita Reagendada 📅";
                    message = `Tu cita ha sido reprogramada para el ${currentData.fecha} a las ${currentData.horaInicio || currentData.hora || ""}.`;
                }

                await supabase.from("notificaciones").insert([{
                    tenant_id: currentData.inquilino || inquilino,
                    target: "patient",
                    paciente_id: pacienteId,
                    title,
                    message,
                    type: "appointment_update",
                    read: false
                }]);
            }
        } catch (nErr) {
            console.warn("Could not send real-time notification to patient/log audit:", nErr);
        }
    };

    const deleteAppointment = async (id) => {
        try {
            // Fetch from Supabase for audit
            const { data: currentData } = await supabase.from("citas").select("*").eq("id", id).maybeSingle();
            await supabase.from("citas").delete().eq("id", id);
            await logAction(currentData?.paciente_id || "unknown", "DELETE_APPOINTMENT", {
                fecha: currentData?.fecha_inicio ? currentData.fecha_inicio.split("T")[0] : "",
                horaInicio: currentData?.fecha_inicio ? new Date(currentData.fecha_inicio).toTimeString().substring(0, 5) : "",
                doctor: currentData?.profesional_id || "No asignado",
                citaId: id
            });
        } catch (err) {
            console.error("Error in deleteAppointment:", err);
        }
    };

    return {
        selectedDate, setSelectedDate,
        viewMode, setViewMode,
        loading, appointments,
        doctors: effectiveDoctors, chairs, branches,
        specialties, entities, priceList, patientsMap,
        isDoctorOnly, loggedInDoctorId,
        createAppointment, updateAppointment, deleteAppointment,
        filters: { filterDocId: isDoctorOnly ? loggedInDoctorId : filterDocId, setFilterDocId, filterBranchId, setFilterBranchId }
    };
}
