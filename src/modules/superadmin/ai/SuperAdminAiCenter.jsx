import React, { useState, useRef, useEffect } from "react";
import {
    FiCpu,
    FiClock,
    FiAlertTriangle,
    FiActivity,
    FiServer,
    FiFileText,
    FiDatabase,
    FiSend,
    FiCheckCircle,
    FiRefreshCw,
    FiShield,
    FiChevronRight,
    FiZap,
    FiLayers,
    FiHelpCircle,
    FiInfo,
} from "react-icons/fi";
import { MOCK_KPIS, QUICK_QUESTIONS, getMockAiResponse } from "./mockAiData";
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

    const [messages, setMessages] = useState([
        {
            id: "msg-initial",
            sender: "ai",
            text: "Hola MadridSystem. ¿Qué quieres revisar hoy?",
            timestamp: "08:30 AM",
            tags: ["Asistente Superadmin", "MOCK IA-1"],
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

    const handleSendMessage = (textToSend) => {
        const query = (textToSend || inputValue).trim();
        if (!query || isThinking) return;

        const userMsg = {
            id: `usr-${Date.now()}`,
            sender: "user",
            text: query,
            timestamp: getFormattedTime(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");
        setIsThinking(true);

        setTimeout(() => {
            const aiResp = getMockAiResponse(query);
            const aiMsg = {
                id: `ai-${Date.now()}`,
                sender: "ai",
                text: aiResp.text,
                tags: aiResp.tags,
                timestamp: getFormattedTime(),
            };
            setMessages((prev) => [...prev, aiMsg]);
            setIsThinking(false);
        }, 500);
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
                text: "Hola MadridSystem. ¿Qué quieres revisar hoy?",
                timestamp: getFormattedTime(),
                tags: ["Asistente Superadmin", "MOCK IA-1"],
            },
        ]);
    };

    const renderFormattedText = (text) => {
        return text.split("\n").map((line, idx) => {
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={idx} className={line.trim() === "" ? "h-2" : "leading-relaxed text-sm"}>
                    {parts.map((part, pIdx) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                            return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                        }
                        if (part.startsWith("*") && part.endsWith("*")) {
                            return <em key={pIdx} className="text-slate-600">{part.slice(1, -1)}</em>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    const getKpiIcon = (type) => {
        switch (type) {
            case "clinic":
                return <FiLayers className="w-5 h-5 text-blue-600" />;
            case "clock":
                return <FiClock className="w-5 h-5 text-amber-600" />;
            case "alert":
                return <FiAlertTriangle className="w-5 h-5 text-rose-600" />;
            case "file":
                return <FiFileText className="w-5 h-5 text-indigo-600" />;
            default:
                return <FiActivity className="w-5 h-5 text-slate-600" />;
        }
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
            case "database":
                return <FiDatabase className="w-3.5 h-3.5 text-teal-600" />;
            default:
                return <FiHelpCircle className="w-3.5 h-3.5 text-slate-500" />;
        }
    };

    // VISTA MÓVIL (< 768px): Experiencia Chat-First en pantalla completa nativa
    if (isMobile) {
        return <SuperAdminAiMobileChat onBack={onBack} />;
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
                                Asistente IA Superadmin
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                                <FiShield className="w-2.5 h-2.5" />
                                Solo superadministrador
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs font-medium mt-1">
                            Inteligencia operativa de OdontoCloud • Supervisión ejecutiva y diagnósticos rápidos
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>Modo MOCK — No conectado a producción</span>
                    </div>
                    <button
                        onClick={handleClearChat}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium shadow-xs transition-colors"
                        title="Reiniciar historial"
                    >
                        <FiRefreshCw className="w-3.5 h-3.5" />
                        <span>Limpiar Chat</span>
                    </button>
                </div>
            </div>

            {/* KPIs MOCK Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {MOCK_KPIS.map((kpi) => (
                    <div
                        key={kpi.id}
                        className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                    >
                        <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {kpi.title}
                            </span>
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                                {getKpiIcon(kpi.iconType)}
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="text-3xl font-black text-slate-900 tracking-tight">
                                {kpi.value}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                <span className="text-[11px] text-slate-500 font-medium truncate">
                                    {kpi.detail}
                                </span>
                                <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${kpi.badgeColor}`}
                                >
                                    {kpi.badge}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Panel Principal: Grid 2 Columnas (Resumen Inteligente + Chat IA) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Columna Izquierda: Resumen Inteligente y Preguntas Rápidas (5 columnas) */}
                <div className="lg:col-span-5 space-y-5">
                    {/* Tarjeta de Resumen Inteligente */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                    <FiZap className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                                    Resumen Inteligente del Sistema
                                </h3>
                            </div>
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Modo MOCK
                            </span>
                        </div>

                        <div className="space-y-3 text-xs text-slate-600">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Salud de la Plataforma (Simulado)
                                    </span>
                                    <span className="text-emerald-700 font-semibold text-[11px]">Entorno Demo OK</span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Servidor demo simulado (entorno de pruebas). Modo MOCK — sin conexión al VPS real ni a bases de datos de producción.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                        <FiClock className="w-3.5 h-3.5 text-amber-600" />
                                        Vencimientos Prioritarios (Demo)
                                    </span>
                                    <span className="text-amber-700 font-semibold text-[11px]">2 clínicas demo</span>
                                </div>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                    Clínica Demo Norte y Clínica Demo Centro (fechas y suscripciones generadas para pruebas de interfaz).
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-rose-900 flex items-center gap-1.5">
                                        <FiAlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                        1 alerta simulada de facturación
                                    </span>
                                    <span className="text-rose-700 font-semibold text-[11px]">Dato MOCK</span>
                                </div>
                                <p className="text-[11px] text-rose-800 leading-relaxed">
                                    Clínica Demo Sur con folios de prueba bajo el umbral sintético. Sin conexión a Factus ni DIAN real.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Preguntas Rápidas */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                                <FiHelpCircle className="w-4 h-4 text-blue-600" />
                                Preguntas Rápidas
                            </h3>
                            <span className="text-[11px] text-slate-400">Clic para consultar</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {QUICK_QUESTIONS.map((q) => (
                                <button
                                    key={q.id}
                                    onClick={() => handleSendMessage(q.label)}
                                    disabled={isThinking}
                                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/70 hover:bg-blue-50/60 text-slate-700 hover:text-blue-800 text-xs font-medium transition-all flex items-center justify-between group disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="p-1 rounded-md bg-white border border-slate-200 group-hover:border-blue-200">
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

                {/* Columna Derecha: Consola de Chat IA Interactiva (7 columnas) */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[650px] overflow-hidden">
                    {/* Encabezado del Chat */}
                    <div className="flex-none px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                <FiCpu className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900 leading-none">
                                        Chat Asistente Superadmin
                                    </h4>
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                </div>
                                <span className="text-[11px] text-amber-700 font-semibold mt-0.5 leading-none block">
                                    Modo MOCK — No conectado a producción
                                </span>
                            </div>
                        </div>
                        <div className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Fase IA-1.1 MOCK
                        </div>
                    </div>

                    {/* Contenedor de Mensajes con Scroll */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs ${msg.sender === "user"
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
                                                Asistente IA Superadmin
                                            </span>
                                            {msg.tags && (
                                                <div className="flex items-center gap-1 ml-auto">
                                                    {msg.tags.map((t, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium"
                                                        >
                                                            {t}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        {msg.sender === "ai" ? renderFormattedText(msg.text) : (
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
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                        <FiCpu className="w-2.5 h-2.5" />
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">Asistente analizando...</span>
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

                    {/* Input Inferior */}
                    <div className="flex-none p-4 bg-white border-t border-slate-200">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSendMessage();
                            }}
                            className="flex items-center gap-2"
                        >
                            <input
                                ref={chatInputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Pregunta sobre clínicas, facturación, servidores, backups..."
                                className="flex-1 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                disabled={isThinking}
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isThinking}
                                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold flex items-center gap-2 shadow-xs disabled:opacity-40 disabled:hover:bg-blue-600 disabled:active:scale-100 transition-all cursor-pointer"
                            >
                                <FiSend className="w-4 h-4" />
                                <span>Enviar</span>
                            </button>
                        </form>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
                            <span>Presiona Enter para enviar • Información demostrativa</span>
                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                Modo MOCK — No conectado a producción
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
