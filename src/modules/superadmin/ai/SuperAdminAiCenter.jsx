import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    FiCpu,
    FiClock,
    FiAlertTriangle,
    FiActivity,
    FiServer,
    FiFileText,
    FiSend,
    FiRefreshCw,
    FiShield,
    FiChevronRight,
    FiZap,
    FiLayers,
    FiHelpCircle,
    FiCheckCircle,
    FiXCircle,
    FiMail,
    FiArrowRight,
} from "react-icons/fi";
import { QUICK_QUESTIONS } from "./mockAiData";
import {
    getDashboardSummary,
    answerQueryDeterministically,
    askAiAssistant,
} from "./services/superadminAiService";
import SuperAdminAiMobileChat from "./SuperAdminAiMobileChat";

export default function SuperAdminAiCenter({ onBack }) {
    const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Estados de datos reales y carga
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState(null);
    const [errorStatus, setErrorStatus] = useState(null);

    // Estados del Chat
    const [messages, setMessages] = useState([
        {
            id: "msg-initial",
            sender: "ai",
            text: "Hola MadridSystem. Datos operativos conectados en tiempo real. ¿Qué deseas consultar hoy?",
            timestamp: "En vivo",
            tags: ["Asistente Operativo", "Datos Reales"],
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef(null);
    const chatInputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const getFormattedTime = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    // Carga inicial del dashboard con datos reales del backend
    const loadDashboardData = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setErrorStatus(null);
        try {
            const data = await getDashboardSummary();
            setDashboardData(data);
        } catch (err) {
            console.error("Error al cargar datos del Centro IA:", err);
            setErrorMessage(err.message || "No fue posible consultar los datos en este momento.");
            setErrorStatus(err.status || 500);
            setDashboardData(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const handleSendMessage = async (textToSend) => {
        const query = (textToSend || inputValue).trim();
        if (!query || isThinking) return;

        const userMsg = {
            id: `usr-${Date.now()}`,
            sender: "user",
            text: query,
            timestamp: getFormattedTime(),
        };

        const currentMessages = [...messages, userMsg];
        setMessages(currentMessages);
        setInputValue("");
        setIsThinking(true);

        const history = currentMessages
            .filter((m) => m.sender === "user" || m.sender === "ai")
            .slice(-8)
            .map((m) => ({
                role: m.sender === "user" ? "user" : "model",
                text: m.text,
            }));

        try {
            const aiResp = await askAiAssistant(query, history, dashboardData);
            const aiMsg = {
                id: `ai-${Date.now()}`,
                sender: "ai",
                text: aiResp.text,
                tags: aiResp.tags || ["Datos Reales"],
                timestamp: getFormattedTime(),
            };
            setMessages((prev) => [...prev, aiMsg]);
        } catch (err) {
            const errMsg = {
                id: `ai-err-${Date.now()}`,
                sender: "ai",
                text: `⚠️ ${err.message || "Ocurrió un error al consultar el servicio."}`,
                tags: ["Error"],
                timestamp: getFormattedTime(),
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleClearChat = () => {
        setMessages([
            {
                id: `msg-${Date.now()}`,
                sender: "ai",
                text: "Chat reiniciado. Datos operativos conectados en tiempo real. ¿Qué deseas consultar?",
                timestamp: getFormattedTime(),
                tags: ["Asistente Operativo", "Datos Reales"],
            },
        ]);
    };

    const renderFormattedText = (text) => {
        return text.split("\n").map((line, idx) => {
            const parts = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
            return (
                <p key={idx} className={line.trim() === "" ? "h-2" : "leading-relaxed text-sm"}>
                    {parts.map((part, pIdx) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                            return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                        }
                        if (part.startsWith("*") && part.endsWith("*")) {
                            return <em key={pIdx} className="text-slate-600">{part.slice(1, -1)}</em>;
                        }
                        if (part.startsWith("`") && part.endsWith("`")) {
                            return <code key={pIdx} className="px-1.5 py-0.5 rounded bg-slate-100 text-rose-600 font-mono text-xs">{part.slice(1, -1)}</code>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    const getQuestionIcon = (iconName) => {
        switch (iconName) {
            case "clock":
                return <FiClock className="w-3.5 h-3.5 text-amber-600" />;
            case "file":
                return <FiZap className="w-3.5 h-3.5 text-blue-600" />;
            case "server":
                return <FiServer className="w-3.5 h-3.5 text-emerald-600" />;
            case "activity":
                return <FiActivity className="w-3.5 h-3.5 text-purple-600" />;
            case "fileText":
                return <FiFileText className="w-3.5 h-3.5 text-indigo-600" />;
            case "alert":
                return <FiAlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
            default:
                return <FiHelpCircle className="w-3.5 h-3.5 text-slate-500" />;
        }
    };

    // Cálculos de KPIs basados estrictamente en datos reales
    const activeClinics = dashboardData?.clinics?.internal_admin?.active_clinics ?? 0;
    const totalClinics = dashboardData?.clinics?.internal_admin?.total_clinics ?? 0;

    const expiringCount = dashboardData?.expiring?.internal_admin?.total_en_riesgo ?? 0;
    const clinicasEnRiesgo = dashboardData?.expiring?.internal_admin?.clinicas ?? [];

    const emailAlerts = dashboardData?.emailIssues?.internal_admin?.total_fallidos_recientes ?? 0;
    const factusAlerts = dashboardData?.factus?.internal_admin?.cantidad_cerca_del_limite ?? 0;
    const totalAlertas = emailAlerts + factusAlerts;

    const pendingRequests = dashboardData?.requests?.internal_admin?.total_pendientes ?? 0;

    const factusConfiguradas = dashboardData?.factus?.internal_admin?.clinicas_con_factus ?? 0;
    const factusProduccion = dashboardData?.factus?.internal_admin?.produccion ?? 0;
    const factusSandbox = dashboardData?.factus?.internal_admin?.sandbox ?? 0;
    const factusAsignados = dashboardData?.factus?.internal_admin?.total_folios_asignados ?? 0;
    const factusUsados = dashboardData?.factus?.internal_admin?.total_folios_usados ?? 0;
    const factusDisponibles = dashboardData?.factus?.internal_admin?.total_folios_disponibles ?? 0;

    // VISTA MÓVIL (< 768px): Experiencia Chat-First nativa
    if (isMobile) {
        return (
            <SuperAdminAiMobileChat
                onBack={onBack}
                dashboardData={dashboardData}
                isLoading={isLoading}
                errorMessage={errorMessage}
                onRetry={loadDashboardData}
            />
        );
    }

    // VISTA DESKTOP / TABLET (>= 768px)
    return (
        <div className="w-full flex flex-col space-y-6">
            {/* Header Superior del Centro IA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                        <FiCpu className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                                Centro IA Superadmin
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                                <FiShield className="w-2.5 h-2.5" />
                                Datos Operativos Reales
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs font-medium mt-1">
                            Supervisión de clínicas, facturación, vencimientos e incidencias en tiempo real
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Backend Conectado</span>
                    </div>
                    <button
                        onClick={handleClearChat}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium shadow-xs transition-colors cursor-pointer"
                        title="Reiniciar conversación"
                    >
                        <FiRefreshCw className="w-3.5 h-3.5" />
                        <span>Limpiar Chat</span>
                    </button>
                </div>
            </div>

            {/* Banner de Estado de Carga / Error */}
            {isLoading && (
                <div className="w-full p-4 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center gap-3 text-blue-800 text-sm font-medium animate-pulse">
                    <FiRefreshCw className="w-4 h-4 animate-spin text-blue-600 flex-none" />
                    <span>Consultando datos operativos de OdontoCloud...</span>
                </div>
            )}

            {!isLoading && errorMessage && (
                <div className="w-full p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-rose-800 text-sm">
                    <div className="flex items-center gap-3">
                        <FiXCircle className="w-5 h-5 text-rose-600 flex-none" />
                        <div>
                            <p className="font-bold">Error de conexión operativa</p>
                            <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
                        </div>
                    </div>
                    <button
                        onClick={loadDashboardData}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* KPIs Grid con Datos Reales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Clínicas Activas */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Clínicas Activas
                        </span>
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                            <FiLayers className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                            {isLoading ? "..." : activeClinics}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[11px] text-slate-500 font-medium truncate">
                                {isLoading ? "Consultando..." : `${totalClinics} clínicas registradas`}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                En Vivo
                            </span>
                        </div>
                    </div>
                </div>

                {/* KPI 2: Próximas a Vencer */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Próximas a Vencer
                        </span>
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                            <FiClock className="w-5 h-5 text-amber-600" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                            {isLoading ? "..." : expiringCount}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[11px] text-slate-500 font-medium truncate">
                                {isLoading
                                    ? "Consultando..."
                                    : expiringCount > 0
                                        ? "Requiere atención"
                                        : "Sin vencimientos próximos"}
                            </span>
                            <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${expiringCount > 0
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                    }`}
                            >
                                {expiringCount > 0 ? "Atención" : "Al Día"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* KPI 3: Alertas Operativas */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Alertas Operativas
                        </span>
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-100">
                            <FiAlertTriangle className="w-5 h-5 text-rose-600" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                            {isLoading ? "..." : totalAlertas}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[11px] text-slate-500 font-medium truncate">
                                {isLoading
                                    ? "Consultando..."
                                    : totalAlertas > 0
                                        ? `${totalAlertas} incidencia(s) detectada(s)`
                                        : "Sin alertas críticas"}
                            </span>
                            <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${totalAlertas > 0
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}
                            >
                                {totalAlertas > 0 ? "Incidencias" : "Estable"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* KPI 4: Solicitudes Pendientes */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Solicitudes Pendientes
                        </span>
                        <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                            <FiFileText className="w-5 h-5 text-indigo-600" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                            {isLoading ? "..." : pendingRequests}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[11px] text-slate-500 font-medium truncate">
                                {isLoading
                                    ? "Consultando..."
                                    : pendingRequests > 0
                                        ? "Pendientes de aprobación"
                                        : "Sin peticiones pendientes"}
                            </span>
                            <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pendingRequests > 0
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                    }`}
                            >
                                {pendingRequests > 0 ? "Pendiente" : "Al Día"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Layout Principal: 35% Izquierda (Resumen Operativo) / 65% Derecha (Chat Protagonista) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Columna Izquierda: ~35% (4 de 12 columnas) */}
                <div className="lg:col-span-4 space-y-5">
                    {/* Tarjeta de Resumen Operativo Determinista */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                    <FiZap className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                                    Resumen Operativo
                                </h3>
                            </div>
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Tiempo Real
                            </span>
                        </div>

                        <div className="space-y-3 text-xs text-slate-600">
                            {/* Bloque Clínicas */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Estado de Plataforma
                                    </span>
                                    <span className="text-emerald-700 font-semibold text-[11px]">
                                        {activeClinics} Activas
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    OdontoCloud tiene {activeClinics} clínica(s) activa(s) y {totalClinics - activeClinics} inactiva(s) registradas.
                                </p>
                            </div>

                            {/* Bloque Factus */}
                            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                                        <FiZap className="w-3.5 h-3.5 text-blue-600" />
                                        Facturación Factus
                                    </span>
                                    <span className="text-blue-700 font-semibold text-[11px]">
                                        {factusConfiguradas} Clínicas
                                    </span>
                                </div>
                                <p className="text-[11px] text-blue-900 leading-relaxed">
                                    {factusConfiguradas} clínica(s) con Factus ({factusProduccion} prod, {factusSandbox} sandbox).
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-blue-800 font-medium pt-1 border-t border-blue-200/60">
                                    <span>Folios disponibles:</span>
                                    <span className="font-bold">{factusDisponibles} / {factusAsignados}</span>
                                </div>
                            </div>

                            {/* Bloque Vencimientos */}
                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                        <FiClock className="w-3.5 h-3.5 text-amber-600" />
                                        Vencimientos Próximos
                                    </span>
                                    <span className="text-amber-700 font-semibold text-[11px]">
                                        {expiringCount > 0 ? `${expiringCount} en riesgo` : "Al día"}
                                    </span>
                                </div>
                                {expiringCount > 0 ? (
                                    <div className="space-y-1 pt-1">
                                        {clinicasEnRiesgo.map((c, i) => (
                                            <div key={i} className="text-[11px] text-amber-900 flex justify-between">
                                                <span className="font-medium truncate max-w-[160px]">• {c.nombre}</span>
                                                <span className="font-bold">{c.dias_restantes}d restantes</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-amber-800 leading-relaxed">
                                        Sin clínicas que venzan en los próximos 30 días.
                                    </p>
                                )}
                            </div>

                            {/* Bloque Correos / Incidencias */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <FiMail className="w-3.5 h-3.5 text-slate-600" />
                                        Servicio Resend
                                    </span>
                                    <span className={`text-[11px] font-semibold ${emailAlerts > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                                        {emailAlerts > 0 ? `${emailAlerts} error(es)` : "Operativo"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    {emailAlerts > 0
                                        ? `Se detectó ${emailAlerts} incidencia(s) reciente(s) en correos transaccionales.`
                                        : "Envíos de correo estables sin incidencias recientes."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Preguntas Rápidas */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                                <FiHelpCircle className="w-4 h-4 text-blue-600" />
                                Consultas Rápidas
                            </h3>
                            <span className="text-[11px] text-slate-400">Clic para ejecutar</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                            {QUICK_QUESTIONS.map((q) => (
                                <button
                                    key={q.id}
                                    onClick={() => handleSendMessage(q.label)}
                                    disabled={isThinking}
                                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/70 hover:bg-blue-50/60 text-slate-700 hover:text-blue-800 text-xs font-medium transition-all flex items-center justify-between group disabled:opacity-50 cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="p-1 rounded-md bg-white border border-slate-200 group-hover:border-blue-200 flex-none">
                                            {getQuestionIcon(q.icon)}
                                        </div>
                                        <span className="truncate">{q.label}</span>
                                    </div>
                                    <FiChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 flex-none transition-transform group-hover:translate-x-0.5" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: ~65% (8 de 12 columnas) — CHAT PROTAGONISTA AMPLIO */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col min-h-[650px] h-[720px] overflow-hidden">
                    {/* Encabezado del Chat */}
                    <div className="flex-none px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                <FiCpu className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900 leading-none">
                                        Consola Operativa Superadmin
                                    </h4>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-medium mt-1 leading-none block">
                                    Consultas deterministas contra el backend • Cero alucinaciones
                                </span>
                            </div>
                        </div>
                        <div className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1.5">
                            <FiCheckCircle className="w-3.5 h-3.5 text-blue-600" />
                            <span>IA-2C Activa</span>
                        </div>
                    </div>

                    {/* Contenedor de Mensajes con Scroll Amplio */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                            >
                                <div
                                    className={`max-w-[88%] rounded-2xl px-5 py-3.5 shadow-xs ${msg.sender === "user"
                                        ? "bg-blue-600 text-white rounded-br-xs"
                                        : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs"
                                        }`}
                                >
                                    {msg.sender === "ai" && (
                                        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100">
                                            <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                                <FiCpu className="w-2.5 h-2.5" />
                                            </div>
                                            <span className="text-[11px] font-bold text-blue-700">
                                                Superadmin Asistente
                                            </span>
                                            {msg.tags && (
                                                <div className="flex items-center gap-1 ml-auto">
                                                    {msg.tags.map((t, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                                                        >
                                                            {t}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        {msg.sender === "ai" ? (
                                            renderFormattedText(msg.text)
                                        ) : (
                                            <p className="text-sm font-normal leading-relaxed text-white">
                                                {msg.text}
                                            </p>
                                        )}
                                    </div>

                                    <div
                                        className={`flex items-center gap-1 text-[10px] mt-2 ${msg.sender === "user" ? "justify-end text-blue-200" : "justify-end text-slate-400"
                                            }`}
                                    >
                                        <FiClock className="w-2.5 h-2.5 opacity-70" />
                                        <span>{msg.timestamp}</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isThinking && (
                            <div className="flex items-start">
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-5 py-3.5 shadow-xs flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                        <FiCpu className="w-2.5 h-2.5" />
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">Analizando datos de OdontoCloud...</span>
                                    <div className="flex gap-1 items-center ml-2">
                                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Inferior Cómodo y Protagonista */}
                    <div className="flex-none p-4 px-6 bg-white border-t border-slate-200">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSendMessage();
                            }}
                            className="flex items-center gap-3"
                        >
                            <input
                                ref={chatInputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Escribe tu consulta sobre clínicas, Factus, vencimientos, correos..."
                                className="flex-1 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm px-5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner"
                                disabled={isThinking}
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isThinking}
                                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold flex items-center gap-2 shadow-xs disabled:opacity-40 disabled:hover:bg-blue-600 disabled:active:scale-100 transition-all cursor-pointer"
                            >
                                <FiSend className="w-4 h-4" />
                                <span>Enviar</span>
                            </button>
                        </form>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5 px-1">
                            <span>Presiona Enter para enviar • Respuestas conectadas en vivo al servidor</span>
                            <span className="font-semibold text-blue-600">
                                OdontoCloud Backend
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
