import React, { useState } from "react";
import { FiDownload, FiFolder, FiFileText, FiArchive, FiCheckCircle, FiAlertCircle, FiX, FiCheck, FiLayers, FiImage } from "react-icons/fi";
import { generateClinicBackupZip } from "../../../services/backupExportService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

export default function ExportBackupModal({ isOpen, onClose }) {
    const { userProfile, clinicConfig } = useAuth();
    const toast = useToast();

    const [evolutionMode, setEvolutionMode] = useState("both"); // 'both' | 'consolidated' | 'individual'
    const [includeImages, setIncludeImages] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, patientName: "", phase: "idle" });

    if (!isOpen) return null;

    const tenantId = userProfile?.inquilino || userProfile?.tenantId || userProfile?.tenant?.id;

    const handleStartExport = async () => {
        if (!tenantId) {
            toast.error("No se encontró el identificador de la clínica.");
            return;
        }

        setIsGenerating(true);
        setProgress({ current: 0, total: 100, patientName: "Iniciando generación de copia de seguridad...", phase: "init" });

        try {
            const clinicInfo = {
                nombre: clinicConfig?.nombre || clinicConfig?.name || userProfile?.clinica || "Clínica Dental",
                nit: clinicConfig?.nit || "—",
                telefono: clinicConfig?.telefono || "—",
                direccion: clinicConfig?.direccion || "—"
            };

            const result = await generateClinicBackupZip({
                tenantId,
                clinicInfo,
                evolutionMode,
                includeImages,
                onProgress: (p) => setProgress(p)
            });

            // Descargar el archivo ZIP al navegador
            const downloadUrl = URL.createObjectURL(result.blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = result.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

            toast.success(`¡Copia de seguridad completada! Se empaquetaron ${result.totalPatients} pacientes con éxito.`);
            setIsGenerating(false);
            onClose();
        } catch (error) {
            console.error("Error al exportar copia de seguridad:", error);
            toast.error(`Error: ${error.message || "No se pudo generar la copia de seguridad."}`);
            setIsGenerating(false);
        }
    };

    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-scaleIn">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                            <FiArchive size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold tracking-tight">Copia de Seguridad Clínica</h3>
                            <p className="text-xs text-slate-400">Estructura Estándar OralDrive en formato .ZIP</p>
                        </div>
                    </div>
                    {!isGenerating && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                        >
                            <FiX size={20} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 space-y-6">

                    {/* Explicación de la estructura */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <FiFolder className="text-indigo-600" /> Jerarquía en el archivo ZIP
                        </div>
                        <div className="text-[11px] font-mono bg-white p-3 rounded-xl border border-slate-200 text-slate-600 leading-relaxed overflow-x-auto">
                            <div>📁 [Nombre Paciente] - [Documento]/</div>
                            <div className="pl-4">├── 📁 Documentos clínicos/</div>
                            <div className="pl-4">├── 📁 Evoluciones/ (PDFs individuales y/o consolidado)</div>
                            <div className="pl-4">├── 📁 Odontogramas/</div>
                            <div className="pl-4">├── 📁 Periodontogramas/</div>
                            <div className="pl-4">├── 📁 Rx-Imagenes Oral/</div>
                            <div className="pl-4">└── 📄 placeholder</div>
                        </div>
                    </div>

                    {/* Selector de Modo de Evoluciones */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                            Modo de Generación de Evoluciones:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => setEvolutionMode("both")}
                                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                    evolutionMode === "both"
                                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-2 ring-emerald-500/20"
                                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                                }`}
                            >
                                <div className="text-xs font-bold flex items-center justify-between">
                                    <span>Híbrido</span>
                                    {evolutionMode === "both" && <FiCheck className="text-emerald-600" size={14} />}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">
                                    Consolidado + Individuales por fecha
                                </div>
                            </button>

                            <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => setEvolutionMode("individual")}
                                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                    evolutionMode === "individual"
                                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-2 ring-emerald-500/20"
                                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                                }`}
                            >
                                <div className="text-xs font-bold flex items-center justify-between">
                                    <span>Individuales</span>
                                    {evolutionMode === "individual" && <FiCheck className="text-emerald-600" size={14} />}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">
                                    1 PDF por cada cita (Estilo OralDrive)
                                </div>
                            </button>

                            <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => setEvolutionMode("consolidated")}
                                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                    evolutionMode === "consolidated"
                                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-2 ring-emerald-500/20"
                                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                                }`}
                            >
                                <div className="text-xs font-bold flex items-center justify-between">
                                    <span>Consolidado</span>
                                    {evolutionMode === "consolidated" && <FiCheck className="text-emerald-600" size={14} />}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">
                                    1 solo PDF de historial continuo
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Opciones adicionales */}
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                            <input
                                type="checkbox"
                                checked={includeImages}
                                disabled={isGenerating}
                                onChange={(e) => setIncludeImages(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                            />
                            <span>Descargar e incluir archivos de radiografías e imágenes adjuntas</span>
                        </label>
                    </div>

                    {/* Barra de Progreso durante la generación */}
                    {isGenerating && (
                        <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 animate-fadeIn">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                                <span className="truncate max-w-[320px]">{progress.patientName}</span>
                                <span>{percent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <div className="text-[10px] text-slate-400 text-right">
                                {progress.current} de {progress.total} procesados
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleStartExport}
                        disabled={isGenerating}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <FiDownload size={15} />
                        <span>{isGenerating ? "Generando ZIP..." : "Descargar Copia de Seguridad"}</span>
                    </button>
                </div>

            </div>
        </div>
    );
}
