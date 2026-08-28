import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useSede } from "../../../context/SedeContext";
import { createOrUpdatePatient } from "../../../services/patientService";
import { useAudit } from "../../../hooks/useAudit";
import supabase from "../../../lib/supabaseClient";
import { getConfigItems } from "../../../services/configPersistenceService";
import { getConfigSectionsCached } from "../../../services/configCacheService";
import { getMyTenantUserDirectory } from "../../../services/tenantDirectoryService";
import { isDoctorUser } from "../../../utils/doctorHelpers";

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

const isCancelledStatus = (st) => {
    if (!st) return false;
    const norm = String(st).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    return ["CANCELADA", "CANCELADO", "CANCELLED", "NO ASISTE", "NO-SHOW"].includes(norm);
};

/**
 * Verifica disponibilidad de un profesional y consultorio en un rango de tiempo
 * Lanza error si hay conflicto de horarios
 */
const assertAppointmentAvailability = async ({ tenantId, professionalId, roomId, start, end, excludeId = null }) => {
    if (!tenantId || !start || !end) {
        throw new Error("Datos insuficientes para verificar disponibilidad");
    }

    // Verificar que la fecha de inicio sea anterior a la fecha de fin
    if (start >= end) {
        throw new Error("La hora de inicio debe ser anterior a la hora de fin");
    }

    // Construir query base
    let query = supabase
        .from("citas")
        .select("id, fecha_inicio, fecha_fin, profesional_id, consultorio_id, estado")
        .eq("tenant_id", tenantId);

    // Si hay un ID a excluir (para updates), excluirlo de la búsqueda
    if (excludeId) {
        query = query.neq("id", excludeId);
    }

    const { data: existingAppointments, error } = await query;

    if (error) {
        console.error("Error al verificar disponibilidad:", error);
        throw new Error("Error al verificar disponibilidad de horarios");
    }

    // Verificar conflictos ignorando citas canceladas
    const conflicts = (existingAppointments || []).filter(apt => {
        if (isCancelledStatus(apt.estado)) return false;

        const aptStart = new Date(apt.fecha_inicio);
        const aptEnd = new Date(apt.fecha_fin);

        // Verificar solapamiento de horarios
        const hasTimeOverlap = (start < aptEnd && end > aptStart);
        
        if (!hasTimeOverlap) return false;

        // Verificar si hay conflicto con el mismo profesional o consultorio
        const sameProfessional = professionalId && String(apt.profesional_id) === String(professionalId);
        const sameRoom = roomId && String(apt.consultorio_id) === String(roomId);

        return sameProfessional || sameRoom;
    });

    if (conflicts.length > 0) {
        const conflict = conflicts[0];
        const conflictStart = new Date(conflict.fecha_inicio);
        const conflictEnd = new Date(conflict.fecha_fin);
        
        let errorMsg = "Ya existe una cita programada en este horario";
        
        if (professionalId && String(conflict.profesional_id) === String(professionalId)) {
            errorMsg += ` para este profesional (${conflictStart.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} - ${conflictEnd.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})`;
        } else if (roomId && String(conflict.consultorio_id) === String(roomId)) {
            errorMsg += ` para este consultorio (${conflictStart.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} - ${conflictEnd.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})`;
        }

        throw new Error(errorMsg);
    }

    return true;
};

