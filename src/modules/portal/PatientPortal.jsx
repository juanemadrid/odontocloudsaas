import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    loginPatientPortal,
    logoutPatientPortal,
    requestPatientAppointment,
    resumePatientPortal,
    setupPatientPin,
    resetPatientPin
} from "../../services/patientPortalService";
import { useParams, useNavigate } from "react-router-dom";
import { DEFAULT_CONFIG } from "../../constants/DefaultConfig";
import { fetchTenantConfigBySlug } from "../../utils/tenantConfigHelper";
import { FiArrowLeft, FiLogOut, FiCalendar, FiDollarSign, FiActivity, FiMessageCircle, FiX, FiPhone, FiUser, FiShield, FiAlertTriangle, FiHeart, FiFileText, FiBell, FiLock, FiKey, FiCheckCircle, FiClock, FiMapPin, FiCreditCard, FiChevronRight } from "react-icons/fi";
import { toast } from "sonner";
import { isAccessBlocked } from "../../utils/subscriptionHelper";

// ── Modal genérico del portal ─────────────────────────────────────────────────
function PortalModal({ title, icon: Icon, color, onClose, maxWidth = "max-w-md", children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className={`w-full ${maxWidth} bg-white rounded-3xl shadow-2xl overflow-hidden transition-all`}>
                <div className={`flex items-center justify-between px-6 py-4 ${color}`}>
                    <h2 className="font-black text-base flex items-center gap-2"><Icon size={18} /> {title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/10 transition-colors cursor-pointer"><FiX size={18} /></button>
                </div>
                <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

const STATUS_MAP = {
    accepted: { label: "Aceptado", classes: "bg-emerald-100 text-emerald-700" },
    aceptado: { label: "Aceptado", classes: "bg-emerald-100 text-emerald-700" },
    active: { label: "Activo", classes: "bg-blue-100 text-blue-700" },
    activo: { label: "Activo", classes: "bg-blue-100 text-blue-700" },
    completed: { label: "Completado", classes: "bg-emerald-100 text-emerald-700" },
    completado: { label: "Completado", classes: "bg-emerald-100 text-emerald-700" },
    draft: { label: "Borrador", classes: "bg-slate-100 text-slate-700" },
    borrador: { label: "Borrador", classes: "bg-slate-100 text-slate-700" },
    rejected: { label: "Rechazado", classes: "bg-rose-100 text-rose-700" },
    rechazado: { label: "Rechazado", classes: "bg-rose-100 text-rose-700" }
};

export default function PatientPortal() {
    const { clinicSlug } = useParams();
    const navigate = useNavigate();
    const [auth, setAuth] = useState(false);
    const [docInput, setDocInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [nextAppt, setNextAppt] = useState(null);
    const [birthDate, setBirthDate] = useState("");
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loadingConfig, setLoadingConfig] = useState(!!clinicSlug);
    const [inquilinoId, setInquilinoId] = useState(null);
    const [tenantInfo, setTenantInfo] = useState(null);

    // PIN Security States (Ley 1581 de Protección de Datos)
    const [loginMode, setLoginMode] = useState("birthdate"); // "birthdate" | "pin" | "reset_pin"
    const [pinInput, setPinInput] = useState("");
    const [newPinInput, setNewPinInput] = useState("");
    const [confirmPinInput, setConfirmPinInput] = useState("");
    const [showPinSetupModal, setShowPinSetupModal] = useState(false);
    const [tempSetupToken, setTempSetupToken] = useState(null);
    const [patientNameForPin, setPatientNameForPin] = useState("");
    const [pendingPortalData, setPendingPortalData] = useState(null);

    // Modal states
    const [activeModal, setActiveModal] = useState(null); // 'cita' | 'pagos' | 'tratamiento' | 'soporte'

    // Data states
    const [pagos, setPagos] = useState([]);
    const [planes, setPlanes] = useState([]);
    const [currentPlanPage, setCurrentPlanPage] = useState(1);
    const [selectedPlanIdx, setSelectedPlanIdx] = useState(0);
    const [todasCitas, setTodasCitas] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [notificaciones, setNotificaciones] = useState([]);
    const [clinicDoctors, setClinicDoctors] = useState([]);
    const unsubRef = useRef(null);

    // Nueva cita form
    const [nuevaCitaForm, setNuevaCitaForm] = useState({ fecha: "", motivo: "", nombre: "", celular: "" });
    const [citaEnviada, setCitaEnviada] = useState(false);
    const [soporteMsg, setSoporteMsg] = useState("");

    // Extract unique specialists treating this patient
    const especialistas = useMemo(() => {
        const set = new Set();
        const docs = [];

        // 1. Add doctor from appointments
        todasCitas.forEach(c => {
            const name = c.dentista || c.profesional_nombre || c.doctorName;
            if (name && name !== "—" && !set.has(name)) {
                set.add(name);
                docs.push({
                    name,
                    specialty: c.profesional_especialidad || c.especialidad || "Odontólogo Especialista"
                });
            }
        });

        // 2. Add doctor from treatment plans
        planes.forEach(p => {
            const name = p.doctorName || p.dentista || p.doctor;
            if (name && typeof name === 'string' && name !== "—" && !set.has(name)) {
                set.add(name);
                docs.push({
                    name,
                    specialty: p.specialty || p.especialidad || "Odontólogo Especialista"
                });
            }
        });

        // 3. Add doctor from clinic profiles if none yet
        if (docs.length === 0 && clinicDoctors.length > 0) {
            clinicDoctors.forEach(cd => {
                if (cd.name && !set.has(cd.name)) {
                    set.add(cd.name);
                    docs.push({ name: cd.name, specialty: cd.specialty || "Especialista Odontológico" });
                }
            });
        }

        // 4. Default fallback: only professional title, never company name as person
        if (docs.length === 0) {
            docs.push({ name: "Equipo de Especialistas", specialty: "Odontología Integral y Especializada" });
        }

        return docs;
    }, [todasCitas, planes, clinicDoctors]);

    useEffect(() => {
        const checkActiveSession = async () => {
            setLoading(true);
            try {
                const portalData = await resumePatientPortal(clinicSlug);
                if (portalData) {
                    applyPortalData(portalData);
                    setAuth(true);
                }
            } catch (error) {
                console.warn("La sesión anterior del portal no pudo reanudarse:", error.message);
            } finally {
                setLoading(false);
            }
        };
        checkActiveSession();
    }, [clinicSlug]);

    useEffect(() => {
        if (!clinicSlug) return;
        let isMounted = true;
        const loadConfig = async () => {
            setLoadingConfig(true);
            try {
                const fetchedConfig = await fetchTenantConfigBySlug(clinicSlug);
                if (isMounted && fetchedConfig) {
                    setConfig(fetchedConfig);
                    if (fetchedConfig.tenant_id) {
                        setInquilinoId(fetchedConfig.tenant_id);
                    }
                }
            } catch (e) {
                console.error("Error loading PatientPortal config:", e);
            } finally {
                if (isMounted) setLoadingConfig(false);
            }
        };
        loadConfig();
        return () => { isMounted = false; };
    }, [clinicSlug]);

    const handleLogin = async (event) => {
        event.preventDefault();
        const cleanDoc = docInput.replace(/\D/g, "");
        if (cleanDoc.length < 5) {
            return toast.error("Ingrese un documento válido (mínimo 5 dígitos).");
        }
        if (!inquilinoId) return toast.error("No fue posible identificar la clínica.");

        setLoading(true);
        try {
            if (loginMode === "pin") {
                if (pinInput.length < 4) {
                    setLoading(false);
                    return toast.error("Ingrese su PIN de 4 dígitos.");
                }
                const storedPin = localStorage.getItem(`odc_pin_${inquilinoId}_${cleanDoc}`);
                try {
                    const result = await loginPatientPortal({
                        document: cleanDoc,
                        pin: pinInput,
                        tenantId: inquilinoId,
                        clinicSlug
                    });
                    if (result.data) {
                        applyPortalData(result.data);
                        setAuth(true);
                        toast.success("¡Bienvenido(a)!");
                        return;
                    }
                } catch (edgeErr) {
                    // Si el error del servidor se debe a que la función requiere fecha o el PIN local coincide
                    if (storedPin && storedPin === pinInput) {
                        const storedBirth = localStorage.getItem(`odc_birth_${inquilinoId}_${cleanDoc}`);
                        if (storedBirth) {
                            try {
                                const fallbackResult = await loginPatientPortal({
                                    document: cleanDoc,
                                    birthDate: storedBirth,
                                    tenantId: inquilinoId,
                                    clinicSlug
                                });
                                if (fallbackResult.data) {
                                    applyPortalData(fallbackResult.data);
                                    setAuth(true);
                                    toast.success("¡Bienvenido(a)!");
                                    return;
                                }
                            } catch (_) {
                                // continuar
                            }
                        }
                    } else if (storedPin && storedPin !== pinInput) {
                        throw new Error("El PIN ingresado es incorrecto.");
                    }
                    throw edgeErr;
                }
            } else {
                // Modo Fecha de Nacimiento (primer ingreso o verificación)
                if (!birthDate) {
                    setLoading(false);
                    return toast.error("Ingrese su fecha de nacimiento.");
                }

                const result = await loginPatientPortal({
                    document: cleanDoc,
                    birthDate,
                    tenantId: inquilinoId,
                    clinicSlug
                });

                // Guardar fecha de nacimiento localmente para agilizar sesiones
                try {
                    localStorage.setItem(`odc_birth_${inquilinoId}_${cleanDoc}`, birthDate);
                } catch (_) {}

                const storedPin = localStorage.getItem(`odc_pin_${inquilinoId}_${cleanDoc}`);

                if (result.requiresPinSetup) {
                    // Primer ingreso exitoso: Solicitar creación de PIN para blindaje legal
                    setTempSetupToken(result.tempToken);
                    setPatientNameForPin(result.patientName || "Paciente");
                    setPendingPortalData(null);
                    setShowPinSetupModal(true);
                } else if (result.requiresPin) {
                    toast.info("Ya tienes un PIN creado. Ingrésalo para acceder.");
                    setLoginMode("pin");
                } else if (result.data) {
                    // Si el paciente entra por "Primer Ingreso" y no ha creado PIN, se le exige crearlo antes de entrar
                    if (!storedPin) {
                        setPendingPortalData(result.data);
                        setPatientNameForPin(result.data.patient?.nombreCompleto || result.data.patient?.nombres || "Paciente");
                        setShowPinSetupModal(true);
                        toast.info("¡Identidad validada! Por favor crea tu PIN personal de 4 dígitos.");
                    } else {
                        applyPortalData(result.data);
                        setAuth(true);
                        toast.success("¡Bienvenido(a)!");
                    }
                }
            }
        } catch (error) {
            toast.error(error.message || "Error al iniciar sesión.");
        } finally {
            setLoading(false);
        }
    };

    const handleSetupPin = async (e) => {
        e.preventDefault();
        const cleanDoc = docInput.replace(/\D/g, "");
        if (newPinInput.length < 4) {
            return toast.error("El PIN debe tener 4 dígitos numéricos.");
        }
        if (newPinInput !== confirmPinInput) {
            return toast.error("Los PINs ingresados no coinciden.");
        }

        setLoading(true);
        try {
            // Guardar PIN localmente para acceso rápido y validación
            if (inquilinoId && cleanDoc) {
                localStorage.setItem(`odc_pin_${inquilinoId}_${cleanDoc}`, newPinInput);
            }

            // Sincronizar con el backend si hay tempToken disponible
            if (tempSetupToken) {
                try {
                    const result = await setupPatientPin({
                        tempToken: tempSetupToken,
                        pin: newPinInput,
                        tenantId: inquilinoId,
                        clinicSlug
                    });
                    if (result.data) {
                        applyPortalData(result.data);
                    }
                } catch (beError) {
                    console.warn("Backend pin setup warning:", beError.message);
                }
            }

            // Si teníamos los datos del portal esperando la creación del PIN
            if (pendingPortalData) {
                applyPortalData(pendingPortalData);
            }

            setShowPinSetupModal(false);
            setAuth(true);
            setLoginMode("pin");
            setPinInput(newPinInput);
            toast.success("¡PIN de seguridad configurado exitosamente! Ahora podrás ingresar directamente con tu documento y tu PIN.");
        } catch (error) {
            toast.error("Error al guardar PIN: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPin = async (e) => {
        e.preventDefault();
        const cleanDoc = docInput.replace(/\D/g, "");
        if (cleanDoc.length < 5) return toast.error("Ingrese un documento válido.");
        if (!birthDate) return toast.error("Ingrese su fecha de nacimiento.");
        if (newPinInput.length < 4) return toast.error("El nuevo PIN debe tener 4 dígitos.");
        if (newPinInput !== confirmPinInput) return toast.error("Los PINs no coinciden.");

        setLoading(true);
        try {
            const result = await resetPatientPin({
                document: cleanDoc,
                birthDate,
                newPin: newPinInput,
                tenantId: inquilinoId,
                clinicSlug
            });
            if (result.data) {
                applyPortalData(result.data);
                setAuth(true);
                setLoginMode("pin");
                setNewPinInput("");
                setConfirmPinInput("");
                toast.success("¡PIN actualizado con éxito!");
            }
        } catch (error) {
            toast.error("Error al actualizar PIN: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    const applyPortalData = (portalData) => {
        const patientData = portalData?.patient;
        if (!patientData) throw new Error("El portal no devolvió los datos del paciente.");

        // 1. Actualizar configuración con la clínica REAL del paciente
        if (portalData.clinic && portalData.clinic.name) {
            setConfig(prev => ({
                ...prev,
                ...portalData.clinic,
                name: portalData.clinic.name || prev.name,
                logo: portalData.clinic.logo || prev.logo,
                primaryColor: portalData.clinic.primaryColor || prev.primaryColor,
                phone: portalData.clinic.phone || prev.phone,
                email: portalData.clinic.email || prev.email,
                address: portalData.clinic.address || prev.address,
                city: portalData.clinic.city || prev.city
            }));
        }

        // 2. Guardar lista de doctores reales de la clínica
        const returnedDoctors = Array.isArray(portalData.doctors) ? portalData.doctors : [];
        if (returnedDoctors.length > 0) {
            setClinicDoctors(returnedDoctors);
        }

        // Garantizar que documento y número de historia estén siempre poblados
        const cleanDoc = docInput ? docInput.replace(/\D/g, "") : "";
        const pDoc = patientData.documento || patientData.nro_documento || patientData.nroDocumento || patientData.cedula || cleanDoc || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("odc_portal_doc") : "") || "";
        if (pDoc && typeof sessionStorage !== "undefined") {
            try { sessionStorage.setItem("odc_portal_doc", pDoc); } catch (_) {}
        }
        patientData.documento = pDoc;
        patientData.nro_documento = pDoc;
        if (!patientData.nroHistoria && !patientData.nro_historia) {
            patientData.nroHistoria = pDoc ? `HC-${pDoc}` : (patientData.id ? `HC-${patientData.id.slice(-6).toUpperCase()}` : "HC-0001");
        }

        setUser(patientData);
        setNuevaCitaForm(form => ({
            ...form,
            nombre: patientData.nombreCompleto || "",
            celular: patientData.celular || ""
        }));

        // 3. Normalizar citas con doctor real
        const citasArr = (portalData.appointments || []).map(appointment => {
            const matchedDoc = returnedDoctors.find(d => String(d.id) === String(appointment.profesional_id));
            const doctorName = appointment.profesional_nombre && appointment.profesional_nombre !== "—"
                ? appointment.profesional_nombre
                : matchedDoc?.name || (returnedDoctors[0]?.name) || "Odontólogo Especialista";
            const doctorSpecialty = matchedDoc?.specialty || appointment.profesional_especialidad || "Odontología";

            return {
                id: appointment.id,
                fecha: appointment.fecha_inicio
                    ? appointment.fecha_inicio.split("T")[0]
                    : (appointment.fecha || ""),
                horaInicio: appointment.fecha_inicio
                    ? new Date(appointment.fecha_inicio).toTimeString().substring(0, 5)
                    : (appointment.horaInicio || ""),
                estado: appointment.estado || "confirmada",
                motivo: appointment.motivo || "Consulta Odontológica",
                dentista: doctorName,
                especialidad: doctorSpecialty,
                ...appointment
            };
        }).sort((first, second) =>
            new Date((second.fecha || "") + "T" + (second.horaInicio || "00:00")) -
            new Date((first.fecha || "") + "T" + (first.horaInicio || "00:00"))
        );
        setTodasCitas(citasArr);

        const today = new Date().toISOString().slice(0, 10);
        setNextAppt(citasArr.find(appointment =>
            appointment.fecha >= today &&
            !["cancelada", "no asistio"].includes((appointment.estado || "").toLowerCase())
        ) || null);

        // 4. Deduplicar pagos y recibos con precisión (por consecutivo numérico normalizado)
        const getCleanConsecutivo = (p) => {
            const raw = p.nro_consecutivo || p.numero || p.consecutivo;
            if (!raw) return null;
            const digits = String(raw).replace(/\D/g, "");
            return digits ? parseInt(digits, 10) : null;
        };

        const uniquePaymentsMap = new Map();
        (portalData.payments || []).forEach(p => {
            if (!p || typeof p !== "object") return;
            const consNum = getCleanConsecutivo(p);
            const key = consNum !== null 
                ? `cons_${consNum}` 
                : String(p.id || p.idFactura || `${(p.fecha || p.created_at || "").slice(0, 10)}_${Number(p.total || p.monto || 0)}`);

            if (uniquePaymentsMap.has(key)) {
                const existing = uniquePaymentsMap.get(key);
                const isExistingSaldo = (existing.descripcion || existing.concepto || "").toLowerCase().includes("saldo a favor");
                const isNewSaldo = (p.descripcion || p.concepto || "").toLowerCase().includes("saldo a favor");
                uniquePaymentsMap.set(key, {
                    ...existing,
                    ...p,
                    descripcion: isExistingSaldo ? existing.descripcion : (isNewSaldo ? p.descripcion : (p.descripcion || existing.descripcion)),
                    concepto: isExistingSaldo ? existing.concepto : (isNewSaldo ? p.concepto : (p.concepto || existing.concepto)),
                    numero: existing.numero || p.numero || (consNum ? String(consNum).padStart(4, "0") : ""),
                    nro_consecutivo: existing.nro_consecutivo || p.nro_consecutivo || (consNum ? String(consNum).padStart(4, "0") : "")
                });
            } else {
                uniquePaymentsMap.set(key, p);
            }
        });

        const paymentRows = Array.from(uniquePaymentsMap.values());
        setPagos(paymentRows.sort((first, second) =>
            new Date(second.created_at || second.fecha || 0).getTime() -
            new Date(first.created_at || first.fecha || 0).getTime()
        ));

        // 5. Filtrar ÚNICAMENTE planes de tratamiento formales (excluir presupuestos/borradores)
        const isRealTreatmentPlan = (p) => {
            const det = (typeof p.detalles === "object" && p.detalles !== null) ? p.detalles : {};
            const planType = String(p.type || det.type || "").toLowerCase();
            if (planType === "presupuesto") return false;
            const st = String(p.status || p.estado || "").toLowerCase();
            if (st === "draft" || st === "borrador" || st === "rechazado") return false;
            const name = String(p.nombre || p.title || det.title || "").toLowerCase();
            if (name.startsWith("presupuesto") && planType !== "plan") return false;
            return true;
        };

        const treatmentPlans = (portalData.plans || []).filter(isRealTreatmentPlan);
        setPlanes(treatmentPlans);
        setCurrentPlanPage(1);
        setNotificaciones(portalData.notifications || []);
    };

    const handleEnviarWhatsApp = () => {
        const phone = (config.phone || config.contactPhone || "3015768935").replace(/\D/g, "");
        const docStr = user?.documento || user?.nro_documento || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("odc_portal_doc") : "") || "";
        const msg = `Hola, soy *${user?.nombreCompleto || user?.nombres || "paciente"}*${docStr ? ` (Doc: ${docStr})` : ""}, me gustaría solicitar una cita odontológica en ${config.name || "la clínica"}.\n\n📅 *Fecha deseada:* ${nuevaCitaForm.fecha || "A convenir"}\n📋 *Motivo:* ${nuevaCitaForm.motivo || "Consulta / Revisión"}\n📱 *Celular:* ${nuevaCitaForm.celular || user?.celular || "El mismo"}`;
        if (phone) {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
        } else {
            toast.error("No hay número de contacto registrado para la clínica.");
        }
    };

    const handleSolicitarCita = async (event) => {
        event.preventDefault();
        try {
            await requestPatientAppointment({
                preferredDate: nuevaCitaForm.fecha,
                reason: nuevaCitaForm.motivo || "Limpieza/Revisión",
                phone: nuevaCitaForm.celular || user?.celular || ""
            });
            setCitaEnviada(true);
            toast.success("¡Solicitud enviada a la clínica con éxito!");
        } catch (error) {
            console.warn("Fallo backend de cita, enlazando por WhatsApp directo:", error.message);
            setCitaEnviada(true);
            handleEnviarWhatsApp();
            toast.info("Conectando directamente con recepción por WhatsApp para confirmar tu cita...");
        }
    };

    const handleLogout = async () => {
        if (unsubRef.current) {
            try {
                unsubRef.current();
            } catch {
                // No hay una suscripción activa en la implementación actual.
            }
        }
        await logoutPatientPortal();
        setAuth(false);
        setUser(null);
        setTodasCitas([]);
        setNextAppt(null);
        setPagos([]);
        setPlanes([]);
        setNotificaciones([]);
    };
    // ── Suspension/Expiration Block check ──
    if (clinicSlug && tenantInfo && isAccessBlocked(tenantInfo)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center space-y-6 animate-fadeIn">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-inner">
                        <FiAlertTriangle size={32} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Portal no disponible</h2>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            El portal de pacientes de <strong>{tenantInfo.name || "la clínica"}</strong> se encuentra temporalmente fuera de servicio.
                        </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">¿Necesitas agendar o consultar?</p>
                        <p className="text-xs text-slate-500 font-medium">Por favor comunícate directamente con la clínica a través de sus canales de atención oficiales.</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Login screen ─────────────────────────────────────────────────────────
    if (!auth) {
        const clinicPrimary = config?.primaryColor || "#1a56db";

        return (
            <div className="min-h-screen relative flex items-center justify-center font-sans overflow-hidden">
                {/* Video background */}
                <video
                    autoPlay muted loop playsInline preload="none"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ zIndex: 0 }}
                >
                    <source src={`${import.meta.env.BASE_URL}video.mp4`} type="video/mp4" />
                </video>

                {/* Overlay — darker at left, lighter right so card pops */}
                <div className="absolute inset-0" style={{ zIndex: 1, background: 'rgba(2,6,18,0.72)' }} />

                {/* Top nav bar */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 py-5">
                    <button
                        onClick={() => navigate(clinicSlug ? `/c/${clinicSlug}` : "/")}
                        className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-semibold transition-colors group"
                    >
                        <FiArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
                        Volver a {config.name || "Inicio"}
                    </button>
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Acceso seguro
                    </div>
                </div>

                {/* WHITE LOGIN CARD */}
                <div className="relative z-10 w-full max-w-sm mx-auto px-4">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

                        {/* Colored top strip with clinic name */}
                        <div className="px-8 pt-8 pb-7 text-center" style={{ background: clinicPrimary }}>
                            {/* Clinic logo or initial - Crisp white square badge */}
                            <div className="flex justify-center mb-4">
                                {config?.logo && config.logo !== "/assets/logo.png" ? (
                                    <div className="w-20 h-20 rounded-2xl bg-white shadow-xl p-2.5 flex items-center justify-center border-2 border-white/90 shrink-0">
                                        <img
                                            src={config.logo}
                                            alt={config.name}
                                            className="w-full h-full object-contain drop-shadow-sm"
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-white shadow-xl p-2.5 flex items-center justify-center border-2 border-white/90 shrink-0">
                                        <div className="w-full h-full rounded-xl flex items-center justify-center" style={{ backgroundColor: `${clinicPrimary}15` }}>
                                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={clinicPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2C9.2 2 7 4.2 7 7c0 1.5.6 3 1.3 4.3L7 21h1l1-4h6l1 4h1l-1.3-9.7C15.4 10 16 8.5 16 7c0-2.8-2.2-5-4-5z"/>
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Portal de Pacientes</p>
                            <h1 className="text-2xl font-black text-white leading-tight">{config.name || "Tu Clínica"}</h1>
                        </div>

                        {/* Form area — white background */}
                        <div className="px-8 py-7 space-y-4">
                            {/* Mode selector: PIN vs Primer ingreso */}
                            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                                <button
                                    type="button"
                                    onClick={() => setLoginMode("pin")}
                                    className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${loginMode === "pin" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    <FiLock size={12} /> Con PIN
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLoginMode("birthdate")}
                                    className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${loginMode === "birthdate" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    <FiCalendar size={12} /> Primer Ingreso
                                </button>
                            </div>

                            <p className="text-slate-500 text-xs text-center leading-snug">
                                {loginMode === "pin" 
                                    ? "Ingresa tu número de documento y tu PIN personal de 4 dígitos." 
                                    : "Valida tu documento y fecha de nacimiento para crear tu PIN seguro."}
                            </p>

                            <form onSubmit={handleLogin} className="space-y-3.5 mt-2">
                                {/* Document field */}
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                        Número de documento
                                    </label>
                                    <div className="relative">
                                        <FiUser size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Ej: 42209244"
                                            value={docInput}
                                            onChange={e => setDocInput(e.target.value)}
                                            disabled={loading}
                                            required
                                            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 bg-slate-50 border-2 border-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-white"
                                        />
                                    </div>
                                </div>

                                {loginMode === "pin" ? (
                                    /* PIN field */
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                                PIN de 4 dígitos
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setLoginMode("reset_pin")}
                                                className="text-[10px] font-bold text-blue-600 hover:underline"
                                            >
                                                ¿Olvidaste tu PIN?
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <input
                                                type="password"
                                                inputMode="numeric"
                                                maxLength={6}
                                                placeholder="••••"
                                                value={pinInput}
                                                onChange={e => setPinInput(e.target.value.replace(/\D/g, ""))}
                                                disabled={loading}
                                                required
                                                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold tracking-widest text-slate-800 placeholder-slate-400 bg-slate-50 border-2 border-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-white text-center"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Birth date field */
                                    <div className="space-y-1">
                                        <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                            Fecha de nacimiento
                                        </label>
                                        <div className="relative">
                                            <FiCalendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <input
                                                type="date"
                                                value={birthDate}
                                                onChange={e => setBirthDate(e.target.value)}
                                                disabled={loading}
                                                required
                                                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-semibold text-slate-800 bg-slate-50 border-2 border-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-white"
                                                max="9999-12-31" min="1900-01-01"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Submit button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 rounded-xl font-black text-sm text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                                    style={{ background: clinicPrimary }}
                                >
                                    {loading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Verificando...
                                        </>
                                    ) : (
                                        <>
                                            <FiShield size={15} />
                                            {loginMode === "pin" ? "Ingresar al Portal" : "Validar y Continuar"}
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="px-8 pb-6 pt-2 text-center border-t border-slate-100">
                            <p className="text-[11px] text-slate-400">
                                ¿Problemas para ingresar?{" "}
                                <a
                                    href={`https://wa.me/57${(config.contactPhone || "3015768935").replace(/\D/g, '')}?text=Hola, necesito ayuda para ingresar al portal de ${config.name}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-slate-600 hover:underline"
                                >
                                    Contactar Recepción
                                </a>
                            </p>
                        </div>
                    </div>

                    {/* MODAL: Configurar PIN por primera vez */}
                    {showPinSetupModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
                                <div className="text-center space-y-2">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                                        <FiShield size={24} />
                                    </div>
                                    <h3 className="text-base font-black text-slate-800">
                                        Protege tu privacidad médica
                                    </h3>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Hola <strong>{patientNameForPin}</strong>. Según la <strong>Ley 1581 de 2012</strong>, crea un PIN de 4 dígitos para que solo tú puedas ver tus citas y tratamientos.
                                    </p>
                                </div>

                                <form onSubmit={handleSetupPin} className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                            Crea tu PIN (4 dígitos)
                                        </label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={4}
                                            placeholder="••••"
                                            value={newPinInput}
                                            onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ""))}
                                            required
                                            autoFocus
                                            className="w-full py-3 px-4 rounded-xl text-center text-lg font-black tracking-widest text-slate-800 bg-slate-50 border-2 border-slate-200 outline-none focus:border-emerald-500 focus:bg-white"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                            Confirma tu PIN
                                        </label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={4}
                                            placeholder="••••"
                                            value={confirmPinInput}
                                            onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ""))}
                                            required
                                            className="w-full py-3 px-4 rounded-xl text-center text-lg font-black tracking-widest text-slate-800 bg-slate-50 border-2 border-slate-200 outline-none focus:border-emerald-500 focus:bg-white"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || newPinInput.length < 4}
                                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? "Guardando..." : "Guardar PIN y Entrar"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowPinSetupModal(false)}
                                        className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-semibold text-center transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Restablecer PIN olvidado */}
                    {loginMode === "reset_pin" && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                            <FiKey size={18} className="text-blue-600" /> Restablecer PIN
                                        </h3>
                                        <p className="text-xs text-slate-500 leading-snug">
                                            Ingresa tu fecha de nacimiento para crear un nuevo PIN.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setLoginMode("pin")}
                                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                                    >
                                        <FiX size={18} />
                                    </button>
                                </div>

                                <form onSubmit={handleResetPin} className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                            Número de documento
                                        </label>
                                        <input
                                            type="text"
                                            value={docInput}
                                            onChange={e => setDocInput(e.target.value)}
                                            required
                                            className="w-full p-2.5 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                            Fecha de nacimiento
                                        </label>
                                        <input
                                            type="date"
                                            value={birthDate}
                                            onChange={e => setBirthDate(e.target.value)}
                                            required
                                            className="w-full p-2.5 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                            Nuevo PIN (4 dígitos)
                                        </label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={4}
                                            placeholder="••••"
                                            value={newPinInput}
                                            onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ""))}
                                            required
                                            className="w-full p-2.5 rounded-xl text-center text-sm font-bold tracking-widest bg-slate-50 border border-slate-200"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                            Confirmar nuevo PIN
                                        </label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={4}
                                            placeholder="••••"
                                            value={confirmPinInput}
                                            onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ""))}
                                            required
                                            className="w-full p-2.5 rounded-xl text-center text-sm font-bold tracking-widest bg-slate-50 border border-slate-200"
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setLoginMode("pin")}
                                            className="w-1/3 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-2/3 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider shadow-md"
                                        >
                                            {loading ? "Actualizando..." : "Actualizar PIN"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    <p className="text-center text-white/30 text-[10px] font-semibold mt-5 tracking-wider">
                        © {new Date().getFullYear()} {config.name || "OdontoCloud"} · Todos los derechos reservados
                    </p>
                </div>
            </div>
        );
    }

    // ── Portal autenticado ────────────────────────────────────────────────────

    // Normalizar: recibos_caja tienen 'total', pagos tienen 'monto'. Estado varía entre colecciones.
    const getPagoMonto = (p) => Number(p.total || p.monto || p.valorTotal || 0);

    const esPagado = (p) => {
        const estado = (p.estado || "").toLowerCase();
        const desc = (p.descripcion || p.concepto || p.observaciones || "").toLowerCase();
        // Abono o saldo a favor se considera saldo efectivamente pagado/acreditado
        if (desc.includes("saldo a favor")) return true;
        if (p.total !== undefined && !p.estado) return true;
        return estado === "pagada" || estado === "pagado" || estado === "paid" || 
               estado === "completado" || estado === "completada" || estado === "complete" || estado === "activo";
    };

    const getReciboTitle = (p) => {
        const rawNum = p.numero || p.nro_consecutivo || p.consecutivo;
        if (rawNum) {
            const cleanDigits = String(rawNum).replace(/\D/g, "");
            return `Recibo #${cleanDigits ? String(cleanDigits).padStart(4, "0") : rawNum}`;
        }
        if (p.idFactura) return `Factura #${p.idFactura}`;
        const desc = (p.descripcion || p.concepto || p.observaciones || "").toLowerCase();
        if (desc.includes("saldo a favor")) return "Recibo Saldo a Favor";
        return `Comprobante de Caja #${(p.id || "").slice(-6).toUpperCase()}`;
    };

    const formatPagoFecha = (p) => {
        const raw = p.fecha || p.created_at || p.fecha_pago;
        if (!raw) return "";
        try {
            const d = new Date(raw);
            if (isNaN(d.getTime())) return String(raw).slice(0, 10);
            return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
            return String(raw).slice(0, 10);
        }
    };

    // Saldo a favor disponible del paciente (desde perfil o desde abonos activos registrados)
    const saldoFavor = Math.max(
        Number(user?.saldo_favor || user?.saldoFavor || 0),
        pagos.filter(p => {
            const desc = (p.descripcion || p.concepto || p.observaciones || "").toLowerCase();
            return desc.includes("saldo a favor") && (p.estado || "").toLowerCase() !== "anulado";
        }).reduce((s, p) => s + getPagoMonto(p), 0)
    );

    const totalPagado = pagos.filter(esPagado).reduce((s, p) => s + getPagoMonto(p), 0);
    // El pendiente real = total de los planes de tratamiento - lo ya abonado
    const totalPlanes = planes.reduce((s, plan) => {
        const items = plan.items || (plan.detalles && plan.detalles.items) || [];
        const planTotal = Number(plan.total || plan.costoTotal || 0) || items.reduce((sum, it) => sum + Number(it.precio || it.price || it.valor || 0), 0);
        return s + planTotal;
    }, 0);
    const totalPendiente = Math.max(0, totalPlanes - totalPagado);



    return (
        <div className="min-h-screen bg-slate-100/70 text-slate-800 font-sans flex flex-col">
            {/* ── Top Header / Navbar ── */}
            <header className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 text-white shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative z-10 flex flex-wrap items-center justify-between gap-4">
                    {/* Brand info */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        <button
                            onClick={() => navigate(clinicSlug ? `/c/${clinicSlug}` : "/")}
                            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/15 text-white"
                            title="Volver a la página principal"
                        >
                            <FiArrowLeft size={18} />
                        </button>
                        <div className="flex items-center gap-3">
                            {config?.logo && config.logo !== "/assets/logo.png" ? (
                                <img
                                    src={config.logo}
                                    alt={config.name}
                                    className="h-10 w-auto max-w-[120px] object-contain rounded-xl bg-white/10 p-1 border border-white/20"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-xl">
                                    🦷
                                </div>
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 bg-white/10 px-2 py-0.5 rounded-md">
                                        Portal Oficial del Paciente
                                    </span>
                                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        Conexión Segura
                                    </span>
                                </div>
                                <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                                    {config.name || "OdontoCloud"}
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* Patient & Quick Actions */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden md:flex flex-col text-right pr-2">
                            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                                Paciente Autenticado
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[220px]">
                                {user.nombreCompleto || user.nombres}
                            </span>
                        </div>

                        <button
                            onClick={() => {
                                setNotificaciones(prev => prev.map(n => ({ ...n, read: true })));
                                setActiveModal("notificaciones");
                            }}
                            className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/15 text-white flex items-center gap-1.5 text-xs font-bold"
                            title="Alertas y Notificaciones"
                        >
                            <FiBell size={18} />
                            {notificaciones.some(n => !n.read) && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-indigo-700 animate-pulse" />
                            )}
                            <span className="hidden sm:inline">Alertas</span>
                        </button>

                        <button
                            onClick={() => { setCitaEnviada(false); setActiveModal("cita"); }}
                            className="px-3.5 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-blue-50 font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5"
                        >
                            <FiCalendar size={15} />
                            <span className="hidden sm:inline">Nueva Cita</span>
                            <span className="sm:hidden">Cita</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/80 transition-all border border-white/15 text-white"
                            title="Cerrar sesión"
                        >
                            <FiLogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Main Dashboard ── */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* ══ COLUMNA IZQUIERDA (lg:col-span-4) ══ */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* 1. Tarjeta de Identidad del Paciente */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-5">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0">
                                    {(user.nombreCompleto || user.nombres || "P")
                                        .split(" ")
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map(n => n[0])
                                        .join("")
                                        .toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                                        Expediente Clínico
                                    </span>
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
                                        {user.nombreCompleto || user.nombres}
                                    </h2>
                                    <p className="text-xs font-bold text-slate-600 truncate">
                                        Doc: {user.documento || user.nro_documento || user.nroDocumento || user.cedula || docInput || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("odc_portal_doc") : "") || "—"}
                                    </p>
                                </div>
                            </div>

                            {/* Datos médicos / administrativos */}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                                        Nro. Historia
                                    </span>
                                    <span className="font-extrabold text-slate-800 text-xs truncate block">
                                        {user.nroHistoria || user.nro_historia || (user.documento ? `HC-${user.documento}` : (docInput ? `HC-${docInput}` : `HC-${(user.id || "").slice(-6).toUpperCase()}`))}
                                    </span>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                                        Entidad (EPS)
                                    </span>
                                    <span className="font-extrabold text-slate-800 text-xs truncate block">
                                        {user.nombreEps || "Particular"}
                                    </span>
                                </div>
                            </div>

                            {/* Alertas Médicas o Alergias */}
                            {user.alertas ? (
                                <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 flex gap-3 items-start">
                                    <FiAlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <h4 className="font-black text-rose-900 text-[10px] uppercase tracking-wider mb-0.5">
                                            Alertas Médicas / Alergias
                                        </h4>
                                        <p className="text-rose-700 text-xs font-semibold leading-relaxed">
                                            {user.alertas}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-200/70 rounded-2xl p-3.5 flex gap-3 items-center">
                                    <FiShield className="text-emerald-500 shrink-0" size={18} />
                                    <div>
                                        <p className="text-emerald-800 text-xs font-bold leading-tight">
                                            Sin alertas alérgicas o críticas registradas
                                        </p>
                                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                            Ficha médica al día
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. Próxima Cita Destacada */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                                    <FiClock size={15} /> Próxima Visita
                                </h3>
                                {nextAppt && (
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                        {nextAppt.estado || "Confirmada"}
                                    </span>
                                )}
                            </div>

                            {loadingData ? (
                                <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
                            ) : nextAppt ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl">
                                        <div className="bg-indigo-600 text-white rounded-xl px-3.5 py-2.5 text-center shadow-sm shrink-0 min-w-[60px]">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-200">
                                                {new Date(`${nextAppt.fecha}T12:00:00`).toLocaleString('es-CO', { month: 'short' })}
                                            </div>
                                            <div className="text-2xl font-black leading-tight">
                                                {new Date(`${nextAppt.fecha}T12:00:00`).getDate()}
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                                <span>{nextAppt.horaInicio || nextAppt.hora || "08:00 AM"}</span>
                                            </div>
                                            <p className="text-xs font-bold text-indigo-900 truncate mt-0.5">
                                                {nextAppt.dentista || "Odontólogo Tratante"}
                                            </p>
                                            <p className="text-[11px] text-slate-500 truncate">
                                                {nextAppt.especialidad || nextAppt.motivo || "Control Odontológico"}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => { setCitaEnviada(false); setActiveModal("cita"); }}
                                        className="w-full py-2.5 rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs transition-all flex items-center justify-center gap-2"
                                    >
                                        <FiCalendar size={14} /> Solicitar otra cita o reagendar
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-4 px-2 space-y-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="text-2xl">🗓️</div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        No tienes citas programadas actualmente.
                                    </p>
                                    <button
                                        onClick={() => { setCitaEnviada(false); setActiveModal("cita"); }}
                                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
                                    >
                                        Solicitar Cita Ahora
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 3. Tus Especialistas Médicos */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <FiUser size={15} /> Tus Especialistas
                            </h3>

                            <div className="divide-y divide-slate-100">
                                {especialistas.map((esp, i) => (
                                    <div key={i} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-50 to-indigo-100 border border-indigo-200 flex items-center justify-center text-xs text-indigo-700 font-black shrink-0 shadow-inner">
                                            {esp.name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || "DR"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-extrabold text-slate-800 text-xs sm:text-sm truncate">
                                                {esp.name}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                                {esp.specialty}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 4. Canales de Atención Directos de la Clínica */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <FiMapPin size={15} /> Sede y Atención
                            </h3>
                            <div className="space-y-3 text-xs text-slate-600">
                                {config.address && (
                                    <div className="flex items-start gap-2.5">
                                        <FiMapPin className="text-slate-400 shrink-0 mt-0.5" size={14} />
                                        <span>{config.address}{config.city ? `, ${config.city}` : ""}</span>
                                    </div>
                                )}
                                {config.phone && (
                                    <div className="flex items-center gap-2.5">
                                        <FiPhone className="text-slate-400 shrink-0" size={14} />
                                        <span>{config.phone}</span>
                                    </div>
                                )}
                            </div>

                            {config.phone && (
                                <a
                                    href={`https://wa.me/${config.phone.replace(/\D/g, "")}?text=Hola, soy ${encodeURIComponent(user.nombreCompleto || user.nombres || "paciente")}, me comunico desde el portal de pacientes.`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <FiMessageCircle size={15} /> WhatsApp Recepción
                                </a>
                            )}
                        </div>
                    </div>

                    {/* ══ COLUMNA DERECHA (lg:col-span-8) ══ */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* 1. Resumen Financiero y Estado de Cuenta */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                                        Finanzas del Paciente
                                    </span>
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <FiDollarSign className="text-indigo-600" size={17} /> Estado de Cuenta y Recibos
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setActiveModal("pagos")}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/70 px-3 py-1.5 rounded-xl transition-all"
                                >
                                    <FiFileText size={14} /> Ver {pagos.length} recibo(s)
                                </button>
                            </div>

                            <div className={`grid grid-cols-1 ${saldoFavor > 0 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"} gap-3.5`}>
                                {/* Total Tratamientos */}
                                <div className="bg-slate-50/70 hover:bg-white rounded-2xl p-4 border border-slate-200/70 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Total Tratamientos
                                        </span>
                                        <div className="w-7 h-7 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-600">
                                            <FiFileText size={14} />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-lg sm:text-xl font-black text-slate-800 tracking-tight block">
                                            ${totalPlanes.toLocaleString("es-CO")}
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-400 block mt-1">
                                            {planes.length} plan(es) registrado(s)
                                        </span>
                                    </div>
                                </div>

                                {/* Total Abonado */}
                                <div className="bg-emerald-50/40 hover:bg-white rounded-2xl p-4 border border-emerald-200/60 hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                                            Total Abonado
                                        </span>
                                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                                            <FiCheckCircle size={14} />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-lg sm:text-xl font-black text-emerald-800 tracking-tight block">
                                            ${totalPagado.toLocaleString("es-CO")}
                                        </span>
                                        <span className="text-[10px] font-semibold text-emerald-600 block mt-1">
                                            {pagos.length} comprobante(s) verificado(s)
                                        </span>
                                    </div>
                                </div>

                                {/* Saldo a Favor Disponible */}
                                {saldoFavor > 0 && (
                                    <div className="bg-teal-50/50 hover:bg-white rounded-2xl p-4 border border-teal-300/70 hover:border-teal-400 hover:shadow-xs transition-all flex flex-col justify-between relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider">
                                                Saldo a Favor
                                            </span>
                                            <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
                                                <FiCreditCard size={14} />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-lg sm:text-xl font-black text-teal-900 tracking-tight block">
                                                ${saldoFavor.toLocaleString("es-CO")}
                                            </span>
                                            <span className="text-[10px] font-bold text-teal-700 block mt-1">
                                                Abono a favor del paciente
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Saldo Pendiente */}
                                <div className={`hover:bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                                    totalPendiente > 0 
                                        ? "bg-amber-50/40 border-amber-200/70 hover:border-amber-300 hover:shadow-xs" 
                                        : "bg-emerald-50/30 border-emerald-200/50 hover:border-emerald-300 hover:shadow-xs"
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                            totalPendiente > 0 ? "text-amber-800" : "text-emerald-700"
                                        }`}>
                                            Saldo Pendiente
                                        </span>
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                            totalPendiente > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                        }`}>
                                            <FiClock size={14} />
                                        </div>
                                    </div>
                                    <div>
                                        <span className={`text-lg sm:text-xl font-black tracking-tight block ${
                                            totalPendiente > 0 ? "text-amber-900" : "text-emerald-800"
                                        }`}>
                                            ${totalPendiente.toLocaleString("es-CO")}
                                        </span>
                                        <span className={`text-[10px] font-semibold block mt-1 ${
                                            totalPendiente > 0 ? "text-amber-700" : "text-emerald-600"
                                        }`}>
                                            {totalPendiente > 0 ? "Por cancelar en clínica" : "¡Tratamientos al día!"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Planes de Tratamiento y Progreso Clínico */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                                        Salud Bucal
                                    </span>
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <FiActivity className="text-indigo-600" size={17} /> Plan de Tratamiento
                                    </h3>
                                </div>
                                {planes.length > 0 && (
                                    <button
                                        onClick={() => { setSelectedPlanIdx(0); setActiveModal("tratamiento"); }}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/70 px-3 py-1.5 rounded-xl transition-all"
                                    >
                                        <FiActivity size={14} /> Ver detalle interactivo ({planes.length})
                                    </button>
                                )}
                            </div>

                            {loadingData ? (
                                <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
                            ) : planes.length === 0 ? (
                                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                    <p className="text-sm font-bold text-slate-600">
                                        No hay planes de tratamiento activos en este momento.
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        Tus planes de tratamiento formalizados por tu odontólogo aparecerán aquí una vez sean registrados.
                                    </p>
                                </div>
                            ) : (() => {
                                const PLANS_PER_PAGE = 2;
                                const totalPlanPages = Math.ceil(planes.length / PLANS_PER_PAGE) || 1;
                                const paginatedPlans = planes.slice((currentPlanPage - 1) * PLANS_PER_PAGE, currentPlanPage * PLANS_PER_PAGE);

                                return (
                                    <div className="space-y-3.5">
                                        {paginatedPlans.map((plan, planIdx) => {
                                            const globalPlanIdx = (currentPlanPage - 1) * PLANS_PER_PAGE + planIdx;
                                            const items = plan.items || (plan.detalles && plan.detalles.items) || [];
                                            const completados = items.filter(it => it.done || it.completado).length;
                                            const pct = items.length > 0 ? Math.round((completados / items.length) * 100) : 0;
                                            return (
                                                <div 
                                                    key={plan.id} 
                                                    className="bg-slate-50/80 hover:bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/70 hover:border-indigo-200 transition-all space-y-3"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h4 className="font-extrabold text-sm sm:text-base text-slate-800 truncate">
                                                                {plan.title || plan.nombre || "Plan de Tratamiento Integral"}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                                                                <FiUser size={12} className="text-slate-400 shrink-0" />
                                                                <span>{plan.doctorName || plan.dentista || "Odontólogo Tratante"}</span>
                                                                {plan.specialty && <span className="text-slate-400">· {plan.specialty}</span>}
                                                            </p>
                                                        </div>
                                                        {(() => {
                                                            const statusInfo = STATUS_MAP[(plan.status || "").toLowerCase()] || {
                                                                label: plan.status || "Activo",
                                                                classes: "bg-blue-100 text-blue-700"
                                                            };
                                                            return (
                                                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${statusInfo.classes}`}>
                                                                    {statusInfo.label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Barra de progreso estilizada y compacta */}
                                                    <div>
                                                        <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                                                            <span>{completados} de {items.length} procedimientos completados</span>
                                                            <span className="text-indigo-600 font-bold">{pct}%</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Vista previa compacta de procedimientos */}
                                                    {items.length > 0 && (
                                                        <div className="pt-0.5">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                {items.slice(0, 4).map((it, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 text-xs bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
                                                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold ${
                                                                            it.done || it.completado ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                                                        }`}>
                                                                            {it.done || it.completado ? "✓" : idx + 1}
                                                                        </span>
                                                                        <span className={`truncate ${it.done || it.completado ? "line-through text-slate-400" : "font-medium text-slate-700"}`}>
                                                                            {it.desc || it.nombre || "Procedimiento"}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Pie de tarjeta con costo y botón interactivo */}
                                                    <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 flex-wrap gap-2">
                                                        <span className="text-xs font-black text-slate-700">
                                                            Valor: <span className="text-indigo-700">${Number(plan.total || 0).toLocaleString("es-CO")}</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedPlanIdx(globalPlanIdx);
                                                                setActiveModal("tratamiento");
                                                            }}
                                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                                                        >
                                                            <span>Ver detalle interactivo</span>
                                                            <FiChevronRight size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Barra de paginación si hay más de PLANS_PER_PAGE tratamientos */}
                                        {totalPlanPages > 1 && (
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                                                <span className="text-[11px] font-bold text-slate-400">
                                                    Página {currentPlanPage} de {totalPlanPages} ({planes.length} tratamientos)
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={currentPlanPage === 1}
                                                        onClick={() => setCurrentPlanPage(prev => Math.max(1, prev - 1))}
                                                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold transition-all cursor-pointer"
                                                    >
                                                        Anterior
                                                    </button>
                                                    <span className="px-2.5 py-1 font-black text-indigo-700 bg-indigo-50 rounded-lg">
                                                        {currentPlanPage} / {totalPlanPages}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        disabled={currentPlanPage === totalPlanPages}
                                                        onClick={() => setCurrentPlanPage(prev => Math.min(totalPlanPages, prev + 1))}
                                                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold transition-all cursor-pointer"
                                                    >
                                                        Siguiente
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* 3. Historial Completo de Visitas */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                                        Registro Clínico
                                    </span>
                                    <h3 className="text-base font-black text-slate-800">
                                        Historial de Consultas y Citas
                                    </h3>
                                </div>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                                    {todasCitas.length} visita(s)
                                </span>
                            </div>

                            {loadingData ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-2xl animate-pulse" />)}
                                </div>
                            ) : todasCitas.length === 0 ? (
                                <p className="text-slate-400 text-sm italic text-center py-6">
                                    No hay registros de citas anteriores.
                                </p>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                                    {todasCitas.map(c => (
                                        <div key={c.id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                                            <div className="min-w-0">
                                                <p className="text-xs sm:text-sm font-extrabold text-slate-800">
                                                    {c.fecha} {c.horaInicio && `· ${c.horaInicio}`}
                                                </p>
                                                <p className="text-xs text-indigo-700 font-semibold truncate mt-0.5">
                                                    {c.dentista || "Odontólogo General"}
                                                </p>
                                                <p className="text-[11px] text-slate-400 truncate">
                                                    {c.motivo || "Control general"}
                                                </p>
                                            </div>
                                            <div className="shrink-0">
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                                    ["atendida", "atendido", "completada", "completado"].includes((c.estado || "").toLowerCase())
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : (c.estado || "").toLowerCase() === "cancelada"
                                                        ? "bg-rose-100 text-rose-700"
                                                        : "bg-blue-100 text-blue-700"
                                                }`}>
                                                    {c.estado || "Programada"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 4. Barra de Acciones Rápidas */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <button
                                onClick={() => { setCitaEnviada(false); setActiveModal("cita"); }}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition text-center group"
                            >
                                <div className="text-2xl mb-1 group-hover:scale-110 transition">📅</div>
                                <div className="font-extrabold text-slate-700 text-xs">Nueva Cita</div>
                                <div className="text-[10px] text-indigo-600 font-bold mt-0.5">Solicitar</div>
                            </button>

                            <button
                                onClick={() => setActiveModal("pagos")}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition text-center group"
                            >
                                <div className="text-2xl mb-1 group-hover:scale-110 transition">💳</div>
                                <div className="font-extrabold text-slate-700 text-xs">Mis Pagos</div>
                                <div className="text-[10px] text-slate-400 font-bold mt-0.5">{pagos.length} comprobante(s)</div>
                            </button>

                            <button
                                onClick={() => setActiveModal("tratamiento")}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition text-center group"
                            >
                                <div className="text-2xl mb-1 group-hover:scale-110 transition">🦷</div>
                                <div className="font-extrabold text-slate-700 text-xs">Tratamiento</div>
                                <div className="text-[10px] text-slate-400 font-bold mt-0.5">{planes.length} plan(es)</div>
                            </button>

                            <button
                                onClick={() => setActiveModal("soporte")}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition text-center group"
                            >
                                <div className="text-2xl mb-1 group-hover:scale-110 transition">💬</div>
                                <div className="font-extrabold text-slate-700 text-xs">Atención</div>
                                <div className="text-[10px] text-emerald-600 font-bold mt-0.5">WhatsApp</div>
                            </button>
                        </div>

                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-auto border-t border-slate-200/60 bg-white py-4 px-4 text-center">
                <p className="text-xs text-slate-400 font-medium">
                    © {new Date().getFullYear()} {config.name || "OdontoCloud"} · Portal de Salud Protegido bajo Ley 1581 de 2012
                </p>
            </footer>

            {/* ── MODAL: Nueva Cita ─────────────────────────────────────────── */}
            {activeModal === "cita" && (
                <PortalModal title="Solicitar Cita" icon={FiCalendar} color="bg-indigo-600 text-white" onClose={() => setActiveModal(null)}>
                    {citaEnviada ? (
                        <div className="text-center py-6 space-y-4">
                            <div className="text-5xl">✅</div>
                            <p className="font-bold text-slate-800 text-lg">¡Solicitud enviada!</p>
                            <p className="text-slate-500 text-sm">Tu solicitud fue recibida. La clínica la revisará y te notificará aquí cuando sea confirmada.</p>
                            {config.phone && (
                                <button
                                    onClick={handleEnviarWhatsApp}
                                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <FiMessageCircle /> También enviar por WhatsApp
                                </button>
                            )}
                            <button onClick={() => setActiveModal(null)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest">Cerrar</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {config.phone && (
                                <button
                                    type="button"
                                    onClick={handleEnviarWhatsApp}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
                                >
                                    <FiMessageCircle size={16} /> Solicitar Cita Inmediata por WhatsApp
                                </button>
                            )}

                            <div className="relative flex py-1 items-center">
                                <div className="flex-grow border-t border-slate-200" />
                                <span className="flex-shrink mx-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">o llena el formulario</span>
                                <div className="flex-grow border-t border-slate-200" />
                            </div>

                            <form onSubmit={handleSolicitarCita} className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Fecha preferida</label>
                                    <input type="date" min={new Date().toISOString().slice(0,10)} max="9999-12-31" required value={nuevaCitaForm.fecha} onChange={e => setNuevaCitaForm(f => ({...f, fecha: e.target.value}))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-semibold text-sm text-slate-800" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Motivo de consulta</label>
                                    <input type="text" placeholder="Ej: Dolor muela, limpieza, revisión..." value={nuevaCitaForm.motivo} onChange={e => setNuevaCitaForm(f => ({...f, motivo: e.target.value}))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-semibold text-sm text-slate-800" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tu celular</label>
                                    <input type="tel" value={nuevaCitaForm.celular} onChange={e => setNuevaCitaForm(f => ({...f, celular: e.target.value}))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-semibold text-sm text-slate-800" placeholder="3001234567" />
                                </div>
                                <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                                    <FiCalendar /> Enviar Solicitud a Clínica
                                </button>
                            </form>
                        </div>
                    )}
                </PortalModal>
            )}

            {/* ── MODAL: Mis Pagos y Recibos ─────────────────────────────────── */}
            {activeModal === "pagos" && (
                <PortalModal title="Mis Pagos y Recibos" icon={FiDollarSign} color="bg-emerald-600 text-white" onClose={() => setActiveModal(null)}>
                    {loadingData ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                    : pagos.length === 0 ? <p className="text-slate-400 text-sm italic text-center py-8">No hay facturas o recibos registrados.</p>
                    : (
                        <div className="space-y-4">
                            <div className={`grid ${saldoFavor > 0 ? "grid-cols-3" : "grid-cols-2"} gap-2.5 mb-2`}>
                                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Pagado</p>
                                    <p className="font-black text-emerald-700 text-sm sm:text-base">${totalPagado.toLocaleString("es-CO")}</p>
                                </div>
                                {saldoFavor > 0 && (
                                    <div className="bg-teal-50 rounded-xl p-3 text-center border border-teal-200">
                                        <p className="text-[9px] font-black text-teal-700 uppercase tracking-widest">A Favor</p>
                                        <p className="font-black text-teal-800 text-sm sm:text-base">${saldoFavor.toLocaleString("es-CO")}</p>
                                    </div>
                                )}
                                <div className="bg-rose-50 rounded-xl p-3 text-center border border-rose-100">
                                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Pendiente</p>
                                    <p className="font-black text-rose-700 text-sm sm:text-base">${totalPendiente.toLocaleString("es-CO")}</p>
                                </div>
                            </div>

                            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                                {pagos.map(p => {
                                    const desc = p.descripcion || p.concepto || p.observaciones || "Abono general a tratamiento";
                                    const isSaldoFavor = desc.toLowerCase().includes("saldo a favor");
                                    const fechaStr = formatPagoFecha(p);
                                    const metodo = p.medio_pago || p.metodo_pago || p.forma_pago || "";

                                    return (
                                        <div key={p.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/70 transition-all flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="text-xs font-black text-slate-800 truncate">
                                                        {getReciboTitle(p)}
                                                    </p>
                                                    {isSaldoFavor && (
                                                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 shrink-0">
                                                            Saldo a Favor
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-600 font-medium truncate mb-1">
                                                    {desc}
                                                </p>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                                                    {fechaStr && <span>📅 {fechaStr}</span>}
                                                    {metodo && <span>💳 {metodo}</span>}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-black text-slate-800">
                                                    ${getPagoMonto(p).toLocaleString("es-CO")}
                                                </p>
                                                <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full inline-block mt-1 ${
                                                    isSaldoFavor
                                                        ? "bg-teal-100 text-teal-800"
                                                        : esPagado(p) 
                                                        ? "bg-emerald-100 text-emerald-700" 
                                                        : "bg-rose-100 text-rose-700"
                                                }`}>
                                                    {isSaldoFavor ? "Activo" : esPagado(p) ? "Pagado" : (p.estado || "Pendiente")}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </PortalModal>
            )}

            {/* ── MODAL: Tratamiento ───────────────────────────────────────── */}
            {activeModal === "tratamiento" && (
                <PortalModal title="Mi Plan de Tratamiento" icon={FiActivity} color="bg-purple-600 text-white" maxWidth="max-w-2xl" onClose={() => setActiveModal(null)}>
                    {loadingData ? (
                        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
                    ) : planes.length === 0 ? (
                        <p className="text-slate-400 text-sm italic text-center py-8">No hay planes de tratamiento formalizados registrados.</p>
                    ) : (() => {
                        const currentPlan = planes[selectedPlanIdx] || planes[0] || {};
                        const items = currentPlan.items || (currentPlan.detalles && currentPlan.detalles.items) || [];
                        const completados = items.filter(it => it.done || it.completado).length;
                        const pct = items.length > 0 ? Math.round((completados / items.length) * 100) : 0;
                        const statusInfo = STATUS_MAP[(currentPlan.status || currentPlan.estado || "").toLowerCase()] || {
                            label: currentPlan.status || currentPlan.estado || "Activo",
                            classes: "bg-blue-100 text-blue-700"
                        };

                        return (
                            <div className="space-y-4">
                                {/* Selector interactivo de tratamientos (Tabs) si hay más de 1 */}
                                {planes.length > 1 && (
                                    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
                                        {planes.map((p, idx) => {
                                            const isSelected = selectedPlanIdx === idx;
                                            const pItems = p.items || (p.detalles && p.detalles.items) || [];
                                            return (
                                                <button
                                                    key={p.id || idx}
                                                    type="button"
                                                    onClick={() => setSelectedPlanIdx(idx)}
                                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                                                        isSelected
                                                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                    }`}
                                                >
                                                    <span>{p.title || p.nombre || `Tratamiento ${idx + 1}`}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                                        isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                                                    }`}>
                                                        {pItems.length}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Cabecera del tratamiento seleccionado */}
                                <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block mb-0.5">
                                                Plan Clínico Seleccionado
                                            </span>
                                            <h3 className="text-base sm:text-lg font-black text-slate-900">
                                                {currentPlan.title || currentPlan.nombre || "Tratamiento Integral"}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-1.5">
                                                <FiUser size={13} className="text-slate-400 shrink-0" />
                                                <span>{currentPlan.doctorName || currentPlan.dentista || "Odontólogo Tratante"}</span>
                                                {currentPlan.specialty && <span className="text-slate-400">· {currentPlan.specialty}</span>}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider block mb-1 ${statusInfo.classes}`}>
                                                {statusInfo.label}
                                            </span>
                                            {currentPlan.total && (
                                                <span className="text-xs font-black text-indigo-700 block">
                                                    ${Number(currentPlan.total).toLocaleString("es-CO")}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Barra de progreso interactiva */}
                                    <div>
                                        <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                                            <span>Progreso del tratamiento: {completados} de {items.length} completados</span>
                                            <span className="text-purple-600 font-black">{pct}%</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Desglose detallado de procedimientos */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                                            Procedimientos Incluidos ({items.length})
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {completados} realizado{completados === 1 ? "" : "s"}
                                        </span>
                                    </div>

                                    {items.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-4 text-center bg-slate-50 rounded-xl">
                                            No hay procedimientos desglosados en este plan.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {items.map((it, idx) => {
                                                const isDone = Boolean(it.done || it.completado);
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-left ${
                                                            isDone
                                                                ? "bg-emerald-50/50 border-emerald-200/70"
                                                                : "bg-white border-slate-200/70 hover:border-slate-300"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-black ${
                                                                isDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                                                            }`}>
                                                                {isDone ? "✓" : idx + 1}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className={`text-xs font-bold leading-snug truncate ${
                                                                    isDone ? "line-through text-slate-500" : "text-slate-800"
                                                                }`}>
                                                                    {it.desc || it.nombre || "Procedimiento Odontológico"}
                                                                </p>
                                                                {it.diente && (
                                                                    <span className="text-[10px] text-slate-400 font-semibold block">
                                                                        Diente: {it.diente}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                                isDone
                                                                    ? "bg-emerald-100 text-emerald-700"
                                                                    : "bg-slate-100 text-slate-600"
                                                            }`}>
                                                                {isDone ? "Completado" : "Pendiente"}
                                                            </span>
                                                            {it.precio && (
                                                                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                                                                    ${Number(it.precio).toLocaleString("es-CO")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Observaciones si existen */}
                                {(currentPlan.observaciones || currentPlan.detalles?.observaciones) && (
                                    <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl text-xs text-purple-900">
                                        <p className="font-bold mb-0.5">Observaciones del especialista:</p>
                                        <p className="text-slate-600">{currentPlan.observaciones || currentPlan.detalles?.observaciones}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </PortalModal>
            )}

            {/* ── MODAL: Notificaciones ──────────────────────────────────────── */}
            {activeModal === "notificaciones" && (
                <PortalModal title="Centro de Notificaciones" icon={FiBell} color="bg-indigo-600 text-white" maxWidth="max-w-lg" onClose={() => setActiveModal(null)}>
                    {notificaciones.length === 0 ? (
                        <div className="text-center py-10 space-y-2">
                            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                                <FiBell size={22} />
                            </div>
                            <p className="text-slate-500 font-bold text-sm">Sin notificaciones recientes</p>
                            <p className="text-slate-400 text-xs">Aquí recibirás recordatorios y novedades sobre tus citas y tratamientos.</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {notificaciones.map(n => {
                                const rawDate = n.createdAt || n.created_at;
                                const dateFormatted = rawDate
                                    ? new Date(rawDate).toLocaleDateString("es-CO", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit"
                                      })
                                    : "";

                                const cleanMsg = String(n.message || "")
                                    .replace(/\s*del\s+undefined\s+a\s+las\s*/gi, " ")
                                    .replace(/\s*del\s+undefined\s*/gi, " ")
                                    .replace(/\s*a\s+las\s+undefined\s*/gi, " ")
                                    .replace(/undefined/gi, "")
                                    .trim();

                                const titleLower = String(n.title || "").toLowerCase();
                                const isConfirmed = titleLower.includes("confirmad");
                                const isCancelled = titleLower.includes("cancelad");
                                const isCompleted = titleLower.includes("completad");
                                const isScheduled = titleLower.includes("agendad") || titleLower.includes("programad");

                                const iconBg = isConfirmed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : isCancelled
                                    ? "bg-rose-100 text-rose-700"
                                    : isCompleted
                                    ? "bg-purple-100 text-purple-700"
                                    : isScheduled
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-indigo-100 text-indigo-700";

                                const IconComponent = isConfirmed
                                    ? FiCheckCircle
                                    : isCancelled
                                    ? FiAlertTriangle
                                    : isCompleted
                                    ? FiCheckCircle
                                    : isScheduled
                                    ? FiCalendar
                                    : FiClock;

                                return (
                                    <div
                                        key={n.id}
                                        className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-3.5 ${
                                            n.read ? "bg-slate-50/70 border-slate-200/60" : "bg-indigo-50/40 border-indigo-200/80 shadow-xs"
                                        }`}
                                    >
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                                            <IconComponent size={17} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <h4 className="font-extrabold text-slate-800 text-xs truncate">
                                                    {n.title}
                                                </h4>
                                                {dateFormatted && (
                                                    <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                                                        {dateFormatted}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-slate-600 text-xs leading-relaxed font-medium">
                                                {cleanMsg}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </PortalModal>
            )}

            {/* ── MODAL: Soporte ───────────────────────────────────────────── */}
            {activeModal === "soporte" && (
                <PortalModal title="Contactar Clínica" icon={FiMessageCircle} color="bg-green-600 text-white" onClose={() => setActiveModal(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">¿Tienes alguna pregunta o necesitas ayuda? Contáctanos directamente.</p>
                        {config.phone && (
                            <a href={`tel:${config.phone}`} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><FiPhone className="text-blue-600" size={18} /></div>
                                <div><p className="text-xs font-black text-slate-700 uppercase tracking-widest">Llamar</p><p className="text-sm font-semibold text-blue-600">{config.phone}</p></div>
                            </a>
                        )}
                        {config.phone && (
                            <a href={`https://wa.me/${config.phone.replace(/\D/g,"")}?text=Hola, soy ${encodeURIComponent(user.nombreCompleto || user.nombres || "paciente")}, necesito ayuda.`}
                               target="_blank" rel="noopener noreferrer"
                               className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100 hover:bg-green-100 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><FiMessageCircle className="text-green-600" size={18} /></div>
                                <div><p className="text-xs font-black text-green-700 uppercase tracking-widest">WhatsApp</p><p className="text-sm font-semibold text-green-700">Enviar mensaje</p></div>
                            </a>
                        )}
                        {config.email && (
                            <a href={`mailto:${config.email}?subject=Consulta paciente ${user.nombreCompleto || ""}`}
                               className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center"><span className="text-indigo-600 text-lg">✉️</span></div>
                                <div><p className="text-xs font-black text-indigo-700 uppercase tracking-widest">Correo</p><p className="text-sm font-semibold text-indigo-700">{config.email}</p></div>
                            </a>
                        )}
                        {!config.phone && !config.email && (
                            <p className="text-slate-400 text-sm italic text-center py-4">La clínica no ha configurado datos de contacto aún.</p>
                        )}
                    </div>
                </PortalModal>
            )}
        </div>
    );
}
