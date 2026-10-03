// src/modules/odontograma/Odontograma.jsx
import React, { useState, useEffect, useRef } from "react";
import OdontogramaVisual from "./components/OdontogramaVisual";
import TratamientosToolbar, { TOOLS, SURFACES } from "./components/TratamientosToolbar";
import supabase from "../../lib/supabaseClient";
import {
    FiPlus,
    FiSave,
    FiClock,
    FiFileText,
    FiTrash2,
    FiSearch,
    FiChevronLeft,
    FiCheckCircle,
    FiEye,
    FiEdit3,
    FiPrinter,
    FiCalendar,
    FiFeather,
    FiAward,
    FiAlertTriangle,
    FiX
} from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import FirmaHuellaModal from "./components/FirmaHuellaModal";
import { generateOralDriveOdontogramaPrintHTML } from "./utils/odontogramaPrintService";
const printHTMLInHiddenIframe = (htmlContent) => {
    let iframe = document.getElementById("oc-print-iframe");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "oc-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0px";
        iframe.style.height = "0px";
        iframe.style.border = "none";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    const triggerPrint = () => {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 150);
    };

    const img = doc.querySelector('.odontogram-image');
    if (img) {
        if (img.complete) {
            triggerPrint();
        } else {
            img.onload = triggerPrint;
        }
    } else {
        triggerPrint();
    }
};

