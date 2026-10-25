import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    FiMic, FiMicOff, FiCpu, FiSettings, FiCheck, 
    FiRefreshCw, FiExternalLink, FiX, FiTrash2,
    FiVolume2, FiVolumeX, FiLayers, FiEdit3, FiPlay,
    FiCheckCircle, FiCopy, FiInfo
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { getGeminiApiKey, saveGeminiApiKey } from '../../../services/geminiKeyService';
import { 
    CLINICAL_SPECIALTIES, 
    POLITE_VOICE_SCRIPTS, 
    parseClinicalDictationLocally 
} from '../../../services/clinicalTemplatesService';

// ─── HELPER SÍNTESIS DE VOZ NATIVA EDUCADÍSIMA (0 COSTO) ──────────────────────
const getSpanishVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.startsWith('es') || v.lang.startsWith('ES'));
    if (spanishVoices.length === 0) return null;
    
    // 1. Voces neuronales o naturales (Edge / Chrome Natural)
    let voice = spanishVoices.find(v => 
        v.name.toLowerCase().includes('natural') || 
        v.name.toLowerCase().includes('neural') ||
        v.name.toLowerCase().includes('sabina') ||
        v.name.toLowerCase().includes('elena')
    );
    
    // 2. Voces Google en español
    if (!voice) {
        voice = spanishVoices.find(v => v.name.toLowerCase().includes('google'));
    }
    
    // 3. Voces de acento España / México / Colombia
    if (!voice) {
        voice = spanishVoices.find(v => v.lang === 'es-CO' || v.lang === 'es_CO');
    }
    if (!voice) {
        voice = spanishVoices.find(v => v.lang === 'es-MX' || v.lang === 'es_MX' || v.lang === 'es-ES' || v.lang === 'es_ES');
    }
    
    return voice || spanishVoices[0];
};

