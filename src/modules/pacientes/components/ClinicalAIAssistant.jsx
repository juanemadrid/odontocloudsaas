import React, { useState, useEffect } from 'react';
import { 
    FiMic, FiMicOff, FiCpu, FiSettings, FiCheck, 
    FiRefreshCw, FiExternalLink, FiX, FiTrash2 
} from 'react-icons/fi';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import { refineClinicalNotes, chatGuidedAssistant } from '../../../services/geminiService';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { getGeminiApiKey, saveGeminiApiKey } from '../../../services/geminiKeyService';

const getSpanishVoice = () => {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => v.lang.startsWith('es') || v.lang.startsWith('ES'));
    if (spanishVoices.length === 0) return null;
    
    // 1. Prioritize neural/natural voices (Edge neural voices)
    let voice = spanishVoices.find(v => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('neural'));
    
    // 2. Prioritize Google voices (Chrome online voices)
    if (!voice) {
        voice = spanishVoices.find(v => v.name.toLowerCase().includes('google'));
    }
    
    // 3. Prioritize specific Spanish accents (Spain/Mexico/Colombia) depending on availability
    if (!voice) {
        voice = spanishVoices.find(v => v.lang === 'es-ES' || v.lang === 'es_ES');
    }
    if (!voice) {
        voice = spanishVoices.find(v => v.lang === 'es-MX' || v.lang === 'es_MX');
    }
    if (!voice) {
        voice = spanishVoices.find(v => v.lang === 'es-CO' || v.lang === 'es_CO');
    }
    
    // 4. Fallback to any Spanish voice
    if (!voice) {
        voice = spanishVoices[0];
    }
    
    return voice;
};

