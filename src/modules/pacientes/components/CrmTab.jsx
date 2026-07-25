import React, { useState } from "react";
import { FiMessageSquare } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useToast } from "../../../context/ToastContext";

export default function CrmTab({ patient }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [note, setNote] = useState("");
    const [sortOrder, setSortOrder] = useState("newest"); // "newest" | "oldest"
    const [saving, setSaving] = useState(false);

    const handleNoteAdd = async (e) => {
        if (e.key === "Enter" && note.trim()) {
            if (!patient?.id) return toast.error("Error: Paciente no identificado");
            
            setSaving(true);
            const newEntry = {
                id: Date.now(),
                text: note.trim(),
                date: new Date().toISOString(),
                user: userProfile?.nombre || "Usuario"
            };
            
            const currentLog = patient.crm_log || [];
            const newLog = [newEntry, ...currentLog];
            
            try {
                await setDoc(doc(db, "pacientes", patient.id), {
                    crm_log: newLog,
                    actualizado: serverTimestamp()
                }, { merge: true });
                setNote("");
                toast.success("Comentario agregado");
            } catch (err) {
                console.error("Error saving CRM:", err);
                toast.error("Error al guardar comentario");
            } finally {
                setSaving(false);
            }
        }
    };

    const logs = patient?.crm_log || [];
    const sortedLogs = [...logs].sort((a, b) => {
        if (sortOrder === "newest") return b.id - a.id;
        return a.id - b.id;
    });

    return (
        <div className="p-4 md:p-8 animate-fadeIn flex flex-col h-full min-h-0">
            <div className="bg-white rounded-lg shadow-sm border border-slate-100 flex flex-col flex-1 overflow-hidden p-6 max-w-4xl mx-auto w-full">
                
                {/* Input Area */}
                <div className="mb-4">
                    <input
                        type="text"
                        disabled={saving}
                        className="w-full border border-slate-200 rounded text-sm px-4 py-2.5 text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 placeholder-slate-300 transition-colors disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder={saving ? "Guardando..." : "Agregar comentario"}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={handleNoteAdd}
                    />
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 mb-6">
                    <button 
                        onClick={() => setSortOrder("newest")}
                        className={`text-[11px] font-bold pb-2 px-1 mr-6 transition-colors ${sortOrder === "newest" ? "border-b-2 border-blue-500 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                    >
                        Comentarios más nuevos ↓
                    </button>
                    <button 
                        onClick={() => setSortOrder("oldest")}
                        className={`text-[11px] font-bold pb-2 px-1 transition-colors ${sortOrder === "oldest" ? "border-b-2 border-blue-500 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                    >
                        Comentarios más antiguos ↑
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {sortedLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 pb-10">
                            <FiMessageSquare size={24} className="opacity-50" />
                            <p className="text-sm font-medium">No hay comentarios</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sortedLogs.map((entry) => (
                                <div key={entry.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-slate-700">{entry.user}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(entry.date).toLocaleString()}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{entry.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

