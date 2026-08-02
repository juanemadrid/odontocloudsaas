import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    loginPatientPortal,
    logoutPatientPortal,
    requestPatientAppointment,
    resumePatientPortal
} from "../../services/patientPortalService";
import { useParams, useNavigate } from "react-router-dom";
import { DEFAULT_CONFIG } from "../../constants/DefaultConfig";
import { fetchTenantConfigBySlug } from "../../utils/tenantConfigHelper";
import { FiArrowLeft, FiLogOut, FiCalendar, FiDollarSign, FiActivity, FiMessageCircle, FiX, FiPhone, FiUser, FiShield, FiAlertTriangle, FiHeart, FiFileText, FiBell } from "react-icons/fi";
import { toast } from "sonner";
import { isAccessBlocked } from "../../utils/subscriptionHelper";

// ── Modal genérico del portal ─────────────────────────────────────────────────
function PortalModal({ title, icon: Icon, color, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className={`flex items-center justify-between px-6 py-4 ${color}`}>
                    <h2 className="font-black text-base flex items-center gap-2"><Icon size={18} /> {title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/10 transition-colors"><FiX size={18} /></button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
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

    // Modal states
    const [activeModal, setActiveModal] = useState(null); // 'cita' | 'pagos' | 'tratamiento' | 'soporte'

    // Data states
    const [pagos, setPagos] = useState([]);
    const [planes, setPlanes] = useState([]);
    const [todasCitas, setTodasCitas] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [notificaciones, setNotificaciones] = useState([]);
    const unsubRef = useRef(null);

    // Nueva cita form
    const [nuevaCitaForm, setNuevaCitaForm] = useState({ fecha: "", motivo: "", nombre: "", celular: "" });
    const [citaEnviada, setCitaEnviada] = useState(false);
    const [soporteMsg, setSoporteMsg] = useState("");

    // Extract unique specialists treating this patient
    const especialistas = useMemo(() => {
        const set = new Set();
        const docs = [];

        // 1. Add doctor from upcoming appointments
        todasCitas.forEach(c => {
            const name = c.dentista || c.doctorName;
            if (name && name !== "—" && !set.has(name)) {
                set.add(name);
                docs.push({ name, specialty: c.especialidad || "Odontólogo Especialista" });
            }
        });

        // 2. Add doctor from treatment plans
        planes.forEach(p => {
            const name = p.doctorName || p.dentista || p.doctor;
            if (name && typeof name === 'string' && name !== "—" && !set.has(name)) {
                set.add(name);
                docs.push({ name, specialty: p.especialidad || "Odontólogo Especialista" });
            }
        });

        // Fallback: If no specialists found, add a default clinic doctor
        if (docs.length === 0) {
            docs.push({ name: config.name || "Tu Odontólogo", specialty: "Odontología General" });
        }

        return docs;
    }, [todasCitas, planes, config]);

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
        if (docInput.replace(/\D/g, "").length < 5) {
            return toast.error("Ingrese un documento válido (mínimo 5 dígitos).");
        }
        if (!birthDate) return toast.error("Ingrese su fecha de nacimiento.");
        if (!inquilinoId) return toast.error("No fue posible identificar la clínica.");

        setLoading(true);
        try {
            const portalData = await loginPatientPortal({
                document: docInput,
                birthDate,
                tenantId: inquilinoId,
                clinicSlug
            });
            applyPortalData(portalData);
            setAuth(true);
        } catch (error) {
            toast.error("Error al iniciar sesión: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    const applyPortalData = (portalData) => {
        const patientData = portalData?.patient;
        if (!patientData) throw new Error("El portal no devolvió los datos del paciente.");

        setUser(patientData);
        setNuevaCitaForm(form => ({
            ...form,
            nombre: patientData.nombreCompleto || "",
            celular: patientData.celular || ""
        }));

        const citasArr = (portalData.appointments || []).map(appointment => ({
            id: appointment.id,
            fecha: appointment.fecha_inicio
                ? appointment.fecha_inicio.split("T")[0]
                : (appointment.fecha || ""),
            horaInicio: appointment.fecha_inicio
                ? new Date(appointment.fecha_inicio).toTimeString().substring(0, 5)
                : (appointment.horaInicio || ""),
            estado: appointment.estado || "confirmada",
            motivo: appointment.motivo || "",
            dentista: appointment.profesional_nombre || "—",
            ...appointment
        })).sort((first, second) =>
            new Date((second.fecha || "") + "T" + (second.horaInicio || "00:00")) -
            new Date((first.fecha || "") + "T" + (first.horaInicio || "00:00"))
        );
        setTodasCitas(citasArr);

        const today = new Date().toISOString().slice(0, 10);
        setNextAppt(citasArr.find(appointment =>
            appointment.fecha >= today &&
            !["cancelada", "no asistio"].includes((appointment.estado || "").toLowerCase())
        ) || null);

        const seenIds = new Set();
        const paymentRows = (portalData.payments || []).filter(payment => {
            if (seenIds.has(payment.id)) return false;
            seenIds.add(payment.id);
            return true;
        });
        setPagos(paymentRows.sort((first, second) =>
            new Date(second.created_at || second.fecha || 0).getTime() -
            new Date(first.created_at || first.fecha || 0).getTime()
        ));
        setPlanes(portalData.plans || []);
        setNotificaciones(portalData.notifications || []);
    };

    const handleSolicitarCita = async (event) => {
        event.preventDefault();
        try {
            await requestPatientAppointment({
                preferredDate: nuevaCitaForm.fecha,
                reason: nuevaCitaForm.motivo || "Limpieza/Revisión",
                phone: nuevaCitaForm.celular || user.celular || ""
            });
            setCitaEnviada(true);
        } catch (error) {
            toast.error("No fue posible enviar la solicitud: " + error.message);
        }
    };
    const handleEnviarWhatsApp = () => {
        const phone = config.phone ? config.phone.replace(/\D/g, "") : "";
        const msg = `Hola, soy *${user.nombreCompleto || user.nombres}*, quisiera agendar una cita odontológica.\n📅 Fecha preferida: ${nuevaCitaForm.fecha || "por definir"}\n📋 Motivo: ${nuevaCitaForm.motivo || "Consulta general"}\n📱 Mi celular: ${nuevaCitaForm.celular}`;
        if (phone) {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
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
                    autoPlay muted loop playsInline preload="auto"
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
                            {/* Clinic logo or initial */}
                            <div className="flex justify-center mb-4">
                                {config?.logo && config.logo !== "/assets/logo.png" ? (
                                    <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center overflow-hidden">
                                        <img
                                            src={config.logo}
                                            alt={config.name}
                                            className="h-12 w-auto object-contain"
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2C9.2 2 7 4.2 7 7c0 1.5.6 3 1.3 4.3L7 21h1l1-4h6l1 4h1l-1.3-9.7C15.4 10 16 8.5 16 7c0-2.8-2.2-5-4-5z"/>
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Portal de Pacientes</p>
                            <h1 className="text-2xl font-black text-white leading-tight">{config.name || "Tu Clínica"}</h1>
                        </div>

                        {/* Form area — white background */}
                        <div className="px-8 py-7 space-y-5">
                            <p className="text-slate-500 text-sm text-center leading-snug">
                                Ingresa tus datos para consultar citas, pagos y tratamientos.
                            </p>

                            <form onSubmit={handleLogin} className="space-y-4 mt-2">
                                {/* Document field */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                        Número de documento
                                    </label>
                                    <div className="relative">
                                        <FiUser size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Ej: 1234567890"
                                            value={docInput}
                                            onChange={e => setDocInput(e.target.value)}
                                            disabled={loading}
                                            required
                                            className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 bg-slate-50 border-2 border-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Birth date field */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
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
                                            className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm font-semibold text-slate-800 bg-slate-50 border-2 border-slate-200 outline-none transition-all focus:border-blue-500 focus:bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Submit button — single solid color */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 rounded-xl font-black text-sm text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5 mt-2"
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
                                            Ingresar al Portal
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="px-8 pb-7 pt-2 text-center border-t border-slate-100">
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
        // Recibos de caja se consideran siempre pagados (ya se cobró en caja)
        if (p.total !== undefined && !p.estado) return true;
        return estado === "pagada" || estado === "pagado" || estado === "paid" || 
               estado === "completado" || estado === "completada" || estado === "complete";
    };
    const totalPagado = pagos.filter(esPagado).reduce((s, p) => s + getPagoMonto(p), 0);
    // El pendiente real = total de los planes de tratamiento - lo ya abonado
    const totalPlanes = planes.reduce((s, plan) => {
        const items = plan.items || [];
        const planTotal = Number(plan.total || 0) || items.reduce((sum, it) => sum + Number(it.precio || it.price || it.valor || 0), 0);
        return s + planTotal;
    }, 0);
    const totalPendiente = Math.max(0, totalPlanes - totalPagado);



    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-8 pb-28 rounded-b-[4rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10 text-9xl">
                    {config?.logo ? <img src={config.logo} alt="" className="w-64 h-64 object-contain brightness-0 invert" /> : "🦷"}
                </div>
                <div className="relative z-10 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(clinicSlug ? `/c/${clinicSlug}` : "/")} className="bg-white/10 p-3 rounded-2xl hover:bg-white/20 transition-all border border-white/10"><FiArrowLeft size={20} /></button>
                        <div>
                            <p className="text-indigo-100/60 font-bold text-xs uppercase tracking-widest mb-1">Bienvenido/a</p>
                            <h1 className="text-2xl font-black tracking-tight leading-tight">{user.nombreCompleto || user.nombres}</h1>
                            <p className="text-indigo-200 text-xs mt-1">{config.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => {
                            notificaciones.forEach(n => {
                                if (!n.read) updateDoc(doc(db, "notificaciones", n.id), { read: true });
                            });
                            setActiveModal("notificaciones");
                        }} className="flex flex-col items-center gap-1 group relative">
                            <div className="bg-white/10 p-3 rounded-2xl group-hover:bg-indigo-500/85 transition-all border border-white/10 relative">
                                <FiBell size={20} />
                                {notificaciones.some(n => !n.read) && (
                                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border border-indigo-600 animate-pulse" />
                                )}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Alertas</span>
                        </button>

                        <button onClick={handleLogout} className="flex flex-col items-center gap-1 group">
                            <div className="bg-white/10 p-3 rounded-2xl group-hover:bg-rose-500/80 transition-all border border-white/10"><FiLogOut size={20} /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Salir</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 -mt-12 relative z-20 space-y-4 max-w-lg mx-auto">
                {/* Próxima Cita */}
                <div className="bg-white p-5 rounded-2xl shadow-lg border-l-8 border-indigo-500">
                    <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-3">Próxima Visita</h3>
                    {loadingData ? <div className="h-12 bg-slate-100 rounded-xl animate-pulse" /> :
                    nextAppt ? (
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-50 px-4 py-3 rounded-xl text-center min-w-[64px]">
                                <div className="text-xs font-bold text-indigo-700 uppercase">{new Date(`${nextAppt.fecha}T12:00:00`).toLocaleString('es-CO', { month: 'short' })}</div>
                                <div className="text-2xl font-black text-indigo-600">{new Date(`${nextAppt.fecha}T12:00:00`).getDate()}</div>
                            </div>
                            <div>
                                <div className="font-black text-slate-800">{nextAppt.horaInicio || nextAppt.hora || "—"}</div>
                                <div className="text-slate-500 text-sm">{nextAppt.dentista || nextAppt.doctorName || "Odontología General"}</div>
                                <div className="text-xs text-slate-400">{nextAppt.motivo || nextAppt.title || "Control"}</div>
                            </div>
                        </div>
                    ) : <p className="text-slate-400 text-sm italic">No tienes citas próximas programadas.</p>}
                </div>

                {/* Tus Especialistas */}
                <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100/80">
                    <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-3">Tus Especialistas</h3>
                    <div className="divide-y divide-slate-100 space-y-2">
                        {especialistas.map((esp, i) => (
                            <div key={i} className="flex items-center gap-3 pt-2 first:pt-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-50 to-indigo-100 border border-indigo-200/60 flex items-center justify-center text-sm text-indigo-600 font-bold shrink-0 shadow-inner">
                                    {esp.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || "Dr"}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-800 text-sm">{esp.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{esp.specialty}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mi Ficha de Salud */}
                <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100/80 space-y-4 text-left">
                    <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                        <FiFileText size={14} /> Mi Ficha de Salud
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-2xl">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nro. Historia</span>
                            <span className="font-extrabold text-slate-700 text-xs truncate block">{user.nroHistoria || `HC-${(user.id || "").slice(-6).toUpperCase()}`}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Entidad (EPS)</span>
                            <span className="font-extrabold text-slate-700 text-xs truncate block">{user.nombreEps || "Particular"}</span>
                        </div>
                    </div>

                    {user.alertas ? (
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 items-start">
                            <FiAlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                            <div>
                                <h4 className="font-black text-rose-800 text-[9px] uppercase tracking-wider mb-1">Alertas Médicas / Alergias</h4>
                                <p className="text-rose-700 text-xs font-semibold leading-relaxed">{user.alertas}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-3 items-center">
                            <FiHeart className="text-emerald-500 shrink-0" size={16} />
                            <div>
                                <p className="text-emerald-700 text-xs font-bold leading-none">No se registran alergias o alertas críticas.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Resumen financiero rápido */}
                {pagos.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Pagado</p>
                            <p className="text-lg font-black text-emerald-700">${totalPagado.toLocaleString("es-CO")}</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Pendiente</p>
                            <p className="text-lg font-black text-rose-700">${totalPendiente.toLocaleString("es-CO")}</p>
                        </div>
                    </div>
                )}

                {/* Acciones rápidas */}
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { setCitaEnviada(false); setActiveModal("cita"); }} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition text-center group">
                        <div className="text-3xl mb-2 group-hover:scale-110 transition">📅</div>
                        <div className="font-bold text-slate-700 text-sm">Nueva Cita</div>
                        <div className="text-[10px] text-indigo-500 font-bold mt-1">Solicitar</div>
                    </button>
                    <button onClick={() => setActiveModal("pagos")} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition text-center group">
                        <div className="text-3xl mb-2 group-hover:scale-110 transition">💳</div>
                        <div className="font-bold text-slate-700 text-sm">Mis Pagos</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1">{pagos.length} factura(s)</div>
                    </button>
                    <button onClick={() => setActiveModal("tratamiento")} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition text-center group">
                        <div className="text-3xl mb-2 group-hover:scale-110 transition">🦷</div>
                        <div className="font-bold text-slate-700 text-sm">Tratamiento</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1">{planes.length} plan(es)</div>
                    </button>
                    <button onClick={() => setActiveModal("soporte")} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition text-center group">
                        <div className="text-3xl mb-2 group-hover:scale-110 transition">💬</div>
                        <div className="font-bold text-slate-700 text-sm">Soporte</div>
                        <div className="text-[10px] text-green-500 font-bold mt-1">WhatsApp</div>
                    </button>
                </div>

                {/* Historial de citas */}
                {todasCitas.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-5">
                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">Historial de Visitas</h3>
                        <div className="space-y-2 max-h-52 overflow-y-auto">
                            {todasCitas.slice(0, 8).map(c => (
                                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">{c.fecha} {(c.horaInicio || c.hora) && `• ${c.horaInicio || c.hora}`}</p>
                                        <p className="text-[10px] text-slate-400">{c.motivo || c.title || "Consulta"}</p>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                        ["atendida","completada"].includes((c.estado||"").toLowerCase()) ? "bg-emerald-100 text-emerald-700" :
                                        (c.estado||"").toLowerCase() === "cancelada" ? "bg-rose-100 text-rose-700" :
                                        "bg-amber-100 text-amber-700"
                                    }`}>{c.estado || "Pendiente"}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-5 rounded-2xl shadow-lg text-white text-center">
                    <p className="font-bold text-base mb-1">😊 ¡Gracias por confiar en nosotros!</p>
                    <p className="text-white/80 text-xs">Recuerda cepillarte 3 veces al día y usar hilo dental.</p>
                </div>
            </div>

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
                        <form onSubmit={handleSolicitarCita} className="space-y-4">
                            <p className="text-xs text-slate-500">Completa el formulario. Tu solicitud llegará directamente a la clínica.</p>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Fecha preferida</label>
                                <input type="date" min={new Date().toISOString().slice(0,10)} required value={nuevaCitaForm.fecha} onChange={e => setNuevaCitaForm(f => ({...f, fecha: e.target.value}))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-semibold text-sm text-slate-800" />
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
                                <FiCalendar /> Enviar Solicitud
                            </button>
                        </form>
                    )}
                </PortalModal>
            )}

            {/* ── MODAL: Mis Pagos ──────────────────────────────────────────── */}
            {activeModal === "pagos" && (
                <PortalModal title="Mis Pagos" icon={FiDollarSign} color="bg-emerald-600 text-white" onClose={() => setActiveModal(null)}>
                    {loadingData ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                    : pagos.length === 0 ? <p className="text-slate-400 text-sm italic text-center py-8">No hay facturas registradas.</p>
                    : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Pagado</p><p className="font-black text-emerald-700">${totalPagado.toLocaleString("es-CO")}</p></div>
                                <div className="bg-rose-50 rounded-xl p-3 text-center"><p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Pendiente</p><p className="font-black text-rose-700">${totalPendiente.toLocaleString("es-CO")}</p></div>
                            </div>
                            {pagos.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div><p className="text-xs font-black text-slate-700">{p.idFactura || p.consecutivo || p.id?.slice(-6)}</p><p className="text-[10px] text-slate-400">{p.descripcion || p.observaciones || "Pago registrado"}</p></div>
                                    <div className="text-right"><p className="text-xs font-black text-slate-700">${getPagoMonto(p).toLocaleString("es-CO")}</p><span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${esPagado(p) ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{esPagado(p) ? "Pagado" : (p.estado || "Pendiente")}</span></div>
                                </div>
                            ))}
                        </div>
                    )}
                </PortalModal>
            )}

            {/* ── MODAL: Tratamiento ───────────────────────────────────────── */}
            {activeModal === "tratamiento" && (
                <PortalModal title="Mi Tratamiento" icon={FiActivity} color="bg-purple-600 text-white" onClose={() => setActiveModal(null)}>
                    {loadingData ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                    : planes.length === 0 ? <p className="text-slate-400 text-sm italic text-center py-8">No hay planes de tratamiento registrados.</p>
                    : (
                        <div className="space-y-4">
                            {planes.map(plan => {
                                const items = plan.items || [];
                                const completados = items.filter(it => it.done || it.completado).length;
                                const pct = items.length > 0 ? Math.round((completados / items.length) * 100) : 0;
                                return (
                                    <div key={plan.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-black text-slate-800">{plan.title || plan.nombre || "Plan de Tratamiento"}</p>
                                            {(() => {
                                                const statusInfo = STATUS_MAP[(plan.status || "").toLowerCase()] || { label: plan.status || "Activo", classes: "bg-amber-100 text-amber-700" };
                                                return (
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${statusInfo.classes}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        {items.length > 0 && (
                                            <>
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                    <span>{completados}/{items.length} procedimientos</span>
                                                    <span>{pct}% completado</span>
                                                </div>
                                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                </div>
                                                <div className="mt-3 space-y-1">
                                                    {items.map((it, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${it.done || it.completado ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}>{it.done || it.completado ? "✓" : idx+1}</span>
                                                            <span className={`font-semibold ${it.done || it.completado ? "line-through text-slate-400" : "text-slate-700"}`}>{it.desc || it.nombre || "Procedimiento"}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        {plan.total && <p className="text-xs font-black text-emerald-600 mt-3">Total: ${Number(plan.total).toLocaleString("es-CO")}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </PortalModal>
            )}

            {/* ── MODAL: Notificaciones ──────────────────────────────────────── */}
            {activeModal === "notificaciones" && (
                <PortalModal title="Mis Notificaciones" icon={FiBell} color="bg-indigo-600 text-white" onClose={() => setActiveModal(null)}>
                    {notificaciones.length === 0 ? (
                        <p className="text-slate-400 text-sm italic text-center py-8">No tienes notificaciones recientes.</p>
                    ) : (
                        <div className="space-y-3">
                            {notificaciones.map(n => (
                                <div key={n.id} className={`p-4 rounded-2xl border transition-all text-left ${n.read ? 'bg-slate-50 border-slate-100' : 'bg-indigo-50/50 border-indigo-100 shadow-sm'}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <h4 className="font-bold text-slate-800 text-xs">{n.title}</h4>
                                        <span className="text-[9px] text-slate-400 font-semibold">{n.createdAt ? new Date(n.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </div>
                                    <p className="text-slate-600 text-xs leading-relaxed">{n.message}</p>
                                </div>
                            ))}
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
