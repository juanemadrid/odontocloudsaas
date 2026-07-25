import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import {
    FiSearch, FiUser, FiCalendar, FiDollarSign,
    FiBox, FiFileText, FiActivity, FiArrowRight,
    FiZap, FiSettings, FiLayout, FiMic
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { searchPatients } from "../services/patientService";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import { toast } from "sonner";

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [startWithVoice, setStartWithVoice] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const inputRef = useRef(null);

    // Compute active dashboard subpath dynamically (e.g. /dashboard_admin, /dashboard_doctor)
    const basePath = useMemo(() => {
        const segs = location.pathname.split("/").filter(Boolean);
        const dashIdx = segs.findIndex((s) =>
            s === "dashboard" || s === "superadmin" || s.startsWith("dashboard_")
        );
        return dashIdx >= 0 ? `/${segs.slice(0, dashIdx + 1).join("/")}` : "/dashboard_admin";
    }, [location.pathname]);

    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript
    } = useSpeechRecognition();

    // Static Commands (Navigation & Quick Actions) using dynamic basePath
    const staticCommands = useMemo(() => [
        { id: 'nav-agenda', label: 'Ir a Agenda', icon: FiCalendar, action: () => navigate(`${basePath}/agenda`), category: 'Navegación' },
        { id: 'nav-pacientes', label: 'Ir a Pacientes', icon: FiUser, action: () => navigate(`${basePath}/pacientes`), category: 'Navegación' },
        { id: 'nav-caja', label: 'Ir a Caja', icon: FiDollarSign, action: () => navigate(`${basePath}/caja`), category: 'Navegación' },
        { id: 'nav-inventario', label: 'Ir a Inventario', icon: FiBox, action: () => navigate(`${basePath}/inventario`), category: 'Navegación' },
        { id: 'nav-reportes', label: 'Ir a Reportes', icon: FiFileText, action: () => navigate(`${basePath}/reportes`), category: 'Navegación' },
        { id: 'nav-config', label: 'Ir a Configuración', icon: FiSettings, action: () => navigate(`${basePath}/config`), category: 'Navegación' },
        { id: 'act-new-patient', label: 'Crear Nuevo Paciente', icon: FiZap, action: () => navigate(`${basePath}/pacientes?action=new`), category: 'Acciones Rápidas' },
    ], [basePath, navigate]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const isK = e.key === 'k' || e.key === 'K';
            if ((e.metaKey || e.ctrlKey) && isK) {
                e.preventDefault();
                e.stopImmediatePropagation();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        const handleOpenGlobalSearch = (e) => {
            setIsOpen(true);
            if (e?.detail?.voice) {
                setStartWithVoice(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('open-global-search', handleOpenGlobalSearch);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('open-global-search', handleOpenGlobalSearch);
        };
    }, []);

    useEffect(() => {
        if (isOpen && startWithVoice) {
            resetTranscript();
            startListening();
            setStartWithVoice(false);
        }
    }, [isOpen, startWithVoice, startListening, resetTranscript]);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    // Close speech recognition if the palette is closed
    useEffect(() => {
        if (!isOpen && isListening) {
            stopListening();
        }
    }, [isOpen, isListening, stopListening]);

    // Search Logic (Debounced)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length < 2) {
                setResults(staticCommands.filter(c =>
                    c.label.toLowerCase().includes(query.toLowerCase())
                ));
                return;
            }

            setSearching(true);
            try {
                const patients = await searchPatients(userProfile?.inquilino, query.toUpperCase());
                const patientResults = patients.map(p => ({
                    id: `patient-${p.id}`,
                    label: p.nombreCompleto,
                    sublabel: p.nroDocumento,
                    icon: FiUser,
                    action: () => navigate(`${basePath}/pacientes?id=${p.id}`),
                    category: 'Pacientes'
                }));

                const filteredStatics = staticCommands.filter(c =>
                    c.label.toLowerCase().includes(query.toLowerCase())
                );

                setResults([...filteredStatics, ...patientResults]);
            } catch (err) {
                console.error(err);
            }
            setSearching(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [query, staticCommands, basePath, navigate, userProfile?.inquilino]);

    const handleAction = (item) => {
        item.action();
        setIsOpen(false);
    };

    const handleExecuteVoiceCommand = async (rawText) => {
        // Clean punctuation and strip accents/diacritics from speech engine
        const text = (rawText || "")
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[.,\/#!$%\^&\*;:{}=\-_~()?¿]/g, "") // Remove punctuation
            .trim();
        setQuery(rawText);
        
        console.log("Analyzing global voice command (normalized):", text);

        // A. Simple Navigation Commands
        if (text === "ir a inicio" || text === "inicio" || text === "ir al inicio") {
            navigate(basePath);
            setIsOpen(false);
            return;
        }
        if (text === "ir a agenda" || text === "agenda" || text === "ir a la agenda") {
            navigate(`${basePath}/agenda`);
            setIsOpen(false);
            return;
        }
        if (text === "ir a pacientes" || text === "pacientes" || text === "ir a los pacientes") {
            navigate(`${basePath}/pacientes`);
            setIsOpen(false);
            return;
        }
        if (text === "ir a caja" || text === "caja" || text === "ir a la caja") {
            navigate(`${basePath}/caja`);
            setIsOpen(false);
            return;
        }
        if (text === "ir a administracion" || text === "administracion" || text === "ir a la administracion") {
            navigate(`${basePath}/administracion`);
            setIsOpen(false);
            return;
        }
        if (text === "ir a reportes" || text === "reportes" || text === "ir a los reportes") {
            navigate(`${basePath}/reportes`);
            setIsOpen(false);
            return;
        }
        if (text === "ir a configuracion" || text === "configuracion" || text === "ir a la configuracion") {
            navigate(`${basePath}/config`);
            setIsOpen(false);
            return;
        }
        if (text === "crear paciente" || text === "nuevo paciente" || text === "crear nuevo paciente" || text === "registrar paciente") {
            navigate(`${basePath}/pacientes?action=new`);
            setIsOpen(false);
            return;
        }

        // B. Patient Details Specific Tab Navigation (pure accentless regexes)
        const regexHistoria = /^(iniciar historia de|iniciar historia clinica de|activar historia de|activar historia clinica de|historia de|historia clinica de|historial de|historial clinico de|abrir paciente|ver paciente|buscar paciente)\s+(.+)$/i;
        const regexOdonto = /^(abrir odontograma de|odontograma de|ver odontograma de|activar odontograma de)\s+(.+)$/i;
        const regexEvo = /^(abrir evoluciones de|evoluciones de|ver evoluciones de|evolucion de|evoluciones de|activar evoluciones de)\s+(.+)$/i;
        const regexAI = /^(abrir copiloto de|copiloto de|insights de|copiloto ia de|activar copiloto de)\s+(.+)$/i;

        let match = null;
        let tab = "anamnesis";

        if ((match = text.match(regexHistoria))) {
            tab = "anamnesis";
        } else if ((match = text.match(regexOdonto))) {
            tab = "odonto";
        } else if ((match = text.match(regexEvo))) {
            tab = "evo";
        } else if ((match = text.match(regexAI))) {
            tab = "ai_insights";
        }

        if (match) {
            const nameToSearch = match[2].trim();
            setSearching(true);
            try {
                const patients = await searchPatients(userProfile?.inquilino, nameToSearch.toUpperCase());
                if (patients && patients.length > 0) {
                    navigate(`${basePath}/pacientes?id=${patients[0].id}&tab=${tab}`);
                    setIsOpen(false);
                } else {
                    toast.error(`No se encontró paciente con el nombre: "${nameToSearch}"`);
                }
            } catch (err) {
                console.error("Error searching patients by voice:", err);
            }
            setSearching(false);
            return;
        }
    };

    const prevListening = useRef(false);
    useEffect(() => {
        if (prevListening.current && !isListening && transcript) {
            handleExecuteVoiceCommand(transcript);
        }
        prevListening.current = isListening;
    }, [isListening, transcript]);

    const handleVoiceClick = () => {
        if (isListening) {
            stopListening();
        } else {
            resetTranscript();
            startListening();
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[selectedIndex]) handleAction(results[selectedIndex]);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-24 px-4 sm:px-6">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-300"
                onClick={() => setIsOpen(false)}
            />

            {/* Palette Panel */}
            <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Search Header */}
                <div className="relative border-b border-slate-100 p-2 flex items-center">
                    <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full pl-14 pr-16 py-5 bg-transparent text-[15px] font-bold text-slate-800 outline-none placeholder:text-slate-300 uppercase tracking-tight"
                        placeholder="BUSCAR PACIENTES, ACCIONES O MODULOS..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        disabled={isListening}
                    />
                    <button
                        type="button"
                        onClick={handleVoiceClick}
                        className={`absolute right-6 p-2.5 rounded-full transition-all ${
                            isListening
                                ? 'bg-rose-100 text-rose-600 animate-pulse ring-2 ring-rose-200'
                                : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'
                        }`}
                        title="Dictar comando de voz (ej: 'historia clinica de Alberto Gomez')"
                    >
                        <FiMic size={18} />
                    </button>
                </div>

                {/* Results List */}
                <div className="max-h-[400px] overflow-y-auto p-3 custom-scrollbar">
                    {isListening ? (
                        <div className="py-8 px-6 text-center bg-indigo-50/40 rounded-2xl border border-indigo-100/50 m-2 animate-pulse flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 animate-bounce">
                                <FiMic size={24} />
                            </div>
                            <h4 className="text-[12px] font-black text-indigo-700 uppercase tracking-widest">Escuchando comando...</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wide">
                                Di por ejemplo: "historia clínica de Alberto Gómez" o "ir a agenda"
                            </p>
                            {interimTranscript && (
                                <div className="mt-4 p-3.5 bg-white rounded-xl border border-indigo-100 shadow-sm inline-block max-w-full truncate text-sm font-bold text-indigo-800 italic">
                                    "{interimTranscript}..."
                                </div>
                            )}
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-10 text-center">
                            <FiActivity className="mx-auto text-slate-200 mb-3" size={32} />
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron resultados</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {results.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className={`
                                        flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border
                                        ${selectedIndex === idx ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-100' : 'bg-transparent border-transparent hover:bg-slate-50'}
                                    `}
                                    onClick={() => handleAction(item)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`
                                            w-10 h-10 rounded-[14px] flex items-center justify-center transition-all
                                            ${selectedIndex === idx ? 'bg-blue-500/30 text-white' : 'bg-slate-50 text-slate-500'}
                                        `}>
                                            <item.icon size={18} />
                                        </div>
                                        <div>
                                            <div className={`text-[12px] font-black uppercase tracking-tight ${selectedIndex === idx ? 'text-white' : 'text-slate-800'}`}>
                                                {item.label}
                                            </div>
                                            {(item.sublabel || item.category) && (
                                                <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${selectedIndex === idx ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    {item.sublabel || item.category}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {selectedIndex === idx && (
                                        <FiArrowRight className="text-white" size={16} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer / Shortcuts */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500">ESC</kbd>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cerrar</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500">↵</kbd>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Seleccionar</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500">↑↓</kbd>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Navegar</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
