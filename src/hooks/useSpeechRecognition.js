import { useState, useEffect, useRef, useCallback } from 'react';

export default function useSpeechRecognition(persistent = false, isGlobal = false) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState(null);
    const [isSupported, setIsSupported] = useState(false);

    const instanceId = useRef(Math.random().toString(36).substring(2, 11)).current;

    const recognitionRef = useRef(null);
    const isPersistentRef = useRef(persistent);
    const isGlobalRef = useRef(isGlobal);
    const shouldBeListeningRef = useRef(false);
    const isListeningRef = useRef(false);

    useEffect(() => {
        isPersistentRef.current = persistent;
    }, [persistent]);

    useEffect(() => {
        isGlobalRef.current = isGlobal;
    }, [isGlobal]);

    // Handle background speech recognition coordination when a foreground instance is active
    useEffect(() => {
        if (isGlobal) {
            const handleForegroundActive = (e) => {
                const active = e.detail.active;
                if (active || window.localVoiceAssistantOpen) {
                    if (isListeningRef.current && recognitionRef.current) {
                        console.log("Pausing global background voice assistant for active local dictation...");
                        try {
                            recognitionRef.current.abort();
                        } catch (err) {
                            console.error("Error pausing global recognition:", err);
                        }
                    }
                } else {
                    if (shouldBeListeningRef.current && !isListeningRef.current && recognitionRef.current && !window.localVoiceAssistantOpen) {
                        console.log("Resuming global background voice assistant...");
                        try {
                            isListeningRef.current = true;
                            recognitionRef.current.start();
                        } catch (err) {
                            console.error("Error resuming global recognition:", err);
                            isListeningRef.current = false;
                        }
                    }
                }
            };
            window.addEventListener('speech-recognition-active', handleForegroundActive);
            return () => {
                window.removeEventListener('speech-recognition-active', handleForegroundActive);
            };
        }
    }, [isGlobal]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            setIsSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'es-ES';

            recognition.onstart = () => {
                isListeningRef.current = true;
                setIsListening(true);
                setError(null);

                if (!isGlobalRef.current) {
                    window.activeSpeechRecognitions = window.activeSpeechRecognitions || new Set();
                    window.activeSpeechRecognitions.add(instanceId);
                    window.dispatchEvent(new CustomEvent('speech-recognition-active', { detail: { active: true } }));
                }
            };

            recognition.onresult = (event) => {
                let final = '';
                let interim = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                if (final) {
                    setTranscript((prev) => {
                        const cleanPrev = prev.trim();
                        const cleanFinal = final.trim();
                        if (!cleanPrev) return cleanFinal;
                        return cleanPrev + ' ' + cleanFinal;
                    });
                }
                setInterimTranscript(interim);
            };

            recognition.onerror = (event) => {
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    console.error('Speech recognition error:', event.error);
                } else {
                    console.log('Speech recognition event:', event.error);
                }
                
                // En modo persistente evitamos apagar el estado visual/UI si es un error recuperable (silencio o aborto por el navegador)
                const isRecoverable = event.error === 'no-speech' || event.error === 'aborted';
                const keepVisualActive = isPersistentRef.current && isRecoverable && shouldBeListeningRef.current;
                
                isListeningRef.current = false;
                if (!keepVisualActive) {
                    setIsListening(false);
                }

                if (event.error === 'not-allowed') {
                    setError('Permiso de micrófono denegado');
                    shouldBeListeningRef.current = false;
                } else if (event.error === 'no-speech') {
                    // Ignorar silencio temporal
                } else {
                    setError(`Error de reconocimiento: ${event.error}`);
                }
            };

            recognition.onend = () => {
                isListeningRef.current = false;
                setInterimTranscript('');
                
                // NO borramos el transcript en onend para que persista durante micro-cortes, reinicios por silencio o al pausar el dictado
                
                if (!isGlobalRef.current) {
                    if (window.activeSpeechRecognitions) {
                        window.activeSpeechRecognitions.delete(instanceId);
                        if (window.activeSpeechRecognitions.size === 0) {
                            window.dispatchEvent(new CustomEvent('speech-recognition-active', { detail: { active: false } }));
                        }
                    }
                }
                
                // Auto-restart in persistent mode with a short delay to allow browser thread to reset
                if (isPersistentRef.current && shouldBeListeningRef.current && recognitionRef.current) {
                    const hasForegroundActive = (window.activeSpeechRecognitions && window.activeSpeechRecognitions.size > 0) || window.localVoiceAssistantOpen;
                    if (isGlobalRef.current && hasForegroundActive) {
                        console.log("Global speech recognition auto-restart paused because local is active or assistant is open.");
                        setIsListening(false);
                        return;
                    }

                    setTimeout(() => {
                        try {
                            if (shouldBeListeningRef.current && !isListeningRef.current) {
                                const currentForegroundActive = (window.activeSpeechRecognitions && window.activeSpeechRecognitions.size > 0) || window.localVoiceAssistantOpen;
                                if (isGlobalRef.current && currentForegroundActive) {
                                    isListeningRef.current = false;
                                    setIsListening(false);
                                    return;
                                }
                                isListeningRef.current = true;
                                recognition.start();
                            }
                        } catch (e) {
                            console.log("Persistent auto-restart failed/prevented:", e);
                            isListeningRef.current = false;
                            setIsListening(false);
                        }
                    }, 300);
                } else {
                    setIsListening(false);
                }
            };

            recognitionRef.current = recognition;
        } else {
            setIsSupported(false);
        }

        return () => {
            shouldBeListeningRef.current = false;
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            if (!isGlobalRef.current) {
                if (window.activeSpeechRecognitions) {
                    window.activeSpeechRecognitions.delete(instanceId);
                    if (window.activeSpeechRecognitions.size === 0) {
                        window.dispatchEvent(new CustomEvent('speech-recognition-active', { detail: { active: false } }));
                    }
                }
            }
        };
    }, []);

    const startListening = useCallback(() => {
        if (!isSupported || !recognitionRef.current) return;

        if (isGlobalRef.current) {
            const hasForegroundActive = (window.activeSpeechRecognitions && window.activeSpeechRecognitions.size > 0) || window.localVoiceAssistantOpen;
            if (hasForegroundActive) {
                console.log("Global background voice assistant start prevented: local assistant is active or open.");
                shouldBeListeningRef.current = true;
                return;
            }
        }

        shouldBeListeningRef.current = true;
        if (isListeningRef.current) return;
        isListeningRef.current = true;
        try {
            recognitionRef.current.start();
        } catch (e) {
            console.error('Start listening error:', e);
            isListeningRef.current = false;
        }
    }, [isSupported]);

    const stopListening = useCallback(() => {
        if (!isSupported || !recognitionRef.current) return;
        shouldBeListeningRef.current = false;
        if (!isListeningRef.current) return;
        try {
            recognitionRef.current.stop();
        } catch (e) {
            console.error('Stop listening error:', e);
        }
    }, [isSupported]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        error,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
        setTranscript
    };
}