export default function Odontograma({ embeddedPatient }) {
    const toast = useToast();
    const { userProfile } = useAuth();

    const [viewMode, setViewMode] = useState("LIST");
    const [sesiones, setSesiones] = useState([]);
    const [currentSesion, setCurrentSesion] = useState(null);
    const [selectedToolId, setSelectedToolId] = useState("caries");
    const [odontogramaData, setOdontogramaData] = useState({});
    const [planTratamiento, setPlanTratamiento] = useState([]);
    const [tipoDenticion, setTipoDenticion] = useState("adulto");
    const [observaciones, setObservaciones] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [firmaModal, setFirmaModal] = useState(null);
    const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);
    const [readOnlyAlert, setReadOnlyAlert] = useState(false);

    useEffect(() => {
        if (readOnlyAlert) {
            const timer = setTimeout(() => setReadOnlyAlert(false), 4000);
            return () => clearTimeout(timer);
        }
    }, [readOnlyAlert]);

    const handlePrintSesion = (sesionToPrint) => {
        try {
            const html = generateOralDriveOdontogramaPrintHTML({
                sesion: sesionToPrint,
                paciente: embeddedPatient,
                userProfile,
                baseUrl: window.location.origin + "/"
            });
            printHTMLInHiddenIframe(html);
            toast?.success("Impresión iniciada");
        } catch (err) {
            console.error("Error al imprimir odontograma:", err);
            toast?.error("Error al generar vista de impresión");
        }
    };

    useEffect(() => {
        if (embeddedPatient?.id) loadSesiones();
    }, [embeddedPatient?.id]);

    const loadSesiones = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("odontogramas")
                .select("*")
                .eq("paciente_id", embeddedPatient.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            setSesiones((data || []).map(d => {
                const h = d.hallazgos || {};
                return {
                    id: d.id,
                    data: h.data || d.data || {},
                    plan: h.plan || d.plan || [],
                    observaciones: d.observaciones || h.observaciones || "",
                    estado: h.estado || d.estado || "Abierto",
                    creado: d.created_at,
                    creadoPor: h.creadoPor || d.creado_por || "usuario@sistema.com",
                    tipoDenticion: h.tipoDenticion || d.tipo_denticion || "adulto",
                    profesional: h.profesional || d.profesional || "Profesional de Planta",
                    firmaDoctor: h.firmaDoctor || d.firma_doctor,
                    firmaPaciente: h.firmaPaciente || d.firma_paciente || d.firmaUrl,
                    huellaPaciente: h.huellaPaciente || d.huella_paciente || d.huellaUrl,
                    rawHallazgos: h
                };
            }));
        } catch (err) { 
            console.error("Error loading sessions:", err);
            toast?.error("Error al cargar historial"); 
        }
        finally { setLoading(false); }
    };

    const handleNuevo = async () => {
        setLoading(true);
        try {
            const tenantId = embeddedPatient?.inquilino || embeddedPatient?.tenant_id || userProfile?.tenant_id || userProfile?.inquilino;
            const creador = userProfile?.email || embeddedPatient?.creadorEmail || "usuario@sistema.com";
            const prof = userProfile?.nombreCompleto || userProfile?.nombre || embeddedPatient?.dentistaResponsable || "Profesional de Planta";

            const { data, error } = await supabase
                .from("odontogramas")
                .insert([{
                    paciente_id: embeddedPatient.id,
                    tenant_id: tenantId,
                    hallazgos: {
                        data: {},
                        plan: [],
                        estado: "Abierto",
                        tipoDenticion: "adulto",
                        creadoPor: creador,
                        profesional: prof
                    },
                    observaciones: ""
                }])
                .select()
                .single();
            if (error) throw error;
            const h = data.hallazgos || {};
            abrirEditor({ 
                id: data.id, 
                data: h.data || {}, 
                plan: h.plan || [], 
                observaciones: data.observaciones || "", 
                estado: h.estado || "Abierto",
                tipoDenticion: h.tipoDenticion || "adulto",
                creadoPor: h.creadoPor || creador,
                profesional: h.profesional || prof,
                rawHallazgos: h
            }, false);
        } catch (err) { 
            console.error("Error creating session:", err);
            toast?.error("Error al crear sesión: " + (err.message || "")); 
        }
        finally { setLoading(false); }
    };

    const abrirEditor = (s, readOnly = false) => {
        setCurrentSesion(s);
        setOdontogramaData(s.data || {});
        setPlanTratamiento(s.plan || []);
        setObservaciones(s.observaciones || "");
        setTipoDenticion(s.tipoDenticion || "adulto");
        setIsReadOnlyMode(readOnly);
        setReadOnlyAlert(false);
        setViewMode("EDITOR");
    };

    const handleEliminar = async (id) => {
        if (!window.confirm("¿Eliminar este odontograma permanentemente?")) return;
        try {
            const { error } = await supabase
                .from("odontogramas")
                .delete()
                .eq("id", id);
            if (error) throw error;
            toast?.success("Eliminado correctamente");
            loadSesiones();
        } catch { toast?.error("Error al eliminar"); }
    };

    const getClinicalZonaLabel = (dienteId, zona) => {
        if (zona === "center") return "Oclusal/Incisal";
        if (zona === "Completo") return "Pieza Completa";
        
        const num = parseInt(dienteId);
        // Dientes Superiores: 1x, 2x, 5x, 6x
        const isUpper = (num >= 11 && num <= 28) || (num >= 51 && num <= 65);
        
        if (zona === "top") return "Vestibular";
        if (zona === "bottom") return isUpper ? "Palatina" : "Lingual";
        
        // Mesial es hacia la línea media (entre 11-21, 51-61, etc.)
        // Derecha del paciente (1x, 4x, 5x, 8x): Derecha en pantalla es Mesial, Izquierda es Distal
        // Izquierda del paciente (2x, 3x, 6x, 7x): Izquierda en pantalla es Mesial, Derecha es Distal
        const isRightSide = (num >= 11 && num <= 18) || (num >= 41 && num <= 48) || (num >= 51 && num <= 55) || (num >= 81 && num <= 85);
        
        if (zona === "left") return isRightSide ? "Distal" : "Mesial";
        if (zona === "right") return isRightSide ? "Mesial" : "Distal";
        
        return zona;
    };

    const [activeToothId, setActiveToothId] = useState(null);
    const [surfaceFilter, setSurfaceFilter] = useState("todas");
    const odontogramaRef = useRef(null);

    const handleImprimir = () => {
        handlePrintSesion({
            ...currentSesion,
            data: odontogramaData,
            plan: planTratamiento,
            observaciones,
            tipoDenticion,
            creado: currentSesion?.creado || new Date().toISOString(),
            profesional: currentSesion?.profesional || userProfile?.nombreCompleto || "Odontólogo Tratante"
        });
    };

    const handleToothClick = (dienteId, zona) => {
        if (isReadOnly) {
            setReadOnlyAlert(true);
            return;
        }

        setActiveToothId(dienteId);
        
        if (!surfaceFilter) return;

        // Si el usuario tiene un filtro de superficie activo (ej: Mesial)
        // Forzamos que se marque esa zona específica automáticamente en cualquier clic (diente o selector)
        let targetZona = zona;
        if (surfaceFilter !== "todas") {
            const surfaceMap = {
                'vestibular': 'top',
                'oclusal': 'center',
                'lingual': 'bottom',
                'mesial': (parseInt(dienteId) >= 11 && parseInt(dienteId) <= 18) || (parseInt(dienteId) >= 41 && parseInt(dienteId) <= 48) || (parseInt(dienteId) >= 51 && parseInt(dienteId) <= 55) || (parseInt(dienteId) >= 81 && parseInt(dienteId) <= 85) ? 'right' : 'left',
                'distal': (parseInt(dienteId) >= 11 && parseInt(dienteId) <= 18) || (parseInt(dienteId) >= 41 && parseInt(dienteId) <= 48) || (parseInt(dienteId) >= 51 && parseInt(dienteId) <= 55) || (parseInt(dienteId) >= 81 && parseInt(dienteId) <= 85) ? 'left' : 'right'
            };
            targetZona = surfaceMap[surfaceFilter] || zona;
        }

        const tool = TOOLS.find(t => t.id === selectedToolId);
        if (!tool) return;

        const GENERAL_TOOLS = [
            "ausente", "extraccion", "implante_bueno", "implante_malo", 
            "corona_buena", "corona_des", "perno_bueno", "perno_malo", 
            "diente_sano", "fractura", "endodoncia_buena", "endodoncia_mala"
        ];
        const isGeneralTool = GENERAL_TOOLS.includes(selectedToolId);

        setOdontogramaData(prev => {
            const cur = { ...(prev[dienteId] || {}) };
            
            if (selectedToolId === "borrador") {
                if (targetZona === "Completo" || isGeneralTool) {
                    return { ...prev, [dienteId]: {} };
                }
                const newToothData = { ...cur };
                delete newToothData[targetZona];
                return { ...prev, [dienteId]: newToothData };
            }

            if (isGeneralTool || targetZona === "Completo") {
                return { 
                    ...prev, 
                    [dienteId]: { 
                        ...cur, 
                        general: { id: tool.id, color: tool.color } 
                    } 
                };
            }

            return { 
                ...prev, 
                [dienteId]: { 
                    ...cur, 
                    [targetZona]: { id: tool.id, color: tool.color } 
                } 
            };
        });

        if (selectedToolId === "borrador") {
            setPlanTratamiento(prev => prev.filter(item => {
                if (String(item.diente) !== String(dienteId)) return true;
                return targetZona !== "Completo" && item.zona !== targetZona;
            }));
            return;
        }

        const label = tool.label;
        const zonaLabel = isGeneralTool ? "Pieza Completa" : getClinicalZonaLabel(dienteId, targetZona);
        const fullDescription = isGeneralTool ? label : `${label} - ${zonaLabel}`;
        const planZone = (isGeneralTool || targetZona === "Completo") ? "Completo" : targetZona;
        const nextItem = {
                diente: dienteId, 
                zona: planZone,
                zonaLabel: zonaLabel, 
                tratamiento: fullDescription, 
                color: tool.color, 
                estado: "Planificado", 
                fechaISO: new Date().toISOString(),
                toolId: tool.id
            };

        setPlanTratamiento(prev => {
            const existingIndex = prev.findIndex(item =>
                String(item.diente) === String(dienteId) && item.zona === planZone
            );
            if (existingIndex < 0) return [...prev, nextItem];
            const next = [...prev];
            next[existingIndex] = nextItem;
            return next;
        });
    };

    const handleSurfaceFilterChange = (newSurfaceId) => {
        if (isReadOnly) {
            setReadOnlyAlert(true);
            return;
        }
        setSurfaceFilter(newSurfaceId);
        setActiveToothId(null);
    };

    const handleToolSelect = (toolId) => {
        if (isReadOnly) {
            setReadOnlyAlert(true);
            return;
        }
        const GENERAL_TOOLS = [
            "ausente", "extraccion", "implante_bueno", "implante_malo", 
            "corona_buena", "corona_des", "perno_bueno", "perno_malo", 
            "diente_sano", "fractura", "endodoncia_buena", "endodoncia_mala"
        ];
        setSelectedToolId(prev => {
            const next = prev === toolId ? null : toolId;
            if (next && GENERAL_TOOLS.includes(next)) {
                setSurfaceFilter("todas");
                setActiveToothId(null);
            }
            return next;
        });
    };

    const handleSave = async (finalizar = false) => {
        if (!currentSesion?.id) return;
        setSaving(true);
        try {
            const newEstado = finalizar ? "Finalizado" : (currentSesion.estado || "Abierto");
            const { error } = await supabase
                .from("odontogramas")
                .update({
                    hallazgos: {
                        data: odontogramaData,
                        plan: planTratamiento,
                        estado: newEstado,
                        tipoDenticion,
                        creadoPor: currentSesion.creadoPor || userProfile?.email || "usuario@sistema.com",
                        profesional: currentSesion.profesional || userProfile?.nombreCompleto || "Profesional de Planta"
                    },
                    observaciones: observaciones
                })
                .eq("id", currentSesion.id);

            if (error) throw error;

            // Sincronización con Plan de Tratamiento Centralizado
            if (finalizar && planTratamiento.length > 0) {
                const itemsToInsert = planTratamiento.map(item => ({
                    paciente_id: embeddedPatient.id,
                    tenant_id: embeddedPatient.inquilino || embeddedPatient.tenant_id,
                    odontograma_id: currentSesion.id,
                    diente: item.diente,
                    zona: item.zona,
                    zona_label: item.zonaLabel,
                    tratamiento: item.tratamiento,
                    color: item.color,
                    estado: "Pendiente",
                    valor: 0,
                    creado_por: embeddedPatient.creadorEmail || "Doctor"
                }));
                await supabase.from("tratamientos_pendientes").insert(itemsToInsert);
            }

            toast?.success(finalizar ? "✅ Sesión finalizada y sincronizada con el Plan" : "✅ Guardado correctamente");
            if (finalizar) { setViewMode("LIST"); loadSesiones(); }
        } catch (e) { 
            console.error(e);
            toast?.error("Error al guardar"); 
        }
        finally { setSaving(false); }
    };

    const handleDeleteItem = (idx) => {
        if (isReadOnly) {
            setReadOnlyAlert(true);
            return;
        }
        const item = planTratamiento[idx];
        setPlanTratamiento(prev => prev.filter((_, i) => i !== idx));
        setOdontogramaData(prev => {
            const c = { ...(prev[item.diente] || {}) };
            const isGeneral = [
                "ausente", "extraccion", "implante_bueno", "implante_malo", 
                "corona_buena", "corona_des", "perno_bueno", "perno_malo", 
                "diente_sano", "fractura", "endodoncia_buena", "endodoncia_mala"
            ].includes(item.toolId);

            if (item.zona === "Completo" || isGeneral || (c.general && c.general.id === item.toolId)) {
                delete c.general;
            } else {
                delete c[item.zona];
            }
            return { ...prev, [item.diente]: c };
        });
    };

    const isReadOnly = isReadOnlyMode || currentSesion?.estado === "Finalizado";
    const filtered = sesiones.filter(s =>
        !search || (s.creadoPor || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.profesional || "").toLowerCase().includes(search.toLowerCase())
    );

    if (viewMode === "LIST") {
        return (
            <div className="flex flex-col h-full bg-white animate-fadeIn">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">
                            Historial de <span className="text-indigo-600">Odontogramas</span>
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                            <FiClock size={10} className="text-indigo-400" />
                            Registro clínico cronológico — {embeddedPatient?.nombreCompleto}
                        </p>
                    </div>
                    <button
                        onClick={handleNuevo}
                        className="flex items-center gap-2 px-6 py-3 rounded-[18px] bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95 transition-all"
                    >
                        <FiPlus size={16} strokeWidth={3} />
                        Nuevo Odontograma
                    </button>
                </header>

                <div className="px-8 py-3 border-b border-slate-50 flex items-center gap-3 bg-slate-50/40">
                    <div className="relative flex-1 max-w-xs">
                        <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por profesional o usuario..."
                            className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-[11px] text-slate-700 bg-white outline-none focus:border-indigo-300 transition-colors"
                        />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-auto">
                        {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-12 px-8 py-3 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <div className="col-span-3 flex items-center gap-1"><FiCalendar size={10} /> Fecha de Sesión</div>
                        <div className="col-span-3">Creado por</div>
                        <div className="col-span-3">Profesional a cargo</div>
                        <div className="col-span-1">Estado</div>
                        <div className="col-span-2 text-right">Acciones</div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <div className="w-8 h-8 border-3 border-slate-100 border-t-indigo-600 rounded-full animate-spin" style={{ border: "3px solid #f1f5f9", borderTopColor: "#4f46e5" }} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Cargando...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                            <FiCalendar size={40} className="mb-4 opacity-50" />
                            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Sin registros clínicos</div>
                            <div className="text-[10px] text-slate-300 mb-6">Inicia el primer registro para este paciente</div>
                            <button onClick={handleNuevo} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline">
                                + Crear primer odontograma
                            </button>
                        </div>
                    ) : filtered.map((s, idx) => {
                        const fecha = s.creado?.toDate ? s.creado.toDate() : (s.creado ? new Date(s.creado) : new Date());
                        const fechaStr = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        const horaStr = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                        const finalizado = s.estado === "Finalizado";

                        return (
                            <div
                                key={s.id}
                                className="grid grid-cols-12 items-center px-8 py-4 border-b border-slate-50 hover:bg-indigo-50/20 transition-colors group"
                            >
                                <div className="col-span-3 flex items-center gap-3">
                                    <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors border border-slate-100">
                                        <FiCalendar size={16} />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-black text-slate-800 tracking-tight">{fechaStr}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{horaStr}</div>
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <div className="text-[11px] font-semibold text-slate-600 truncate max-w-[180px]">
                                        {s.creadoPor || "usuario@sistema.com"}
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <div className="text-[11px] font-semibold text-slate-600 truncate max-w-[180px]">
                                        {s.profesional || "Profesional de Planta"}
                                    </div>
                                </div>

                                <div className="col-span-1">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${finalizado
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                        : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${finalizado ? "bg-emerald-500" : "bg-indigo-500 animate-pulse"}`} />
                                        {s.estado || "Abierto"}
                                    </span>
                                </div>

                                <div className="col-span-2 flex justify-end items-center gap-1.5">
                                    {/* 1. Firma del paciente */}
                                    <button
                                        onClick={() => setFirmaModal({ ...s, tipoFirma: "paciente" })}
                                        title="Firma del paciente"
                                        className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center hover:bg-cyan-100 transition-all shadow-sm"
                                    >
                                        <FiFeather size={14} />
                                    </button>

                                    {/* 2. Firma del doctor */}
                                    <button
                                        onClick={() => setFirmaModal({ ...s, tipoFirma: "doctor" })}
                                        title="Firma del doctor"
                                        className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-all shadow-sm"
                                    >
                                        <FiAward size={14} />
                                    </button>

                                    {/* 3. Ver (Modo solo lectura) */}
                                    <button
                                        onClick={() => abrirEditor(s, true)}
                                        title="Ver odontograma"
                                        className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-all shadow-sm"
                                    >
                                        <FiEye size={14} />
                                    </button>

                                    {/* 4. Editar (SOLO si no está finalizado) */}
                                    {!finalizado && (
                                        <button
                                            onClick={() => abrirEditor(s, false)}
                                            title="Editar odontograma"
                                            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-all shadow-sm"
                                        >
                                            <FiEdit3 size={14} />
                                        </button>
                                    )}

                                    {/* 5. Imprimir */}
                                    <button
                                        onClick={() => handlePrintSesion(s)}
                                        title="Imprimir / PDF"
                                        className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-all shadow-sm"
                                    >
                                        <FiPrinter size={14} />
                                    </button>

                                    {/* 6. Borrar */}
                                    <button
                                        onClick={() => handleEliminar(s.id)}
                                        title="Borrar odontograma"
                                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-all shadow-sm"
                                    >
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <footer className="h-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between px-8">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {sesiones.length} sesión{sesiones.length !== 1 ? "es" : ""} clínica{sesiones.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Motor Clínico v4.0 Elite
                    </span>
                </footer>

                {firmaModal && (
                    <FirmaHuellaModal
                        sesion={firmaModal}
                        paciente={embeddedPatient}
                        tipo={firmaModal.tipoFirma || "paciente"}
                        planTratamiento={firmaModal.plan || []}
                        onClose={() => setFirmaModal(null)}
                        onGuardar={async ({ firmaDataUrl, huellaImg, tipo }) => {
                            try {
                                const isDoc = tipo === "doctor";
                                const currentHallazgos = firmaModal.rawHallazgos || {};
                                const updatePayload = {
                                    ...currentHallazgos,
                                    data: firmaModal.data || currentHallazgos.data || {},
                                    plan: firmaModal.plan || currentHallazgos.plan || [],
                                    estado: firmaModal.estado || currentHallazgos.estado || "Abierto",
                                    tipoDenticion: firmaModal.tipoDenticion || currentHallazgos.tipoDenticion || "completo",
                                    creadoPor: firmaModal.creadoPor || currentHallazgos.creadoPor,
                                    profesional: firmaModal.profesional || currentHallazgos.profesional,
                                    firmaDoctor: isDoc ? (firmaDataUrl || null) : (firmaModal.firmaDoctor || currentHallazgos.firmaDoctor || null),
                                    firmaPaciente: !isDoc ? (firmaDataUrl || null) : (firmaModal.firmaPaciente || currentHallazgos.firmaPaciente || null),
                                    huellaPaciente: !isDoc ? (huellaImg || null) : (firmaModal.huellaPaciente || currentHallazgos.huellaPaciente || null),
                                    firmadoEn: new Date().toISOString()
                                };

                                const { error } = await supabase
                                    .from("odontogramas")
                                    .update({
                                        hallazgos: updatePayload
                                    })
                                    .eq("id", firmaModal.id);

                                if (error) throw error;
                                toast?.success(isDoc ? "✅ Firma del doctor guardada con éxito" : "✅ Firma y huella del paciente guardadas con éxito");
                                setFirmaModal(null);
                                loadSesiones();
                            } catch (err) {
                                console.error("Error al guardar firma:", err);
                                toast?.error("Error al guardar firma");
                            }
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden animate-fadeIn">
            <header className="px-6 py-3 border-b border-slate-100 flex items-center gap-4 bg-white sticky top-0 z-20 flex-wrap">
                <button
                    onClick={() => { setViewMode("LIST"); loadSesiones(); }}
                    className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                >
                    <FiChevronLeft size={18} />
                </button>

                <div>
                    <div className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-none flex items-center gap-2">
                        <span>Odontograma <span className="text-indigo-600">Clínico</span></span>
                        {isReadOnly ? (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                                {currentSesion?.estado === "Finalizado" ? "FINALIZADO" : "MODO VISUALIZACIÓN"}
                            </span>
                        ) : (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                MODO EDICIÓN
                            </span>
                        )}
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        {embeddedPatient?.nombreCompleto} • {planTratamiento.length} hallazgo{planTratamiento.length !== 1 ? "s" : ""}
                    </div>
                </div>

                <div className="flex-1" />

                {/* Selector de Dentición Profesional */}
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                    {[
                        { id: 'adulto', label: 'Permanente', icon: '🦷' },
                        { id: 'nino', label: 'Temporal', icon: '👶' },
                        { id: 'completo', label: 'Mixta', icon: '🌓' }
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setTipoDenticion(btn.id)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${tipoDenticion === btn.id
                                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                                : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                                }`}
                        >
                            <span>{btn.icon}</span>
                            {btn.label}
                        </button>
                    ))}
                </div>

                {isReadOnly && currentSesion?.estado !== "Finalizado" && (
                    <button
                        onClick={() => {
                            setIsReadOnlyMode(false);
                            setReadOnlyAlert(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-[14px] bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all shadow-sm"
                    >
                        <FiEdit3 size={14} /> Modo edición
                    </button>
                )}

                {!isReadOnly && (
                    <>
                        <button onClick={() => handleSave(false)} disabled={saving} className={`flex items-center gap-2 px-5 py-2 rounded-[14px] text-[11px] font-black uppercase tracking-widest transition-all ${saving ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"}`}>
                            <FiSave size={14} /> {saving ? "..." : "Guardar"}
                        </button>
                        <button onClick={() => handleSave(true)} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-[14px] bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                            <FiCheckCircle size={14} /> Finalizar
                        </button>
                    </>
                )}
                <button onClick={handleImprimir} title="Imprimir como PDF" className="flex items-center gap-2 px-4 py-2 rounded-[14px] bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all shadow-sm">
                    <FiPrinter size={14} /> Imprimir
                </button>
            </header>

            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Columna Principal: Odontograma + Leyenda y Hallazgos a Ancho Completo */}
                <div className="w-full flex-1 flex flex-col bg-white min-w-0 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
                    <div className="w-full flex-shrink-0" ref={odontogramaRef}>
                        <OdontogramaVisual
                            odontogramaData={odontogramaData}
                            onToothClick={handleToothClick}
                            tipoDenticion={tipoDenticion}
                            activeToothId={activeToothId}
                            surfaceFilter={surfaceFilter}
                        />
                    </div>
                    
                    {/* Panel Inferior: Checkboxes, Leyenda y Observaciones */}
                    <div className="px-8 py-6 border-t border-slate-200 bg-white shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-10">
                        {/* Checkboxes de Superficies — con bloqueo para herramientas de pieza completa */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
                            {[
                                { id: 'todas', label: 'Todas las superficies' },
                                { id: 'vestibular', label: 'Vestibular' },
                                { id: 'oclusal', label: 'Oclusal/Incisal' },
                                { id: 'lingual', label: 'Lingual/Palatina' },
                                { id: 'mesial', label: 'Mesial' },
                                { id: 'distal', label: 'Distal' }
                            ].map(surf => {
                                const GENERAL_TOOLS = [
                                    "ausente", "extraccion", "implante_bueno", "implante_malo", 
                                    "corona_buena", "corona_des", "perno_bueno", "perno_malo", 
                                    "diente_sano", "fractura", "endodoncia_buena", "endodoncia_mala"
                                ];
                                const isBlocked = GENERAL_TOOLS.includes(selectedToolId) && surf.id !== 'todas';
                                return (
                                    <label
                                        key={surf.id}
                                        className={`flex items-center gap-2 ${isBlocked ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer group'}`}
                                        title={isBlocked ? "Esta opción aplica a toda la pieza dental" : undefined}
                                    >
                                        <input
                                            type="radio"
                                            name="odontograma-superficie"
                                            disabled={isBlocked}
                                            checked={surfaceFilter === surf.id}
                                            onChange={() => !isBlocked && handleSurfaceFilterChange(surf.id)}
                                            className="w-4 h-4 text-indigo-600 bg-slate-50 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <span className={`text-[12px] font-bold transition-colors ${surfaceFilter === surf.id ? "text-indigo-700" : "text-slate-700 group-hover:text-slate-900"}`}>{surf.label}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Leyenda y Observaciones */}
                        <div className="flex flex-col xl:flex-row gap-6 items-start">
                            {/* Leyenda: 2-3 columnas responsive */}
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 gap-x-8 gap-y-1 bg-slate-50/50 p-4 rounded-[20px] border border-slate-100 shadow-sm w-full">
                                {TOOLS.filter(t => t.id !== "borrador").map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleToolSelect(t.id)}
                                        className={`flex items-center gap-2 py-1.5 px-2.5 rounded-xl transition-all text-left ${
                                            selectedToolId === t.id
                                                ? "bg-white shadow-sm ring-1 ring-indigo-200"
                                                : "hover:bg-white/70"
                                        }`}
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 shrink-0 shadow-sm overflow-hidden" style={{ color: t.color }}>
                                            {t.icon}
                                        </div>
                                        <span className={`text-[10px] md:text-[11px] font-semibold truncate ${selectedToolId === t.id ? "text-indigo-800 font-bold" : "text-slate-600"}`}>
                                            {t.label}
                                        </span>
                                    </button>
                                ))}
                                {/* Borrador */}
                                <button
                                    onClick={() => handleToolSelect("borrador")}
                                    className={`flex items-center gap-2 py-1.5 px-2.5 rounded-xl transition-all text-left col-span-full mt-2 border-t border-slate-100 pt-3 ${
                                        selectedToolId === "borrador" ? "bg-white shadow-sm ring-1 ring-slate-300" : "hover:bg-white/70"
                                    }`}
                                >
                                    <div className="w-5 h-5 rounded-full bg-slate-300 shrink-0 shadow-sm" />
                                    <span className="text-[11px] font-semibold text-slate-600">Borrador General</span>
                                </button>
                            </div>

                            {/* Campo de Observaciones */}
                            <div className="w-full xl:w-[260px] flex-shrink-0">
                                <label className="text-[12px] font-black text-slate-800 tracking-tight block mb-2">Observaciones Clínicas:</label>
                                <textarea
                                    value={observaciones}
                                    onChange={e => setObservaciones(e.target.value)}
                                    disabled={isReadOnly}
                                    className="w-full rounded-[14px] border-2 border-slate-200 px-4 py-3 text-[12px] text-slate-700 resize-y min-h-[140px] outline-none focus:border-indigo-400 transition-colors bg-white shadow-inner disabled:bg-slate-50 disabled:text-slate-500"
                                    placeholder="Detalles sobre los hallazgos..."
                                />
                            </div>
                        </div>

                        {/* TABLA DE HALLAZGOS INLINE (MATCHING ORALDRIVE SCREENSHOT 1) */}
                        <div className="mt-8 border-t border-slate-200 pt-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-[12px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <span>Hallazgos del Odontograma</span>
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                                        {planTratamiento.length} registros
                                    </span>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full border-collapse text-[11px]">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[9.5px] border-b border-slate-200">
                                            <th className="py-2.5 px-4 text-left">Fecha de creación</th>
                                            <th className="py-2.5 px-4 text-left">Creado por</th>
                                            <th className="py-2.5 px-4 text-center">Pieza</th>
                                            <th className="py-2.5 px-4 text-left">Situación</th>
                                            <th className="py-2.5 px-4 text-left">Cara afectada</th>
                                            {!isReadOnly && <th className="py-2.5 px-3 text-center">Acción</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {planTratamiento.length === 0 ? (
                                            <tr>
                                                <td colSpan={isReadOnly ? 5 : 6} className="py-8 text-center text-slate-400 text-[11px]">
                                                    Sin hallazgos clínicos registrados en esta sesión.
                                                </td>
                                            </tr>
                                        ) : (
                                            planTratamiento.map((item, idx) => {
                                                const dateStr = item.fechaISO ? new Date(item.fechaISO).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : "—";
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="py-2.5 px-4 text-slate-500 font-semibold">{dateStr}</td>
                                                        <td className="py-2.5 px-4 text-slate-700 font-semibold">{currentSesion?.profesional || userProfile?.nombreCompleto || "Doctor"}</td>
                                                        <td className="py-2.5 px-4 text-center">
                                                            <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 font-black px-2 py-0.5 rounded-md text-[10px]">
                                                                #{item.diente}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color || "#94a3b8" }} />
                                                                <span className="font-bold text-slate-800">{item.tratamiento}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-4 text-slate-600">{item.zonaLabel || item.zona}</td>
                                                        {!isReadOnly && (
                                                            <td className="py-2.5 px-3 text-center">
                                                                <button
                                                                    onClick={() => handleDeleteItem(idx)}
                                                                    className="text-rose-400 hover:text-rose-600 hover:scale-110 p-1 transition-all"
                                                                    title="Eliminar hallazgo"
                                                                >
                                                                    <FiTrash2 size={13} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AVISO FLOTANTE DE MODO VISUALIZACIÓN (MATCHING ORALDRIVE SCREENSHOT 1) */}
            {readOnlyAlert && (
                <div 
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 shadow-2xl rounded-2xl bg-rose-500 text-white px-6 py-3.5 flex items-center gap-3 border border-rose-400 max-w-lg animate-bounce-short"
                    style={{ boxShadow: "0 20px 45px rgba(244, 63, 94, 0.45)" }}
                >
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <FiAlertTriangle className="text-xl text-white" />
                    </div>
                    <div className="text-left flex-1">
                        <div className="font-extrabold text-[13px] tracking-wide leading-tight">Oops!</div>
                        <div className="text-[11.5px] font-medium text-rose-100 leading-snug mt-0.5">
                            Se encuentra en modo visualización, si desea editar el odontograma, debe ir a modo edición.
                        </div>
                    </div>
                    {currentSesion?.estado !== "Finalizado" && (
                        <button
                            onClick={() => {
                                setIsReadOnlyMode(false);
                                setReadOnlyAlert(false);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase tracking-wider shrink-0 transition-all shadow-sm"
                        >
                            Modo edición
                        </button>
                    )}
                    <button 
                        onClick={() => setReadOnlyAlert(false)} 
                        className="text-rose-200 hover:text-white p-1 ml-1"
                        title="Cerrar"
                    >
                        <FiX size={18} />
                    </button>
                </div>
            )}
        </div>
    );
}
