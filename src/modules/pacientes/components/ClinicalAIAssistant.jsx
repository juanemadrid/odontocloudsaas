import React, { useState, useEffect, useRef } from 'react';
import { 
    FiMic, FiMicOff, FiCheck, FiX, FiVolume2, FiVolumeX, 
    FiSave, FiPlus, FiFileText, FiRefreshCw, FiTrash2
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { 
    CLINICAL_SPECIALTIES, 
    parseClinicalDictationLocally,
    isSaveOrConfirmCommand
} from '../../../services/clinicalTemplatesService';

// Síntesis de voz ultra discreta (solo confirmaciones breves si el doctor la tiene activa)
const speakDiscreet = (text, isMuted) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find(v => v.lang.startsWith('es') || v.lang.startsWith('ES'));
        if (spanishVoice) utterance.voice = spanishVoice;

        window.speechSynthesis.speak(utterance);
    } catch (e) {
        // Silencioso
    }
};

export default function ClinicalAIAssistant({ 
    onApply, 
    onClose,
    setValue,
    watch,
    onSubmitForm,
    activeTab = 'evolucion'
}) {
    const { userProfile } = useAuth();

    // Estado del micrófono y voz (Voz silenciada por defecto para no incomodar frente al paciente)
    const [voiceMuted, setVoiceMuted] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('operatoria');
    const [selectedTooth, setSelectedTooth] = useState('16');
    const [lastAction, setLastAction] = useState('');

    // Hook de reconocimiento de voz nativo
    const {
        isListening,
        transcript,
        interimTranscript,
        error: speechError,
        isSupported,
        startListening,
        stopListening,
        resetTranscript
    } = useSpeechRecognition(false);

    // Notificar error de micrófono si ocurre
    useEffect(() => {
        if (speechError) {
            toast.error(`Micrófono: ${speechError}. Por favor verifique los permisos en el navegador.`);
        }
    }, [speechError]);

    // Transcripción viva acumulada
    const currentLiveSpeech = `${transcript} ${interimTranscript}`.trim();

    // Detección automática de comando "guardar" al dictar
    useEffect(() => {
        if (!isListening || !currentLiveSpeech) return;

        const lower = currentLiveSpeech.toLowerCase();
        // Si el doctor dijo "guardar", "guarda" o "finalizar"
        if (lower.endsWith('guardar') || lower.endsWith('guarda') || lower.endsWith('finalizar') || lower.endsWith('listo')) {
            const cleanText = currentLiveSpeech
                .replace(/\b(guardar|guarda|finalizar|listo)\b/gi, '')
                .trim();

            if (cleanText) {
                applyTextToComment(cleanText);
            }
            stopListening();
            resetTranscript();
            toast.success("Comando 'Guardar' detectado por voz");
            if (onSubmitForm) {
                setTimeout(() => onSubmitForm(), 400);
            }
        }
    }, [currentLiveSpeech, isListening]);

    // Insertar texto en el campo comentario del formulario
    const applyTextToComment = (newText, overwrite = false) => {
        if (!newText || !setValue) return;
        const currentComment = watch ? (watch("comentario") || "") : "";

        let updated = newText.trim();
        if (!overwrite && currentComment.trim()) {
            updated = `${currentComment.trim()}\n\n${newText.trim()}`;
        }

        setValue("comentario", updated);
        if (onApply) onApply({ comentario: updated });
    };

    // Alternar encendido/apagado del micrófono
    const handleToggleMic = () => {
        if (!isSupported) {
            toast.error("Su navegador no soporta reconocimiento de voz. Use Google Chrome o Microsoft Edge.");
            return;
        }

        if (isListening) {
            stopListening();
            if (currentLiveSpeech) {
                applyTextToComment(currentLiveSpeech);
                resetTranscript();
                toast.success("Texto dictado agregado al comentario");
                speakDiscreet("Texto añadido, doctor.", voiceMuted);
            }
        } else {
            resetTranscript();
            startListening();
            toast.info("Micrófono activado. Hable con naturalidad...");
        }
    };

    // Estructurar el dictado actual a formato médico formal
    const handleStructureDictation = () => {
        if (!currentLiveSpeech) {
            toast.info("Por favor dicte primero lo realizado antes de estructurar.");
            return;
        }

        stopListening();
        const parsed = parseClinicalDictationLocally(currentLiveSpeech);
        if (parsed && parsed.generatedText) {
            applyTextToComment(parsed.generatedText, true);
            resetTranscript();
            toast.success("Nota clínica estructurada y aplicada");
            speakDiscreet("Evolución estructurada con éxito.", voiceMuted);
        } else {
            applyTextToComment(currentLiveSpeech);
            resetTranscript();
            toast.success("Texto añadido al expediente");
        }
    };

    // Insertar plantilla rápida de procedimiento
    const handleInsertTemplate = (proc) => {
        const generated = proc.template({
            tooth: selectedTooth || '16',
            surfacesText: proc.defaultSurfaces ? proc.defaultSurfaces.join('-') : 'Oclusal',
            anesthesia: proc.anesthesiaDefault || 'Infiltrativa con Lidocaína 2% (1 carpule)',
            tolerance: 'Paciente tolera el procedimiento de forma satisfactoria sin complicaciones',
            materials: proc.materials,
            postOp: proc.postOp
        });

        applyTextToComment(generated);
        setLastAction(proc.name);
        toast.success(`Plantilla de ${proc.name} insertada`);
        speakDiscreet(`${proc.name} registrada.`, voiceMuted);
    };

    // Guardar formulario directamente
    const handleSaveEvolutionDirectly = () => {
        if (onSubmitForm) {
            onSubmitForm();
            speakDiscreet("Guardando evolución.", voiceMuted);
        }
    };

    const currentSpecialty = CLINICAL_SPECIALTIES.find(s => s.id === selectedCategory) || CLINICAL_SPECIALTIES[0];

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-4">
            
            {/* Header Limpio y Profesional */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#8dc63f] flex items-center justify-center font-black border border-emerald-100">
                        <HiSparkles size={18} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-800 tracking-tight">
                            Asistente de Evolución
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">
                            Dictado por voz & plantillas clínicas
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Botón Silenciar / Activar Voz discreta */}
                    <button
                        type="button"
                        onClick={() => {
                            const next = !voiceMuted;
                            setVoiceMuted(next);
                            toast.info(next ? "Confirmaciones de voz desactivadas" : "Confirmaciones de voz activadas");
                        }}
                        className={`p-1.5 rounded-lg border text-xs transition-colors ${
                            voiceMuted 
                                ? 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        title={voiceMuted ? "Activar confirmaciones sonoras" : "Silenciar voz"}
                    >
                        {voiceMuted ? <FiVolumeX size={14} /> : <FiVolume2 size={14} />}
                    </button>

                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Ocultar panel"
                        >
                            <FiX size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* SECCIÓN 1: DICTADO POR VOZ (CLARO, VISIBLE Y CONFIABLE) */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Dictado por Micrófono
                    </span>
                    {isListening && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            Grabando voz...
                        </span>
                    )}
                </div>

                {/* Botón Principal de Micrófono */}
                <button
                    type="button"
                    onClick={handleToggleMic}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                        isListening
                            ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-rose-200'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                    }`}
                >
                    {isListening ? <FiMicOff size={16} /> : <FiMic size={16} />}
                    <span>{isListening ? "Detener Dictado & Insertar" : "🎙️ Presione para Dictar al Expediente"}</span>
                </button>

                {/* Transcripción en vivo */}
                <div className={`p-2.5 rounded-lg border text-xs min-h-[56px] transition-colors ${
                    isListening 
                        ? 'bg-white border-rose-200 text-slate-800' 
                        : 'bg-white/60 border-slate-200 text-slate-500'
                }`}>
                    {currentLiveSpeech ? (
                        <p className="italic font-medium leading-relaxed">
                            "{currentLiveSpeech}"
                        </p>
                    ) : (
                        <p className="text-slate-400 text-[11px]">
                            {isListening 
                                ? "Escuchando... Hable con naturalidad sobre el procedimiento realizado." 
                                : "Haga clic en el botón azul para dictar por voz."}
                        </p>
                    )}
                </div>

                {/* Botón para estructurar formalmente lo dictado */}
                {currentLiveSpeech && (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleStructureDictation}
                            className="flex-1 py-1.5 px-3 bg-[#8dc63f] hover:bg-[#7cb035] text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                        >
                            <HiSparkles size={13} />
                            Estructurar a Lenguaje Médico
                        </button>
                        <button
                            type="button"
                            onClick={resetTranscript}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg border border-slate-200 hover:bg-white transition-colors"
                            title="Borrar texto dictado"
                        >
                            <FiTrash2 size={13} />
                        </button>
                    </div>
                )}
            </div>

            {/* SECCIÓN 2: PLANTILLAS RÁPIDAS (1 CLIC PARA INSERTAR) */}
            <div className="space-y-2.5 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Plantillas por Especialidad
                    </span>
                    <div className="flex items-center gap-1.5">
                        <label className="text-[10px] text-slate-400 font-medium">Pieza:</label>
                        <input
                            type="text"
                            value={selectedTooth}
                            onChange={(e) => setSelectedTooth(e.target.value)}
                            placeholder="16"
                            className="w-12 h-6 px-1.5 text-center text-xs font-bold text-slate-800 bg-slate-50 rounded border border-slate-200 outline-none focus:border-indigo-400"
                        />
                    </div>
                </div>

                {/* Selector de Especialidades */}
                <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                    {CLINICAL_SPECIALTIES.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors border ${
                                selectedCategory === cat.id
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            {cat.icon} {cat.name.split(' ')[0]}
                        </button>
                    ))}
                </div>

                {/* Lista de Procedimientos de la Especialidad */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar max-h-48">
                    {currentSpecialty.procedures.map(proc => (
                        <button
                            key={proc.id}
                            type="button"
                            onClick={() => handleInsertTemplate(proc)}
                            className="w-full p-2.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 text-left transition-all group flex items-center justify-between"
                        >
                            <div>
                                <h5 className="text-xs font-semibold text-slate-800 group-hover:text-emerald-800">
                                    {proc.name}
                                </h5>
                                <p className="text-[10px] text-slate-400 group-hover:text-slate-500 line-clamp-1">
                                    {proc.anesthesiaDefault}
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-[#8dc63f] bg-emerald-50 px-2 py-1 rounded-md shrink-0 border border-emerald-100 group-hover:bg-[#8dc63f] group-hover:text-white transition-colors">
                                + Insertar
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* SECCIÓN 3: BOTÓN DE GUARDADO RÁPIDO */}
            <div className="pt-2 border-t border-slate-100">
                <button
                    type="button"
                    onClick={handleSaveEvolutionDirectly}
                    className="w-full py-2.5 px-4 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors active:scale-98"
                >
                    <FiSave size={15} />
                    Guardar Evolución en Expediente
                </button>
            </div>
        </div>
    );
}
