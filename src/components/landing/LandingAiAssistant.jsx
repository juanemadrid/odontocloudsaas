import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiMessageSquare, FiX, FiSend, FiRefreshCw, FiMinimize2, 
    FiCheckCircle, FiArrowRight, FiZap, FiExternalLink
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { FaWhatsapp } from 'react-icons/fa';
import { askHelp } from '../../services/helpAssistantService';

const SUGGESTED_QUESTIONS = [
    { label: "💳 Planes y Precios", q: "¿Cuáles son los planes de suscripción y precios de OdontoCloud?" },
    { label: "🚀 Prueba Gratis 30 Días", q: "¿Cómo funciona la prueba gratuita de 30 días?" },
    { label: "🧾 Facturación DIAN y RIPS", q: "¿Tienen facturación electrónica DIAN y RIPS en Colombia?" },
    { label: "🦷 Historia Clínica y Odontograma", q: "¿Qué incluye la historia clínica y el odontograma digital?" },
    { label: "💬 Hablar con Asesor Humano", q: "Quiero hablar con un asesor comercial por WhatsApp" },
];

function MessageContent({ text, onOpenTrial, whatsappNumber }) {
    if (!text) return null;

    const lower = text.toLowerCase();
    const showsTrialAction = lower.includes("prueba") || lower.includes("plan clínica") || lower.includes("activar tu acceso") || lower.includes("solicitar demostración");
    const showsWhatsappAction = lower.includes("whatsapp") || lower.includes("asesor") || lower.includes("humano") || lower.includes("contacto");

    const lines = text.split("\n");

    return (
        <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-1" />;

                // Títulos en negrita (ej: **Título:**)
                if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
                    const cleanTitle = trimmed.replace(/\*\*/g, "");
                    return (
                        <div key={idx} className="font-bold text-slate-900 text-xs sm:text-sm pt-1 pb-0.5 flex items-center gap-1.5 text-blue-900">
                            <HiSparkles className="text-cyan-600 shrink-0" size={13} />
                            <span>{cleanTitle}</span>
                        </div>
                    );
                }

                // Pasos o viñetas numeradas (1. paso)
                const stepMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
                if (stepMatch) {
                    const stepNum = stepMatch[1];
                    const stepContent = stepMatch[2];
                    return (
                        <div key={idx} className="flex items-start gap-2 pt-0.5">
                            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                                {stepNum}
                            </span>
                            <span className="flex-1 text-slate-700">{formatInlineBold(stepContent)}</span>
                        </div>
                    );
                }

                // Viñetas con viñeta (• o -)
                if (trimmed.startsWith("•") || (trimmed.startsWith("- ") && !trimmed.startsWith("---"))) {
                    const bulletContent = trimmed.replace(/^[•\-]\s*/, "");
                    return (
                        <div key={idx} className="flex items-start gap-2 pt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                            <span className="flex-1 text-slate-700">{formatInlineBold(bulletContent)}</span>
                        </div>
                    );
                }

                return (
                    <p key={idx} className="text-slate-700 m-0">
                        {formatInlineBold(trimmed)}
                    </p>
                );
            })}

            {/* Botones de Acción Contextuales Integrados en la Respuesta */}
            {(showsTrialAction || showsWhatsappAction) && (
                <div className="pt-2 mt-2 border-t border-slate-100 flex flex-wrap gap-2">
                    {showsTrialAction && (
                        <button
                            type="button"
                            onClick={onOpenTrial}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-bold text-[11px] shadow-sm hover:shadow transition-all cursor-pointer"
                        >
                            <FiZap size={12} className="text-amber-300" />
                            <span>Comenzar Prueba Gratis (30 Días)</span>
                            <FiArrowRight size={11} />
                        </button>
                    )}
                    {showsWhatsappAction && (
                        <a
                            href={`https://wa.me/57${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent("Hola, estuve hablando con el asistente virtual de OdontoCloud y quisiera asesoría personalizada con un asesor humano.")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-lg font-bold text-[11px] shadow-sm hover:shadow transition-all"
                        >
                            <FaWhatsapp size={13} />
                            <span>Chatear por WhatsApp</span>
                            <FiExternalLink size={11} />
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function formatInlineBold(str) {
    if (!str.includes("**")) return str;
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
            return <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>;
        }
        return p;
    });
}

export default function LandingAiAssistant({ config }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            sender: 'bot',
            text: `¡Hola! 👋 Soy **OdontoIA**, tu asistente inteligente de **OdontoCloud Colombia**.\n\nPuedo orientarte sobre planes, precios, facturación electrónica DIAN, RIPS oficiales o cómo iniciar tu prueba gratuita de 30 días sin costo.\n\n¿En qué te puedo asesorar hoy?`,
            sources: []
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const whatsappNumber = (config?.contactPhone || "3015768935").replace(/\D/g, '');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) {
            scrollToBottom();
        }
    }, [messages, isOpen, isMinimized, loading]);

    const handleSend = async (queryText) => {
        const text = (queryText || inputText).trim();
        if (!text || loading) return;

        const userMsg = { id: `user-${Date.now()}`, sender: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            // Previous guide ids for conversation context
            const previousIds = messages
                .filter(m => m.sender === 'bot' && m.sources?.length)
                .flatMap(m => m.sources.map(s => s.id))
                .slice(-3);

            const response = await askHelp(text, previousIds, { mode: 'public' });
            
            const botMsg = {
                id: `bot-${Date.now()}`,
                sender: 'bot',
                text: response?.answer || "Disculpa, no pude procesar tu solicitud en este momento. Si deseas atención inmediata, puedes contactarnos por WhatsApp.",
                sources: response?.sources || []
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            console.error("Error en asistente landing:", err);
            setMessages(prev => [
                ...prev,
                {
                    id: `bot-err-${Date.now()}`,
                    sender: 'bot',
                    text: "Hubo un inconveniente al conectar con el asistente. Si deseas, puedes escribirnos directamente a WhatsApp para atenderte de inmediato.",
                    sources: []
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenTrial = () => {
        window.dispatchEvent(new CustomEvent('open-trial-modal'));
        setIsMinimized(true);
    };

    const handleReset = () => {
        setMessages([
            {
                id: `welcome-${Date.now()}`,
                sender: 'bot',
                text: `¡Conversación reiniciada! 👋 ¿En qué más te puedo ayudar sobre OdontoCloud?`,
                sources: []
            }
        ]);
    };

    return (
        <div
            className={`fixed z-[95] font-sans transition-all duration-300 ${
                isOpen && !isMinimized
                    ? "inset-2 sm:inset-auto sm:bottom-6 sm:right-6 flex flex-col justify-end items-end"
                    : "bottom-4 right-4 sm:bottom-6 sm:right-6"
            }`}
        >
            {/* Backdrop en móviles para enfocar 100% la atención en el chat */}
            <AnimatePresence>
                {isOpen && !isMinimized && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] sm:hidden -z-10"
                    />
                )}
            </AnimatePresence>

            {/* Ventana de Chat Expandida (En móviles ocupa casi toda la pantalla) */}
            <AnimatePresence>
                {isOpen && !isMinimized && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.97 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="w-full h-full max-h-[100dvh] sm:w-[430px] sm:h-[620px] sm:max-h-[calc(100vh-5.5rem)] bg-white rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_rgba(2,42,99,0.35)] border border-slate-200/90 flex flex-col overflow-hidden sm:mb-3"
                    >
                        {/* Header Premium */}
                        <div className="bg-gradient-to-r from-[#022a63] via-[#034199] to-[#0284c7] px-4 py-3 sm:px-5 sm:py-4 text-white flex items-center justify-between shadow-md shrink-0">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className="relative">
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
                                        <HiSparkles size={20} className="text-cyan-300 animate-pulse" />
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#022a63] rounded-full"></span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white m-0">OdontoIA</h3>
                                        <span className="px-1.5 py-0.5 bg-cyan-400/20 text-cyan-200 font-bold text-[9px] rounded uppercase tracking-wider border border-cyan-300/30">Oficial</span>
                                    </div>
                                    <p className="text-[11px] text-cyan-100/90 font-medium m-0 flex items-center gap-1">
                                        <span>Asesor inteligente y soporte en vivo</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-0.5 sm:gap-1 text-white/80">
                                <button
                                    onClick={handleReset}
                                    title="Reiniciar chat"
                                    className="p-2 sm:p-1.5 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                                >
                                    <FiRefreshCw size={15} />
                                </button>
                                <button
                                    onClick={() => setIsMinimized(true)}
                                    title="Minimizar"
                                    className="p-2 sm:p-1.5 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                                >
                                    <FiMinimize2 size={16} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    title="Cerrar asistente"
                                    className="p-2 sm:p-1.5 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                                >
                                    <FiX size={19} />
                                </button>
                            </div>
                        </div>

                        {/* Banner con enlace rápido de WhatsApp */}
                        <div className="bg-slate-50 border-b border-slate-100 px-3.5 py-2 sm:px-4 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
                            <span className="flex items-center gap-1 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                ¿Prefieres hablar con un humano?
                            </span>
                            <a
                                href={`https://wa.me/57${whatsappNumber}?text=${encodeURIComponent("Hola, me gustaría hablar con un asesor comercial de OdontoCloud.")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-[#1ea952] hover:text-[#168740] flex items-center gap-1 transition-colors"
                            >
                                <FaWhatsapp size={13} />
                                <span>WhatsApp</span>
                            </a>
                        </div>

                        {/* Cuerpo de Mensajes */}
                        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-gradient-to-b from-slate-50/50 via-white to-white scrollbar-thin scrollbar-thumb-slate-200">
                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                                >
                                    <div
                                        className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3 sm:p-3.5 ${
                                            msg.sender === 'user'
                                                ? 'bg-blue-600 text-white rounded-br-xs shadow-sm font-medium text-xs sm:text-[13px]'
                                                : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                                        }`}
                                    >
                                        {msg.sender === 'user' ? (
                                            <p className="m-0 leading-relaxed">{msg.text}</p>
                                        ) : (
                                            <MessageContent
                                                text={msg.text}
                                                onOpenTrial={handleOpenTrial}
                                                whatsappNumber={whatsappNumber}
                                            />
                                        )}
                                    </div>

                                    {/* Guías oficiales citadas como fuente de autoridad */}
                                    {msg.sender === 'bot' && msg.sources && msg.sources.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1 pl-1">
                                            {msg.sources.map(src => (
                                                <span
                                                    key={src.id}
                                                    className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded-full font-medium"
                                                >
                                                    <FiCheckCircle size={10} className="text-emerald-500" />
                                                    <span>{src.title}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div className="flex items-start gap-2">
                                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3.5 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                                            </div>
                                            <span className="text-[11px] font-medium text-slate-400">Consultando documentación oficial...</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Sugerencias Rápidas Iniciales (Chips) */}
                            {messages.length === 1 && (
                                <div className="pt-2">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preguntas frecuentes:</p>
                                    <div className="flex flex-col gap-1.5">
                                        {SUGGESTED_QUESTIONS.map((sug, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSend(sug.q)}
                                                className="text-left text-xs bg-white hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300 rounded-xl px-3 py-2 text-slate-700 hover:text-blue-900 transition-all font-medium flex items-center justify-between group shadow-2xs cursor-pointer"
                                            >
                                                <span>{sug.label}</span>
                                                <FiArrowRight size={12} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Footer */}
                        <div className="p-2.5 sm:p-3 bg-white border-t border-slate-200/80 shrink-0">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSend();
                                }}
                                className="flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Pregunta sobre planes, DIAN, RIPS o funciones..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all font-medium"
                                    disabled={loading}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim() || loading}
                                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 shadow-sm transition-all cursor-pointer"
                                    title="Enviar pregunta"
                                >
                                    <FiSend size={15} />
                                </button>
                            </form>
                            <div className="mt-1.5 flex items-center justify-between px-1">
                                <span className="text-[10px] text-slate-400 font-medium">OdontoIA • Certificado para Odontología</span>
                                <button
                                    type="button"
                                    onClick={handleOpenTrial}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                                >
                                    Prueba 30 días gratis →
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Botón Flotante Principal (Trigger) */}
            <div className={`items-center gap-2 ${isOpen && !isMinimized ? 'hidden sm:flex' : 'flex'}`}>
                {/* Tooltip de sugerencia cuando está cerrado */}
                {!isOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1 }}
                        onClick={() => setIsOpen(true)}
                        className="hidden md:flex items-center gap-2 bg-slate-900/95 backdrop-blur-md text-white text-xs font-semibold py-2 px-3.5 rounded-full shadow-lg border border-white/10 cursor-pointer hover:bg-slate-900 transition-all"
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>OdontoIA • Chatea con nuestro asesor</span>
                    </motion.div>
                )}

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        if (isOpen && isMinimized) {
                            setIsMinimized(false);
                        } else {
                            setIsOpen(!isOpen);
                            setIsMinimized(false);
                        }
                    }}
                    className={`relative p-3.5 sm:p-4 rounded-full shadow-[0_10px_25px_rgba(2,132,199,0.35)] transition-all duration-300 flex items-center justify-center cursor-pointer ${
                        isOpen && !isMinimized
                            ? 'bg-slate-900 text-white'
                            : 'bg-gradient-to-r from-[#0284c7] via-[#022a63] to-[#0284c7] bg-[length:200%_auto] text-white hover:shadow-[0_12px_30px_rgba(2,132,199,0.5)]'
                    }`}
                    title={isOpen ? "Cerrar asistente" : "OdontoIA • Abrir asesor virtual"}
                >
                    {isOpen && !isMinimized ? (
                        <FiX size={24} />
                    ) : (
                        <>
                            <HiSparkles size={24} className="text-cyan-300 animate-pulse" />
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                        </>
                    )}
                </motion.button>
            </div>
        </div>
    );
}