export function useAgenda() {
    const { userProfile } = useAuth();
    const { activeSede, sedesList } = useSede();
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

    // Filters - Sincronizado por defecto con la sede activa seleccionada en el menú superior
    const [filterDocId, setFilterDocId] = useState("");
    const [filterBranchId, setFilterBranchId] = useState(() => activeSede?.id || "");
    const [filterChairId, setFilterChairId] = useState("");

    // Sincronizar filterBranchId cuando el usuario cambia la sede en el selector superior
    useEffect(() => {
        if (activeSede?.id) {
            setFilterBranchId(activeSede.id);
        }
    }, [activeSede?.id]);

    useEffect(() => {
        const handleSedeChange = (e) => {
            const newSedeId = e.detail?.sedeId || e.detail?.sede?.id;
            if (newSedeId) {
                setFilterBranchId(newSedeId);
            }
        };
        window.addEventListener("sede-changed", handleSedeChange);
        return () => window.removeEventListener("sede-changed", handleSedeChange);
    }, []);

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
                const fetchProfiles = async () => {
                    try {
                        const { data } = await supabase
                            .from("profiles")
                            .select("id,full_name,email,role,especialidad,activo,apellido,sucursal_id")
                            .eq("tenant_id", inquilino);
                        return data || [];
                    } catch (e) { return []; }
                };

                const fetchConsultorios = async () => {
                    try {
                        const { data } = await supabase.from("consultorios").select("*").eq("tenant_id", inquilino);
                        return data || [];
                    } catch (e) { return []; }
                };

                const fetchEntidades = async () => {
                    try {
                        const { data } = await supabase.from("entidades").select("*").eq("tenant_id", inquilino);
                        return data || [];
                    } catch (e) { return []; }
                };

                const fetchPacientes = async () => {
                    try {
                        const { data } = await supabase.from("pacientes").select("id,documento,nombres,apellidos,telefono").eq("tenant_id", inquilino);
                        return data || [];
                    } catch (e) { return []; }
                };

                const fetchUserDirectory = async () => {
                    try {
                        return await getMyTenantUserDirectory();
                    } catch (e) { return {}; }
                };

                const [profData, sucursalesData, conData, recFisicosData, entData, pacData, userDirectory, agendaConfig] = await Promise.all([
                    fetchProfiles(),
                    getConfigItems(inquilino, "sucursales", "sucursales"),
                    fetchConsultorios(),
                    getConfigItems(inquilino, "recursos_fisicos", "consultorios"),
                    fetchEntidades(),
                    fetchPacientes(),
                    fetchUserDirectory(),
                    getConfigSectionsCached(inquilino, ["agenda_doctor_settings", "especialidades"])
                ]);

                // Fusionar usuarios de profiles y configUsersData
                const configUsersData = Array.isArray(userDirectory?.usuarios) ? userDirectory.usuarios : [];
                const userDetailsMap = userDirectory?.user_details || {};
                const allUsersMap = new Map();

                (profData || []).forEach(u => {
                    if (u.activo !== false) {
                        allUsersMap.set(u.id, u);
                    }
                });

                (configUsersData || []).forEach(u => {
                    if (u.id && u.activo !== false) {
                        const existing = allUsersMap.get(u.id) || {};
                        allUsersMap.set(u.id, { ...existing, ...u });
                    }
                });

                const allUsersList = Array.from(allUsersMap.values());

                // Filtrar doctores / profesionales
                const doctorSettingsMap = agendaConfig?.agenda_doctor_settings || {};

                const docsList = allUsersList
                    .filter(u => {
                        const detail = userDetailsMap[u.id] || {};
                        const mergedUser = { ...u, ...detail };
                        return isDoctorUser(mergedUser);
                    })
                    .map(u => {
                        const detail = userDetailsMap[u.id] || {};
                        const nombreCompleto = u.nombreCompleto || u.full_name || (u.nombre ? `${u.nombre} ${u.apellido || ''}`.trim() : '') || (detail.nombre ? `${detail.nombre} ${detail.apellido || ''}`.trim() : '') || u.email;
                        const userNombre = u.nombre || detail.nombre || nombreCompleto.split(' ')[0] || '';
                        const userApellido = u.apellido || detail.apellido || nombreCompleto.split(' ').slice(1).join(' ') || '';

                        const docSettings = doctorSettingsMap[u.id] || {};
                        let docSpaces = [];
                        if (docSettings && Array.isArray(docSettings.selectedResources)) {
                            docSpaces = docSettings.selectedResources;
                        } else if (docSettings && Array.isArray(docSettings.espaciosFisicos)) {
                            docSpaces = docSettings.espaciosFisicos;
                        } else if (Array.isArray(detail.recursos)) {
                            docSpaces = detail.recursos;
                        } else if (Array.isArray(u.recursos)) {
                            docSpaces = u.recursos;
                        } else {
                            docSpaces = [];
                        }

                        return {
                            id: u.id,
                            nombre: userNombre,
                            apellido: userApellido,
                            nombreCompleto: nombreCompleto,
                            email: u.email,
                            rol: u.role || u.rol || "Doctor",
                            especialidad: u.especialidad || (detail.especialidades ? detail.especialidades.join(', ') : 'Odontología General'),
                            especialidades: detail.especialidades || (u.especialidades || []),
                            sucursales: detail.sucursales || u.sucursales || [],
                            espaciosFisicos: docSpaces,
                            selectedResources: docSpaces,
                            recursoPrincipal: docSettings.recursoPrincipal || docSpaces[0] || "",
                            activo: u.activo !== false
                        };
                    });

                // Solo mostrar doctores/profesionales legítimos (excluyendo administradores)
                setDoctors(docsList);

                // Branches — sucursales
                setBranches(sedesList && sedesList.length > 0 ? sedesList : (sucursalesData || []));

                // Recursos físicos / Consultorios — fusionar tabla PostgreSQL y website_config
                const chairsMap = new Map();
                (conData || []).forEach(c => {
                    if (c.activo !== false) {
                        chairsMap.set(c.id, {
                            id: c.id,
                            nombre: c.nombre || c.name || "Sillón",
                            ubicacion: c.ubicacion || c.descripcion || "",
                            sucursalId: c.sucursal_id || c.sucursalId || "",
                            activo: true
                        });
                    }
                });
                (recFisicosData || []).forEach(c => {
                    if (c.id && c.activo !== false) {
                        const existing = chairsMap.get(c.id) || {};
                        chairsMap.set(c.id, {
                            ...existing,
                            id: c.id,
                            nombre: c.nombre || c.name || existing.nombre || "Sillón",
                            ubicacion: c.ubicacion || c.descripcion || existing.ubicacion || "",
                            sucursalId: c.sucursal_id || c.sucursalId || existing.sucursalId || "",
                            activo: true
                        });
                    }
                });
                setChairs(Array.from(chairsMap.values()));

                // Specialties — from website_config or defaults
                const rawCfgSpecs = Array.isArray(agendaConfig?.especialidades)
                    ? agendaConfig.especialidades
                    : [];
                const cfgSpecs = rawCfgSpecs
                    .map(e => typeof e === 'string' ? { id: e, nombre: e } : { id: e.id || e.nombre, nombre: e.nombre || e.id })
                    .filter(e => e.id && e.nombre);
                if (cfgSpecs.length > 0) setSpecialties(cfgSpecs);
                else setSpecialties(DEFAULT_SPECIALTIES);

                // Entities
                setEntities(entData || []);

                // Patients map
                const map = {};
                (pacData || []).forEach(p => {
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

    // 1. Fetch & Subscribe to Supabase Appointments
    const fetchSupabaseCitas = useCallback(async () => {
        if (!inquilino) {
            setLoading(false);
            return;
        }

        let start, end;
        if (viewMode === 'day') {
            start = startOfDay(selectedDate);
            end = endOfDay(selectedDate);
        } else {
            start = startOfWeek(selectedDate);
            end = addDays(start, 6);
            end.setHours(23, 59, 59, 999);
        }

        try {
            const { data, error } = await supabase
                .from("citas")
                .select("*, paciente:pacientes(nombres, apellidos, documento, telefono)")
                .eq("tenant_id", inquilino);

            if (error) throw error;

            const mapped = (data || []).map(c => {
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
                const stateKey = String(c.estado || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
                const statusAliases = {
                    "sin confirmar": "pending", "pendiente": "pending", "programada": "pending",
                    "confirmada": "confirmed", "confirmado": "confirmed",
                    "atendido": "attended", "completada": "attended", "completado": "attended",
                    "urgencia": "urgencia", "sin cont. web": "sin-cont-web",
                    "no asiste": "no-show", "cancelada": "cancelled", "cancelado": "cancelled",
                    "cancelled": "cancelled", "en espera": "waiting"
                };
                const normStatus = statusAliases[stateKey] || (statusMap[stateKey] ? stateKey : "confirmed");

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

            const effectiveBranchId = filterBranchId || activeSede?.id || "";
            const isMultiSede = (sedesList && sedesList.length > 1) || (branches && branches.length > 1);

            const visible = mapped.filter(ev => {
                const inRange = ev.start >= start && ev.start <= end;
                const activeDocFilter = isDoctorOnly ? loggedInDoctorId : filterDocId;
                const matchDoc = !activeDocFilter || ev.doctorId === activeDocFilter || ev.resourceId === activeDocFilter || ev.profesional_id === activeDocFilter;
                
                const matchBranch = !isMultiSede || !effectiveBranchId || effectiveBranchId === "TODAS" ||
                    String(ev.sucursalId) === String(effectiveBranchId) ||
                    String(ev.sucursal_id) === String(effectiveBranchId) ||
                    (activeSede?.nombre && String(ev.sucursalId || "").toUpperCase() === String(activeSede.nombre).toUpperCase()) ||
                    (sedesList?.find(s => String(s.id) === String(effectiveBranchId))?.nombre && (
                        String(ev.sucursalId || "").toUpperCase() === String(sedesList.find(s => String(s.id) === String(effectiveBranchId)).nombre).toUpperCase()
                    )) ||
                    (!ev.sucursalId && !ev.sucursal_id && activeSede?.esPrincipal);

                const matchChair = !filterChairId || ev.consultorioId === filterChairId || ev.consultorio_id === filterChairId || ev.sillonId === filterChairId || ev.recursoId === filterChairId;
                return inRange && matchDoc && matchBranch && matchChair;
            }).sort((a, b) => (a.start || 0) - (b.start || 0));

            setAppointments(visible);
        } catch (err) {
            console.error("Error al obtener citas de Supabase en useAgenda:", err);
        } finally {
            setLoading(false);
        }
    }, [inquilino, viewMode, selectedDate, isDoctorOnly, loggedInDoctorId, filterDocId, filterBranchId, filterChairId, activeSede, sedesList, branches]);

    // === Load Appointments Effect & Subscription ===
    useEffect(() => {
        if (!inquilino) {
            setLoading(false);
            return;
        }

        setLoading(true);
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
            supabase.removeChannel(channel);
        };
    }, [inquilino, fetchSupabaseCitas]);

    // Actions
    const createAppointment = async (data) => {
        await assertAppointmentAvailability({
            tenantId: inquilino,
            professionalId: data.doctorId,
            roomId: data.consultorioId,
            start: data.start,
            end: data.end || new Date(data.start.getTime() + (data.duracion || 30) * 60000)
        });

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
        await fetchSupabaseCitas();
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

        const { data: currentData, error: currentError } = await supabase
            .from("citas")
            .select("*")
            .eq("tenant_id", inquilino)
            .eq("id", id)
            .single();
        if (currentError) throw currentError;

        const isCancelled = finalPatch.status === "cancelled" ||
            ["cancelada", "cancelado", "cancelled"].includes((finalPatch.estado || "").toLowerCase());
        const timeChanged = ["start", "end", "fecha", "horaInicio", "duracion"]
            .some((field) => Object.prototype.hasOwnProperty.call(patch, field));
        const scheduleChanged = ["start", "end", "fecha", "horaInicio", "duracion", "doctorId", "consultorioId"]
            .some((field) => Object.prototype.hasOwnProperty.call(patch, field));
        let validatedStart = null;
        let validatedEnd = null;

        if (scheduleChanged) {
            const professionalId = finalPatch.doctorId ?? currentData.profesional_id;
            const roomId = finalPatch.consultorioId ?? currentData.consultorio_id;
            validatedStart = finalPatch.start ? new Date(finalPatch.start) : new Date(currentData.fecha_inicio);
            if (finalPatch.fecha || finalPatch.horaInicio) {
                const localDate = finalPatch.fecha || `${validatedStart.getFullYear()}-${String(validatedStart.getMonth() + 1).padStart(2, "0")}-${String(validatedStart.getDate()).padStart(2, "0")}`;
                const rawTime = finalPatch.horaInicio || `${String(validatedStart.getHours()).padStart(2, "0")}:${String(validatedStart.getMinutes()).padStart(2, "0")}`;
                const cleanTime = String(rawTime).trim().substring(0, 5);
                validatedStart = new Date(`${localDate}T${cleanTime}:00`);
            }
            validatedEnd = finalPatch.end ? new Date(finalPatch.end) : new Date(currentData.fecha_fin);
            if (!finalPatch.end && (finalPatch.start || finalPatch.fecha || finalPatch.horaInicio || finalPatch.duracion)) {
                const duration = Number(finalPatch.duracion) || Math.max(5, Math.round((new Date(currentData.fecha_fin) - new Date(currentData.fecha_inicio)) / 60000)) || 30;
                validatedEnd = new Date(validatedStart.getTime() + duration * 60000);
            }
            if (!isCancelled) {
                await assertAppointmentAvailability({
                    tenantId: inquilino,
                    professionalId,
                    roomId,
                    start: validatedStart,
                    end: validatedEnd,
                    excludeId: id
                });
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
        if (timeChanged) {
            supPatch.fecha_inicio = validatedStart.toISOString();
            supPatch.fecha_fin = validatedEnd.toISOString();
        }

        if (Object.keys(supPatch).length > 0) {
            const { error: updateError } = await supabase.from("citas").update(supPatch)
                .eq("tenant_id", inquilino).eq("id", id);
            if (updateError) throw updateError;
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

        await fetchSupabaseCitas();
    };

    const deleteAppointment = async (id) => {
        const { data: currentData, error: readError } = await supabase.from("citas").select("*")
            .eq("tenant_id", inquilino).eq("id", id).maybeSingle();
        if (readError) throw readError;
        if (!currentData) throw new Error("La cita no existe o no pertenece a esta clínica.");
        const { error: deleteError } = await supabase.from("citas").delete()
            .eq("tenant_id", inquilino).eq("id", id);
        if (deleteError) throw deleteError;
        await logAction(currentData.paciente_id || "unknown", "DELETE_APPOINTMENT", {
            fecha: currentData.fecha_inicio ? currentData.fecha_inicio.split("T")[0] : "",
            horaInicio: currentData.fecha_inicio ? new Date(currentData.fecha_inicio).toTimeString().substring(0, 5) : "",
            doctor: currentData.profesional_id || "No asignado",
            citaId: id
        });
        await fetchSupabaseCitas();
    };
    return {
        selectedDate, setSelectedDate,
        viewMode, setViewMode,
        loading, appointments,
        doctors: effectiveDoctors, chairs, branches,
        specialties, entities, priceList, patientsMap,
        isDoctorOnly, loggedInDoctorId,
        createAppointment, updateAppointment, deleteAppointment,
        refreshAppointments: fetchSupabaseCitas,
        filters: { filterDocId: isDoctorOnly ? loggedInDoctorId : filterDocId, setFilterDocId, filterBranchId, setFilterBranchId, filterChairId, setFilterChairId }
    };
}
