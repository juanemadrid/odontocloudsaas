import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
    analyzeClinicKPIs,
    detectAtRiskPatients,
    checkLowStockAlerts,
    analyzeDoctorProductivityWithAI
} from "../../../services/intelligenceService";
import { dispatchAutomationEvent, AUTOMATION_EVENTS } from "../../../services/AutomationService";
import { FiCpu, FiRefreshCw, FiAlertTriangle, FiUsers, FiTrendingUp, FiPackage, FiSettings, FiExternalLink, FiCheck } from "react-icons/fi";
import { toast } from "sonner";
import { getGeminiApiKey, saveGeminiApiKey } from "../../../services/geminiKeyService";

// ─── Renderer de Markdown simple ─────────────────────────────────────────────
function MarkdownBlock({ text }) {
    if (!text) return null;
    const html = text
        .replace(/^## (.+)$/gm, '<h2 class="text-sm font-black text-slate-800 uppercase tracking-tight mt-5 mb-2 flex items-center gap-2">$1</h2>')
        .replace(/^### (.+)$/gm, '<h3 class="text-xs font-black text-slate-600 uppercase tracking-widest mt-4 mb-1.5">$1</h3>')
        .replace(/^\*\*(.+?)\*\*/gm, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-slate-700 mb-1 leading-relaxed list-disc">$1</li>')
        .replace(/\n\n/g, '<br/>')
        .replace(/\n/g, ' ');
    return <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Tarjeta de resultado ─────────────────────────────────────────────────────
function AICard({ title, icon: Icon, color, children, onRefresh, loading }) {
    return (
        <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${color}`}>
                    <Icon size={14} /> {title}
                </h3>
                {onRefresh && (
                    <button onClick={onRefresh} disabled={loading} className="text-slate-400 hover:text-slate-700 transition-colors">
                        <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
                    </button>
                )}
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

export default function ReporteIA() {
    const { userProfile } = useAuth();
    const [apiKey, setApiKey] = useState("");
    const [showSettings, setShowSettings] = useState(false);

    // Estados de análisis
    const [kpiAnalysis, setKpiAnalysis]         = useState("");
    const [atRiskPatients, setAtRiskPatients]   = useState([]);
    const [stockAlerts, setStockAlerts]         = useState([]);
    const [doctorAnalysis, setDoctorAnalysis]   = useState("");

    // Estados de carga
    const [loadingKpi, setLoadingKpi]       = useState(false);
    const [loadingRisk, setLoadingRisk]     = useState(false);
    const [loadingStock, setLoadingStock]   = useState(false);
    const [loadingDr, setLoadingDr]         = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

    useEffect(() => {
        const loadKey = async () => {
            const key = await getGeminiApiKey(userProfile?.inquilino);
            if (key) setApiKey(key);
        };
        loadKey();
    }, [userProfile?.inquilino]);

    // Carga inicial automática (datos sin IA)
    useEffect(() => {
        if (userProfile?.inquilino && !initialLoaded) {
            setInitialLoaded(true);
            loadAtRiskPatients();
            loadStockAlerts();
        }
    }, [userProfile?.inquilino]);

    // ── Pacientes en riesgo (sin IA, solo datos) ──────────────────────────────
    const loadAtRiskPatients = useCallback(async () => {
        if (!userProfile?.inquilino) return;
        setLoadingRisk(true);
        try {
            const result = await detectAtRiskPatients(userProfile.inquilino, 60);
            setAtRiskPatients(result);

            // Disparar evento de automatización para pacientes con >90 días
            const criticos = result.filter(r => r.diasSinVisita > 90);
            if (criticos.length > 0) {
                criticos.forEach(r => {
                    dispatchAutomationEvent(AUTOMATION_EVENTS.PATIENT_NO_VISIT_60_DAYS.name, {
                        patientId: r.patient.id,
                        patientName: r.patient.nombreCompleto,
                        celular: r.patient.celular,
                        diasSinVisita: r.diasSinVisita
                    });
                });
            }
        } catch (e) {
            toast.error("Error detectando pacientes en riesgo: " + e.message);
        } finally {
            setLoadingRisk(false);
        }
    }, [userProfile?.inquilino]);

    // ── Alertas de stock (sin IA) ─────────────────────────────────────────────
    const loadStockAlerts = useCallback(async () => {
        if (!userProfile?.inquilino) return;
        setLoadingStock(true);
        try {
            const result = await checkLowStockAlerts(userProfile.inquilino);
            setStockAlerts(result);
            // Disparar evento para items críticos (stock = 0)
            result.filter(r => r.critico).forEach(r => {
                dispatchAutomationEvent(AUTOMATION_EVENTS.STOCK_LOW.name, {
                    productoId: r.id,
                    nombre: r.nombre,
                    stockActual: r.stockActual,
                    stockMinimo: r.stockMinimo
                });
            });
        } catch (e) {
            toast.error("Error revisando stock: " + e.message);
        } finally {
            setLoadingStock(false);
        }
    }, [userProfile?.inquilino]);

    // ── Análisis gerencial IA ─────────────────────────────────────────────────
    const handleAnalyzeKPIs = async () => {
        if (!apiKey) { toast.error("Configure la API Key de Gemini primero."); setShowSettings(true); return; }
        if (!userProfile?.inquilino) return;
        setLoadingKpi(true);
        try {
            // Obtener datos
            const [snapPac, snapCitas, snapFact, snapPlanes] = await Promise.all([
                getDocs(query(collection(db, "pacientes"), where("inquilino", "==", userProfile.inquilino))),
                getDocs(query(collection(db, "agenda"), where("inquilino", "==", userProfile.inquilino))),
                getDocs(query(collection(db, "facturas"), where("inquilino", "==", userProfile.inquilino))),
                getDocs(query(collection(db, "treatment_plans"), where("inquilino", "==", userProfile.inquilino)))
            ]);

            let facturado = 0, recaudado = 0, canceladas = 0, completadas = 0;
            snapFact.docs.forEach(d => {
                const f = d.data();
                facturado += Number(f.monto || 0);
                if (f.estado === "Pagada") recaudado += Number(f.monto || 0);
            });
            snapCitas.docs.forEach(d => {
                const c = d.data();
                const e = (c.estado || "").toLowerCase();
                if (e === "cancelada") canceladas++;
                if (["atendida", "completada"].includes(e)) completadas++;
            });

            const treatmentCounts = {};
            snapPlanes.docs.forEach(d => {
                (d.data().items || []).forEach(item => {
                    if (!item.desc) return;
                    if (!treatmentCounts[item.desc]) treatmentCounts[item.desc] = { name: item.desc, total: 0 };
                    treatmentCounts[item.desc].total += (Number(item.amount) || 0) * (Number(item.qty) || 1);
                });
            });
            const topTratamientos = Object.values(treatmentCounts).sort((a, b) => b.total - a.total).slice(0, 5);

            const kpiData = {
                pacientes: snapPac.size,
                citas: snapCitas.size,
                facturado, recaudado,
                pendiente: facturado - recaudado,
                topTratamientos,
                citasPorEstado: { canceladas, completadas }
            };

            const analysis = await analyzeClinicKPIs(kpiData, apiKey);
            setKpiAnalysis(analysis);
            toast.success("Análisis gerencial generado");
        } catch (e) {
            toast.error("Error en análisis: " + e.message);
        } finally {
            setLoadingKpi(false);
        }
    };

    // ── Análisis IA de doctores ───────────────────────────────────────────────
    const handleAnalyzeDoctors = async () => {
        if (!apiKey) { toast.error("Configure la API Key de Gemini primero."); setShowSettings(true); return; }
        if (!userProfile?.inquilino) return;
        setLoadingDr(true);
        try {
            const result = await analyzeDoctorProductivityWithAI(userProfile.inquilino, apiKey);
            setDoctorAnalysis(result);
            toast.success("Análisis de doctores generado");
        } catch (e) {
            toast.error("Error en análisis: " + e.message);
        } finally {
            setLoadingDr(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-4 shrink-0 mb-6 mx-2 mt-2">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <FiCpu className="text-indigo-600 animate-pulse" size={18} />
                    </div>
                    <div>
                        <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Inteligencia Artificial</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Análisis automático con Gemini</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowSettings(s => !s)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${showSettings ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                >
                    <FiSettings size={12} /> API Key
                </button>
            </div>

            {/* API Key Settings */}
            {showSettings && (
                <div className="mx-2 mb-4 bg-white border border-indigo-100 rounded-2xl p-5 shadow-md animate-fadeIn">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Clave API de Gemini (Gratis)</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">Se guarda solo en este navegador. Obtenla gratis en Google AI Studio.</p>
                        </div>
                        <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-500 flex items-center gap-1 hover:underline uppercase tracking-widest">
                            AI Studio <FiExternalLink size={10} />
                        </a>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-indigo-400"
                        />
                        <button
                            onClick={async () => { 
                                try {
                                    await saveGeminiApiKey(userProfile?.inquilino, apiKey);
                                    toast.success("API Key guardada para toda la clínica"); 
                                    setShowSettings(false); 
                                } catch(e) {
                                    toast.error("Error al guardar: " + e.message);
                                }
                            }}
                            className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black uppercase tracking-widest"
                        >
                            Guardar
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-20 space-y-6">

                {/* ── Análisis Gerencial ──────────────────────────────────── */}
                <AICard title="Diagnóstico Gerencial IA" icon={FiTrendingUp} color="text-indigo-600"
                    onRefresh={handleAnalyzeKPIs} loading={loadingKpi}>
                    {kpiAnalysis ? (
                        <MarkdownBlock text={kpiAnalysis} />
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <p className="text-sm text-slate-500 text-center max-w-sm">
                                Nova analiza todos tus KPIs y genera un diagnóstico ejecutivo con hallazgos y recomendaciones concretas.
                            </p>
                            <button
                                onClick={handleAnalyzeKPIs}
                                disabled={loadingKpi}
                                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-200 disabled:opacity-60"
                            >
                                {loadingKpi ? <><FiRefreshCw className="animate-spin" /> Analizando...</> : <><FiCpu /> Generar Diagnóstico</>}
                            </button>
                        </div>
                    )}
                </AICard>

                {/* ── Pacientes en Riesgo ─────────────────────────────────── */}
                <AICard title={`Pacientes en Riesgo de Abandono (${atRiskPatients.length})`} icon={FiUsers} color="text-rose-600"
                    onRefresh={loadAtRiskPatients} loading={loadingRisk}>
                    {loadingRisk ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : atRiskPatients.length === 0 ? (
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
                            <FiCheck className="text-emerald-500 shrink-0" size={18} />
                            <p className="text-sm text-emerald-700 font-semibold">¡Excelente! No hay pacientes con más de 60 días sin visitar.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                            {atRiskPatients.map((r, i) => (
                                <div key={r.patient.id || i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-rose-50/50 border border-slate-100 transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-800 truncate">{r.patient.nombreCompleto || r.patient.nombre || "Paciente"}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Última visita: {r.ultimaVisita}</p>
                                        {r.tratamientosActivos.length > 0 && (
                                            <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                                                {r.tratamientosActivos.length} plan(es) activo(s)
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${r.diasSinVisita > 90 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                                            {r.diasSinVisita}d
                                        </span>
                                        {r.patient.celular && (
                                            <a
                                                href={`https://wa.me/57${r.patient.celular?.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(r.patient.nombreCompleto || "")}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block text-[9px] text-green-600 font-black uppercase tracking-widest mt-1 hover:underline"
                                            >
                                                WhatsApp →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </AICard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── Alertas de Stock ──────────────────────────────── */}
                    <AICard title={`Stock Bajo (${stockAlerts.length} productos)`} icon={FiPackage} color="text-amber-600"
                        onRefresh={loadStockAlerts} loading={loadingStock}>
                        {loadingStock ? (
                            <div className="flex items-center justify-center py-6">
                                <div className="w-7 h-7 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : stockAlerts.length === 0 ? (
                            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
                                <FiCheck className="text-emerald-500 shrink-0" size={18} />
                                <p className="text-sm text-emerald-700 font-semibold">Inventario en niveles normales.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {stockAlerts.map((a, i) => (
                                    <div key={a.id || i} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${a.critico ? "bg-rose-50 border-rose-200" : "bg-amber-50/60 border-amber-100"}`}>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-slate-800 truncate">{a.nombre}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Mínimo: {a.stockMinimo} uds</p>
                                        </div>
                                        <span className={`text-xs font-black px-2 py-1 rounded-full shrink-0 ml-2 ${a.critico ? "bg-rose-200 text-rose-700" : "bg-amber-200 text-amber-800"}`}>
                                            {a.critico ? "AGOTADO" : `${a.stockActual} uds`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </AICard>

                    {/* ── Productividad Doctores IA ─────────────────────── */}
                    <AICard title="Productividad por Doctor" icon={FiTrendingUp} color="text-purple-600"
                        onRefresh={handleAnalyzeDoctors} loading={loadingDr}>
                        {doctorAnalysis ? (
                            <MarkdownBlock text={doctorAnalysis} />
                        ) : (
                            <div className="flex flex-col items-center gap-4 py-4">
                                <p className="text-xs text-slate-500 text-center">
                                    Analiza citas atendidas, tasa de asistencia y facturación por doctor.
                                </p>
                                <button
                                    onClick={handleAnalyzeDoctors}
                                    disabled={loadingDr}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60"
                                >
                                    {loadingDr ? <><FiRefreshCw className="animate-spin" /> Analizando...</> : <><FiCpu /> Analizar Doctores</>}
                                </button>
                            </div>
                        )}
                    </AICard>

                </div>

                {/* ── Alerta visual de configuración WhatsApp ──────── */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
                    <h4 className="text-xs font-black text-green-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <FiAlertTriangle size={12} /> Automatizaciones disponibles
                    </h4>
                    <div className="grid grid-cols-1 gap-3 text-[11px]">
                        <div className="flex items-start gap-2">
                            <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${import.meta.env.VITE_WA_TOKEN ? "bg-green-500" : "bg-slate-300"}`} />
                            <div>
                                <p className="font-black text-slate-700">WhatsApp Business API</p>
                                <p className="text-slate-500">{import.meta.env.VITE_WA_TOKEN ? "✅ Configurado" : "⚠️ Agregar VITE_WA_TOKEN en .env"}</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
