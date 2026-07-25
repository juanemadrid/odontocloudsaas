import React, { useEffect } from 'react';
import { FiMic, FiMicOff } from 'react-icons/fi';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import { toast } from 'sonner';

export default function VoiceInputButton({ onTranscript, className = "" }) {
    const {
        isListening,
        transcript,
        interimTranscript,
        error,
        isSupported,
        startListening,
        stopListening,
        resetTranscript
    } = useSpeechRecognition();

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useEffect(() => {
        if (transcript) {
            onTranscript(transcript);
            resetTranscript();
        }
    }, [transcript, onTranscript, resetTranscript]);

    if (!isSupported) {
        return null; // Ocultar si el navegador no lo soporta (ej: Firefox móvil antiguo)
    }

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            <button
                type="button"
                onClick={handleToggle}
                className={`p-2.5 rounded-lg flex items-center justify-center transition-all ${
                    isListening
                        ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/30'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-700 border border-slate-200'
                }`}
                title={isListening ? "Detener dictado por voz" : "Dictar con voz"}
            >
                {isListening ? <FiMicOff size={15} /> : <FiMic size={15} />}
            </button>
            
            {isListening && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900/95 backdrop-blur text-white text-[10px] rounded-lg font-bold shadow-xl flex items-center gap-2 z-30 animate-fadeIn max-w-[200px] sm:max-w-[300px] overflow-hidden">
                    <span className="flex gap-0.5 items-center shrink-0">
                        <span className="w-0.5 h-2 bg-[#8dc63f] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-0.5 h-3.5 bg-[#8dc63f] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-0.5 h-2.5 bg-[#8dc63f] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    <span className="truncate">
                        {interimTranscript ? `"${interimTranscript}"` : 'Escuchando...'}
                    </span>
                </div>
            )}
        </div>
    );
}
