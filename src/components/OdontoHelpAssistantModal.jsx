import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    FiX, FiSend, FiSearch, FiBookOpen, FiCheckCircle, FiCornerDownRight, 
    FiMessageSquare, FiRefreshCw, FiMinimize2, FiMaximize2, FiHelpCircle, FiChevronRight, FiPlayCircle, FiArrowLeft 
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { screenContextFromLocation } from '../../supabase/functions/_shared/helpConversation.mjs';
import { askHelp } from '../services/helpAssistantService';
import { helpFallbackMessage } from '../../supabase/functions/_shared/helpFeedback.mjs';
import { HELP_GUIDES, formatGuide, normalize, searchGuides } from '../../supabase/functions/_shared/helpKnowledge.mjs';
import { HELP_VIDEO_SERIES, videosDisponibles, videoParaGuias, videoParaPregunta, youtubeEmbedUrl, youtubeThumb, youtubeThumbHd } from '../data/helpVideos';

function FormattedMessage({ text }) {
    if (!text) return null;

    const lines = text.split("\n");

    return (
        <div className="space-y-2 text-xs leading-relaxed">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-1" />;

                // 1. Títulos en negrita (ej: **Título:**)
                if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
                    const cleanTitle = trimmed.replace(/\*\*/g, "");
                    return (
                        <div key={idx} className="font-bold text-slate-900 text-[13px] pt-1.5 pb-1 flex items-center gap-1.5 border-b border-slate-100">
                            <FiCheckCircle className="text-[#8dc63f] shrink-0" size={14} />
                            <span>{cleanTitle}</span>
                        </div>
                    );
                }

                // 1.5 Recordatorio / Requisitos previos "📌 Recuerda antes de empezar"
                if (trimmed.startsWith("📌") || trimmed.includes("Recuerda antes de")) {
                    const parts = trimmed.split(/(\*\*.*?\*\*|\[.*?\]|\`.*?\`)/g);
                    return (
                        <div key={idx} className="p-2.5 my-1.5 bg-amber-50/90 border border-amber-200/90 rounded-lg text-amber-900 text-[11.5px] leading-relaxed flex items-start gap-2 shadow-xs">
                            <span className="text-base shrink-0 leading-none">📌</span>
                            <div className="flex-1">
                                {parts.map((p, pIdx) => {
                                    if (p === "📌" || p === "📌 ") return null;
                                    if (p.startsWith("**") && p.endsWith("**")) {
                                        return <strong key={pIdx} className="font-bold text-amber-950">{p.replace(/\*\*/g, "")} </strong>;
                                    }
                                    if (p.startsWith("[") && p.endsWith("]")) {
                                        return <span key={pIdx} className="px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-md mx-0.5 border border-amber-200">{p.slice(1, -1)}</span>;
                                    }
                                    return <span key={pIdx}>{p}</span>;
                                })}
                            </div>
                        </div>
                    );
                }

                // 2. Pasos numerados (ej: 1. **Paso:** detalle)
                const stepMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
                if (stepMatch) {
                    const stepNum = stepMatch[1];
                    let stepContent = stepMatch[2];

                    const parts = stepContent.split(/(\*\*.*?\*\*|\[.*?\]|\`.*?\`)/g);

                    return (
                        <div key={idx} className="flex items-start gap-2 pt-1 pl-0.5">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                {stepNum}
                            </span>
                            <div className="flex-1 text-slate-700 leading-normal">
                                {parts.map((p, pIdx) => {
                                    if (p.startsWith("**") && p.endsWith("**")) {
                                        return <strong key={pIdx} className="font-bold text-slate-900">{p.replace(/\*\*/g, "")} </strong>;
                                    }
                                    if (p.startsWith("[") && p.endsWith("]")) {
                                        return <span key={pIdx} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md mx-0.5 border border-blue-100/60">{p.slice(1, -1)}</span>;
                                    }
                                    if (p.startsWith("`") && p.endsWith("`")) {
                                        return <code key={pIdx} className="px-1 py-0.5 bg-slate-100 text-slate-800 font-mono rounded text-[11px]">{p.slice(1, -1)}</code>;
                                    }
                                    return <span key={pIdx}>{p}</span>;
                                })}
                            </div>
                        </div>
                    );
                }

                // 3. Viñetas (ej: - Subpaso)
                if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                    const bulletContent = trimmed.substring(2);
                    const parts = bulletContent.split(/(\*\*.*?\*\*|\[.*?\]|\`.*?\`)/g);

                    return (
                        <div key={idx} className="flex items-start gap-2 pl-6 pt-0.5">
                            <FiCornerDownRight className="text-slate-400 shrink-0 mt-1" size={11} />
                            <div className="flex-1 text-slate-600">
                                {parts.map((p, pIdx) => {
                                    if (p.startsWith("**") && p.endsWith("**")) {
                                        return <strong key={pIdx} className="font-semibold text-slate-800">{p.replace(/\*\*/g, "")} </strong>;
                                    }
                                    if (p.startsWith("[") && p.endsWith("]")) {
                                        return <span key={pIdx} className="px-1.5 py-0.5 bg-slate-100 text-slate-800 font-bold rounded-md mx-0.5">{p.slice(1, -1)}</span>;
                                    }
                                    return <span key={pIdx}>{p}</span>;
                                })}
                            </div>
                        </div>
                    );
                }

                // 4. Texto estándar con negritas
                const parts = trimmed.split(/(\*\*.*?\*\*|\[.*?\]|\`.*?\`)/g);
                return (
                    <p key={idx} className="text-slate-700">
                        {parts.map((p, pIdx) => {
                            if (p.startsWith("**") && p.endsWith("**")) {
                                return <strong key={pIdx} className="font-bold text-slate-900">{p.replace(/\*\*/g, "")}</strong>;
                            }
                            if (p.startsWith("[") && p.endsWith("]")) {
                                return <span key={pIdx} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md">{p.slice(1, -1)}</span>;
                            }
                            return <span key={pIdx}>{p}</span>;
                        })}
                    </p>
                );
            })}
        </div>
    );
}

export default function OdontoHelpAssistantModal({ isOpen, onClose }) {
    const { user, userProfile } = useAuth();
    if (!isOpen) return null;
    return <HelpPanel key={String(user?.id) + ':' + String(userProfile?.tenant_id || userProfile?.inquilino)} onClose={onClose} />;
}

function HelpPanel({ onClose }) {
    const welcome = { 
        sender: 'bot', 
        text: 'Soy OdontoIA. ¿Qué necesitas hacer en OdontoCloud? No escribas nombres, documentos ni datos de pacientes.',
        sources: [] 
    };
    
    const [messages, setMessages] = useState([welcome]);
    const [input, setInput] = useState('');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('Todos');
    const [isTyping, setIsTyping] = useState(false);
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'library' | 'videos'
    const [videoActual, setVideoActual] = useState(null);
    const videos = videosDisponibles();
    const [isMinimized, setIsMinimized] = useState(false);
    const [previousIds, setPreviousIds] = useState([]);
    
    const pending = useRef(false);
    const activeRequest = useRef(null);
    useEffect(() => () => { generation.current += 1; activeRequest.current?.abort(); }, []);
    const generation = useRef(0);
    const endRef = useRef(null);
    const inputRef = useRef(null);
    const searchRef = useRef(null);
    const dialogRef = useRef(null);
    const shouldScrollToTop = useRef(null);
    
    const categories = ['Todos', ...new Set(HELP_GUIDES.map(g => g.category))];
    const matches = search.trim() ? searchGuides(search) : HELP_GUIDES;
    const visibleGuides = HELP_GUIDES.filter(g => (category === 'Todos' || g.category === category) &&
        (!search.trim() || matches.some(m => m.id === g.id) || normalize(g.title).includes(normalize(search))));

    useEffect(() => {
        if (!isMinimized && activeTab === 'chat') {
            inputRef.current?.focus();
        } else if (!isMinimized && activeTab === 'library') {
            searchRef.current?.focus();
        }
    }, [activeTab, isMinimized]);

    useEffect(() => { 
        if (activeTab === 'chat') {
            if (shouldScrollToTop.current) {
                const targetId = shouldScrollToTop.current;
                shouldScrollToTop.current = null;
                setTimeout(() => {
                    const el = document.getElementById(targetId);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 50);
            } else {
                endRef.current?.scrollIntoView({ behavior: 'smooth' }); 
            }
        }
    }, [messages, isTyping, activeTab]);

    const reset = () => {
        generation.current += 1; activeRequest.current?.abort();
        pending.current = false;
        setIsTyping(false);
        setMessages([welcome]);
        setPreviousIds([]);
        setInput('');
        setActiveTab('chat');
        inputRef.current?.focus();
    };

    const abrirVideo = video => setVideoActual(video);
    const reproductor = videoActual
        ? <VideoFlotante video={videoActual} onClose={() => setVideoActual(null)} />
        : null;

    const showGuide = guide => {
        generation.current += 1; activeRequest.current?.abort();
        pending.current = false;
        setIsTyping(false);
        const guideMsgId = 'guide-' + Date.now();
        setMessages(prev => [
            ...prev, 
            { id: guideMsgId, sender: 'bot', text: formatGuide(guide), provider: 'manual', sources: [], video: videoParaGuias([guide.id]) }
        ]);
        setPreviousIds([guide.id]);
        shouldScrollToTop.current = guideMsgId;
        setActiveTab('chat');
        inputRef.current?.focus();
    };

function detectScreenContext() {
    return screenContextFromLocation(window.location.pathname, window.location.search);
}

    const handleSend = async (customQuery = null) => {
        const question = (typeof customQuery === 'string' ? customQuery : input).trim();
        if (!question || pending.current) return;
        pending.current = true;
        const requestId = ++generation.current;
        setMessages(prev => [...prev, { sender: 'user', text: question }]);
        setInput('');
        setActiveTab('chat');
        setIsTyping(true);
        const controller = new AbortController();
        activeRequest.current = controller;
        const replyId = 'reply-' + requestId;
        setMessages(prev => [...prev, { id: replyId, sender: 'bot', text: '', provider: 'ollama', pending: true, sources: [] }]);
        const screenContext = detectScreenContext();
        const result = await askHelp(question, previousIds, {
            history: messages.slice(1).filter(m => !m.pending),
            signal: controller.signal,
            screenContext,
            onUpdate: text => { if (requestId === generation.current) setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text } : m)); },
        });
        if (requestId !== generation.current) return;
        const sources = (result.sources || []).filter(s => s && HELP_GUIDES.some(g => g.id === s.id));
        const video = (result.reason === 'cancelled' || result.reason === 'conversation') ? null : (videoParaGuias(sources.map(s => s.id)) || videoParaPregunta(question));
        setMessages(prev => prev.map(m => m.id === replyId ? { sender: 'bot', text: result.answer, provider: result.provider, model: result.model, reason: result.reason, diagnostic: result.diagnostic, sources, video } : m));
        if (sources.length && result.reason !== 'conversation' && result.reason !== 'cancelled') setPreviousIds(sources.map(s => s.id));
        pending.current = false;
        setIsTyping(false);
        inputRef.current?.focus();
    };

    const handleKeys = event => {
        if (event.key === 'Escape') { 
            event.stopPropagation(); 
            setIsMinimized(true);
        }
    };

    // Si está minimizado, mostrar píldora flotante compacta en la esquina inferior derecha
    if (isMinimized) {
        return (
            <>
            {reproductor}
            <div 
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-4 right-4 z-[999] bg-slate-900 text-white pl-4 pr-3 py-2.5 rounded-full shadow-2xl border border-slate-700/80 flex items-center gap-3 cursor-pointer hover:bg-slate-800 transition-all animate-in slide-in-from-bottom-2 select-none"
                style={{ boxShadow: '0 12px 35px -5px rgba(15, 23, 42, 0.4)' }}
            >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide">
                    <FiHelpCircle className="text-emerald-400" size={15} />
                    <span>Ayuda OdontoCloud</span>
                </div>
                <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
                    <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                        className="p-1 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                        title="Ver ventana de ayuda"
                    >
                        <FiMaximize2 size={13} />
                    </button>
                    <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-1 rounded-md hover:bg-white/10 text-slate-300 hover:text-rose-400 transition-colors"
                        title="Cerrar ayuda"
                    >
                        <FiX size={15} />
                    </button>
                </div>
            </div>
            </>
        );
    }

    // Ventana interactiva flotante (sin bloquear la pantalla de fondo)
    return (
        <>
        {reproductor}
        <aside
            ref={dialogRef}
            role="complementary"
            aria-label="Chat con OdontoIA"
            onKeyDown={handleKeys}
            className="fixed bottom-4 right-4 z-[999] w-[450px] max-w-[calc(100vw-1.5rem)] h-[620px] max-h-[calc(100dvh-4.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 font-sans"
            style={{ boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(15, 23, 42, 0.08)' }}
        >
            {/* Header del Asistente */}
            <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <FiHelpCircle size={17} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-emerald-300 text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Asistente virtual
                        </div>
                        <h2 id="help-title" className="text-xs sm:text-sm font-bold truncate text-white leading-tight">
                            OdontoIA
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={reset}
                        title="Nueva conversación"
                        aria-label="Nueva conversación"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                        <FiRefreshCw size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsMinimized(true)}
                        title="Minimizar (para ver toda la pantalla)"
                        aria-label="Minimizar"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                        <FiMinimize2 size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Cerrar ayuda"
                        aria-label="Cerrar ayuda"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                        <FiX size={17} />
                    </button>
                </div>
            </header>

            {/* Pestañas de Navegación: Chat Paso a Paso vs Biblioteca */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 py-1.5 gap-2 shrink-0">
                <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeTab === 'chat'
                            ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <FiMessageSquare size={13} />
                    <span>Paso a Paso (Chat)</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('library')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeTab === 'library'
                            ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <FiBookOpen size={13} />
                    <span>Biblioteca ({HELP_GUIDES.length})</span>
                </button>
                {videos.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('videos')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'videos'
                                ? 'bg-white text-blue-600 shadow-xs border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <FiPlayCircle size={13} />
                        <span>Videos ({videos.length})</span>
                    </button>
                )}
            </div>

            {/* Contenido: Tab Chat Paso a Paso */}
            {activeTab === 'chat' && (
                <div className="flex flex-col flex-1 min-h-0 bg-white">
                    {/* Mensajes del chat */}
                    <div role="log" aria-live="polite" className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/70">
                        {messages.map((message, index) => (
                            <div 
                                key={message.id || index}
                                id={message.id}
                                className={message.sender === 'user' 
                                    ? 'ml-auto max-w-[88%] bg-blue-600 text-white rounded-2xl rounded-br-xs p-3 text-xs shadow-xs' 
                                    : 'mr-auto max-w-[94%] bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs p-3.5 shadow-2xs text-slate-700'
                                }
                            >
                                {message.sender === 'user' ? (
                                    <div className="font-medium whitespace-pre-wrap break-words">{message.text}</div>
                                ) : (
                                    <>
                                        <div className="mb-1.5 text-[11px] font-semibold text-teal-700">
                                            {message.pending ? 'OdontoIA está escribiendo…' : 'OdontoIA'}
                                        </div>
                                        {helpFallbackMessage(message) && (
                                            <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 mb-2 border border-amber-200">
                                                {helpFallbackMessage(message)}
                                            </p>
                                        )}
                                        <FormattedMessage text={message.text || (message.pending ? "Revisando tu pregunta…" : "")} />
                                        {message.video && !message.pending && (
                                            <button
                                                type="button"
                                                onClick={() => abrirVideo(message.video)}
                                                className="mt-3 w-full flex items-center gap-2.5 p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-100 text-left transition-colors cursor-pointer"
                                            >
                                                <img src={youtubeThumb(message.video.youtube)} alt="" className="w-16 h-9 rounded-md object-cover shrink-0" loading="lazy" />
                                                <span className="min-w-0">
                                                    <span className="flex items-center gap-1 text-[11px] font-extrabold text-rose-700"><FiPlayCircle size={13} /> Ver video</span>
                                                    <span className="block text-[11px] font-semibold text-slate-700 truncate">{message.video.serie} {message.video.orden} · {message.video.titulo}</span>
                                                </span>
                                            </button>
                                        )}
                                        {message.sources?.length > 0 && (
                                            <div className="mt-3 pt-2 border-t border-slate-200/70">
                                                <p className="text-[10px] font-bold text-slate-400 mb-1">Guías relacionadas:</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {message.sources.map(source => (
                                                        <button 
                                                            type="button" 
                                                            key={source.id} 
                                                            onClick={() => showGuide(HELP_GUIDES.find(g => g.id === source.id))} 
                                                            className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors cursor-pointer border border-blue-100"
                                                        >
                                                            {source.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                        {isTyping && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl max-w-[80%] flex items-center gap-2 text-xs text-slate-500 animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                                <span>Preparando la respuesta…</span><button type="button" className="ml-auto font-semibold text-blue-700" onClick={() => activeRequest.current?.abort()}>Detener</button>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* Input para preguntar */}
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="border-t border-slate-200 p-3 bg-slate-50 shrink-0">
                        <div className="flex gap-2">
                            <input 
                                ref={inputRef} 
                                aria-label="Pregunta sobre OdontoCloud" 
                                maxLength={1200} 
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                placeholder="Ej: ¿Cómo crear un recibo de caja?" 
                                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs font-medium" 
                            />
                            <button 
                                type="submit" 
                                aria-label="Enviar pregunta" 
                                disabled={isTyping || !input.trim()} 
                                className="bg-blue-600 text-white rounded-xl px-3.5 py-2 disabled:opacity-40 hover:bg-blue-700 transition-colors shadow-xs cursor-pointer flex items-center justify-center shrink-0"
                            >
                                <FiSend size={13} />
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                            <span>Puede equivocarse. Consulta las guías y evita incluir datos de pacientes.</span>
                        </p>
                    </form>
                </div>
            )}

            {/* Contenido: Tab Biblioteca de Guías */}
            {activeTab === 'library' && (
                <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
                    <div className="p-3 border-b border-slate-200 bg-white shrink-0">
                        <div className="flex gap-2 items-center">
                            <div className="relative flex-1">
                                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                <input 
                                    ref={searchRef} 
                                    aria-label="Buscar guía" 
                                    value={search} 
                                    onChange={e => setSearch(e.target.value)} 
                                    placeholder={`Buscar entre las ${HELP_GUIDES.length} guías...`} 
                                    className="w-full h-8.5 pl-8 pr-7 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:border-blue-500 transition-all font-medium placeholder:text-slate-400" 
                                />
                                {search && (
                                    <button 
                                        type="button" 
                                        onClick={() => setSearch('')} 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                        title="Limpiar búsqueda"
                                    >
                                        <FiX size={12} />
                                    </button>
                                )}
                            </div>
                            <div className="relative shrink-0">
                                <select 
                                    value={category} 
                                    onChange={e => setCategory(e.target.value)} 
                                    aria-label="Filtrar por categoría"
                                    className="h-8.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 cursor-pointer transition-all shadow-2xs"
                                >
                                    {categories.map(c => (
                                        <option key={c} value={c}>
                                            {c === 'Todos' ? `Todas (${HELP_GUIDES.length})` : c}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto p-2.5 flex-1 divide-y divide-slate-100">
                        {visibleGuides.map(g => (
                            <button 
                                type="button" 
                                key={g.id} 
                                onClick={() => showGuide(g)} 
                                className="w-full text-left p-2.5 rounded-xl hover:bg-white hover:shadow-xs transition-all flex items-center justify-between group cursor-pointer"
                            >
                                <div className="min-w-0 pr-2">
                                    <span className="block text-[9px] uppercase tracking-wider font-extrabold text-blue-600">{g.category}</span>
                                    <span className="block text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors mt-0.5 truncate">{g.title}</span>
                                </div>
                                <FiChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors shrink-0" />
                            </button>
                        ))}
                        {!visibleGuides.length && (
                            <p className="p-6 text-center text-xs text-slate-400 italic">
                                No se encontraron guías con ese criterio. Prueba otra palabra o selecciona Todos.
                            </p>
                        )}
                    </div>
                </div>
            )}
            {/* Contenido: Tab Videos tutoriales (el video se abre en una ventana flotante) */}
            {activeTab === 'videos' && (
                <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
                    <p className="px-3 pt-2.5 text-[10px] text-slate-500">Toca un video: se abre en una ventana flotante que puedes mover y agrandar.</p>
                    <ListaVideos videos={videos} actual={videoActual} onSelect={abrirVideo} />
                </div>
            )}
        </aside>
        </>
    );
}

const TAMANOS = [
    { id: 'S', label: 'Pequeño', w: 420 },
    { id: 'M', label: 'Mediano', w: 720 },
    { id: 'L', label: 'Grande', w: 1040 },
];
const BARRA = 44;

// Reproductor flotante: se mueve arrastrando la barra y se agranda con la esquina inferior derecha o con los botones de tamaño.
function VideoFlotante({ video, onClose }) {
    const limitar = (x, y, w) => {
        const h = Math.round(w * 9 / 16) + BARRA;
        return {
            x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)),
            y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8)),
        };
    };
    const anchoInicial = Math.min(720, window.innerWidth - 16);
    const [w, setW] = useState(anchoInicial);
    const [pos, setPos] = useState(() => limitar(window.innerWidth - anchoInicial - 480, 80, anchoInicial));
    const [cargando, setCargando] = useState(true);
    const [moviendo, setMoviendo] = useState(false);
    const accion = useRef(null);

    useEffect(() => { setCargando(true); }, [video.id]);
    useEffect(() => {
        const alCambiar = () => setPos(p => limitar(p.x, p.y, Math.min(w, window.innerWidth - 16)));
        window.addEventListener('resize', alCambiar);
        return () => window.removeEventListener('resize', alCambiar);
    }, [w]);
    useEffect(() => {
        const tecla = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [onClose]);

    const empezar = (tipo) => (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        accion.current = { tipo, x0: e.clientX, y0: e.clientY, pos0: pos, w0: w };
        setMoviendo(true);
    };
    const mover = (e) => {
        const a = accion.current;
        if (!a) return;
        if (a.tipo === 'mover') {
            setPos(limitar(a.pos0.x + e.clientX - a.x0, a.pos0.y + e.clientY - a.y0, w));
        } else {
            const maxW = Math.min(window.innerWidth - a.pos0.x - 8, (window.innerHeight - a.pos0.y - BARRA - 8) * 16 / 9);
            setW(Math.round(Math.min(Math.max(320, a.w0 + e.clientX - a.x0), maxW)));
        }
    };
    const terminar = () => { accion.current = null; setMoviendo(false); };

    const elegirTamano = (ancho) => {
        const nuevo = Math.min(ancho, window.innerWidth - 16, (window.innerHeight - BARRA - 16) * 16 / 9);
        setW(Math.round(nuevo));
        setPos(p => limitar(p.x, p.y, nuevo));
    };

    const alto = Math.round(w * 9 / 16);
    return createPortal(
        <div
            role="dialog"
            aria-label={`Video: ${video.titulo}`}
            className="fixed z-[1000] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden select-none"
            style={{ left: pos.x, top: pos.y, width: w, boxShadow: '0 25px 60px -10px rgba(15, 23, 42, 0.55)' }}
        >
            <div
                onPointerDown={empezar('mover')}
                onPointerMove={mover}
                onPointerUp={terminar}
                onPointerCancel={terminar}
                className="flex items-center gap-2 px-3 text-white cursor-move touch-none"
                style={{ height: BARRA }}
                title="Arrastra para mover"
            >
                <FiPlayCircle className="text-rose-400 shrink-0" size={15} />
                <div className="min-w-0 flex-1">
                    <span className="block text-[9px] uppercase tracking-wider font-extrabold text-rose-300 leading-tight">{video.serie} · Video {video.orden}</span>
                    <span className="block text-xs font-bold truncate leading-tight">{video.titulo}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0" onPointerDown={e => e.stopPropagation()}>
                    {TAMANOS.map(t => (
                        <button key={t.id} type="button" onClick={() => elegirTamano(t.w)} title={t.label}
                            className="w-7 h-7 rounded-lg text-[10px] font-extrabold text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer">
                            {t.id}
                        </button>
                    ))}
                    <button type="button" onClick={onClose} title="Cerrar video" aria-label="Cerrar video"
                        className="w-7 h-7 rounded-lg text-slate-300 hover:bg-white/10 hover:text-rose-400 flex items-center justify-center cursor-pointer">
                        <FiX size={16} />
                    </button>
                </div>
            </div>
            <div className="relative bg-black" style={{ height: alto }}>
                {cargando && (
                    <div className="absolute inset-0 flex items-center justify-center bg-cover bg-center"
                        style={{ backgroundImage: `url(${youtubeThumbHd(video.youtube)})` }}>
                        <div className="absolute inset-0 bg-slate-900/40" />
                        <div className="relative flex flex-col items-center gap-2 text-white">
                            <div className="w-10 h-10 border-4 border-white/80 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[11px] font-bold drop-shadow">Cargando video…</span>
                        </div>
                    </div>
                )}
                <iframe
                    key={video.id}
                    src={youtubeEmbedUrl(video.youtube)}
                    title={video.titulo}
                    onLoad={() => setCargando(false)}
                    className="absolute inset-0 w-full h-full"
                    style={{ opacity: cargando ? 0 : 1, transition: 'opacity .2s' }}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                />
                {/* Mientras se arrastra, una capa evita que el video "robe" el mouse */}
                {moviendo && <div className="absolute inset-0" />}
                <div
                    onPointerDown={empezar('tamano')}
                    onPointerMove={mover}
                    onPointerUp={terminar}
                    onPointerCancel={terminar}
                    className="absolute right-0 bottom-0 w-5 h-5 cursor-nwse-resize touch-none"
                    style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,.55) 50%)' }}
                    title="Arrastra para agrandar o achicar"
                />
            </div>
        </div>,
        document.body
    );
}

function ListaVideos({ videos, actual, onSelect }) {
    return (
        <div className="overflow-y-auto p-2.5 flex-1 space-y-3">
            {HELP_VIDEO_SERIES.map(serie => {
                const lista = videos.filter(v => v.serie === serie);
                if (!lista.length) return null;
                return (
                    <div key={serie}>
                        <p className="px-1 pb-1.5 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">{serie}</p>
                        <div className="space-y-1">
                            {lista.map(v => (
                                <button
                                    type="button"
                                    key={v.id}
                                    onClick={() => onSelect(v)}
                                    className={`w-full text-left p-2 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${actual?.id === v.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-white hover:shadow-xs border border-transparent'}`}
                                >
                                    <span className="relative shrink-0">
                                        <img src={youtubeThumb(v.youtube)} alt="" className="w-20 h-11 rounded-lg object-cover bg-slate-200" loading="lazy" />
                                        <FiPlayCircle className="absolute inset-0 m-auto text-white drop-shadow" size={18} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-blue-600">Video {v.orden}</span>
                                        <span className="block text-xs font-bold text-slate-700 truncate">{v.titulo}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