export default function ClinicalAIAssistant({ 
    onApply, 
    onClose,
    doctors = [],
    planes = [],
    setValue,
    watch,
    onSubmitForm,
    activeTab = 'evolucion',
    setActiveTab,
    plantillaDetails = {},
    setPlantillaDetails,
    servicios = []
}) {
    const { userProfile } = useAuth();

    // ─── ESTADOS DEL ASISTENTE ────────────────────────────────────────────────
    // Modos: 'constructor' (Plantillas programadas 100% gratis), 'voz_asistida' (Dictado inteligente), 'dictado_directo' (Transcripción pura)
    const [assistantMode, setAssistantMode] = useState('constructor');
    const [voiceMuted, setVoiceMuted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Selección del constructor estructurado
    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('operatoria');
    const [selectedProcedureId, setSelectedProcedureId] = useState('resina_simple');
    const [selectedTooth, setSelectedTooth] = useState('16');
    const [selectedSurfaces, setSelectedSurfaces] = useState(['Oclusal']);
    const [selectedAnesthesia, setSelectedAnesthesia] = useState('Infiltrativa con Lidocaína 2% con epinefrina (1 carpule)');
    const [selectedTolerance, setSelectedTolerance] = useState('Paciente tolera el procedimiento de forma satisfactoria sin complicaciones');
    const [previewText, setPreviewText] = useState('');

    // Ajustes secundarios de API opcional
    const [showSettings, setShowSettings] = useState(false);
    const [apiKey, setApiKey] = useState('');

    // Speech Recognition
    const {
        isListening,
        transcript,
        interimTranscript,
        error: speechError,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
        setTranscript
    } = useSpeechRecognition(false);

    // Nombre de cortesía del doctor
    const doctorDisplayName = useMemo(() => {
        const raw = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.displayName || "Doctor";
        return raw.replace(/^(Dr\.|Dra\.|Dr|Dra)\s+/i, '');
    }, [userProfile]);

    // Especialidad actual y procedimiento actual
    const currentSpecialty = useMemo(() => {
        return CLINICAL_SPECIALTIES.find(s => s.id === selectedSpecialtyId) || CLINICAL_SPECIALTIES[0];
    }, [selectedSpecialtyId]);

    const currentProcedure = useMemo(() => {
        return currentSpecialty.procedures.find(p => p.id === selectedProcedureId) || currentSpecialty.procedures[0];
    }, [currentSpecialty, selectedProcedureId]);

    // ─── MOTOR DE VOZ EDUCADÍSIMA (SINTETIZADOR) ──────────────────────────────
    const speakPolite = (text) => {
        if (voiceMuted || typeof window === 'undefined' || !window.speechSynthesis || !text) return;

        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 0.98; // Cadencia pausada, calmada y profesional
            utterance.pitch = 1.0;
            
            const voice = getSpanishVoice();
            if (voice) utterance.voice = voice;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.warn("Speech synthesis notice:", err);
            setIsSpeaking(false);
        }
    };

    // Saludo educado al abrir por primera vez
    const hasGreetedRef = useRef(false);
    useEffect(() => {
        if (!hasGreetedRef.current) {
            hasGreetedRef.current = true;
            const greeting = POLITE_VOICE_SCRIPTS.greeting(doctorDisplayName);
            // Breve espera para que el modal termine de animarse
            const timer = setTimeout(() => {
                speakPolite(greeting);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [doctorDisplayName]);

    // Cancelar voz al desmontar
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    // Regenerar texto de vista previa cuando cambien las variables del constructor
    useEffect(() => {
        if (currentProcedure && currentProcedure.template) {
            const surfacesText = selectedSurfaces.join('-');
            const text = currentProcedure.template({
                tooth: selectedTooth || '[Pieza]',
                surfacesText,
                anesthesia: selectedAnesthesia,
                tolerance: selectedTolerance,
                materials: currentProcedure.materials,
                postOp: currentProcedure.postOp
            });
            setPreviewText(text);
        }
    }, [currentProcedure, selectedTooth, selectedSurfaces, selectedAnesthesia, selectedTolerance]);

    // Cargar clave si existe en el backend (opcional)
    useEffect(() => {
        const loadKey = async () => {
            try {
                const key = await getGeminiApiKey(userProfile?.inquilino);
                if (key) setApiKey(key);
            } catch (e) {
                // silencioso
            }
        };
        loadKey();
    }, [userProfile?.inquilino]);

    // Manejar errores de micrófono
    useEffect(() => {
        if (speechError) {
            toast.error(`Micrófono: ${speechError}`);
        }
    }, [speechError]);

    // ─── ACCIONES DEL CONSTRUCTOR ─────────────────────────────────────────────
    const handleSelectSpecialty = (specId) => {
        setSelectedSpecialtyId(specId);
        const spec = CLINICAL_SPECIALTIES.find(s => s.id === specId);
        if (spec && spec.procedures.length > 0) {
            const firstProc = spec.procedures[0];
            setSelectedProcedureId(firstProc.id);
            if (firstProc.anesthesiaDefault) {
                setSelectedAnesthesia(firstProc.anesthesiaDefault);
            }
            if (firstProc.defaultSurfaces) {
                setSelectedSurfaces(firstProc.defaultSurfaces);
            }
            speakPolite(`Especialidad ${spec.name}. Procedimiento ${firstProc.name}.`);
        }
    };

    const handleSelectProcedure = (proc) => {
        setSelectedProcedureId(proc.id);
        if (proc.anesthesiaDefault) setSelectedAnesthesia(proc.anesthesiaDefault);
        if (proc.defaultSurfaces) setSelectedSurfaces(proc.defaultSurfaces);
        speakPolite(POLITE_VOICE_SCRIPTS.procedureSelected(proc.name, selectedTooth));
    };

    const toggleSurface = (surf) => {
        setSelectedSurfaces(prev => {
            if (prev.includes(surf)) {
                return prev.filter(s => s !== surf);
            } else {
                return [...prev, surf];
            }
        });
    };

    // Aplicar al formulario de evolución del paciente
    const handleApplyEvolution = () => {
        if (!previewText) return;

        if (setValue) {
            // Si ya hay un comentario previo, preguntar o anexar limpiamente
            const currentComment = watch ? (watch("comentario") || "") : "";
            if (currentComment.trim()) {
                const updated = `${currentComment.trim()}\n\n---\n${previewText.trim()}`;
                setValue("comentario", updated);
            } else {
                setValue("comentario", previewText.trim());
            }
        }

        if (onApply) {
            onApply({ comentario: previewText });
        }

        speakPolite(POLITE_VOICE_SCRIPTS.appliedToForm());
        toast.success("Evolución clínica insertada en el formulario con éxito", {
            description: "Texto médico formal listo para guardar."
        });
    };

    // ─── MODO DICTADO INTELIGENTE (OFFLINE CON PARSER LOCAL) ───────────────────
    const handleVoiceSmartProcess = () => {
        const fullDictation = `${transcript} ${interimTranscript}`.trim();
        if (!fullDictation) {
            toast.info("Por favor, hable al micrófono antes de estructurar la evolución.");
            return;
        }

        stopListening();
        const parsed = parseClinicalDictationLocally(fullDictation);
        if (parsed) {
            setSelectedSpecialtyId(parsed.specialty.id);
            setSelectedProcedureId(parsed.procedure.id);
            if (parsed.tooth) setSelectedTooth(parsed.tooth);
            if (parsed.surfaces && parsed.surfaces.length > 0) setSelectedSurfaces(parsed.surfaces);
            if (parsed.anesthesia) setSelectedAnesthesia(parsed.anesthesia);
            if (parsed.tolerance) setSelectedTolerance(parsed.tolerance);

            setPreviewText(parsed.generatedText);
            setAssistantMode('constructor');
            speakPolite(parsed.politeVoiceMsg);
            toast.success("Dictado estructurado con éxito por el Asistente Nova");
        } else {
            toast.error("No se pudo interpretar el dictado.");
        }
    };

    // Dictar directamente al cuadro de comentario
    const handleAppendDictationDirectly = () => {
        const full = `${transcript} ${interimTranscript}`.trim();
        if (!full) return;

        if (setValue) {
            const current = watch ? (watch("comentario") || "") : "";
            const newComment = current.trim() ? `${current.trim()} ${full}` : full;
            setValue("comentario", newComment);
        }
        resetTranscript();
        speakPolite("He añadido el dictado directamente a la evolución.");
        toast.success("Texto dictado añadido a la evolución");
    };

    // Guardar clave API opcional
    const handleSaveApiKey = async (e) => {
        e.preventDefault();
        try {
            await saveGeminiApiKey(userProfile?.inquilino, apiKey);
            toast.success("Configuración de Gemini actualizada");
            setShowSettings(false);
        } catch (err) {
            toast.error(err.message || "Error al guardar la clave API");
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/70 rounded-2xl border border-slate-200/80 p-3.5 space-y-3 shadow-inner custom-scrollbar overflow-y-auto">
            {/* Header del Asistente */}
            <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/60 shadow-xs">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-[#8dc63f] flex items-center justify-center text-white font-black text-xs shadow-sm">
                            <HiSparkles className="animate-pulse" />
                        </div>
                        {isSpeaking && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Asistente Nova</h4>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                100% Gratis
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold leading-tight">
                            {isSpeaking ? "🗣️ Nova hablando educadamente..." : `A su servicio, Dr. ${doctorDisplayName}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Botón Silenciar / Activar Voz Educada */}
                    <button
                        type="button"
                        onClick={() => {
                            const next = !voiceMuted;
                            setVoiceMuted(next);
                            if (next && window.speechSynthesis) {
                                window.speechSynthesis.cancel();
                                setIsSpeaking(false);
                            } else if (!next) {
                                speakPolite(`Voz educada activada, doctor ${doctorDisplayName}.`);
                            }
                            toast.info(next ? "Voz de Nova silenciada" : "Voz educada de Nova activada");
                        }}
                        className={`p-1.5 rounded-lg border transition-all ${
                            voiceMuted 
                                ? 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-600' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title={voiceMuted ? "Activar voz de cortesía de Nova" : "Silenciar voz de Nova"}
                    >
                        {voiceMuted ? <FiVolumeX size={14} /> : <FiVolume2 size={14} />}
                    </button>

                    {/* Botón Ajustes Opcionales */}
                    <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-1.5 rounded-lg border transition-all ${
                            showSettings 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500'
                        }`}
                        title="Opciones de conexión"
                    >
                        <FiSettings size={14} />
                    </button>

                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Ocultar asistente"
                        >
                            <FiX size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Selector de Modo del Asistente */}
            <div className="grid grid-cols-3 bg-slate-200/60 p-1 rounded-xl gap-1 text-[10px] font-black uppercase tracking-wider">
                <button
                    type="button"
                    onClick={() => {
                        stopListening();
                        setAssistantMode('constructor');
                    }}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                        assistantMode === 'constructor' 
                            ? 'bg-white text-indigo-700 shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <FiLayers size={11} />
                    <span>Plantillas</span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setAssistantMode('voz_asistida');
                        speakPolite(POLITE_VOICE_SCRIPTS.voiceListeningStarted());
                    }}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                        assistantMode === 'voz_asistida' 
                            ? 'bg-white text-emerald-700 shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <FiMic size={11} />
                    <span>Dictado IA</span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setAssistantMode('dictado_directo');
                    }}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                        assistantMode === 'dictado_directo' 
                            ? 'bg-white text-blue-700 shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <FiEdit3 size={11} />
                    <span>Voz Directa</span>
                </button>
            </div>

            {/* Panel de Ajustes Opcionales (Gemini API) */}
            {showSettings && (
                <div className="bg-white border border-indigo-100 rounded-xl p-3 flex flex-col gap-2.5 animate-fadeIn shadow-xs">
                    <div className="flex justify-between items-start">
                        <div>
                            <h5 className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">Conexión Opcional a Gemini</h5>
                            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                                Este asistente ya funciona <strong className="text-emerald-600">100% gratis</strong> sin necesidad de claves externas. Si deseas conectar tu propia API de Google AI Studio, puedes ingresarla aquí:
                            </p>
                        </div>
                    </div>
                    <form onSubmit={handleSaveApiKey} className="flex gap-1.5">
                        <input
                            type="password"
                            placeholder="Clave API opcional (AI Studio)..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-indigo-500"
                        />
                        <button
                            type="submit"
                            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            Guardar
                        </button>
                    </form>
                </div>
            )}

            {/* ─── VISTA 1: CONSTRUCTOR PROGRAMADO POR PLANTILLAS CLÍNICAS ─── */}
            {assistantMode === 'constructor' && (
                <div className="space-y-3 animate-fadeIn">
                    {/* Carrusel / Grid de Especialidades */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                            1. Especialidad Odontológica
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {CLINICAL_SPECIALTIES.map(spec => {
                                const isSelected = spec.id === selectedSpecialtyId;
                                return (
                                    <button
                                        key={spec.id}
                                        type="button"
                                        onClick={() => handleSelectSpecialty(spec.id)}
                                        className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                                            isSelected 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-102 font-black' 
                                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 font-bold'
                                        }`}
                                    >
                                        <span className="text-base mb-0.5">{spec.icon}</span>
                                        <span className="text-[9px] leading-tight line-clamp-1">{spec.name.split(' ')[0]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selector de Procedimientos de la Especialidad */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                            2. Procedimiento Realizado ({currentSpecialty.procedures.length})
                        </label>
                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto custom-scrollbar bg-white p-1 rounded-xl border border-slate-200/80">
                            {currentSpecialty.procedures.map(proc => {
                                const isSelected = proc.id === selectedProcedureId;
                                return (
                                    <button
                                        key={proc.id}
                                        type="button"
                                        onClick={() => handleSelectProcedure(proc)}
                                        className={`px-2.5 py-1.5 rounded-lg text-left text-xs transition-all flex items-center justify-between ${
                                            isSelected 
                                                ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-black' 
                                                : 'hover:bg-slate-50 text-slate-700 font-bold'
                                        }`}
                                    >
                                        <span className="truncate">{proc.name}</span>
                                        {isSelected && <FiCheck className="text-indigo-600 shrink-0 ml-1.5" size={13} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Parámetros Rápidos: Pieza, Superficies y Anestesia */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                3. Parámetros del Paciente
                            </span>
                        </div>

                        {/* Pieza Dental y Superficies */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                                    Diente / Pieza (FDI)
                                </label>
                                <input
                                    type="text"
                                    value={selectedTooth}
                                    onChange={(e) => setSelectedTooth(e.target.value)}
                                    placeholder="Ej: 16, 24, 38..."
                                    className="w-full h-8 px-2.5 text-xs font-black text-indigo-700 bg-indigo-50/50 rounded-lg border border-indigo-200 outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                                    Superficies tratadas
                                </label>
                                <div className="flex gap-1">
                                    {['O', 'M', 'D', 'V', 'L'].map(surfCode => {
                                        const surfNameMap = { O: 'Oclusal', M: 'Mesial', D: 'Distal', V: 'Vestibular', L: 'Lingual/Palatina' };
                                        const fullName = surfNameMap[surfCode];
                                        const isChecked = selectedSurfaces.some(s => s.toLowerCase().startsWith(fullName.toLowerCase().slice(0, 3)));
                                        return (
                                            <button
                                                key={surfCode}
                                                type="button"
                                                onClick={() => toggleSurface(fullName)}
                                                className={`w-6 h-8 rounded-md font-black text-[10px] transition-all border ${
                                                    isChecked 
                                                        ? 'bg-[#8dc63f] text-white border-[#8dc63f] shadow-xs' 
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                }`}
                                                title={fullName}
                                            >
                                                {surfCode}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Anestesia Empleada */}
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                                Técnica & Anestésico
                            </label>
                            <select
                                value={selectedAnesthesia}
                                onChange={(e) => setSelectedAnesthesia(e.target.value)}
                                className="w-full h-8 px-2 text-xs font-bold text-slate-700 bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-indigo-400"
                            >
                                <option value="Infiltrativa con Lidocaína 2% con epinefrina (1 carpule)">Infiltrativa: Lidocaína 2% con epi (1 carpule)</option>
                                <option value="Troncular con Lidocaína 2% con epinefrina (1.5 carpules)">Troncular: Lidocaína 2% con epi (1.5 carpules)</option>
                                <option value="Infiltrativa con Mepivacaína al 3% sin vasoconstrictor (1 carpule)">Infiltrativa: Mepivacaína al 3% sin vaso</option>
                                <option value="Tópica en spray / gel benzocaína 20%">Tópica: Gel benzocaína 20%</option>
                                <option value="Sin anestesia por tratarse de procedimiento no invasivo">Sin anestesia</option>
                            </select>
                        </div>
                    </div>

                    {/* Vista Previa de la Evolución Estructurada */}
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1">
                                <HiSparkles className="text-[#8dc63f]" />
                                Nota de Evolución Estructurada
                            </span>
                            <button
                                type="button"
                                onClick={() => speakPolite(previewText)}
                                className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-wider flex items-center gap-1 transition-colors"
                                title="Escuchar nota con voz educada"
                            >
                                <FiPlay size={10} /> Escuchar
                            </button>
                        </div>

                        <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/80 text-xs font-bold text-slate-700 leading-relaxed max-h-36 overflow-y-auto custom-scrollbar whitespace-pre-line">
                            {previewText || "Seleccione un procedimiento para generar la nota..."}
                        </div>

                        <button
                            type="button"
                            onClick={handleApplyEvolution}
                            className="w-full py-2.5 px-4 bg-[#8dc63f] hover:bg-[#7cb035] active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-lime-500/20"
                        >
                            <FiCheckCircle size={15} />
                            Aplicar al Formulario de Evolución
                        </button>
                    </div>
                </div>
            )}

            {/* ─── VISTA 2: DICTADO INTELIGENTE POR VOZ (OFFLINE) ─────────── */}
            {assistantMode === 'voz_asistida' && (
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 space-y-3.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                        <div>
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Dictado Clínico Inteligente</h5>
                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                Hable en lenguaje natural (ej: <em>"Hice resina en el 26 por oclusal con lidocaína y no tuvo dolor"</em>).
                            </p>
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 min-h-[90px] flex flex-col justify-between">
                        <div className="text-xs font-bold text-slate-700 italic">
                            {transcript || interimTranscript ? (
                                `"${transcript} ${interimTranscript}"`
                            ) : (
                                <span className="text-slate-400 font-normal">Presione "Iniciar Dictado" y comience a hablar...</span>
                            )}
                        </div>

                        {isListening && (
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                Escuchando al doctor...
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (isListening) {
                                    stopListening();
                                } else {
                                    resetTranscript();
                                    startListening();
                                }
                            }}
                            className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                                isListening 
                                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 animate-pulse' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20'
                            }`}
                        >
                            {isListening ? <FiMicOff /> : <FiMic />}
                            <span>{isListening ? "Detener" : "Iniciar Dictado"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleVoiceSmartProcess}
                            disabled={!transcript && !interimTranscript}
                            className="py-2.5 px-3 rounded-xl bg-[#8dc63f] hover:bg-[#7cb035] disabled:bg-slate-100 disabled:text-slate-400 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-lime-500/20 disabled:shadow-none"
                        >
                            <HiSparkles />
                            <span>Estructurar Nota</span>
                        </button>
                    </div>

                    <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[10px] font-bold text-indigo-900 leading-relaxed flex items-start gap-2">
                        <FiInfo className="text-indigo-600 shrink-0 mt-0.5" />
                        <span>El motor en JavaScript de OdontoCloud detecta automáticamente el diente, superficie, anestésico y tolerancia sin costo alguno.</span>
                    </div>
                </div>
            )}

            {/* ─── VISTA 3: DICTADO DIRECTO (VOZ A TEXTO TEXTUAL) ─────────── */}
            {assistantMode === 'dictado_directo' && (
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                        <div>
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Dictado Directo al Expediente</h5>
                            <p className="text-[10px] text-slate-500 font-bold">
                                Transcribe su voz directamente al campo de comentario.
                            </p>
                        </div>
                    </div>

                    <textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder="Haga clic en el micrófono y dicte sus observaciones..."
                        className="w-full h-28 p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-indigo-400 resize-none custom-scrollbar"
                    />

                    {isListening && interimTranscript && (
                        <div className="text-[10px] text-slate-400 font-bold italic animate-pulse">
                            Escuchando: "{interimTranscript}"
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (isListening) stopListening();
                                else startListening();
                            }}
                            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                                isListening 
                                    ? 'bg-rose-500 text-white shadow-md animate-pulse' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                            }`}
                        >
                            {isListening ? <FiMicOff /> : <FiMic />}
                            <span>{isListening ? "Detener" : "Dictar"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleAppendDictationDirectly}
                            disabled={!transcript.trim()}
                            className="flex-1 py-2.5 px-3 bg-[#8dc63f] hover:bg-[#7cb035] disabled:bg-slate-100 disabled:text-slate-400 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:shadow-none shadow-md shadow-lime-500/20"
                        >
                            <FiCheck />
                            <span>Insertar</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
