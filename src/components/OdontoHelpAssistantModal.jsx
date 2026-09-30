import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiSend, FiSearch, FiBookOpen, FiCheckCircle, FiCornerDownRight, FiMessageSquare, FiRefreshCw } from 'react-icons/fi';
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
                        <div key={idx} className="font-bold text-slate-900 text-[13px] pt-1 pb-0.5 flex items-center gap-1.5 border-b border-slate-100">
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

                    // Formatear negritas y etiquetas internas
                    const parts = stepContent.split(/(\*\*.*?\*\*|\[.*?\]|\`.*?\`)/g);

                    return (
                        <div key={idx} className="flex items-start gap-2 pt-1 pl-1">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                {stepNum}
                            </span>
                            <div className="flex-1 text-slate-700">
                                {parts.map((p, pIdx) => {
                                    if (p.startsWith("**") && p.endsWith("**")) {
                                        return <strong key={pIdx} className="font-bold text-slate-900">{p.replace(/\*\*/g, "")} </strong>;
                                    }
                                    if (p.startsWith("[") && p.endsWith("]")) {
                                        return <span key={pIdx} className="px-1.5 py-0.5 bg-[#8dc63f]/20 text-[#608d20] font-bold rounded-md mx-0.5">{p.slice(1, -1)}</span>;
                                    }
                                    if (p.startsWith("`") && p.endsWith("`")) {
                                        return <code key={pIdx} className="px-1 py-0.5 bg-slate-100 text-blue-600 font-mono rounded text-[11px]">{p.slice(1, -1)}</code>;
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
    // Remount on account/clinic changes: no conversation can survive a change of scope.
    return <HelpPanel key={String(user?.id) + ':' + String(userProfile?.tenant_id || userProfile?.inquilino)} onClose={onClose} />;
}

function HelpPanel({ onClose }) {
    const welcome = { sender: 'bot', text: '¡Hola! Soy la ayuda de OdontoCloud. Puedo explicarte cómo usar el sistema, paso a paso. Pregúntame o consulta una guía de la biblioteca.', sources: [] };
    const [messages, setMessages] = useState([welcome]);
    const [input, setInput] = useState('');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('Todos');
    const [isTyping, setIsTyping] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const [previousIds, setPreviousIds] = useState([]);
    const pending = useRef(false);
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
        const previousFocus = document.activeElement;
        inputRef.current?.focus();
        return () => { generation.current += 1; previousFocus?.focus?.(); };
    }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
    useEffect(() => { (showLibrary ? searchRef : inputRef).current?.focus(); }, [showLibrary]);

    const reset = () => {
        generation.current += 1;
        pending.current = false;
        setIsTyping(false);
        setMessages([welcome]);
        setPreviousIds([]);
        setInput('');
        inputRef.current?.focus();
    };
    const showGuide = guide => {
        // A guide selection supersedes an outstanding answer.
        generation.current += 1;
        pending.current = false;
        setIsTyping(false);
        setMessages(prev => [...prev, { sender: 'bot', text: formatGuide(guide), provider: 'manual', sources: [] }]);
        setPreviousIds([guide.id]);
        setShowLibrary(false);
        inputRef.current?.focus();
    };
    const handleSend = async event => {
        event.preventDefault();
        const question = input.trim();
        if (!question || pending.current) return;
        pending.current = true;
        const requestId = ++generation.current;
        setMessages(prev => [...prev, { sender: 'user', text: question }]);
        setInput('');
        setIsTyping(true);
        const result = await askHelp(question, previousIds);
        if (requestId !== generation.current) return;
        const sources = (result.sources || []).filter(s => s && HELP_GUIDES.some(g => g.id === s.id));
        setMessages(prev => [...prev, { sender: 'bot', text: result.answer, provider: result.provider, reason: result.reason, sources }]);
        setPreviousIds(sources.map(s => s.id));
        pending.current = false;
        setIsTyping(false);
        inputRef.current?.focus();
    };
    const handleKeys = event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const nodes = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')].filter(el => el.getClientRects().length);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    return (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5">
            <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="help-title" onKeyDown={handleKeys}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[740px] max-h-[94dvh] flex flex-col overflow-hidden">
                <header className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3">
                    <div><div className="text-emerald-300 text-[10px] uppercase tracking-widest font-bold">Tu guía de uso</div>
                        <h2 id="help-title" className="text-lg font-semibold !text-white">Ayuda de OdontoCloud</h2>
                        <p className="text-xs text-slate-300 mt-1">Respuestas basadas en las guías del sistema</p></div>
                    <div className="flex gap-2">
                        <button type="button" onClick={reset} title="Nueva conversación" aria-label="Nueva conversación" className="p-2 rounded-lg hover:bg-white/10"><FiRefreshCw size={18} /></button>
                        <button type="button" onClick={onClose} aria-label="Cerrar ayuda" className="p-2 rounded-lg hover:bg-white/10"><FiX size={22} /></button>
                    </div>
                </header>
                <button type="button" className="md:hidden px-4 py-2 text-sm border-b text-blue-700 text-left" onClick={() => setShowLibrary(!showLibrary)}>
                    {showLibrary ? 'Volver a la conversación' : 'Explorar las guías del sistema'}
                </button>
                <div className="flex flex-1 min-h-0">
                    <aside aria-label="Biblioteca de ayuda" className={(showLibrary ? 'flex' : 'hidden') + ' md:flex flex-col w-full md:w-72 shrink-0 bg-slate-50 border-r border-slate-200 min-h-0'}>
                        <div className="p-4 border-b space-y-3">
                            <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm"><FiBookOpen /> Biblioteca <span className="ml-auto text-xs text-slate-500">{HELP_GUIDES.length} guías</span></div>
                            <label className="flex items-center gap-2 bg-white rounded-lg border px-3 py-2"><FiSearch className="text-slate-400 shrink-0" />
                                <input ref={searchRef} aria-label="Buscar guía" value={search} onChange={e => setSearch(e.target.value)} placeholder="Citas, pagos, pacientes…" className="w-full min-w-0 bg-transparent text-xs outline-none" /></label>
                            <div className="flex gap-1.5 flex-wrap">{categories.map(c => <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)} className={'text-[10px] rounded-full px-2.5 py-1 border ' + (category === c ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white text-slate-600 border-slate-200')}>{c}</button>)}</div>
                        </div>
                        <div className="overflow-y-auto p-2 flex-1">
                            {visibleGuides.map(g => <button type="button" key={g.id} onClick={() => showGuide(g)} className="w-full text-left p-3 rounded-xl hover:bg-white hover:shadow-sm focus-visible:outline-blue-600">
                                <span className="block text-[10px] uppercase tracking-wide text-slate-400">{g.category}</span><span className="block text-xs font-semibold text-slate-700 mt-1">{g.title}</span>
                            </button>)}
                            {!visibleGuides.length && <p className="p-3 text-xs text-slate-500">No hay guías con esos filtros. Prueba otra palabra o selecciona Todos.</p>}
                        </div>
                    </aside>
                    <div className={(showLibrary ? 'hidden' : 'flex') + ' md:flex flex-col flex-1 min-w-0'}>
                        <div role="log" aria-live="polite" aria-label="Conversación de ayuda" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white">
                            {messages.map((message, index) => <div key={index} className={message.sender === 'user' ? 'ml-auto max-w-[90%] bg-blue-600 text-white rounded-2xl rounded-br-sm p-3 text-sm whitespace-pre-wrap break-words' : 'max-w-full text-slate-700'}>
                                {message.sender === 'user' ? message.text : <>
                                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400"><FiMessageSquare /> {message.provider === 'ollama' ? 'Respuesta de IA local' : 'Guía del sistema'}</div>
                                    {['unavailable', 'not_configured'].includes(message.reason) && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2 mb-3">La IA local no está disponible. Te muestro las guías relacionadas.</p>}
                                    <FormattedMessage text={message.text} />
                                    {message.sources?.length > 0 && <div className="mt-3 pt-2 border-t border-slate-100"><p className="text-[10px] text-slate-400 mb-1">Guías de referencia</p><div className="flex flex-wrap gap-2">{message.sources.map(source => <button type="button" key={source.id} onClick={() => showGuide(HELP_GUIDES.find(g => g.id === source.id))} className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">{source.title}</button>)}</div></div>}
                                </>}
                            </div>)}
                            {isTyping && <p role="status" className="text-xs text-slate-500 animate-pulse">Consultando las guías con la IA local…</p>}
                            <div ref={endRef} />
                        </div>
                        <form onSubmit={handleSend} className="border-t p-4 bg-slate-50">
                            <div className="flex gap-2"><input ref={inputRef} aria-label="Pregunta sobre OdontoCloud" maxLength={1200} value={input} onChange={e => setInput(e.target.value)} placeholder="¿Cómo hago para apartar una cita?" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm focus:outline-blue-500" />
                                <button type="submit" aria-label="Enviar pregunta" disabled={isTyping || !input.trim()} className="bg-blue-600 text-white rounded-xl px-4 disabled:opacity-40 hover:bg-blue-700"><FiSend /></button></div>
                            <p className="text-[10px] text-slate-500 mt-2">Describe la función que necesitas. No incluyas datos de pacientes. Las opciones dependen de tus permisos.</p>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );
}
