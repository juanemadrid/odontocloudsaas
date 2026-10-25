import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    FiMic, FiMicOff, FiSettings, FiCheck, 
    FiVolume2, FiVolumeX, FiLayers, FiPlay,
    FiCheckCircle, FiInfo, FiRotateCcw, FiSave, FiAlertCircle
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { getGeminiApiKey, saveGeminiApiKey } from '../../../services/geminiKeyService';
import { 
    CLINICAL_SPECIALTIES, 
    POLITE_VOICE_SCRIPTS, 
    parseClinicalDictationLocally,
    isSaveOrConfirmCommand,
    isCancelCommand,
    extractToothFromText,
    extractAnesthesiaFromText,
    extractToleranceFromText
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
    // Modos: 'manos_libres' (100% por voz y comandos sin tocar nada), 'plantillas' (Manual por clics)
    const [assistantMode, setAssistantMode] = useState('manos_libres');
    const [voiceMuted, setVoiceMuted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // ─── ESTADO DE LA MÁQUINA DE CONVERSACIÓN PASO A PASO (MANOS LIBRES) ─────
    // Pasos:
    // 1: Preguntar Procedimiento y Diente
    // 2: Preguntar Anestesia
    // 3: Preguntar Tolerancia / Complicaciones
    // 4: Confirmar y Guardar por Voz ("¿Desea que la guarde ahora?")
    // 5: Guardado finalizado
    const [voiceStep, setVoiceStep] = useState(1);
    const [capturedData, setCapturedData] = useState({
        procedureName: '',
        specialtyId: 'operatoria',
        procedureId: 'resina_simple',
        tooth: '',
        surfacesText: 'Oclusal',
        anesthesia: '',
        tolerance: ''
    });
    const [currentStatusMsg, setCurrentStatusMsg] = useState('Iniciando modo manos libres...');
    const [lastSpokenText, setLastSpokenText] = useState('');
    const [isProcessingStep, setIsProcessingStep] = useState(false);

    // Selección manual para modo plantillas
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

    // Speech Recognition con modo persistente para escuchar continuamente sin tocar el mouse
    const {
        isListening,
        transcript,
        interimTranscript,
        error: speechError,
        isSupported,
        startListening,
        stopListening,
        resetTranscript
    } = useSpeechRecognition(true);

    // Refs para evitar problemas de dependencias en callbacks asíncronos
    const voiceStepRef = useRef(voiceStep);
    useEffect(() => { voiceStepRef.current = voiceStep; }, [voiceStep]);

    const capturedDataRef = useRef(capturedData);
    useEffect(() => { capturedDataRef.current = capturedData; }, [capturedData]);

    const setValueRef = useRef(setValue);
    useEffect(() => { setValueRef.current = setValue; }, [setValue]);

    const watchRef = useRef(watch);
    useEffect(() => { watchRef.current = watch; }, [watch]);

    const onSubmitFormRef = useRef(onSubmitForm);
    useEffect(() => { onSubmitFormRef.current = onSubmitForm; }, [onSubmitForm]);

    // Nombre de cortesía del doctor
    const doctorDisplayName = useMemo(() => {
        const raw = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.displayName || "Doctor";
        return raw.replace(/^(Dr\.|Dra\.|Dr|Dra)\s+/i, '');
    }, [userProfile]);

    // ─── MOTOR DE VOZ EDUCADÍSIMA (SINTETIZADOR) ──────────────────────────────
    const speakPolite = (text, onFinishCallback) => {
        if (voiceMuted || typeof window === 'undefined' || !window.speechSynthesis || !text) {
            if (onFinishCallback) onFinishCallback();
            return;
        }

        try {
            window.speechSynthesis.cancel();
            // Pausar reconocimiento mientras Nova habla para que no se escuche a sí misma
            stopListening();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 0.98; // Cadencia pausada, calmada y profesional
            utterance.pitch = 1.0;
            
            const voice = getSpanishVoice();
            if (voice) utterance.voice = voice;

            utterance.onstart = () => {
                setIsSpeaking(true);
            };

            const handleSpeechEnd = () => {
                setIsSpeaking(false);
                // Reanudar la escucha del doctor inmediatamente después de que Nova termina de hablar
                if (assistantMode === 'manos_libres' && voiceStepRef.current <= 4) {
                    resetTranscript();
                    startListening();
                }
                if (onFinishCallback) onFinishCallback();
            };

            utterance.onend = handleSpeechEnd;
            utterance.onerror = (e) => {
                console.warn("Speech error or cancelled:", e);
                handleSpeechEnd();
            };

            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.warn("Speech synthesis notice:", err);
            setIsSpeaking(false);
            if (onFinishCallback) onFinishCallback();
        }
    };

    // ─── BIENVENIDA INICIAL AL ABRIR EL MODAL ──────────────────────────────────
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            // Pre-cargar voces
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.getVoices();
            }

            const welcomeMsg = `Buenos días, doctor ${doctorDisplayName}. Le asiste Nova en modo manos libres. No necesita tocar nada con las manos. Dígame: ¿qué procedimiento realizamos hoy y en qué diente?`;
            setCurrentStatusMsg('Paso 1: Escuchando procedimiento y diente...');
            
            const timer = setTimeout(() => {
                speakPolite(welcomeMsg);
            }, 600);

            return () => clearTimeout(timer);
        }
    }, [doctorDisplayName]);

    // Cancelar voz y escucha al desmontar
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            stopListening();
        };
    }, []);

    // ─── CONSTRUCTOR DINÁMICO DE NOTA CLÍNICA ─────────────────────────────────
    const buildFormattedNote = (data) => {
        const spec = CLINICAL_SPECIALTIES.find(s => s.id === data.specialtyId) || CLINICAL_SPECIALTIES[0];
        const proc = spec.procedures.find(p => p.id === data.procedureId) || spec.procedures[0];

        return proc.template({
            tooth: data.tooth || 'tratada',
            surfacesText: data.surfacesText || '',
            anesthesia: data.anesthesia || 'Infiltrativa con Lidocaína al 2%',
            tolerance: data.tolerance || 'Paciente tolera el procedimiento de forma satisfactoria sin complicaciones',
            materials: proc.materials,
            postOp: proc.postOp
        });
    };

    // ─── CONTROLADOR DE VOZ MANOS LIBRES (DEBOUNCED SPEECH PROCESSOR) ─────────
    // Espera a que el doctor termine de hablar (1.6s de silencio) y procesa el paso
    useEffect(() => {
        if (assistantMode !== 'manos_libres' || isSpeaking || isProcessingStep) return;

        const currentDictation = `${transcript} ${interimTranscript}`.trim();
        if (!currentDictation || currentDictation.length < 2) return;

        const timer = setTimeout(() => {
            handleProcessDoctorSpeech(currentDictation);
        }, 1700);

        return () => clearTimeout(timer);
    }, [transcript, interimTranscript, assistantMode, isSpeaking, isProcessingStep]);

    // ─── PROCESADOR DEL HABLA DEL DOCTOR SEGÚN EL PASO ACTUAL ─────────────────
    const handleProcessDoctorSpeech = (spokenText) => {
        if (!spokenText || isSpeaking || isProcessingStep) return;
        setIsProcessingStep(true);
        setLastSpokenText(spokenText);
        resetTranscript();

        const clean = spokenText.toLowerCase().trim();
        const currentStep = voiceStepRef.current;
        console.log(`[Nova Manos Libres] Paso ${currentStep} procesando: "${spokenText}"`);

        // Comprobación de comando de cancelación o reinicio por voz
        if (isCancelCommand(clean)) {
            setVoiceStep(1);
            setCapturedData({
                procedureName: '',
                specialtyId: 'operatoria',
                procedureId: 'resina_simple',
                tooth: '',
                surfacesText: 'Oclusal',
                anesthesia: '',
                tolerance: ''
            });
            setCurrentStatusMsg('Asistente reiniciado por comando de voz');
            speakPolite(`Entendido doctor ${doctorDisplayName}. He reiniciado el proceso. Dígame nuevamente: ¿qué procedimiento realizamos hoy?`, () => {
                setIsProcessingStep(false);
            });
            return;
        }

        // Si el doctor dijo TODO en una sola frase (ej: "Hice resina en el 16 con lidocaína sin dolor y guarda")
        if (isSaveOrConfirmCommand(clean) && (clean.includes('resina') || clean.includes('exodoncia') || clean.includes('cordal') || clean.includes('endodoncia') || clean.includes('control') || clean.includes('limpieza'))) {
            const parsed = parseClinicalDictationLocally(spokenText);
            if (parsed) {
                const note = parsed.generatedText;
                if (setValueRef.current) {
                    setValueRef.current('comentario', note);
                }
                setPreviewText(note);
                setVoiceStep(5);
                setCurrentStatusMsg('✅ Guardando evolución automáticamente...');
                speakPolite(`Con el mayor de los gustos, doctor. He registrado el procedimiento y guardado la evolución en el expediente. Que tenga un excelente día.`, () => {
                    if (onSubmitFormRef.current) {
                        onSubmitFormRef.current();
                    }
                    setIsProcessingStep(false);
                });
                return;
            }
        }

        // ─── PASO 1: PROCEDIMIENTO Y DIENTE ───────────────────────────────────
        if (currentStep === 1) {
            const parsed = parseClinicalDictationLocally(spokenText);
            const detectedTooth = extractToothFromText(spokenText) || parsed?.tooth || 'tratada';
            const procName = parsed?.procedure?.name || 'Procedimiento odontológico';

            const updatedData = {
                ...capturedDataRef.current,
                procedureName: procName,
                specialtyId: parsed?.specialty?.id || 'operatoria',
                procedureId: parsed?.procedure?.id || 'resina_simple',
                tooth: detectedTooth,
                surfacesText: parsed?.surfaces?.length > 0 ? parsed.surfaces.join('-') : 'Oclusal',
                anesthesia: parsed?.anesthesia || '',
                tolerance: parsed?.tolerance || ''
            };

            setCapturedData(updatedData);

            // Si ya mencionó el anestésico en la misma frase, saltar directamente a tolerancia
            if (updatedData.anesthesia && (clean.includes('lidocaina') || clean.includes('troncular') || clean.includes('sin anestesia') || clean.includes('mepivacaina'))) {
                setVoiceStep(3);
                setCurrentStatusMsg('Paso 3: Verificando tolerancia del paciente...');
                speakPolite(`Entendido doctor, ${procName} en pieza dental ${detectedTooth} con ${updatedData.anesthesia}. ¿Hubo alguna complicación o el paciente toleró bien?`, () => {
                    setIsProcessingStep(false);
                });
            } else {
                setVoiceStep(2);
                setCurrentStatusMsg('Paso 2: Esperando técnica y anestésico...');
                speakPolite(`Entendido doctor, ${procName} en pieza dental ${detectedTooth}. ¿Qué anestésico utilizó o fue sin anestesia?`, () => {
                    setIsProcessingStep(false);
                });
            }
            return;
        }

        // ─── PASO 2: ANESTÉSICO ───────────────────────────────────────────────
        if (currentStep === 2) {
            const detectedAnesthesia = extractAnesthesiaFromText(spokenText) || 'Infiltrativa con Lidocaína 2% con epinefrina (1 carpule)';
            const updatedData = {
                ...capturedDataRef.current,
                anesthesia: detectedAnesthesia
            };
            setCapturedData(updatedData);

            setVoiceStep(3);
            setCurrentStatusMsg('Paso 3: Esperando tolerancia o complicaciones...');
            speakPolite(`Anotado doctor: ${detectedAnesthesia}. ¿Hubo alguna complicación o el paciente toleró bien el procedimiento?`, () => {
                setIsProcessingStep(false);
            });
            return;
        }

        // ─── PASO 3: TOLERANCIA / COMPLICACIONES ──────────────────────────────
        if (currentStep === 3) {
            const detectedTolerance = extractToleranceFromText(spokenText) || 'Paciente tolera el procedimiento de forma satisfactoria sin complicaciones';
            const updatedData = {
                ...capturedDataRef.current,
                tolerance: detectedTolerance
            };
            setCapturedData(updatedData);

            // Construir la nota final y escribirla directamente en el formulario
            const note = buildFormattedNote(updatedData);
            setPreviewText(note);
            if (setValueRef.current) {
                setValueRef.current('comentario', note);
            }

            setVoiceStep(4);
            setCurrentStatusMsg('Paso 4: Esperando confirmación para guardar...');
            speakPolite(`He redactado la evolución formal en el expediente doctor. ¿Desea que la guarde de una vez? Solo diga: Sí, Guardar.`, () => {
                setIsProcessingStep(false);
            });
            return;
        }

        // ─── PASO 4: CONFIRMACIÓN Y GUARDADO POR VOZ (100% MANOS LIBRES) ───────
        if (currentStep === 4) {
            if (isSaveOrConfirmCommand(clean)) {
                setVoiceStep(5);
                setCurrentStatusMsg('✅ Guardando evolución en la base de datos...');
                speakPolite(`Con el mayor de los gustos, doctor. Guardando evolución en el expediente. Que tenga un excelente día.`, () => {
                    // Ejecutar el guardado del formulario en React Hook Form
                    if (onSubmitFormRef.current) {
                        onSubmitFormRef.current();
                    }
                    setIsProcessingStep(false);
                });
            } else {
                // Si el doctor quiso agregar alguna otra indicación (ej: "agrega que se citó en 8 días")
                const currentComment = watchRef.current ? (watchRef.current("comentario") || "") : previewText;
                const updatedComment = `${currentComment}\n\nObservación adicional: ${spokenText}.`;
                if (setValueRef.current) {
                    setValueRef.current('comentario', updatedComment);
                }
                setPreviewText(updatedComment);
                speakPolite(`Entendido doctor, agregué la observación a la nota. ¿Desea que la guarde ahora? Diga: Sí o Guardar.`, () => {
                    setIsProcessingStep(false);
                });
            }
            return;
        }

        setIsProcessingStep(false);
    };

    // ─── GUARDADO MANUAL SI EL DOCTOR DECIDE HACER CLIC ───────────────────────
    const handleManualSaveNow = () => {
        if (!previewText) {
            toast.error("Aún no hay una evolución redactada.");
            return;
        }
        if (setValueRef.current) {
            setValueRef.current('comentario', previewText);
        }
        if (onSubmitFormRef.current) {
            onSubmitFormRef.current();
        }
        speakPolite("Evolución guardada con éxito, doctor.");
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
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-[#8dc63f] flex items-center justify-center text-white font-black text-sm shadow-sm">
                            <HiSparkles className="animate-pulse" />
                        </div>
                        {isSpeaking && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Asistente Nova</h4>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Manos Libres
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold leading-tight">
                            {isSpeaking ? "🗣️ Nova hablando..." : isListening ? "🎙️ Escuchando al doctor..." : `Dr. ${doctorDisplayName}`}
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
                                speakPolite(`Voz educada de Nova activada, doctor.`);
                            }
                            toast.info(next ? "Voz de Nova silenciada" : "Voz educada activada");
                        }}
                        className={`p-1.5 rounded-lg border transition-all ${
                            voiceMuted 
                                ? 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-600' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title={voiceMuted ? "Activar voz de Nova" : "Silenciar voz de Nova"}
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
                        title="Opciones"
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
                            <FiCheck size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Selector de Modo */}
            <div className="grid grid-cols-2 bg-slate-200/60 p-1 rounded-xl gap-1 text-[10px] font-black uppercase tracking-wider">
                <button
                    type="button"
                    onClick={() => {
                        setAssistantMode('manos_libres');
                        resetTranscript();
                        startListening();
                        speakPolite("Modo manos libres activo, doctor. Dígame qué procedimiento realizamos.");
                    }}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        assistantMode === 'manos_libres' 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <FiMic size={12} />
                    <span>Modo Manos Libres (Por Voz)</span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        stopListening();
                        setAssistantMode('plantillas');
                    }}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        assistantMode === 'plantillas' 
                            ? 'bg-white text-indigo-700 shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <FiLayers size={12} />
                    <span>Selector Manual</span>
                </button>
            </div>

            {/* Ajustes Opcionales */}
            {showSettings && (
                <div className="bg-white border border-indigo-100 rounded-xl p-3 flex flex-col gap-2.5 animate-fadeIn shadow-xs">
                    <h5 className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">Conexión Opcional a Gemini</h5>
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                        Este asistente ya es <strong className="text-emerald-600">100% gratuito y manos libres</strong>. Si deseas ingresar una clave API propia de Google AI Studio, puedes colocarla aquí:
                    </p>
                    <form onSubmit={handleSaveApiKey} className="flex gap-1.5">
                        <input
                            type="password"
                            placeholder="Clave API opcional..."
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

            {/* ─── VISTA PRINCIPAL: MODO MANOS LIBRES (100% POR VOZ) ─────────── */}
            {assistantMode === 'manos_libres' && (
                <div className="space-y-3 animate-fadeIn">
                    {/* Barra de Pasos Visual (Progreso de la Conversación) */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                            <span className="text-slate-400">Progreso Manos Libres</span>
                            <span className="text-indigo-600 font-black">
                                Paso {Math.min(voiceStep, 4)} de 4
                            </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                            {[
                                { step: 1, label: '1. Procedim.' },
                                { step: 2, label: '2. Anestesia' },
                                { step: 3, label: '3. Tolerancia' },
                                { step: 4, label: '4. Guardar' }
                            ].map((s) => {
                                const isDone = voiceStep > s.step;
                                const isCurrent = voiceStep === s.step;
                                return (
                                    <div 
                                        key={s.step}
                                        className={`py-1.5 px-1 rounded-lg text-center text-[9px] font-black uppercase tracking-wider transition-all border ${
                                            isDone 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : isCurrent 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm animate-pulse'
                                                : 'bg-slate-50 text-slate-400 border-slate-200/60'
                                        }`}
                                    >
                                        {isDone ? `✓ ${s.label}` : s.label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Estado del Asistente y Ondas de Audio */}
                    <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 rounded-2xl text-white shadow-md space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                    isSpeaking 
                                        ? 'bg-cyan-400 animate-ping' 
                                        : isListening 
                                        ? 'bg-emerald-400 animate-pulse' 
                                        : 'bg-slate-500'
                                }`} />
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                                    {isSpeaking 
                                        ? 'Nova hablando con el doctor...' 
                                        : isListening 
                                        ? 'Micrófono activo (hable libremente)' 
                                        : 'Micrófono en pausa'}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setVoiceStep(1);
                                    resetTranscript();
                                    speakPolite(`Reiniciado doctor. Dígame: ¿qué procedimiento realizamos hoy?`);
                                }}
                                className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                                title="Reiniciar conversación"
                            >
                                <FiRotateCcw size={12} />
                            </button>
                        </div>

                        {/* Visualizador de audio animado */}
                        <div className="flex items-center justify-center gap-1.5 h-7 bg-black/20 rounded-xl px-3">
                            <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-4" />
                            <span className="w-1 bg-cyan-400 rounded-full animate-pulse h-6 delay-75" />
                            <span className="w-1 bg-emerald-300 rounded-full animate-pulse h-3 delay-150" />
                            <span className="w-1 bg-indigo-400 rounded-full animate-pulse h-5 delay-100" />
                            <span className="w-1 bg-cyan-300 rounded-full animate-pulse h-2 delay-200" />
                            <span className="text-[10px] font-mono text-emerald-200 font-bold ml-2 truncate">
                                {transcript || interimTranscript || currentStatusMsg}
                            </span>
                        </div>

                        {/* Datos capturados en vivo por la voz */}
                        <div className="bg-white/10 rounded-xl p-2.5 space-y-1 text-[10px] text-slate-200 font-bold">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Procedimiento / Diente:</span>
                                <span className="text-white font-black">{capturedData.procedureName || 'Pendiente'} {capturedData.tooth ? `(Pza ${capturedData.tooth})` : ''}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Anestésico:</span>
                                <span className="text-emerald-300 font-black">{capturedData.anesthesia || 'Pendiente'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Tolerancia:</span>
                                <span className="text-cyan-300 font-black truncate max-w-[180px]">{capturedData.tolerance || 'Pendiente'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Nota clínica en tiempo real */}
                    {previewText && (
                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-2 shadow-xs animate-fadeIn">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1">
                                    <HiSparkles className="text-[#8dc63f]" />
                                    Evolución Clínica Redactada
                                </span>
                                <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    Lista en el expediente
                                </span>
                            </div>

                            <p className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs font-bold text-slate-700 leading-relaxed max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-line">
                                {previewText}
                            </p>

                            {/* Indicador de confirmación por voz */}
                            {voiceStep === 4 && (
                                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800">
                                    <div className="flex items-center gap-1.5 text-xs font-black">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                        <span>Diga "Guardar" o "Sí" para finalizar</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleManualSaveNow}
                                        className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1 shadow-xs"
                                    >
                                        <FiSave /> Guardar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Guía de Comandos Rápidos de Voz */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-[10px] text-slate-500 font-bold space-y-1">
                        <span className="font-black text-slate-700 uppercase tracking-wider block">
                            🎙️ Comandos de voz que puedes decir:
                        </span>
                        <p>• <em>"Resina en el 16 con lidocaína sin dolor y guarda"</em></p>
                        <p>• <em>"Exodoncia cordal 38 con troncular sin complicaciones"</em></p>
                        <p>• <em>"Sí" / "Guardar" / "Listo"</em> (para guardar y cerrar)</p>
                        <p>• <em>"Reiniciar" / "Cancelar"</em> (para empezar de nuevo)</p>
                    </div>
                </div>
            )}

            {/* ─── VISTA SECUNDARIA: SELECTOR MANUAL POR PLANTILLAS ──────────── */}
            {assistantMode === 'plantillas' && (
                <div className="space-y-3 animate-fadeIn">
                    {/* Especialidades */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                            Especialidad Odontológica
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {CLINICAL_SPECIALTIES.map(spec => (
                                <button
                                    key={spec.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedSpecialtyId(spec.id);
                                        const first = spec.procedures[0];
                                        setSelectedProcedureId(first.id);
                                        if (first.anesthesiaDefault) setSelectedAnesthesia(first.anesthesiaDefault);
                                    }}
                                    className={`p-2 rounded-xl border text-center transition-all ${
                                        selectedSpecialtyId === spec.id 
                                            ? 'bg-indigo-600 text-white font-black shadow-xs' 
                                            : 'bg-white hover:bg-slate-50 text-slate-700 font-bold border-slate-200'
                                    }`}
                                >
                                    <span className="text-base block">{spec.icon}</span>
                                    <span className="text-[9px] line-clamp-1">{spec.name.split(' ')[0]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Procedimientos */}
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                            Procedimiento
                        </label>
                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar bg-white p-1 rounded-xl border border-slate-200">
                            {(CLINICAL_SPECIALTIES.find(s => s.id === selectedSpecialtyId) || CLINICAL_SPECIALTIES[0]).procedures.map(proc => (
                                <button
                                    key={proc.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedProcedureId(proc.id);
                                        if (proc.anesthesiaDefault) setSelectedAnesthesia(proc.anesthesiaDefault);
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs transition-all flex items-center justify-between ${
                                        selectedProcedureId === proc.id 
                                            ? 'bg-indigo-50 text-indigo-950 font-black border border-indigo-200' 
                                            : 'text-slate-700 font-bold hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="truncate">{proc.name}</span>
                                    {selectedProcedureId === proc.id && <FiCheck className="text-indigo-600" size={13} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Botón Aplicar y Guardar */}
                    <button
                        type="button"
                        onClick={() => {
                            const spec = CLINICAL_SPECIALTIES.find(s => s.id === selectedSpecialtyId);
                            const proc = spec?.procedures.find(p => p.id === selectedProcedureId);
                            if (proc) {
                                const note = proc.template({
                                    tooth: selectedTooth || '16',
                                    surfacesText: selectedSurfaces.join('-'),
                                    anesthesia: selectedAnesthesia,
                                    tolerance: selectedTolerance,
                                    materials: proc.materials,
                                    postOp: proc.postOp
                                });
                                if (setValueRef.current) setValueRef.current('comentario', note);
                                toast.success("Evolución aplicada");
                                speakPolite("Evolución aplicada al formulario.");
                            }
                        }}
                        className="w-full py-2.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-lime-500/20"
                    >
                        <FiCheckCircle size={14} />
                        Aplicar al Formulario
                    </button>
                </div>
            )}
        </div>
    );
}
