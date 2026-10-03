import React, { useState, useRef, useEffect } from 'react';
import { 
    FiX, FiSend, FiSearch, FiBookOpen, FiCheckCircle, FiCornerDownRight, 
    FiMessageSquare, FiRefreshCw, FiMinimize2, FiMaximize2, FiHelpCircle, FiChevronRight 
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { askHelp } from '../services/helpAssistantService';
import { HELP_GUIDES, formatGuide, normalize, searchGuides } from '../../supabase/functions/_shared/helpKnowledge.mjs';

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

const QUICK_TOPICS = [
    { label: "Recibo de caja", q: "Cómo hago un recibo de caja" },
    { label: "Saldo a favor", q: "Cómo registrar saldo a favor" },
    { label: "Apartar cita", q: "Cómo apartar una cita" },
    { label: "Factura venta", q: "Cómo crear una factura de venta" },
    { label: "Arqueo de caja", q: "Cómo cerrar o cuadrar caja" }
];

function HelpPanel({ onClose }) {
    const welcome = { 
        sender: 'bot', 
        text: '¡Hola! Soy OdontoIA. Cuéntame qué quieres hacer o dónde te quedaste y lo vemos paso a paso.',
        sources: [] 
    };
    
    const [messages, setMessages] = useState([welcome]);
    const [input, setInput] = useState('');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('Todos');
    const [isTyping, setIsTyping] = useState(false);
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'library'
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
            endRef.current?.scrollIntoView({ behavior: 'smooth' }); 
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

    const showGuide = guide => {
        generation.current += 1; activeRequest.current?.abort();
        pending.current = false;
        setIsTyping(false);
        setMessages(prev => [
            ...prev, 
            { sender: 'bot', text: formatGuide(guide), provider: 'manual', sources: [] }
        ]);
        setPreviousIds([guide.id]);
        setActiveTab('chat');
        inputRef.current?.focus();
    };

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
        const result = await askHelp(question, previousIds, {
            history: messages.slice(1).filter(m => !m.pending), signal: controller.signal,
            onUpdate: text => { if (requestId === generation.current) setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text } : m)); },
        });
        if (requestId !== generation.current) return;
        const sources = (result.sources || []).filter(s => s && HELP_GUIDES.some(g => g.id === s.id));
        setMessages(prev => prev.map(m => m.id === replyId ? { sender: 'bot', text: result.answer, provider: result.provider, reason: result.reason, sources } : m));
        if (result.reason !== 'conversation' && result.reason !== 'cancelled') setPreviousIds(sources.map(s => s.id));
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
        );
    }

    // Ventana interactiva flotante (sin bloquear la pantalla de fondo)
    return (
        <aside
            ref={dialogRef}
            role="complementary"
            aria-label="Asistente de ayuda y guías de OdontoCloud"
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
                            Guía en vivo
                        </div>
                        <h2 id="help-title" className="text-xs sm:text-sm font-bold truncate text-white leading-tight">
                            Ayuda de OdontoCloud
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
            </div>

            {/* Contenido: Tab Chat Paso a Paso */}
            {activeTab === 'chat' && (
                <div className="flex flex-col flex-1 min-h-0 bg-white">
                    {/* Botones de sugerencias rápidas */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50/70 overflow-x-auto flex gap-1.5 shrink-0 scrollbar-none">
                        {QUICK_TOPICS.map((item, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSend(item.q)}
                                className="whitespace-nowrap text-[11px] font-bold px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 transition-all shadow-2xs cursor-pointer"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Mensajes del chat */}
                    <div role="log" aria-live="polite" className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                        {messages.map((message, index) => (
                            <div 
                                key={index} 
                                className={message.sender === 'user' 
                                    ? 'ml-auto max-w-[88%] bg-blue-600 text-white rounded-2xl rounded-br-xs p-3 text-xs shadow-xs' 
                                    : 'max-w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs text-slate-700'
                                }
                            >
                                {message.sender === 'user' ? (
                                    <div className="font-medium whitespace-pre-wrap break-words">{message.text}</div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            <FiMessageSquare size={11} /> 
                                            <span>{message.pending ? 'OdontoIA está escribiendo…' : message.provider === 'ollama' ? 'OdontoIA · IA local' : message.provider === 'manual' ? 'Guía verificada' : 'OdontoIA'}</span>
                                        </div>
                                        {['unavailable', 'not_configured'].includes(message.reason) && (
                                            <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 mb-2 border border-amber-200">
                                                La IA no completó la respuesta. Puedes continuar con esta guía:
                                            </p>
                                        )}
                                        <FormattedMessage text={message.text || (message.pending ? "Revisando tu pregunta…" : "")} />
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
                    <div className="p-3 border-b border-slate-200 space-y-2 bg-white shrink-0">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input 
                                ref={searchRef} 
                                aria-label="Buscar guía" 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                                placeholder="Buscar en 40 guías (caja, citas, facturas)..." 
                                className="w-full h-8.5 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:border-blue-500 transition-all font-medium" 
                            />
                        </div>

                        <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-1 max-h-20 scrollbar-none">
                            {categories.map(c => (
                                <button 
                                    type="button" 
                                    key={c} 
                                    aria-pressed={category === c} 
                                    onClick={() => setCategory(c)} 
                                    className={`text-[10px] font-bold rounded-md px-2 py-0.5 border cursor-pointer transition-all ${
                                        category === c 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-2xs' 
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'
                                    }`}
                                >
                                    {c}
                                </button>
                            ))}
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
        </aside>
    );
}

