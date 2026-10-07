import React, { useState, useRef, useEffect } from "react";
import { FiSend, FiArrowLeft, FiCpu, FiClock, FiShield, FiRefreshCw, FiAlertTriangle } from "react-icons/fi";
import { MOBILE_CHIPS } from "./mockAiData";
import { answerQueryDeterministically, askAiAssistant } from "./services/superadminAiService";

export default function SuperAdminAiMobileChat({
    onBack,
    dashboardData,
    isLoading,
    errorMessage,
    onRetry,
}) {
    const [messages, setMessages] = useState([
        {
            id: "msg-initial",
            sender: "ai",
            text: "Hola MadridSystem. Conectado a datos operativos reales. Selecciona una consulta o escribe tu mensaje:",
            timestamp: "En vivo",
            tags: ["Asistente Operativo", "En Vivo"],
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

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
                text: `⚠️ ${err.message || "Error al consultar el servicio."}`,
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
                text: "Chat reiniciado. ¿Qué deseas consultar hoy?",
                timestamp: getFormattedTime(),
                tags: ["Asistente Operativo", "En Vivo"],
            },
        ]);
    };

    const renderFormattedText = (text) => {
        return text.split("\n").map((line, idx) => {
            const parts = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
            return (
                <p key={idx} className={line.trim() === "" ? "h-2" : "leading-relaxed text-xs sm:text-sm"}>
                    {parts.map((part, pIdx) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                            return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                        }
                        if (part.startsWith("*") && part.endsWith("*")) {
                            return <em key={pIdx} className="text-slate-600">{part.slice(1, -1)}</em>;
                        }
                        if (part.startsWith("`") && part.endsWith("`")) {
                            return <code key={pIdx} className="px-1 py-0.5 rounded bg-slate-100 text-rose-600 font-mono text-[11px]">{part.slice(1, -1)}</code>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-screen w-screen overflow-hidden">
            {/* Header Móvil Compacto */}
            <div className="flex-none px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all"
                        aria-label="Volver"
                    >
                        <FiArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        <FiCpu className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h2 className="text-sm font-bold text-slate-900 leading-tight">
                                Centro IA Superadmin
                            </h2>
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                            Datos en Vivo • Supervisión Real
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleClearChat}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all"
                        title="Limpiar conversación"
                    >
                        <FiRefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Banner de Carga o Error si aplica */}
            {isLoading && (
                <div className="flex-none px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-blue-800 text-xs font-medium animate-pulse">
                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Consultando métricas en vivo...</span>
                </div>
            )}

            {!isLoading && errorMessage && (
                <div className="flex-none px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-rose-800 text-xs">
                    <div className="flex items-center gap-2">
                        <FiAlertTriangle className="w-4 h-4 text-rose-600 flex-none" />
                        <span className="truncate max-w-[200px]">{errorMessage}</span>
                    </div>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="px-2 py-1 rounded bg-rose-600 text-white font-bold text-[10px]"
                        >
                            Reintentar
                        </button>
                    )}
                </div>
            )}

            {/* Chips de Consultas Rápidas en Carrusel Horizontal */}
            <div className="flex-none px-3 py-2 bg-white border-b border-slate-100 overflow-x-auto no-scrollbar flex items-center gap-2">
                {MOBILE_CHIPS.map((chip) => (
                    <button
                        key={chip.id}
                        onClick={() => handleSendMessage(chip.prompt)}
                        disabled={isThinking}
                        className="flex-none px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/80 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* Área de Mensajes con Scroll Independiente */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                        <div
                            className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-xs ${msg.sender === "user"
                                ? "bg-blue-600 text-white rounded-br-xs"
                                : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs"
                                }`}
                        >
                            {msg.sender === "ai" && (
                                <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-100 text-[10px]">
                                    <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px]">
                                        <FiCpu className="w-2 h-2" />
                                    </div>
                                    <span className="font-bold text-blue-700">Asistente Superadmin</span>
                                    {msg.tags && (
                                        <div className="flex items-center gap-1 ml-auto">
                                            {msg.tags.map((t, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-medium text-[9px]"
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
                                    <p className="text-xs sm:text-sm font-normal leading-relaxed text-white">
                                        {msg.text}
                                    </p>
                                )}
                            </div>

                            <div
                                className={`flex items-center gap-1 text-[9px] mt-1.5 ${msg.sender === "user" ? "justify-end text-blue-200" : "justify-end text-slate-400"
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
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-3.5 py-2.5 shadow-xs flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px]">
                                <FiCpu className="w-2 h-2" />
                            </div>
                            <span className="text-xs text-slate-500 font-medium">Analizando datos de OdontoCloud...</span>
                            <div className="flex gap-1 items-center ml-1">
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Fijo Inferior */}
            <div className="flex-none p-3 bg-white border-t border-slate-200 safe-area-bottom">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                    }}
                    className="flex items-center gap-2"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe tu consulta operativa..."
                        className="flex-1 bg-slate-50 text-slate-900 placeholder:text-slate-400 text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        disabled={isThinking}
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isThinking}
                        className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-xs disabled:opacity-40 disabled:active:scale-100 transition-all"
                    >
                        <FiSend className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
