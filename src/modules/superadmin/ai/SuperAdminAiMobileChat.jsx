import React, { useState, useRef, useEffect } from "react";
import { FiSend, FiArrowLeft, FiCpu, FiClock, FiShield, FiRefreshCw } from "react-icons/fi";
import { MOBILE_CHIPS, getMockAiResponse } from "./mockAiData";

export default function SuperAdminAiMobileChat({ onBack }) {
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
        }, 550);
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
                <p key={idx} className={line.trim() === "" ? "h-2" : "leading-relaxed text-xs sm:text-sm"}>
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

    return (
        <div className="fixed inset-0 z-50 flex flex-col h-full w-full max-w-full bg-slate-100 text-slate-900 overflow-hidden select-none">
            {/* Header Chat-First Nativo Móvil */}
            <header className="flex-none bg-white border-b border-slate-200 px-3 py-2.5 shadow-xs z-20">
                <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors active:scale-95 shrink-0"
                                title="Volver al panel"
                                aria-label="Volver"
                            >
                                <FiArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                                <FiCpu className="w-4 h-4" />
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h1 className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight leading-none truncate">
                                OdontoCloud Colombia
                            </h1>
                            <span className="text-[11px] font-semibold text-blue-600 mt-0.5 leading-none truncate">
                                Asistente IA Superadmin
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-tight whitespace-nowrap">
                            <FiShield className="w-2.5 h-2.5" />
                            Solo superadministrador
                        </span>
                        <button
                            onClick={handleClearChat}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                            title="Reiniciar chat"
                        >
                            <FiRefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Sub-banner indicador de estado MOCK */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 font-bold text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Modo MOCK — No conectado a producción
                    </span>
                    <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[9px]">Simulado</span>
                </div>
            </header>

            {/* Chips Horizontales Fijos de Acceso Rápido */}
            <div className="flex-none bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/80 px-3 py-2 z-10 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1.5 min-w-max">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        Atajos:
                    </span>
                    {MOBILE_CHIPS.map((chip) => (
                        <button
                            key={chip.id}
                            onClick={() => handleSendMessage(chip.prompt)}
                            disabled={isThinking}
                            className="px-3 py-1 bg-white hover:bg-blue-50 active:bg-blue-100 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 rounded-full text-xs font-medium shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <span>{chip.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Área de Mensajes con Scroll */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                        <div
                            className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs ${msg.sender === "user"
                                ? "bg-blue-600 text-white rounded-br-xs"
                                : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs"
                                }`}
                        >
                            {msg.sender === "ai" && (
                                <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-100">
                                    <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">
                                        <FiCpu className="w-2 h-2" />
                                    </div>
                                    <span className="text-[10px] font-bold text-blue-700 tracking-tight">
                                        Asistente IA Superadmin
                                    </span>
                                    {msg.tags && msg.tags.length > 0 && (
                                        <div className="flex items-center gap-1 ml-auto">
                                            {msg.tags.slice(0, 2).map((tag, tIdx) => (
                                                <span
                                                    key={tIdx}
                                                    className="text-[8px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-medium"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1">
                                {msg.sender === "ai" ? renderFormattedText(msg.text) : (
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
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-3.5 py-2 shadow-xs flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">
                                <FiCpu className="w-2 h-2" />
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

            {/* Input Fijo Inferior */}
            <div className="flex-none bg-white border-t border-slate-200 p-2.5 shadow-md z-20">
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
                        placeholder="Consulta clínicas, factus, servidor..."
                        className="flex-1 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm px-3.5 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-inner"
                        disabled={isThinking}
                    />

                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isThinking}
                        className="flex-none w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-sm disabled:opacity-40 disabled:hover:bg-blue-600 disabled:active:scale-100 transition-all cursor-pointer"
                        aria-label="Enviar mensaje"
                    >
                        <FiSend className="w-4 h-4" />
                    </button>
                </form>
                <div className="text-center mt-1">
                    <span className="text-[9px] text-amber-700 font-semibold block">
                        Modo MOCK — No conectado a producción • Información demostrativa
                    </span>
                </div>
            </div>
        </div>
    );
}
