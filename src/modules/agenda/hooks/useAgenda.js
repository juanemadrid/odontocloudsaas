import { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, arrayUnion, setDoc, or } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { createOrUpdatePatient } from "../../../services/patientService";
import { useAudit } from "../../../hooks/useAudit";

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

        // Fetch doctors: We query all users for the tenant and filter client-side.
        // This ensures we catch anyone marked as doctor (esDoctor == true OR by role/profile) 
        // even if the exact boolean field is missing in older records.
        const unsubDocs = onSnapshot(query(
            collection(db, "usuarios"), 
            or(
                where("inquilino", "==", inquilino),
                where("tenantId", "==", inquilino)
            )
        ), snap => {
            setDoctors(
                snap.docs
                    .map(d => {
                        const data = d.data();
                        return { 
                            id: d.id, 
                            ...data 
                        };
                    })
                    .filter(u => u.activo !== false) // Active users only
                    .filter(u => 
                        u.esDoctor === true || 
                        (typeof u.rol === 'string' && ['doctor', 'odontologo', 'especialista'].includes(u.rol.toLowerCase())) ||
                        (typeof u.profileName === 'string' && u.profileName.toLowerCase().includes('octor'))
                    )
            );
        });
        const unsubChairs = onSnapshot(query(collection(db, "tenants", inquilino, "recursos_fisicos"), orderBy("nombre", "asc")), snap => {
            setChairs(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.active !== false));
        });
        const unsubBranches = onSnapshot(query(collection(db, "sucursales"), where("inquilino", "==", inquilino)), snap => {
            setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.activo !== false));
        });
        const unsubSpecs = onSnapshot(query(collection(db, "especialidades"), where("inquilino", "==", inquilino)), snap => {
            setSpecialties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubEntities = onSnapshot(query(collection(db, "entidades"), where("inquilino", "==", inquilino)), snap => {
            setEntities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubPrices = onSnapshot(query(collection(db, "precios"), where("inquilino", "==", inquilino)), snap => {
            setPriceList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubPatients = onSnapshot(query(collection(db, "pacientes"), where("inquilino", "==", inquilino)), snap => {
            const map = {};
            snap.docs.forEach(d => {
                const data = d.data();
                const pObj = { id: d.id, ...data };
                map[d.id] = pObj;
                if (data.nroDocumento) map[String(data.nroDocumento).trim()] = pObj;
                if (data.documento) map[String(data.documento).trim()] = pObj;
                if (data.id) map[String(data.id).trim()] = pObj;
                const nameKey = (data.nombreCompleto || data.paciente || `${data.nombres || ''} ${data.apellidos || ''}`).trim().toLowerCase();
                if (nameKey) map[nameKey] = pObj;
            });
            setPatientsMap(map);
        });

        return () => {
            unsubDocs(); unsubChairs(); unsubBranches();
            unsubSpecs(); unsubEntities(); unsubPrices(); unsubPatients();
        };
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

        const q = query(
            collection(db, "citas"),
            where("inquilino", "==", inquilino)
        );

        let isCurrent = true;

        const unsub = onSnapshot(q, (snap) => {
            console.log("useAgenda - Snapshot received. docs:", snap.docs.length);
            const raw = snap.docs.map(d => {
                const data = d.data();
                let dateObj = null;
                if (data.fecha?.toDate) dateObj = data.fecha.toDate();
                else if (typeof data.fecha === 'string') {
                    const [y, m, d] = data.fecha.split("-").map(Number);
                    const [hh, mm] = (data.horaInicio || data.hora || "00:00").split(":").map(Number);
                    dateObj = new Date(y, m - 1, d, hh, mm);
                }

                return {
                    id: d.id,
                    ...data,
                    pacienteId: data.pacienteId || data.patientId || null,
                    start: dateObj,
                    end: new Date((dateObj?.getTime() || 0) + ((data.duracion || 30) * 60000)),
                    resourceId: data.doctorId
                };
            });

            const visible = raw.filter(ev => {
                const inRange = ev.start >= start && ev.start <= end;
                const activeDocFilter = isDoctorOnly ? loggedInDoctorId : filterDocId;
                const matchDoc = !activeDocFilter || ev.doctorId === activeDocFilter;
                const matchBranch = !filterBranchId || ev.sucursalId === filterBranchId;
                return inRange && matchDoc && matchBranch;
            }).sort((a, b) => (a.start || 0) - (b.start || 0));

            console.log("useAgenda - Visible appointments:", visible.length);
            setAppointments(visible);
            setLoading(false);

            // Fetch patient debts asynchronously
            const uniquePatientIds = [...new Set(visible.map(a => a.pacienteId).filter(Boolean))];
            if (uniquePatientIds.length > 0) {
                const fetchDebts = async () => {
                    try {
                        const debtMap = {};
                        await Promise.all(uniquePatientIds.map(async (pid) => {
                            const [snapPlans, snapPagos, snapEvos] = await Promise.all([
                                getDocs(query(collection(db, "treatment_plans"), where("patientId", "==", pid))),
                                getDocs(query(collection(db, "pagos"), where("patientId", "==", pid))),
                                getDocs(query(collection(db, "clinical_evolutions"), where("patientId", "==", pid)))
                            ]);

                            const plans = snapPlans.docs.map(d => ({ id: d.id, ...d.data() }));
                            const payments = snapPagos.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.estado !== 'Anulado');
                            const evos = snapEvos.docs.map(d => ({ id: d.id, ...d.data() }));

                            let totalDebt = 0;
                            plans.forEach(plan => {
                                const planPayments = payments.filter(p => p.planId === plan.id);
                                const planEvos = evos.filter(e => e.planId === plan.id);
                                const paidMap = {};
                                (plan.items || []).forEach(it => { paidMap[it.id] = 0; });
                                planPayments.forEach(p => {
                                    if (p.itemPayments && p.itemPayments.length > 0) {
                                        p.itemPayments.forEach(ip => { 
                                            if (paidMap[ip.itemId] !== undefined) paidMap[ip.itemId] += Number(ip.monto || 0); 
                                        });
                                    }
                                });
                                (plan.items || []).forEach(item => {
                                    // Compatibilidad: registros nuevos usan `realizado`, antiguos usaban `checked`
                                    const realized = planEvos.some(e =>
                                        e.plantillaItems?.[item.id]?.realizado === true ||
                                        (e.plantillaItems?.[item.id]?.realizado === undefined && e.plantillaItems?.[item.id]?.checked === true)
                                    );
                                    if (!realized) return;
                                    const cost = (Number(item.amount || 0) * Number(item.qty || 1)) - Number(item.descuento || 0);
                                    const paid = paidMap[item.id] || 0;
                                    const debt = Math.max(0, cost - paid);
                                    totalDebt += debt;
                                });
                            });
                            debtMap[pid] = totalDebt;
                        }));

                        if (!isCurrent) return;

                        setAppointments(prev => prev.map(apt => {
                            if (debtMap[apt.pacienteId] !== undefined) {
                                return { ...apt, pagoPendiente: debtMap[apt.pacienteId] };
                            }
                            return apt;
                        }));
                    } catch (e) {
                        console.error("Error fetching patient debts for agenda:", e);
                    }
                };
                fetchDebts();
            }
        }, (err) => {
            console.error("useAgenda - Snapshot error:", err);
            setLoading(false);
        });

        return () => {
            isCurrent = false;
            unsub();
        };
    }, [selectedDate, viewMode, inquilino, filterDocId, filterBranchId]);

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
            ...data,
            inquilino,
            pacienteId, // Usamos el ID nuevo o el existente
            fecha: `${y}-${m}-${d}`,
            horaInicio: `${hh}:${mm}`,
            creado: new Date().toISOString()
        };

        const payload = Object.fromEntries(
            Object.entries(rawPayload).filter(([_, v]) => v !== undefined)
        );

        const ref = await addDoc(collection(db, "citas"), payload);

        // Audit log
        await logAction(payload.pacienteId || "unknown", "CREATE_APPOINTMENT", {
            fecha: payload.fecha,
            horaInicio: payload.horaInicio || payload.hora || "",
            doctor: doctors.find(d => d.id === payload.doctorId)?.nombreCompleto || payload.doctorId || "No asignado",
            citaId: ref.id
        });

        if (pacienteId) {
            try {
                await setDoc(doc(db, "pacientes", pacienteId), {
                    citas: arrayUnion(ref.id),
                    inquilino
                }, { merge: true });

                // Notify Patient in real-time
                await addDoc(collection(db, "notificaciones"), {
                    inquilino,
                    target: "patient",
                    title: "Nueva Cita Agendada 📅",
                    message: `Tu cita ha sido programada para el ${payload.fecha} a las ${payload.horaInicio || payload.hora || ""}.`,
                    type: "appointment_scheduled",
                    pacienteId,
                    read: false,
                    createdAt: new Date().toISOString()
                });
            } catch (pErr) {
                console.warn("Could not associate appointment to patient document:", pErr);
            }
        }
        return ref.id;
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
            // Obtener la cita actual para comparar
            const currentDoc = await getDoc(doc(db, "citas", id));
            const currentData = currentDoc.exists() ? currentDoc.data() : {};
            
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
                // Fetch doctor schedule configurations in real-time
                const [predSnap, openSnap, unavailSnap] = await Promise.all([
                    getDocs(collection(db, "usuarios", doctorId, "horarios_predefinidos")),
                    getDocs(collection(db, "usuarios", doctorId, "agenda_abierta")),
                    getDocs(collection(db, "usuarios", doctorId, "no_disponibles"))
                ]);

                const predefined = predSnap.docs.map(doc => doc.data());
                const openAgenda = openSnap.docs.map(doc => doc.data());
                const unavailable = unavailSnap.docs.map(doc => doc.data());

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
                // Fetch consultorio schedule configurations in real-time
                const [resPredSnap, resOpenSnap, resUnavailSnap] = await Promise.all([
                    getDocs(collection(db, "tenants", inquilino, "recursos_fisicos", consultorioId, "horarios_predefinidos")),
                    getDocs(collection(db, "tenants", inquilino, "recursos_fisicos", consultorioId, "agenda_abierta")),
                    getDocs(collection(db, "tenants", inquilino, "recursos_fisicos", consultorioId, "no_disponibles"))
                ]);

                const resPredefined = resPredSnap.docs.map(doc => doc.data());
                const resOpenAgenda = resOpenSnap.docs.map(doc => doc.data());
                const resUnavailable = resUnavailSnap.docs.map(doc => doc.data());

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
                const doctorCheck = query(
                    collection(db, 'citas'),
                    where('inquilino', '==', inquilino),
                    where('doctorId', '==', doctorId),
                    where('fecha', '==', finalPatch.fecha)
                );
                
                const doctorSnap = await getDocs(doctorCheck);
                
                for (const docSnap of doctorSnap.docs) {
                    if (docSnap.id === id) continue; // Excluir la cita actual
                    
                    const citaExistente = docSnap.data();
                    if (citaExistente.status === 'cancelled' || ['cancelada', 'cancelado'].includes((citaExistente.estado || '').toLowerCase())) continue;
                    
                    const [citaHh, citaMm] = (citaExistente.horaInicio || "00:00").split(":").map(Number);
                    const citaInicio = new Date(y, m - 1, d, citaHh, citaMm);
                    const citaFin = new Date(citaInicio.getTime() + ((citaExistente.duracion || 30) * 60000));
                    
                    // Verificar solapamiento: (nuevaInicio < citaFin) && (nuevaFin > citaInicio)
                    if (nuevaInicio < citaFin.getTime() && nuevaFin > citaInicio.getTime()) {
                        const doctorName = doctors.find(d => d.id === doctorId)?.nombreCompleto || 
                                          `${doctors.find(d => d.id === doctorId)?.nombre || ''} ${doctors.find(d => d.id === doctorId)?.apellido || ''}`.trim() || 
                                          'El doctor';
                        const horaFinStr = `${String(citaFin.getHours()).padStart(2, '0')}:${String(citaFin.getMinutes()).padStart(2, '0')}`;
                        throw new Error(`${doctorName} ya tiene una cita desde las ${citaExistente.horaInicio} hasta las ${horaFinStr}.`);
                    }
                }
            }
            
            // Validar que el consultorio no tenga solapamiento (excluyendo la cita actual)
            if (consultorioId) {
                const consultorioCheck = query(
                    collection(db, 'citas'),
                    where('inquilino', '==', inquilino),
                    where('consultorioId', '==', consultorioId),
                    where('fecha', '==', finalPatch.fecha)
                );
                
                const consultorioSnap = await getDocs(consultorioCheck);
                
                for (const docSnap of consultorioSnap.docs) {
                    if (docSnap.id === id) continue; // Excluir la cita actual
                    
                    const citaExistente = docSnap.data();
                    if (citaExistente.status === 'cancelled' || ['cancelada', 'cancelado'].includes((citaExistente.estado || '').toLowerCase())) continue;
                    
                    const [citaHh, citaMm] = (citaExistente.horaInicio || "00:00").split(":").map(Number);
                    const citaInicio = new Date(y, m - 1, d, citaHh, citaMm);
                    const citaFin = new Date(citaInicio.getTime() + ((citaExistente.duracion || 30) * 60000));
                    
                    // Verificar solapamiento
                    if (nuevaInicio < citaFin.getTime() && nuevaFin > citaInicio.getTime()) {
                        const consultorioName = chairs.find(c => c.id === consultorioId)?.nombre || 'El consultorio';
                        const horaFinStr = `${String(citaFin.getHours()).padStart(2, '0')}:${String(citaFin.getMinutes()).padStart(2, '0')}`;
                        throw new Error(`${consultorioName} está ocupado desde las ${citaExistente.horaInicio} hasta las ${horaFinStr}.`);
                    }
                }
            }
        }
    }

        const cleanPatch = Object.fromEntries(
            Object.entries(finalPatch).filter(([_, v]) => v !== undefined)
        );
        await updateDoc(doc(db, "citas", id), cleanPatch);

        // If status changed or appointment is rescheduled, notify patient in real-time
        try {
            const currentDoc = await getDoc(doc(db, "citas", id));
            const currentData = currentDoc.exists() ? currentDoc.data() : {};
            const pacienteId = currentData.pacienteId;

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

                await addDoc(collection(db, "notificaciones"), {
                    inquilino: currentData.inquilino || inquilino,
                    target: "patient",
                    title,
                    message,
                    type: "appointment_update",
                    pacienteId,
                    read: false,
                    createdAt: new Date().toISOString()
                });
            }
        } catch (nErr) {
            console.warn("Could not send real-time notification to patient/log audit:", nErr);
        }
    };

    const deleteAppointment = async (id) => {
        try {
            const currentDoc = await getDoc(doc(db, "citas", id));
            if (currentDoc.exists()) {
                const currentData = currentDoc.data();
                await deleteDoc(doc(db, "citas", id));
                await logAction(currentData.pacienteId || "unknown", "DELETE_APPOINTMENT", {
                    fecha: currentData.fecha,
                    horaInicio: currentData.horaInicio || "",
                    doctor: currentData.doctorNombre || currentData.doctorId || "No asignado",
                    citaId: id
                });
            } else {
                await deleteDoc(doc(db, "citas", id));
            }
        } catch (err) {
            console.error("Error in auditing deleteAppointment:", err);
            await deleteDoc(doc(db, "citas", id));
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