const INTERIM_FLUSH_DELAY_MS = 3000;
const CONVERSATION_SILENCE_DELAY_MS = 2200;

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
    const [isConversational, setIsConversational] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [chatHistory, setChatHistory] = useState([]);
    const isFirstRun = React.useRef(true);
    const chatContainerRef = React.useRef(null);

    // Refs to stabilize dependencies of the debounced speech processor
    const doctorsRef = React.useRef(doctors);
    const planesRef = React.useRef(planes);
    const setValueRef = React.useRef(setValue);
    const watchRef = React.useRef(watch);
    const onSubmitFormRef = React.useRef(onSubmitForm);
    const activeTabRef = React.useRef(activeTab);
    const currentStepRef = React.useRef(currentStep);
    const chatHistoryRef = React.useRef(chatHistory);
    const serviciosRef = React.useRef(servicios);

    // Keep refs up-to-date on every render
    useEffect(() => { doctorsRef.current = doctors; });
    useEffect(() => { planesRef.current = planes; });
    useEffect(() => { setValueRef.current = setValue; });
    useEffect(() => { watchRef.current = watch; });
    useEffect(() => { onSubmitFormRef.current = onSubmitForm; });
    useEffect(() => { activeTabRef.current = activeTab; });
    useEffect(() => { currentStepRef.current = currentStep; });
    useEffect(() => { chatHistoryRef.current = chatHistory; });
    useEffect(() => { serviciosRef.current = servicios; });

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        if (chatContainerRef.current) {
            scrollToBottom();
            
            // Multiple triggers to guarantee scrolling is updated after complete rendering
            const t1 = setTimeout(scrollToBottom, 50);
            const t2 = setTimeout(scrollToBottom, 150);
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [chatHistory]);

    // Use our Speech Recognition hook - in persistent mode if Conversational Mode is active
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
    } = useSpeechRecognition(isConversational);

    // Ref to always have latest interimTranscript available in timers
    const interimTranscriptRef = React.useRef(interimTranscript);
    useEffect(() => { interimTranscriptRef.current = interimTranscript; }, [interimTranscript]);
    const transcriptRef = React.useRef(transcript);
    useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
    const isLoadingRef = React.useRef(false);
    // Tracks the last text sent to Gemini to prevent double-processing (interim + final same phrase)
    const lastProcessedTextRef = React.useRef('');

    // Fallback: promote interimTranscript → transcript after 1.5s silence
    // Fixes Chrome bug where results sometimes never become 'final'
    useEffect(() => {
        if (!isConversational || !interimTranscript.trim()) return;
        
        const flushTimer = setTimeout(() => {
            // Only flush if there's interim text but no new final text arrived, and we're not already processing
            const latestInterim = interimTranscriptRef.current.trim();
            if (latestInterim && !isLoadingRef.current) {
                // Promote interim to final transcript so the debounce effect triggers
                setTranscript(prev => {
                    const cleanPrev = prev.trim();
                    if (!cleanPrev) return latestInterim;
                    // Avoid appending duplicates
                    if (cleanPrev.endsWith(latestInterim)) return cleanPrev;
                    return cleanPrev + ' ' + latestInterim;
                });
            }
        }, INTERIM_FLUSH_DELAY_MS); // Usar el delay de flush correcto para esperar a que termine de hablar antes de forzar el final
        
        return () => clearTimeout(flushTimer);
    }, [interimTranscript, isConversational, setTranscript]);

    const [apiKey, setApiKey] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const apiKeyRef = React.useRef(apiKey);
    useEffect(() => { apiKeyRef.current = apiKey; });

    // Mount/Unmount coordination for background voice assistant and pre-fetching voices
    useEffect(() => {
        window.localVoiceAssistantOpen = true;
        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
        }
        window.dispatchEvent(new CustomEvent('speech-recognition-active', { detail: { active: true } }));

        return () => {
            window.localVoiceAssistantOpen = false;
            window.dispatchEvent(new CustomEvent('speech-recognition-active', { detail: { active: false } }));
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    // Cargar la API key desde Firestore (admin) o fallback a localStorage/env
    useEffect(() => {
        const loadKey = async () => {
            const key = await getGeminiApiKey(userProfile?.inquilino);
            if (key) setApiKey(key);
        };
        loadKey();
    }, [userProfile?.inquilino]);

    useEffect(() => {
        if (speechError) {
            toast.error(speechError);
        }
    }, [speechError]);

    // Al activar o desactivar el modo conversacional, manejamos la bienvenida verbal y el inicio de pasos
    useEffect(() => {
        if (isConversational) {
            const isDoc = userProfile?.esDoctor || userProfile?.rol === 'doctor';
            const doctorName = userProfile?.nombreCompleto || userProfile?.nombre || "";
            const cleanName = doctorName.replace(/^(Dr\.|Dra\.|Dr|Dra)\s+/i, '');
            const displayName = cleanName ? `doctor ${cleanName}` : "doctor";
            
            let greeting = "";
            
            // Auto-seleccionar doctor si es perfil doctor
            if (setValue) {
                const byUid = doctors.find(d => d.id === userProfile?.uid || d.uid === userProfile?.uid);
                const byEmail = !byUid && userProfile?.email
                    ? doctors.find(d => (d.email || d.correo || '').toLowerCase() === userProfile.email.toLowerCase())
                    : null;
                const resolvedDocId = byUid?.id || byEmail?.id || userProfile?.uid;
                if (resolvedDocId) {
                    setValue('doctorId', resolvedDocId);
                }
            }

            if (activeTab === 'nota') {
                const hasDoctorId = watch && watch("doctorId");
                const currentStart = hasDoctorId ? 2 : 1;
                setCurrentStep(currentStart);

                if (isFirstRun.current) {
                    if (currentStart === 2) {
                        greeting = `¡Hola, ${displayName}! Le habla Nova, su asistente virtual. ¿Qué aclaración clínica registraremos hoy?`;
                    } else {
                        greeting = "¡Hola! Le habla Nova, su asistente virtual. Para iniciar, ¿qué doctor registra esta nota?";
                    }
                } else {
                    if (currentStart === 2) {
                        greeting = `Le habla Nova, ${displayName}. Por favor, dícteme la aclaración clínica.`;
                    } else {
                        greeting = "Le habla Nova. ¿Qué doctor registra la nota aclaratoria?";
                    }
                }
            } else {
                if (isFirstRun.current) {
                    if (isDoc) {
                        setCurrentStep(2);
                        greeting = `¡Hola, ${displayName}! Le habla Nova, su asistente clínica. Vamos a registrar la evolución completa. ¿Bajo qué plan de tratamiento trabajamos hoy?`;
                    } else {
                        setCurrentStep(1);
                        greeting = "¡Hola! Le habla Nova, su asistente clínica. Para registrar la evolución, dígame: ¿qué doctor atiende al paciente hoy?";
                    }
                } else {
                    if (isDoc) {
                        setCurrentStep(2);
                        greeting = `Le habla Nova, ${displayName}. ¿Qué plan de tratamiento registraremos en esta sesión?`;
                    } else {
                        greeting = "Le habla Nova. ¿Qué doctor está a cargo del procedimiento de hoy?";
                    }
                }
            }
            
            isFirstRun.current = false;

            setChatHistory([
                { role: 'model', parts: [{ text: greeting }] }
            ]);

            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(greeting);
                utterance.lang = 'es-ES';
                utterance.rate = 0.98; // Velocidad pausada y natural para clínica profesional
                const spanishVoice = getSpanishVoice();
                if (spanishVoice) {
                    utterance.voice = spanishVoice;
                }
                
                // Safety fallback: if speech synthesis gets blocked or stuck, start listening after a dynamic safety window anyway
                const greetingDuration = Math.max(8000, greeting.length * 65);
                const safetyTimer = setTimeout(() => {
                    startListening();
                }, greetingDuration);

                utterance.onstart = () => {
                    scrollToBottom();
                };
                utterance.onboundary = () => {
                    scrollToBottom();
                };
                utterance.onend = () => {
                    clearTimeout(safetyTimer);
                    startListening();
                };
                utterance.onerror = () => {
                    clearTimeout(safetyTimer);
                    startListening();
                };
                window.speechSynthesis.speak(utterance);
            } else {
                startListening();
            }
        } else {
            setCurrentStep(0);
            isFirstRun.current = true;
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        }
    }, [isConversational, userProfile, setValue, activeTab]);

    // Conversational Mode: Debounced speech processor (waits for 2200ms of silence before calling Gemini)
    useEffect(() => {
        if (!isConversational || !transcript.trim() || isLoadingRef.current) return;

        const timer = setTimeout(async () => {
            const rawText = transcript.trim();
            const textLower = rawText.toLowerCase();

            // Detectar comandos de voz para cambio de pestaña
            if (textLower.includes("nota aclaratoria") || textLower.includes("nota aclaratorio") || textLower.includes("cambiar a nota") || textLower.includes("pasar a nota") || textLower.includes("ir a nota")) {
                if (setActiveTab && activeTabRef.current !== 'nota') {
                    stopListening();
                    resetTranscript();
                    setActiveTab('nota');
                    return;
                }
            } else if (textLower.includes("evolución") || textLower.includes("evolucion") || textLower.includes("cambiar a evolución") || textLower.includes("cambiar a evolucion") || textLower.includes("pasar a evolución") || textLower.includes("pasar a evolucion") || textLower.includes("ir a evolución") || textLower.includes("ir a evolucion")) {
                if (setActiveTab && activeTabRef.current !== 'evolucion') {
                    stopListening();
                    resetTranscript();
                    setActiveTab('evolucion');
                    return;
                }
            }
            
            // 1. Temporarily stop listening to prevent the mic from capturing the AI's spoken response
            stopListening();
            resetTranscript();

            // Anti-duplicate guard: skip if this exact text was already sent to Gemini
            // Solo bloquea si el texto es IDÉNTICO y fue procesado hace menos de 3 segundos
            if (rawText === lastProcessedTextRef.current) {
                console.log("[Nova] Texto duplicado ignorado:", rawText);
                startListening();
                return;
            }
            lastProcessedTextRef.current = rawText;

            setLoading(true);
            isLoadingRef.current = true;

            try {
                const effectiveKey = apiKeyRef.current.trim() || import.meta.env.VITE_GEMINI_API_KEY || '';
                if (!effectiveKey) {
                    toast.error('Debe configurar su Clave API de Gemini.');
                    setShowSettings(true);
                    startListening();
                    return;
                }

                console.log("Conversational Assistant processing:", rawText);

                // Preparar los datos actuales del formulario
                const contextData = {
                    doctors: doctorsRef.current || [],
                    planes: planesRef.current || [],
                    servicios: serviciosRef.current || [],
                    activeTab: activeTabRef.current,
                    currentForm: {
                        doctorId: watchRef.current ? watchRef.current("doctorId") : '',
                        planId: watchRef.current ? watchRef.current("planId") : '',
                        horaInicio: watchRef.current ? watchRef.current("horaInicio") : '',
                        horaFin: watchRef.current ? watchRef.current("horaFin") : '',
                        comentario: watchRef.current ? watchRef.current("comentario") : '',
                        aplicaMedicamento: watchRef.current ? watchRef.current("aplicaMedicamento") : false,
                        detalleMedicamento: watchRef.current ? watchRef.current("detalleMedicamento") : '',
                        controlEsterilizacion: watchRef.current ? watchRef.current("controlEsterilizacion") : false
                    }
                };

                // Llamar al servicio interactivo guiado
                const response = await chatGuidedAssistant(rawText, currentStepRef.current, chatHistoryRef.current, contextData, effectiveKey);

                // Actualizar los campos del formulario en React Hook Form en tiempo real
                if (response.fieldToUpdate && response.extractedValue !== null) {
                    if (response.fieldToUpdate === 'horas') {
                        if (response.extractedValue.horaInicio) setValueRef.current('horaInicio', response.extractedValue.horaInicio);
                        if (response.extractedValue.horaFin) setValueRef.current('horaFin', response.extractedValue.horaFin);
                    } else if (response.fieldToUpdate === 'horaInicio') {
                        setValueRef.current('horaInicio', response.extractedValue);
                    } else if (response.fieldToUpdate === 'aplicaMedicamento') {
                        setValueRef.current('aplicaMedicamento', !!response.extractedValue);
                    } else if (response.fieldToUpdate === 'controlEsterilizacion') {
                        setValueRef.current('controlEsterilizacion', !!response.extractedValue);
                    } else if (response.fieldToUpdate === 'resumen') {
                        // Paso 7: Nova hace el resumen verbal – no actualizar ningún campo del formulario.
                        // Solo se muestra el resumen en el chat y se espera confirmación del doctor.
                        console.log('[Nova] Paso 7 – Resumen verbal antes de guardar.');
                    } else if (response.fieldToUpdate === 'submit') {
                        if (response.extractedValue === true) {
                            // Rellenar automáticamente la hora de fin con la hora actual si está vacía
                            if (watchRef.current && !watchRef.current("horaFin")) {
                                const now = new Date();
                                const hh = String(now.getHours()).padStart(2, '0');
                                const mm = String(now.getMinutes()).padStart(2, '0');
                                setValueRef.current('horaFin', `${hh}:${mm}`);
                            }
                            if (onSubmitFormRef.current) {
                                onSubmitFormRef.current();
                            }
                        }
                    } else {
                        setValueRef.current(response.fieldToUpdate, response.extractedValue);
                    }
                }

                // Procesar actualizaciones secundarias (extraUpdates) en segundo plano
                if (response.extraUpdates) {
                    Object.entries(response.extraUpdates).forEach(([field, val]) => {
                        if (val !== null && val !== undefined) {
                            if (field === 'aplicaMedicamento' || field === 'controlEsterilizacion') {
                                setValueRef.current(field, !!val);
                            } else if (field === 'completarProcedimientos' && Array.isArray(val) && setPlantillaDetails && serviciosRef.current) {
                                setPlantillaDetails(prev => {
                                    const next = { ...prev };
                                    if (val.includes("todos") || val.includes("all")) {
                                        Object.keys(next).forEach(k => {
                                            const srv = serviciosRef.current.find(s => s.id === k);
                                            next[k] = { 
                                                ...next[k], 
                                                checked: true, 
                                                realizado: true,
                                                desc: srv?.desc || srv?.procedimiento || srv?.nombre || next[k]?.desc || '',
                                                dientes: srv?.dientes || next[k]?.dientes || ''
                                            };
                                        });
                                    } else if (val.includes("ninguno") || val.includes("none")) {
                                        Object.keys(next).forEach(k => {
                                            next[k] = { ...next[k], checked: false, realizado: false };
                                        });
                                    } else {
                                        val.forEach(item => {
                                            if (typeof item === 'number') {
                                                const srv = serviciosRef.current[item - 1];
                                                if (srv && next[srv.id]) {
                                                    next[srv.id] = { 
                                                        ...next[srv.id], 
                                                        checked: true, 
                                                        realizado: true,
                                                        desc: srv.desc || srv.procedimiento || srv.nombre || '',
                                                        dientes: srv.dientes || ''
                                                    };
                                                }
                                            } else if (typeof item === 'string') {
                                                const idx = parseInt(item, 10);
                                                if (!isNaN(idx)) {
                                                    const srv = serviciosRef.current[idx - 1];
                                                    if (srv && next[srv.id]) {
                                                        next[srv.id] = { 
                                                            ...next[srv.id], 
                                                            checked: true, 
                                                            realizado: true,
                                                            desc: srv.desc || srv.procedimiento || srv.nombre || '',
                                                            dientes: srv.dientes || ''
                                                        };
                                                    }
                                                } else {
                                                    const srv = serviciosRef.current.find(s => 
                                                        (s.desc || s.procedimiento || s.nombre || '').toLowerCase().includes(item.toLowerCase())
                                                    );
                                                    if (srv && next[srv.id]) {
                                                        next[srv.id] = { 
                                                            ...next[srv.id], 
                                                            checked: true, 
                                                            realizado: true,
                                                            desc: srv.desc || srv.procedimiento || srv.nombre || '',
                                                            dientes: srv.dientes || ''
                                                        };
                                                    }
                                                }
                                            }
                                        });
                                    }
                                    return next;
                                });
                            } else if (field === 'medicamentos' && Array.isArray(val)) {
                                const current = watchRef.current ? watchRef.current("medicamentos") || [] : [];
                                const filteredNew = val.filter(newMed => 
                                    newMed.medicamento && 
                                    !current.some(c => 
                                        c.medicamento.toLowerCase() === newMed.medicamento.toLowerCase() &&
                                        c.via === newMed.via
                                    )
                                );
                                if (filteredNew.length > 0) {
                                    setValueRef.current("medicamentos", [...current, ...filteredNew]);
                                    setValueRef.current("aplicaMedicamento", true);
                                }
                            } else if (field === 'esterilizaciones' && Array.isArray(val)) {
                                const current = watchRef.current ? watchRef.current("esterilizaciones") || [] : [];
                                const filteredNew = val.filter(newEst => 
                                    newEst.ciclo &&
                                    !current.some(c => 
                                        c.ciclo.toLowerCase() === newEst.ciclo.toLowerCase() &&
                                        c.concepto === newEst.concepto
                                    )
                                );
                                if (filteredNew.length > 0) {
                                    setValueRef.current("esterilizaciones", [...current, ...filteredNew]);
                                    setValueRef.current("controlEsterilizacion", true);
                                }
                            } else {
                                setValueRef.current(field, val);
                            }
                        }
                    });
                }

                // Avanzar al siguiente paso sugerido
                if (response.nextStep) {
                    setCurrentStep(response.nextStep);
                }

                // Generar vista estructurada para la previsualización inferior
                setResult({
                    comentario: watchRef.current ? watchRef.current("comentario") : (response.fieldToUpdate === 'comentario' ? response.extractedValue : ''),
                    tratamiento: watchRef.current ? watchRef.current("planId") : '',
                    prognosis: 'Favorable'
                });

                // Agregar al historial de conversación local
                setChatHistory(prev => [
                    ...prev,
                    { role: 'user', parts: [{ text: rawText }] },
                    { role: 'model', parts: [{ text: response.speechResponse }] }
                ]);

                // Sintetizar la respuesta de voz y continuar la escucha
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(response.speechResponse);
                    utterance.lang = 'es-ES';
                    utterance.rate = 1.1; // Velocidad un poco más rápida para mayor agilidad profesional
                    const spanishVoice = getSpanishVoice();
                    if (spanishVoice) {
                        utterance.voice = spanishVoice;
                    }
                    
                    // Safety fallback: if response speech synthesis gets blocked, start listening after a dynamic safety window
                    const responseDuration = Math.max(10000, response.speechResponse.length * 65);
                    const responseSafetyTimer = setTimeout(() => {
                        if (!(response.fieldToUpdate === 'submit' && response.extractedValue === true)) {
                            startListening();
                        }
                    }, responseDuration);

                    utterance.onstart = () => {
                        scrollToBottom();
                    };
                    utterance.onboundary = () => {
                        scrollToBottom();
                    };
                    
                    utterance.onend = () => {
                        clearTimeout(responseSafetyTimer);
                        if (!(response.fieldToUpdate === 'submit' && response.extractedValue === true)) {
                            startListening();
                        }
                    };
                    utterance.onerror = () => {
                        clearTimeout(responseSafetyTimer);
                        startListening();
                    };
                    
                    window.speechSynthesis.speak(utterance);
                } else {
                    if (!(response.fieldToUpdate === 'submit' && response.extractedValue === true)) {
                        startListening();
                    }
                }
            } catch (err) {
                console.error("Error en asistente conversacional:", err);
                const msg = err.message || '';
                const isCapacityError = msg.includes('high demand') || msg.includes('503') || msg.includes('unavailable') || msg.includes('no está disponible');
                const isDenied = msg.includes('denied access') || msg.includes('Forbidden') || msg.includes('403') || msg.includes('API_KEY_INVALID') || msg.includes('invalid');
                const isQuotaZero = msg.includes('limit: 0') || msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
                const isJsonError = err instanceof SyntaxError || msg.includes('JSON') || msg.includes('Unexpected token');
                
                if (isDenied) {
                    toast.error('⛔ API Key inválida o sin acceso. Ve a Ajustes y verifica tu clave de Gemini.', { duration: 6000 });
                } else if (isQuotaZero) {
                    toast.warning('⏳ Límite de velocidad alcanzado. Espera unos segundos y vuelve a hablar.', { duration: 4000 });
                } else if (isCapacityError) {
                    toast.warning('Nova está ocupada un momento. Hable nuevamente para reintentar.');
                } else if (isJsonError) {
                    toast.error('Error al interpretar respuesta de Gemini. Intenta hablar de nuevo.', { duration: 4000 });
                } else {
                    toast.error(`Error: ${msg || 'No se pudo conectar con el asistente.'}`, { duration: 5000 });
                }
                resetTranscript(); // Limpiar transcripción para evitar reintentar con el mismo texto y romper el bucle
                startListening();
            } finally {
                setLoading(false);
                isLoadingRef.current = false;
                // Limpiar guard de deduplicación después de 2s para evitar bloquear el siguiente turno
                setTimeout(() => { lastProcessedTextRef.current = ''; }, 2000);
            }
        }, CONVERSATION_SILENCE_DELAY_MS); // Usar el delay correcto para dar tiempo a hablar sin fragmentar la frase

        return () => clearTimeout(timer);
    }, [transcript, isConversational, stopListening, startListening, resetTranscript]);

    const handleSaveApiKey = async (e) => {
        e.preventDefault();
        try {
            await saveGeminiApiKey(userProfile?.inquilino, apiKey.trim());
            toast.success('Clave API guardada para toda la clínica');
            setShowSettings(false);
        } catch (err) {
            toast.error('Error al guardar: ' + err.message);
        }
    };

    const handleToggleListen = () => {
        if (isListening) {
            stopListening();
        } else {
            resetTranscript();
            startListening();
        }
    };

    const handleRefine = async () => {
        const rawText = transcript.trim();
        if (!rawText) {
            toast.error('Primero dicte o escriba algún comentario.');
            return;
        }

        const effectiveKey = apiKey.trim() || import.meta.env.VITE_GEMINI_API_KEY || '';
        if (!effectiveKey) {
            toast.error('Debe configurar su Clave API de Gemini.');
            setShowSettings(true);
            return;
        }

        setLoading(true);
        try {
            const refined = await refineClinicalNotes(rawText, effectiveKey);
            setResult(refined);
            toast.success('Nota de evolución estructurada con éxito');
        } catch (e) {
            toast.error(e.message || 'Error al procesar con la IA. Verifique su API Key.');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyResult = () => {
        if (!result) return;
        onApply({
            comentario: result.comentario,
            treatment: result.tratamiento,
            prognosis: result.prognosis
        });
        toast.success('Datos insertados en el formulario');
        if (onClose) onClose();
    };

    const handleClearHistory = () => {
        setChatHistory([]);
        setResult(null);
        setCurrentStep(1);
        toast.success('Historial del asistente reiniciado');
    };

    return (
        <div className="bg-white border border-slate-100 rounded-[16px] p-5 shadow-xl flex flex-col gap-4 animate-fadeIn relative overflow-y-auto custom-scrollbar h-full max-h-[480px]">
            {/* Top gradient accent */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-[#8dc63f] rounded-t-[16px]" />
            
            <style>{`
                @keyframes oc-wave {
                    0%, 100% { transform: scaleY(0.35); }
                    50% { transform: scaleY(1.3); }
                }
                .oc-wave-bar {
                    display: inline-block;
                    width: 3px;
                    border-radius: 0px;
                    background-color: #10b981; /* emerald-500 */
                    animation: oc-wave 1s ease-in-out infinite;
                }
                .oc-wave-bar:nth-child(1) { height: 10px; animation-delay: 0.1s; }
                .oc-wave-bar:nth-child(2) { height: 16px; animation-delay: 0.2s; }
                .oc-wave-bar:nth-child(3) { height: 12px; animation-delay: 0.3s; }
                .oc-wave-bar:nth-child(4) { height: 20px; animation-delay: 0.4s; }
                .oc-wave-bar:nth-child(5) { height: 14px; animation-delay: 0.5s; }
                .oc-wave-bar:nth-child(6) { height: 8px; animation-delay: 0.6s; }
            `}</style>
            
            {/* Cabecera Ultra Limpia y Compacta */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-[8px]">
                        <FiCpu className={isListening ? "animate-pulse" : ""} size={14} />
                    </span>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Asistente Nova</h4>
                </div>
                
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-1.5 rounded-[8px] transition-colors border ${
                            showSettings 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500'
                        }`}
                        title="Ajustes de API"
                    >
                        <FiSettings size={13} />
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-[8px] bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            <FiX size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* Selector de Modo Premium */}
            <div className="flex bg-slate-100 p-0.5 rounded-[12px] shrink-0 border border-slate-200/20">
                <button
                    type="button"
                    onClick={() => {
                        stopListening();
                        resetTranscript();
                        setIsConversational(false);
                        setResult(null);
                        setChatHistory([]);
                        toast.info("Modo Dictar Texto Activo");
                    }}
                    className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-[10px] ${
                        !isConversational 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'bg-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Dictar Texto
                </button>
                <button
                    type="button"
                    onClick={() => {
                        stopListening();
                        resetTranscript();
                        setIsConversational(true);
                        setResult(null);
                        setChatHistory([]);
                        toast.info("Modo Asistente Guiado Activo");
                    }}
                    className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-[10px] ${
                        isConversational 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'bg-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Asistente Guiado
                </button>
            </div>

            {/* Ajustes de API */}
            {showSettings && (
                <div className="bg-white border border-indigo-100 rounded-[12px] p-4 flex flex-col gap-3 animate-fadeIn shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">Configurar Gemini API (100% Gratis)</h5>
                            <p className="text-[9px] text-slate-400 font-bold mt-1 max-w-[220px] leading-relaxed">
                                Obtenga una API Key gratis en Google AI Studio.
                            </p>
                        </div>
                        <a 
                            href="https://aistudio.google.com/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 hover:underline"
                        >
                            Obtener Key <FiExternalLink size={10} />
                        </a>
                    </div>
                    <form onSubmit={handleSaveApiKey} className="flex gap-2">
                        <input
                            type="password"
                            placeholder="Pegue su clave API aquí..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-[8px] border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-indigo-500 caret-slate-950"
                        />
                        <button
                            type="submit"
                            className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[8px] text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Guardar
                        </button>
                    </form>
                </div>
            )}

            {/* Modo Conversacional - Historial de Chat y Estado */}
            {isConversational ? (
                <div className="flex flex-col gap-4">
                    {/* Estado del Asistente */}
                    <div className="flex items-center justify-between bg-white border border-slate-100 rounded-[12px] p-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            {isListening && !loading && !window.speechSynthesis?.speaking ? (
                                <div className="flex items-center gap-0.5 h-4 px-1 shrink-0">
                                    <span className="oc-wave-bar"></span>
                                    <span className="oc-wave-bar"></span>
                                    <span className="oc-wave-bar"></span>
                                    <span className="oc-wave-bar"></span>
                                    <span className="oc-wave-bar"></span>
                                </div>
                            ) : (
                                <div className={`w-2.5 h-2.5 shrink-0 ${
                                    loading 
                                        ? 'bg-amber-500 animate-spin border-t-2 border-white' 
                                        : window.speechSynthesis?.speaking 
                                        ? 'bg-[#4aa5c8] animate-bounce shadow-[0_0_8px_rgba(74,165,200,0.5)]' 
                                        : 'bg-slate-300'
                                }`} />
                            )}
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                                {loading 
                                    ? "Procesando..." 
                                    : window.speechSynthesis?.speaking 
                                    ? "Nova hablando..." 
                                    : isListening 
                                    ? "Escuchando..." 
                                    : "Micrófono apagado"}
                            </span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <button
                                type="button"
                                onClick={handleToggleListen}
                                className={`h-8 px-4 rounded-[10px] text-[9px] font-black uppercase tracking-widest transition-all border ${
                                    isListening 
                                        ? 'bg-rose-500 hover:bg-rose-600 text-white border-transparent shadow-md shadow-rose-500/10' 
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/80'
                                }`}
                            >
                                {isListening ? "Apagar Mic" : "Encender Mic"}
                            </button>
                            {chatHistory.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearHistory}
                                    className="h-8 w-8 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-[10px] transition-colors border border-rose-100"
                                    title="Limpiar conversación"
                                >
                                    <FiTrash2 size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Barra de progreso visual – 8 pasos (evolución) o 3 pasos (nota) */}
                    {currentStep > 0 && (
                        (() => {
                            const totalPasos = activeTab === 'nota' ? 3 : 8;
                            const labelsPasos = activeTab === 'nota'
                                ? ['Doctor', 'Comentario', 'Guardar']
                                : ['Doctor', 'Plan', 'Hora', 'Dictado', 'Procedim.', 'Medicam.', 'Resumen', 'Guardar'];
                            const safePaso = Math.min(currentStep, totalPasos);
                            const porcentaje = Math.round((safePaso / totalPasos) * 100);
                            const labelActual = labelsPasos[safePaso - 1] || '';
                            return (
                                <div className="bg-slate-50 border border-slate-100 rounded-[12px] p-2.5 flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                                        <span className="text-slate-400">Paso {safePaso} de {totalPasos}</span>
                                        <span className="text-indigo-600 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                                            {labelActual}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-[#8dc63f] transition-all duration-500"
                                            style={{ width: `${porcentaje}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between">
                                        {labelsPasos.map((lbl, i) => (
                                            <div
                                                key={i}
                                                className={`text-[7px] font-black uppercase tracking-widest transition-colors ${
                                                    i + 1 < safePaso ? 'text-[#8dc63f]'
                                                    : i + 1 === safePaso ? 'text-indigo-600'
                                                    : 'text-slate-300'
                                                }`}
                                                style={{ width: `${100 / totalPasos}%`, textAlign: 'center' }}
                                            >
                                                {i + 1 < safePaso ? '✓' : i + 1 === safePaso ? '●' : '○'}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()
                    )}


                    {/* Historial de conversación en burbujas */}
                    <div 
                        ref={chatContainerRef}
                        className="bg-white border border-slate-100 rounded-[12px] p-4 max-h-[180px] overflow-y-auto custom-scrollbar flex flex-col gap-3"
                    >
                        {chatHistory.length === 0 ? (
                            <div className="py-8 text-center text-[10px] font-bold uppercase tracking-wider text-slate-300 font-mono">
                                Hable para iniciar el flujo guiado.
                            </div>
                        ) : (
                            chatHistory.map((msg, i) => (
                                <div 
                                    key={i} 
                                    className={`flex flex-col max-w-[85%] rounded-[12px] px-3 py-2 text-xs font-bold leading-normal ${
                                        msg.role === 'user' 
                                            ? 'bg-slate-100 text-slate-800 self-end' 
                                            : 'bg-indigo-50/60 text-indigo-950 border border-indigo-100/50 self-start'
                                    }`}
                                >
                                    <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                        {msg.role === 'user' ? 'Tú (Dentista)' : 'Asistente Nova'}
                                    </span>
                                    <span>{msg.parts[0].text}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Transcripción en vivo */}
                    {isListening && (transcript || interimTranscript) && (
                        <div className="bg-slate-100 border border-slate-100 rounded-[12px] p-3 text-[10px] font-bold text-slate-500 italic">
                            Oído: "{transcript} {interimTranscript}"
                        </div>
                    )}
                </div>
            ) : (
                /* Modo Dictado Estándar */
                <div className="bg-white rounded-[12px] border border-slate-100 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dictado en bruto</span>
                        {transcript && (
                            <button
                                type="button"
                                onClick={resetTranscript}
                                className="text-[9px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest transition-colors"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>

                    <textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder="Haga clic en 'Grabar Sesión' y comente lo realizado al paciente en lenguaje natural..."
                        className="w-full h-20 p-3 text-xs font-bold text-slate-700 bg-slate-50/50 rounded-[12px] outline-none border border-slate-100 focus:border-indigo-400 focus:bg-white resize-none custom-scrollbar caret-slate-950"
                    />

                    {isListening && interimTranscript && (
                        <div className="text-[10px] text-slate-400 font-bold italic animate-pulse">
                            Escuchando: "{interimTranscript}"
                        </div>
                    )}

                    <div className="flex justify-between items-center gap-3 mt-1">
                        <button
                            type="button"
                            onClick={handleToggleListen}
                            className={`h-10 px-4 rounded-[12px] border flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${
                                isListening
                                    ? 'bg-rose-500 hover:bg-rose-600 text-white border-transparent shadow-md shadow-rose-500/20 animate-pulse'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                            }`}
                        >
                            {isListening ? (
                                <>
                                    <FiMicOff />
                                    Detener
                                </>
                            ) : (
                                <>
                                    <FiMic className="text-[#8dc63f]" />
                                    Grabar Sesión
                                </>
                            )}
                        </button>

                        {isListening && (
                            <div className="flex items-center gap-0.5 h-4 px-2 shrink-0">
                                <span className="oc-wave-bar"></span>
                                <span className="oc-wave-bar"></span>
                                <span className="oc-wave-bar"></span>
                                <span className="oc-wave-bar"></span>
                                <span className="oc-wave-bar"></span>
                                <span className="oc-wave-bar"></span>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleRefine}
                            disabled={loading || !transcript.trim()}
                            className="h-10 px-4 rounded-[12px] border border-transparent flex items-center justify-center gap-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none shadow-md shadow-lime-500/20"
                        >
                            {loading ? (
                                <>
                                    <FiRefreshCw className="animate-spin" />
                                    Analizando...
                                </>
                            ) : (
                                <>
                                    <FiCpu />
                                    Estructurar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Resultado IA (Acumulado o estructurado) */}
            {result && (
                <div className="bg-white border border-[#8dc63f]/30 rounded-[12px] p-4 flex flex-col gap-3 animate-fadeIn">
                    <h5 className="text-[10px] font-black text-[#8dc63f] uppercase tracking-widest">Nota Clínica Estructurada</h5>
                    
                    <div className="space-y-3">
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Evolución (Comentario)</span>
                            <p className="text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-[12px] border border-slate-100 leading-relaxed whitespace-pre-line">
                                {result.comentario}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Tratamiento</span>
                                <p className="text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-[12px] border border-slate-100 truncate" title={result.tratamiento}>
                                    {result.tratamiento || 'No especificado'}
                                </p>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Pronóstico</span>
                                <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-[12px] mt-1.5 ${
                                    result.prognosis === 'Favorable' 
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : result.prognosis === 'Reservado'
                                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                        : 'bg-rose-50 text-rose-600 border border-rose-100'
                                }`}>
                                    {result.prognosis}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleApplyResult}
                        className="w-full h-11 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-[12px] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 border border-transparent shadow-md shadow-lime-500/20 mt-1"
                    >
                        <FiCheck />
                        Aplicar al Formulario
                    </button>
                </div>
            )}
        </div>
    );
}
