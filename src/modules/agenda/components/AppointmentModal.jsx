import React, { useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { useToast } from "../../../context/ToastContext";
import { searchPatients } from "../../../services/patientService";
import { FiUser, FiCalendar, FiPhone, FiExternalLink, FiSearch, FiCreditCard, FiAlertCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { buildDashboardPath } from "../../../utils/dashboardBasePath";
import { sendConfirmation } from "../../../services/WhatsAppService";
import { dispatchAutomationEvent } from "../../../services/AutomationService";
import { usePermissions } from "../../../hooks/usePermissions";

// Basic schema for appointment info
const baseSchema = z.object({
    id: z.string().optional(),
    doctorId: z.string().min(1, "Seleccione un doctor"),
    consultorioId: z.string().min(1, "Seleccione un consultorio"),
    sucursalId: z.string().min(1, "Seleccione una sucursal"),
    especialidadId: z.string().optional(),
    entidadId: z.string().optional(),
    precioItemId: z.string().optional(),
    fecha: z.string().min(1, "Fecha requerida"),
    hora: z.string().min(1, "Hora requerida"),
    duracion: z.number().min(5).default(30),
    comentario: z.string().optional(),
    status: z.string().optional(),
    valoracion: z.boolean().default(false),
    control: z.boolean().default(false),
    enviarCorreo: z.boolean().default(true)
});

// Full schema with conditionally required fields
const appointmentSchema = z.discriminatedUnion("isNewPatient", [
    baseSchema.extend({
        isNewPatient: z.literal(false),
        pacienteId: z.string().min(1, "Seleccione un paciente"),
        pacienteNombre: z.string(),
    }),
    baseSchema.extend({
        isNewPatient: z.literal(true),
        nombres: z.string().min(1, "Nombre requerido"),
        apellidos: z.string().min(1, "Apellido requerido"),
        tipoDocumento: z.string().min(1, "Tipo doc requerido"),
        nroDocumento: z.string().min(1, "Documento requerido"),
        celular: z.string().min(1, "Celular requerido"),
        email: z.string().email("Correo inválido").optional().or(z.literal("")),
        fechaNacimiento: z.string().min(1, "F. Nacimiento requerida"),
        sexo: z.string().min(1, "Sexo requerido")
    })
]);

export default function AppointmentModal({
    isOpen,
    onClose,
    initialData,
    doctors,
    chairs,
    branches,
    specialties = [],
    entities = [],
    priceList = [],
    onSave,
    onDelete
}) {
    const toast = useToast();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { can } = usePermissions();
    const hasWritePermission = initialData?.id ? can("Agenda", "Agenda", "editar") : can("Agenda", "Agenda", "crear");
    const inquilino = userProfile?.inquilino;    const [patientResults, setPatientResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [term, setTerm] = useState("");
    const [selectedPatientPhone, setSelectedPatientPhone] = useState("");
    const searchInputWrapperRef = useRef(null);
    const [dropdownStyle, setDropdownStyle] = useState({});
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
 
    const { control, register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
        resolver: zodResolver(appointmentSchema),
        defaultValues: {
            isNewPatient: false,
            duracion: 30,
            comentario: "",
            doctorId: "",
            consultorioId: "",
            sucursalId: "",
            especialidadId: "",
            entidadId: "",
            precioItemId: "",
            fecha: "",
            hora: "",
            status: "confirmed",
            valoracion: false,
            control: false,
            enviarCorreo: true
        }
    });
 
    const isNew = watch("isNewPatient");
    const selectedPatientName = watch("pacienteNombre");
 
    useEffect(() => {
        if (isOpen && initialData) {
            setIsConfirmingDelete(false);
            let f = "", h = "";;
            if (initialData.start) {
                const y = initialData.start.getFullYear();
                const m = String(initialData.start.getMonth() + 1).padStart(2, '0');
                const d = String(initialData.start.getDate()).padStart(2, '0');
                f = `${y}-${m}-${d}`;
                h = String(initialData.start.getHours()).padStart(2, '0') + ":" + String(initialData.start.getMinutes()).padStart(2, '0');
            }
            // Soporte para fecha directa como string (ej. desde notificación de cita)
            if (!f && initialData.fecha) {
                f = initialData.fecha;
            }

            reset({
                isNewPatient: false,
                id: initialData.id,
                pacienteId: initialData.pacienteId || "",
                pacienteNombre: initialData.paciente || initialData.pacienteNombre || "",
                doctorId: initialData.doctorId || (doctors?.[0]?.id || ""),
                consultorioId: initialData.consultorioId || (chairs?.[0]?.id || ""),
                sucursalId: initialData.sucursalId || (branches?.[0]?.id || ""),
                especialidadId: initialData.especialidadId || "",
                entidadId: initialData.entidadId || "",
                precioItemId: initialData.precioItemId || "",
                fecha: f,
                hora: h,
                duracion: initialData.duracion || 30,
                comentario: initialData.comentario || "",
                status: initialData.status || "confirmed",
                valoracion: initialData.valoracion || false,
                control: initialData.control || false,
                enviarCorreo: initialData.enviarCorreo ?? true
            });
            setTerm(initialData.paciente || initialData.pacienteNombre || "");
            setSelectedPatientPhone(initialData.celular || "");
        } else {
            reset({
                isNewPatient: false, // Default to search
                doctorId: doctors?.[0]?.id || "",
                consultorioId: chairs?.[0]?.id || "",
                sucursalId: branches?.[0]?.id || ""
            });
            setTerm("");
            setSelectedPatientPhone("");
        }
    }, [isOpen, initialData, doctors, chairs, branches, reset]);

    // Search Logic
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (isNew || term.length < 2 || term === selectedPatientName) {
                setPatientResults([]);
                return;
            }
            setSearching(true);
            try {
                const raw = await searchPatients(inquilino, term);
                // Deduplicate by patient id to avoid React duplicate key warnings
                const seen = new Set();
                const results = raw.filter(p => {
                    if (seen.has(p.id)) return false;
                    seen.add(p.id);
                    return true;
                });
                setPatientResults(results);
            } catch (e) {
                console.error("Search error:", e);
                // If it's the index error, we want the user to see it
                if (e.message.includes("index")) {
                    toast.error("Falta crear el índice en Firebase. Revisa el enlace enviado.");
                } else {
                    toast.error("Error buscando pacientes: " + e.message);
                }
            } finally {
                setSearching(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [term, isNew, selectedPatientName, inquilino, toast]);

    // Update dropdown position when results appear
    useEffect(() => {
        if (patientResults.length > 0 && searchInputWrapperRef.current) {
            const rect = searchInputWrapperRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 6,
                left: rect.left,
                width: rect.width,
                zIndex: 100005,
            });
        }
    }, [patientResults]);

    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    const handleClose = () => {
        if (isDirty) {
            setShowCloseConfirm(true);
            return;
        }
        onClose();
    };

    const handleWhatsApp = async () => {
        if (!initialData?.id && !watch("pacienteId")) {
            toast.error("Seleccione un paciente primero");
            return;
        }
        try {
            const res = await sendConfirmation({
                pacienteNombre: watch("pacienteNombre"),
                celularPaciente: selectedPatientPhone,
                fecha: watch("fecha"),
                horaInicio: watch("hora")
            });
            toast.success("Mensaje enviado correctamente");
        } catch (e) {
            toast.error("Error enviando WhatsApp: " + e.message);
        }
    };

    const handleGoToProfile = () => {
        const pid = watch("pacienteId");
        if (!pid) return;
        navigate(buildDashboardPath(`pacientes?id=${pid}`));
    };

    const onValidSubmit = async (data) => {
        console.log("onValidSubmit triggered with data:", data);
        try {
            const [y, m, d] = data.fecha.split("-").map(Number);
            const [hh, mm] = data.hora.split(":").map(Number);
            const start = new Date(y, m - 1, d, hh, mm);
            const end = new Date(start.getTime() + data.duracion * 60000);
            // Asegurar que horaInicio esté siempre presente para que la agenda lo muestre
            data.horaInicio = data.hora;

            // Import Firebase Firestore dynamically
            const { collection: firestoreCollection, query: firestoreQuery, where, getDocs } = await import('firebase/firestore');
            const { db } = await import('../../../firebase/firebaseConfig');

            // Si la cita se está guardando como cancelada, no requiere validación de horarios ni solapamientos
            const isCancelled = data.status === 'cancelled';

            // Helper robusto: detecta citas canceladas sin importar capitalización ni idioma
            const esCitaCancelada = (cita) => {
                const s = (cita.status || '').toLowerCase();
                const e = (cita.estado || '').toLowerCase();
                return s === 'cancelled' || s === 'cancelado' || s === 'cancelada' ||
                       e === 'cancelado' || e === 'cancelada' || e === 'cancelled';
            };

            if (!isCancelled) {
                // 1. ✅ VALIDACIÓN DE DISPONIBILIDAD DEL DOCTOR (Horarios Predefinidos, Aperturas, No Disponibles)
                if (data.doctorId) {
                const docId = data.doctorId;
                
                // Fetch doctor schedule configurations in real-time
                const [predSnap, openSnap, unavailSnap] = await Promise.all([
                    getDocs(firestoreCollection(db, "usuarios", docId, "horarios_predefinidos")),
                    getDocs(firestoreCollection(db, "usuarios", docId, "agenda_abierta")),
                    getDocs(firestoreCollection(db, "usuarios", docId, "no_disponibles"))
                ]);

                const predefined = predSnap.docs.map(doc => doc.data());
                const openAgenda = openSnap.docs.map(doc => doc.data());
                const unavailable = unavailSnap.docs.map(doc => doc.data());

                const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                const dayName = days[start.getDay()];

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
                const apptEndMin = apptStartMin + data.duracion;

                // Check unavailable slots first
                for (const slot of unavailable) {
                    if (slot.fecha === data.fecha && slot.active !== false) {
                        const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                        const slotEndMin = parseTimeToMinutes(slot.horaFin);
                        if (apptStartMin < slotEndMin && apptEndMin > slotStartMin) {
                            const motivoStr = slot.motivo ? ` por motivo de: "${slot.motivo}"` : "";
                            toast.error(`El doctor no está disponible en este horario${motivoStr}.`);
                            return;
                        }
                    }
                }

                // Solo validar disponibilidad si el doctor tiene horarios configurados (opt-in)
                // Si no tiene ningún horario configurado, se permite cualquier hora
                const hasScheduleConfig = predefined.length > 0 || openAgenda.length > 0;

                // ✅ EXCEPCIÓN: Si existe una cita cancelada del mismo doctor, mismo consultorio,
                // misma fecha y misma hora, significa que el slot fue previamente validado como válido.
                // Permitir la nueva cita sin restricción de asignación de consultorio.
                let hasFreedSlotFromCancellation = false;
                if (hasScheduleConfig && data.consultorioId) {
                    const cancelledQuery = firestoreQuery(
                        firestoreCollection(db, 'citas'),
                        where('inquilino', '==', inquilino),
                        where('doctorId', '==', data.doctorId),
                        where('consultorioId', '==', data.consultorioId),
                        where('fecha', '==', data.fecha),
                        where('horaInicio', '==', data.hora)
                    );
                    const cancelledSnap = await getDocs(cancelledQuery);
                    hasFreedSlotFromCancellation = cancelledSnap.docs.some(d => {
                        const c = d.data();
                        return esCitaCancelada(c);
                    });
                }

                if (hasScheduleConfig && !hasFreedSlotFromCancellation) {
                    let isAvailable = false;

                    // Check open agenda custom dates
                    for (const slot of openAgenda) {
                        if (slot.fecha === data.fecha && slot.active !== false) {
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
                                    if (slot.recursoId === "todos" || slot.recursoId === data.consultorioId) {
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

                        const doctorName = doctors.find(d => d.id === data.doctorId)?.nombreCompleto || 
                                          `${doctors.find(d => d.id === data.doctorId)?.nombre || ''} ${doctors.find(d => d.id === data.doctorId)?.apellido || ''}`.trim() || 
                                          'El doctor';

                        if (hasPredefinedTimeButWrongResource) {
                            toast.error(`${doctorName} no está programado para atender en este consultorio en ese horario. Está asignado a: ${scheduledResourceName}.`);
                        } else {
                            const endTimeStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                            toast.error(`${doctorName} no tiene agenda habilitada para el día ${dayName} en el horario de ${data.hora} a ${endTimeStr}.`);
                        }
                        return;
                    }
                }
            }

            // 1.5 ✅ VALIDACIÓN DE DISPONIBILIDAD DEL CONSULTORIO (Recurso Físico)
            if (data.consultorioId) {
                const resId = data.consultorioId;
                
                // Fetch consultorio schedule configurations in real-time
                const [resPredSnap, resOpenSnap, resUnavailSnap] = await Promise.all([
                    getDocs(firestoreCollection(db, "tenants", inquilino, "recursos_fisicos", resId, "horarios_predefinidos")),
                    getDocs(firestoreCollection(db, "tenants", inquilino, "recursos_fisicos", resId, "agenda_abierta")),
                    getDocs(firestoreCollection(db, "tenants", inquilino, "recursos_fisicos", resId, "no_disponibles"))
                ]);

                const resPredefined = resPredSnap.docs.map(doc => doc.data());
                const resOpenAgenda = resOpenSnap.docs.map(doc => doc.data());
                const resUnavailable = resUnavailSnap.docs.map(doc => doc.data());

                const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                const dayName = days[start.getDay()];

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
                const apptEndMin = apptStartMin + data.duracion;

                // Check unavailable slots first
                for (const slot of resUnavailable) {
                    if (slot.fecha === data.fecha && slot.active !== false) {
                        const slotStartMin = parseTimeToMinutes(slot.horaInicio);
                        const slotEndMin = parseTimeToMinutes(slot.horaFin);
                        if (apptStartMin < slotEndMin && apptEndMin > slotStartMin) {
                            const motivoStr = slot.motivo ? ` por motivo de: "${slot.motivo}"` : "";
                            toast.error(`El consultorio no está disponible en este horario${motivoStr}.`);
                            return;
                        }
                    }
                }

                // If schedules are configured, check availability
                if (resPredefined.length > 0 || resOpenAgenda.length > 0) {
                    let isResAvailable = false;

                    // Check open agenda
                    for (const slot of resOpenAgenda) {
                        if (slot.fecha === data.fecha && slot.active !== false) {
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
                        const consultorioName = chairs.find(c => c.id === resId)?.nombre || 'el consultorio seleccionado';
                        const endTimeStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                        toast.error(`${consultorioName} no tiene horario de atención habilitado para el día ${dayName} de ${data.hora} a ${endTimeStr}.`);
                        return;
                    }
                }
            }

            // 2. ✅ VALIDACIÓN: Prevenir solapamiento con otras citas del mismo Doctor o del mismo Consultorio
            const nuevaInicio = start.getTime();
            const nuevaFin = end.getTime();
            
            // Obtener todas las citas del doctor en esa fecha
            const doctorCheck = firestoreQuery(
                firestoreCollection(db, 'citas'),
                where('inquilino', '==', inquilino),
                where('doctorId', '==', data.doctorId),
                where('fecha', '==', data.fecha)
            );
            
            const doctorSnap = await getDocs(doctorCheck);
            

            // Verificar solapamiento de horarios con citas del doctor
            for (const docSnap of doctorSnap.docs) {
                if (data.id && docSnap.id === data.id) continue; // Excluir la cita actual que se está editando
                
                const citaExistente = docSnap.data();
                if (esCitaCancelada(citaExistente)) continue;
                
                const [citaHh, citaMm] = (citaExistente.horaInicio || "00:00").split(":").map(Number);
                const citaInicio = new Date(start);
                citaInicio.setHours(citaHh, citaMm, 0, 0);
                const citaFin = new Date(citaInicio.getTime() + (citaExistente.duracion || 30) * 60000);
                
                if (nuevaInicio < citaFin.getTime() && nuevaFin > citaInicio.getTime()) {
                    const doctorName = doctors.find(d => d.id === data.doctorId)?.nombreCompleto || 
                                      `${doctors.find(d => d.id === data.doctorId)?.nombre || ''} ${doctors.find(d => d.id === data.doctorId)?.apellido || ''}`.trim() || 
                                      'el doctor seleccionado';
                    const horaFinExistente = `${String(citaFin.getHours()).padStart(2, '0')}:${String(citaFin.getMinutes()).padStart(2, '0')}`;
                    toast.error(`${doctorName} ya tiene una cita programada desde las ${citaExistente.horaInicio} hasta las ${horaFinExistente}.`);
                    return;
                }
            }
            
            // Obtener todas las citas del consultorio en esa fecha
            const consultorioCheck = firestoreQuery(
                firestoreCollection(db, 'citas'),
                where('inquilino', '==', inquilino),
                where('consultorioId', '==', data.consultorioId),
                where('fecha', '==', data.fecha)
            );
            
            const consultorioSnap = await getDocs(consultorioCheck);
            
            // Verificar solapamiento de horarios con citas del consultorio
            for (const docSnap of consultorioSnap.docs) {
                if (data.id && docSnap.id === data.id) continue; // Excluir la cita actual que se está editando
                
                const citaExistente = docSnap.data();
                if (esCitaCancelada(citaExistente)) continue;
                
                const [citaHh, citaMm] = (citaExistente.horaInicio || "00:00").split(":").map(Number);
                const citaInicio = new Date(start);
                citaInicio.setHours(citaHh, citaMm, 0, 0);
                const citaFin = new Date(citaInicio.getTime() + (citaExistente.duracion || 30) * 60000);
                
                if (nuevaInicio < citaFin.getTime() && nuevaFin > citaInicio.getTime()) {
                    const consultorioName = chairs.find(c => c.id === data.consultorioId)?.nombre || 'el consultorio seleccionado';
                    const horaFinExistente = `${String(citaFin.getHours()).padStart(2, '0')}:${String(citaFin.getMinutes()).padStart(2, '0')}`;
                    toast.error(`${consultorioName} está ocupado por otra cita desde las ${citaExistente.horaInicio} hasta las ${horaFinExistente}.`);
                    return;
                }
            }
            }

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
            const finalStatus = (data.status === 'cancelled' && initialData?.start && new Date(initialData.start).getTime() !== start.getTime()) 
                ? 'confirmed' 
                : (data.status || 'confirmed');
            const finalEstado = statusMap[finalStatus] || 'CONFIRMADA';

            const payload = {
                ...data,
                status: finalStatus,
                estado: finalEstado,
                start,
                end,
                doctor: doctors.find(d => d.id === data.doctorId) ? `${doctors.find(d => d.id === data.doctorId).nombre || ''} ${doctors.find(d => d.id === data.doctorId).apellido || ''}`.trim() || doctors.find(d => d.id === data.doctorId).nombreCompleto : "Doctor",
                // Si es paciente nuevo, marcamos como registro incompleto (captura inicial)
                paciente: data.isNewPatient ? `${data.nombres} ${data.apellidos}` : data.pacienteNombre,
                celular: data.isNewPatient ? data.celular : selectedPatientPhone,
                registroCompleto: data.isNewPatient ? false : undefined
            };

            await onSave(payload);

            // Dispatch automation event
            dispatchAutomationEvent("APPOINTMENT_CREATED", {
                ...payload,
                inquilino,
                operatorName: userProfile?.nombre || userProfile?.email
            });

            onClose();
        } catch (error) {
            console.error("Error in onValidSubmit:", error);
            toast.error(error.message || "Error guardando cita");
        }
    };

    const onInvalidSubmit = (errors) => {
        console.warn("Form validation failed:", errors);
        const errorMessages = Object.values(errors).map(err => err.message).filter(Boolean);
        if (errorMessages.length > 0) {
            toast.error("Por favor complete los campos requeridos: " + errorMessages.join(", "));
        } else {
            toast.error("Por favor revise los campos marcados en rojo.");
        }
    };

    const handleSelectPatient = (p) => {
        setValue("pacienteId", p.id);
        setValue("pacienteNombre", p.nombreCompleto);
        setTerm(p.nombreCompleto);
        setPatientResults([]);
        setSelectedPatientPhone(p.celular || "");
    };

    const changeWeek = (days) => {
        const currentFecha = watch("fecha") || new Date().toISOString().split('T')[0];
        const d = new Date(currentFecha + "T00:00:00");
        d.setDate(d.getDate() + days);
        setValue("fecha", d.toISOString().split('T')[0]);
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div className="relative flex flex-col bg-slate-50 overflow-hidden h-[90vh] w-[1100px] max-w-[98vw] rounded-[32px] shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                {/* CLEAN HEADER */}
                <div className="px-8 py-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600">
                            <FiCalendar size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Gestión de Cita Médica</h3>
                                {!hasWritePermission && (
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[9px] font-black uppercase tracking-widest leading-none">Sólo Lectura</span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planificación Dental Premium</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95"
                    >
                        <span className="text-xl leading-none">×</span>
                    </button>
                </div>

                {initialData?.registroCompleto === false && (
                    <div className="bg-amber-50 border-b border-amber-200 px-8 py-3.5 flex items-center justify-between gap-4 animate-pulse shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shadow-md">
                                <FiAlertCircle size={14} />
                            </span>
                            <div className="flex flex-col">
                                <span className="text-amber-800 text-[11px] font-black uppercase tracking-wider">Registro Incompleto</span>
                                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                    Este paciente fue registrado de forma rápida desde la agenda y tiene datos pendientes por completar.
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                handleGoToProfile();
                                onClose();
                            }}
                            className="px-4 py-2 bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-700 active:scale-95 transition-all shadow-md shadow-amber-600/10 shrink-0 animate-bounce"
                        >
                            Completar Ficha Paciente
                        </button>
                    </div>
                )}

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT COL: FORM (Fixed Width) */}
                    <form
                        onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}
                        className="w-[400px] shrink-0 overflow-y-auto custom-scrollbar p-8 bg-white/50 border-r border-slate-100 space-y-6"
                    >
                        {/* SECTION: PACIENTE */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identidad del Paciente</label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" {...register("isNewPatient")} disabled={!hasWritePermission} className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/20 h-4 w-4 transition-all" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight group-hover:text-blue-600 transition-colors">Nuevo</span>
                                </label>
                            </div>

                            {!isNew ? (
                                <div ref={searchInputWrapperRef} className="relative">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors">
                                                <FiSearch size={14} />
                                            </div>
                                            <input
                                                value={term}
                                                onChange={e => { setTerm(e.target.value); if (e.target.value !== selectedPatientName) setValue("pacienteId", ""); }}
                                                disabled={!hasWritePermission}
                                                placeholder="BUSCAR POR NOMBRE O CC..."
                                                className={`w-full bg-white border border-slate-200 rounded-[14px] pl-10 pr-4 py-3 text-[11px] font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 transition-all outline-none placeholder:text-slate-300 uppercase tracking-tight ${errors.pacienteId ? "border-red-500 ring-red-50" : "shadow-sm"}`}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleGoToProfile}
                                            disabled={!watch("pacienteId")}
                                            className="w-11 h-11 bg-white border border-slate-100 flex items-center justify-center text-blue-600 rounded-[14px] shadow-sm hover:bg-blue-50 disabled:opacity-30 transition-all active:scale-95"
                                        >
                                            <FiUser size={18} />
                                        </button>
                                    </div>
                                    {patientResults.length > 0 && ReactDOM.createPortal(
                                        <div
                                            style={dropdownStyle}
                                            className="bg-white shadow-2xl rounded-2xl border border-slate-200 max-h-56 overflow-y-auto p-2 space-y-1"
                                        >
                                            {patientResults.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="p-4 hover:bg-blue-600 group rounded-xl cursor-pointer transition-all flex items-center justify-between"
                                                    onMouseDown={(e) => { e.preventDefault(); handleSelectPatient(p); }}
                                                >
                                                    <div>
                                                        <div className="text-[11px] font-black text-slate-800 group-hover:text-white uppercase transition-colors">{p.nombreCompleto || p.paciente}</div>
                                                        <div className="text-[9px] font-bold text-slate-400 group-hover:text-blue-100 uppercase transition-colors">{p.nroDocumento || "S/N"} | {p.celular || "S/C"}</div>
                                                    </div>
                                                    <div className="w-6 h-6 rounded-full bg-slate-50 group-hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                        <FiExternalLink size={10} className="text-blue-600 group-hover:text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>,
                                        document.body
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombres *</label>
                                            <input {...register("nombres")} disabled={!hasWritePermission} placeholder="NOMBRES" className="bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 placeholder:text-slate-300 uppercase w-full shadow-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 outline-none transition-all" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellidos *</label>
                                            <input {...register("apellidos")} disabled={!hasWritePermission} placeholder="APELLIDOS" className="bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 placeholder:text-slate-300 uppercase w-full shadow-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 outline-none transition-all" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo Doc *</label>
                                            <select {...register("tipoDocumento")} disabled={!hasWritePermission} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none">
                                                <option value="">TIPO...</option>
                                                <option value="CC">CC - Cédula</option>
                                                <option value="TI">TI - Tarjeta Id.</option>
                                                <option value="RC">RC - Reg. Civil</option>
                                                <option value="CE">CE - Cédula Ext.</option>
                                                <option value="PA">PA - Pasaporte</option>
                                                <option value="PE">PE - Permiso Esp.</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento *</label>
                                            <input {...register("nroDocumento")} disabled={!hasWritePermission} placeholder="DOCUMENTO" className="bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 placeholder:text-slate-300 uppercase w-full shadow-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 outline-none transition-all" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Celular *</label>
                                            <input {...register("celular")} disabled={!hasWritePermission} placeholder="CELULAR" className="bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 placeholder:text-slate-300 uppercase w-full shadow-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 outline-none transition-all" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sexo *</label>
                                            <select {...register("sexo")} disabled={!hasWritePermission} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none">
                                                <option value="">SEXO...</option>
                                                <option value="M">Masculino</option>
                                                <option value="F">Femenino</option>
                                                <option value="O">Otro</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Nacimiento *</label>
                                        <input type="date" {...register("fechaNacimiento")} disabled={!hasWritePermission} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 shadow-sm transition-all" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SECTION: ASIGNACIÓN */}
                        <div className="space-y-4 pt-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Detalles de la Cita</label>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sede *</label>
                                    <select {...register("sucursalId")} disabled={!hasWritePermission} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none">
                                        <option value="">ELIJA SUCURSAL...</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Especialidad *</label>
                                    <select {...register("especialidadId")} disabled={!hasWritePermission} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none">
                                        <option value="">ELIJA ESPECIALIDAD...</option>
                                        {/* ✅ FILTRADO POR SUCURSAL */}
                                        {specialties
                                            .filter(s => !watch("sucursalId") || !s.sucursalId || s.sucursalId === watch("sucursalId"))
                                            .map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)
                                        }
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Profesional *</label>
                                    <select {...register("doctorId")} disabled={!hasWritePermission || doctors.length === 1} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none disabled:bg-slate-100 disabled:cursor-not-allowed">
                                        <option value="">ELIJA DOCTOR...</option>
                                        {/* ✅ FILTRADO POR ESPECIALIDAD */}
                                        {doctors
                                            .filter(d => {
                                                const esp = watch("especialidadId");
                                                if (!esp) return true;
                                                return d.especialidades && Array.isArray(d.especialidades) && d.especialidades.includes(esp);
                                            })
                                            .map(d => {
                                                const fullName = `${d.nombre || d.nombres || ''} ${d.apellido || d.apellidos || ''}`.trim() || d.nombreCompleto || 'Doctor';
                                                return <option key={d.id} value={d.id}>{fullName}</option>;
                                            })
                                        }
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Espacio Clínico *</label>
                                    <select {...register("consultorioId")} disabled={!hasWritePermission} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none">
                                        <option value="">ELIJA CONSULTORIO...</option>
                                        {chairs.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Cita *</label>
                                        <input 
                                            type="date" 
                                            {...register("fecha")} 
                                            disabled={!hasWritePermission} 
                                            className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 uppercase outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 shadow-sm transition-all" 
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora *</label>
                                        <input 
                                            type="time" 
                                            step="60" 
                                            {...register("hora")} 
                                            disabled={!hasWritePermission} 
                                            className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 shadow-sm transition-all cursor-pointer" 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Duración Estimada *</label>
                                    <select {...register("duracion", { valueAsNumber: true })} disabled={!hasWritePermission} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none">
                                        {[5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 105, 120].map(m => (
                                            <option key={m} value={m}>{m} MINUTOS</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones / Comentarios</label>
                                    <textarea 
                                        {...register("comentario")} 
                                        disabled={!hasWritePermission}
                                        placeholder="NOTAS ADICIONALES SOBRE LA CITA..." 
                                        rows={3}
                                        className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 placeholder:text-slate-300 uppercase outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 shadow-sm transition-all resize-none"
                                    />
                                </div>

                                {initialData?.id && (
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado de la Cita</label>
                                        <select 
                                            {...register("status")} 
                                            disabled={!hasWritePermission} 
                                            className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none"
                                        >
                                            <option value="pending">Sin Confirmar</option>
                                            <option value="confirmed">Confirmada</option>
                                            <option value="attended">Atendido</option>
                                            <option value="urgencia">Urgencia</option>
                                            <option value="sin-cont-web">Sin Cont. WEB</option>
                                            <option value="no-show">No asiste</option>
                                            <option value="cancelled">Cancelado</option>
                                            <option value="waiting">En espera</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* COMPONENTES DE ESTADO / ACTUALIDAD */}
                            <div className="flex flex-col gap-5 bg-slate-50/50 p-5 rounded-2xl border border-dashed border-slate-200">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input type="checkbox" {...register("valoracion")} disabled={!hasWritePermission} className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500/20 h-4.5 w-4.5 transition-all shadow-sm" />
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">Valoración</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input type="checkbox" {...register("control")} disabled={!hasWritePermission} className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500/20 h-4.5 w-4.5 transition-all shadow-sm" />
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">Control Post</span>
                                    </label>
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer group border-t border-slate-200 pt-4">
                                    <input type="checkbox" {...register("enviarCorreo")} disabled={!hasWritePermission} className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/20 h-4 w-4 transition-all" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">Enviar recordatorio vía email</span>
                                </label>
                            </div>
                        </div>
                    </form>

                    {/* RIGHT COL: SCHEDULE GRID (Flexible) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-8 relative">
                        <div className="flex items-center justify-between mb-8 sticky top-0 bg-white/95 backdrop-blur-md pb-4 z-10 border-b border-slate-50">
                            <div className="flex items-center gap-6">
                                <button 
                                    type="button" 
                                    onClick={() => changeWeek(-7)}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all active:scale-90"
                                >
                                    ◀
                                </button>
                                <div className="text-center">
                                    <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">
                                        {(() => {
                                            const f = watch("fecha");
                                            if (!f) return "Seleccione una fecha";
                                            try {
                                                return new Date(f + "T00:00:00").toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' });
                                            } catch (e) {
                                                return "Fecha inválida";
                                            }
                                        })()}
                                    </h4>
                                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.2em]">Semana de Disponibilidad</p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => changeWeek(7)}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all active:scale-90"
                                >
                                    ▶
                                </button>
                            </div>
                            <button type="button" onClick={() => setValue("fecha", new Date().toISOString().split('T')[0])} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95">Ir a Hoy</button>
                        </div>

                        {/* Weekly Grid (Premium display) */}
                        <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-[24px] overflow-hidden shadow-sm">
                            {['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map((day, idx) => {
                                // Calculate the specific date for this column
                                const f = watch("fecha") || new Date().toISOString().split('T')[0];
                                const baseDate = new Date(f + "T00:00:00");
                                
                                // Ensure baseDate is valid
                                if (isNaN(baseDate.getTime())) {
                                    return <div key={day} className="bg-white p-4 text-[10px] text-slate-400">Error fecha</div>;
                                }

                                const dayOfWeek = baseDate.getDay(); // 0 (Sun) to 6 (Sat)
                                const diff = idx - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
                                const columnDateObj = new Date(baseDate);
                                columnDateObj.setDate(baseDate.getDate() + diff);
                                
                                const columnDateStr = columnDateObj.toISOString().split('T')[0];
                                const isSameDay = watch("fecha") === columnDateStr;

                                return (
                                    <div key={day} className={`flex flex-col bg-white min-h-[500px] ${idx > 4 ? 'bg-slate-50/30' : ''}`}>
                                        <div className={`p-4 text-center border-b border-slate-50 ${isSameDay ? 'bg-blue-50/30' : 'bg-slate-50/20'}`}>
                                            <div className={`text-[10px] font-black uppercase leading-tight tracking-widest mb-1 ${isSameDay ? 'text-blue-600' : 'text-slate-400'}`}>{day}</div>
                                            <div className={`text-[15px] font-black leading-none ${isSameDay ? 'text-blue-700' : 'text-slate-800'}`}>
                                                {columnDateObj.getDate()}
                                            </div>
                                        </div>
                                        <div className="p-2 space-y-1.5 flex flex-col items-center">
                                        {(() => {
                                                // Generar slots de 07:00 a 21:30 cada 30 minutos
                                                const slots = [];
                                                for (let h = 7; h <= 21; h++) {
                                                    for (let m = 0; m < 60; m += 30) {
                                                        if (h === 21 && m > 30) break;
                                                        const hh = String(h).padStart(2, '0');
                                                        const mm = String(m).padStart(2, '0');
                                                        slots.push(`${hh}:${mm}`);
                                                    }
                                                }

                                                // Formatear a AM/PM para mostrar
                                                const fmt12 = (t) => {
                                                    const [hh, mm] = t.split(':').map(Number);
                                                    const ampm = hh >= 12 ? 'PM' : 'AM';
                                                    const h12 = hh % 12 || 12;
                                                    return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
                                                };

                                                return slots.map(t => {
                                                    const isSelected = isSameDay && watch("hora") === t;
                                                    return (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => {
                                                                setValue("hora", t);
                                                                setValue("fecha", columnDateStr);
                                                            }}
                                                            disabled={!hasWritePermission}
                                                            className={`w-full max-w-[80px] py-1.5 text-[9px] font-black rounded-lg transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 active:scale-95' : 'bg-white text-slate-400 border-slate-100 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 shadow-sm'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                                        >
                                                            {fmt12(t)}
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ACTION BAR (OralDrive Styling) */}
                <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                    {isConfirmingDelete ? (
                        <div className="flex items-center justify-between w-full bg-red-50 border border-red-100 rounded-2xl p-4 transition-all duration-300 animate-fadeIn">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-red-500 text-white rounded-xl">
                                    <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="text-[12px] font-extrabold text-red-800 uppercase tracking-wider">¿Está seguro que quiere eliminar esta cita?</p>
                                    <p className="text-[11px] text-red-600 font-semibold mt-0.5">Esta acción es permanente y no se puede deshacer.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsConfirmingDelete(false)}
                                    className="px-6 py-3 rounded-xl border border-slate-200 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider hover:bg-white transition-all active:scale-95"
                                >
                                    No, Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        console.log("Confirm delete click. onDelete is defined:", !!onDelete, "initialData.id:", initialData?.id);
                                        if (onDelete) onDelete(initialData.id, true);
                                    }}
                                    className="px-6 py-3 rounded-xl bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-wider hover:bg-red-700 hover:shadow-lg hover:shadow-red-100 transition-all active:scale-95"
                                >
                                    Sí, Eliminar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {initialData?.id ? (
                                <div className="flex items-center gap-4">
                                    {can("Agenda", "Agenda", "eliminar") && (
                                        <button
                                            type="button"
                                            onClick={() => setIsConfirmingDelete(true)}
                                            className="group px-8 py-4 rounded-2xl border-2 border-red-500 text-red-500 font-extrabold text-[11px] uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center gap-3"
                                        >
                                            <span>ELIMINAR CITA</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-500 font-extrabold text-[11px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-all active:scale-95"
                                    >
                                        CERRAR
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-500 font-extrabold text-[11px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-all active:scale-95"
                                >
                                    CANCELAR
                                </button>
                            )}

                            <div className="flex items-center gap-4">
                                {hasWritePermission && (
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        onClick={handleSubmit(onValidSubmit, onInvalidSubmit)}
                                        className="px-16 py-4 rounded-2xl bg-emerald-600 text-white font-extrabold text-[12px] uppercase tracking-[0.2em] hover:bg-emerald-700 shadow-2xl shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-50 min-w-[240px] flex items-center justify-center gap-3"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : null}
                                        <span>{isSubmitting ? "GUARDANDO..." : "CONFIRMAR REGISTRO"}</span>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
                {showCloseConfirm && (
                    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-[32px] max-w-md w-full p-8 border border-slate-100 shadow-2xl animate-scaleIn relative overflow-hidden flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                                <FiAlertCircle size={32} strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                                ¿Descartar Cambios?
                            </h3>
                            
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed mb-6">
                                Tienes cambios sin guardar en esta cita. Si la cierras ahora, perderás todas las modificaciones realizadas.
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCloseConfirm(false);
                                        onClose();
                                    }}
                                    className="w-full py-3 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Descartar y Cerrar
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setShowCloseConfirm(false)}
                                    className="w-full py-3 bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    Seguir Editando
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
