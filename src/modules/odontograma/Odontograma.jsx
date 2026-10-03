// src/modules/odontograma/Odontograma.jsx
import React, { useState, useEffect, useRef } from "react";
import OdontogramaVisual from "./components/OdontogramaVisual";
import TratamientosToolbar, { TOOLS, SURFACES, GENERAL_TOOLS } from "./components/TratamientosToolbar";
import supabase from "../../lib/supabaseClient";
import {
    FiPlus,
    FiSave,
    FiClock,
    FiFileText,
    FiTrash2,
    FiSearch,
    FiChevronLeft,
    FiChevronDown,
    FiCheckCircle,
    FiEye,
    FiEdit2,
    FiEdit3,
    FiPrinter,
    FiCalendar,
    FiPenTool,
    FiAward,
    FiAlertTriangle,
    FiX
} from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import FirmaHuellaModal from "./components/FirmaHuellaModal";
import { generateOralDriveOdontogramaPrintHTML } from "./utils/odontogramaPrintService";
import { isDoctorUser } from "../../utils/doctorHelpers";
import { getDoctorsList } from "../../services/supabaseServices";
import { getDoctorSignatureAndData } from "../../services/doctorSignatureService";
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
    const { userProfile, user } = useAuth();
    const esDoctor = isDoctorUser(userProfile);
    const currentUserName = userProfile?.nombreCompleto 
        || userProfile?.nombre 
        || `${userProfile?.nombres || ''} ${userProfile?.apellidos || ''}`.trim()
        || userProfile?.displayName 
        || user?.displayName 
        || user?.email 
        || "Usuario";

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

    // Estados de Profesional Odontólogo
    const [catalogProfesionales, setCatalogProfesionales] = useState([]);
    const [currentDoctor, setCurrentDoctor] = useState("");
    const [showNewModal, setShowNewModal] = useState(false);
    const [newModalDoctor, setNewModalDoctor] = useState("");
    const [newModalDenticion, setNewModalDenticion] = useState("adulto");

    // Estados de Acciones y Eliminación
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [deleteConfirmSesion, setDeleteConfirmSesion] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        const loadDoctors = async () => {
            try {
                let docs = await getDoctorsList(userProfile, embeddedPatient);
                if (!docs || docs.length === 0) {
                    docs = await getDoctorsList(userProfile, null);
                }
                setCatalogProfesionales(docs || []);
            } catch (err) {
                console.warn("Error cargando lista de profesionales en Odontograma:", err);
            }
        };
        if (embeddedPatient?.id) {
            loadDoctors();
        }
    }, [embeddedPatient?.id, userProfile]);

    useEffect(() => {
        if (readOnlyAlert) {
            const timer = setTimeout(() => setReadOnlyAlert(false), 4000);
            return () => clearTimeout(timer);
        }
    }, [readOnlyAlert]);

    const handlePrintSesion = async (sesionToPrint) => {
        try {
            const targetDocName = sesionToPrint?.profesional || currentDoctor || "";
            let doctorData = catalogProfesionales.find(p => 
                (p.nombreCompleto && p.nombreCompleto.toLowerCase() === targetDocName.toLowerCase()) ||
                (p.nombre && p.nombre.toLowerCase() === targetDocName.toLowerCase())
            ) || {};

            try {
                const resolved = await getDoctorSignatureAndData(
                    targetDocName || doctorData?.id || doctorData?.nombre,
                    embeddedPatient?.inquilino || embeddedPatient?.tenant_id || userProfile?.tenant_id,
                    userProfile
                );
                if (resolved?.nombre) {
                    doctorData = { ...doctorData, ...resolved };
                }
            } catch (e) {
                console.warn("Aviso al consultar datos del doctor para impresión:", e);
            }

            const html = generateOralDriveOdontogramaPrintHTML({
                sesion: sesionToPrint,
                paciente: embeddedPatient,
                userProfile,
                doctorData,
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

    const handleNuevo = () => {
        if (!esDoctor) {
            // Usuario administrativo / recepción: abre modal para elegir el profesional odontólogo
            const defaultDoc = (catalogProfesionales.length > 0)
                ? (catalogProfesionales[0].nombreCompleto || catalogProfesionales[0].nombre)
                : "";
            setNewModalDoctor(defaultDoc);
            setNewModalDenticion("adulto");
            setShowNewModal(true);
        } else {
            // Usuario con rol de doctor: creación directa asignándose a sí mismo
            const myName = currentUserName || "Odontólogo Tratante";
            handleCreateWithDoctor(myName, "adulto");
        }
    };

    const handleCreateWithDoctor = async (doctorName, denticion = "adulto") => {
        if (!doctorName) {
            return toast?.warning("Debe seleccionar el profesional a cargo del odontograma");
        }
        setLoading(true);
        try {
            const tenantId = embeddedPatient?.inquilino || embeddedPatient?.tenant_id || userProfile?.tenant_id || userProfile?.inquilino;
            const creador = currentUserName;

            const { data, error } = await supabase
                .from("odontogramas")
                .insert([{
                    paciente_id: embeddedPatient.id,
                    tenant_id: tenantId,
                    hallazgos: {
                        data: {},
                        plan: [],
                        estado: "Abierto",
                        tipoDenticion: denticion,
                        creadoPor: creador,
                        profesional: doctorName
                    },
                    observaciones: ""
                }])
                .select()
                .single();
            if (error) throw error;
            const h = data.hallazgos || {};
            setShowNewModal(false);
            abrirEditor({ 
                id: data.id, 
                data: h.data || {}, 
                plan: h.plan || [], 
                observaciones: data.observaciones || "", 
                estado: h.estado || "Abierto",
                tipoDenticion: h.tipoDenticion || denticion,
                creadoPor: h.creadoPor || creador,
                profesional: h.profesional || doctorName,
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

        // Resolver profesional: si fue guardado erróneamente con el nombre de un usuario administrativo,
        // o si viene vacío, resolver con el primer doctor del catálogo disponible
        let initialDoc = s.profesional;
        const loggedUserName = (currentUserName || "").trim().toLowerCase();
        const isSavedWithNonDocAdmin = !esDoctor && loggedUserName && initialDoc && initialDoc.trim().toLowerCase() === loggedUserName;

        if (!initialDoc || initialDoc === "Profesional de Planta" || isSavedWithNonDocAdmin) {
            if (esDoctor) {
                initialDoc = currentUserName;
            } else if (catalogProfesionales.length > 0) {
                initialDoc = catalogProfesionales[0].nombreCompleto || catalogProfesionales[0].nombre || "";
            }
        }
        setCurrentDoctor(initialDoc || "");

        setIsReadOnlyMode(readOnly);
        setReadOnlyAlert(false);
        setViewMode("EDITOR");
    };

    const handleEliminar = (s) => {
        setDeleteConfirmSesion(s);
    };

    const executeDelete = async (id) => {
        setDeletingId(id);
        try {
            // 1. Limpiar tratamientos pendientes asociados si existen
            try {
                await supabase
                    .from("tratamientos_pendientes")
                    .delete()
                    .eq("odontograma_id", id);
            } catch (eTrat) {
                console.warn("Aviso al limpiar tratamientos pendientes:", eTrat);
            }

            // 2. Eliminar el odontograma de la base de datos
            const { error } = await supabase
                .from("odontogramas")
                .delete()
                .eq("id", id);

            if (error) throw error;

            // 3. Actualizar la lista en pantalla inmediatamente
            setSesiones(prev => prev.filter(item => item.id !== id));
            toast?.success("Odontograma eliminado correctamente");
            setDeleteConfirmSesion(null);
        } catch (err) {
            console.error("Error al eliminar odontograma:", err);
            toast?.error("Error al eliminar odontograma: " + (err?.message || ""));
        } finally {
            setDeletingId(null);
        }
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
            profesional: currentDoctor || currentSesion?.profesional || "Odontólogo Tratante"
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

        const isGeneralTool = GENERAL_TOOLS.includes(selectedToolId);

        setOdontogramaData(prev => {
            const cur = { ...(prev[dienteId] || {}) };
            
            if (selectedToolId === "borrador") {
                if (targetZona === "Completo" || isGeneralTool || surfaceFilter === "todas") {
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

            if (surfaceFilter === "todas") {
                return {
                    ...prev,
                    [dienteId]: {
                        ...cur,
                        top: { id: tool.id, color: tool.color },
                        center: { id: tool.id, color: tool.color },
                        bottom: { id: tool.id, color: tool.color },
                        left: { id: tool.id, color: tool.color },
                        right: { id: tool.id, color: tool.color },
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
            const isFullClear = targetZona === "Completo" || isGeneralTool || surfaceFilter === "todas";
            setPlanTratamiento(prev => prev.filter(item => {
                if (String(item.diente) !== String(dienteId)) return true;
                return !isFullClear && item.zona !== targetZona;
            }));
            return;
        }

        const label = tool.label;
        const isAllSurfaces = !isGeneralTool && surfaceFilter === "todas";
        const zonaLabel = isGeneralTool 
            ? "Pieza Completa" 
            : isAllSurfaces 
                ? "Todas las superficies" 
                : getClinicalZonaLabel(dienteId, targetZona);
        const fullDescription = isGeneralTool ? label : `${label} - ${zonaLabel}`;
        const planZone = (isGeneralTool || isAllSurfaces || targetZona === "Completo") ? "Completo" : targetZona;
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
        setSelectedToolId(toolId);
        if (toolId && GENERAL_TOOLS.includes(toolId)) {
            setSurfaceFilter("todas");
            setActiveToothId(null);
        }
    };

    const handleSave = async (finalizar = false) => {
        if (!currentSesion?.id) return;
        setSaving(true);
        try {
            const newEstado = finalizar ? "Finalizado" : (currentSesion.estado || "Abierto");
            const finalDocName = currentDoctor || currentSesion.profesional || "Odontólogo Tratante";
            const { error } = await supabase
                .from("odontogramas")
                .update({
                    hallazgos: {
                        data: odontogramaData,
                        plan: planTratamiento,
                        estado: newEstado,
                        tipoDenticion,
                        creadoPor: currentSesion.creadoPor || currentUserName || "usuario@sistema.com",
                        profesional: finalDocName
                    },
                    observaciones: observaciones
                })
                .eq("id", currentSesion.id);

            if (error) throw error;

            setCurrentSesion(prev => ({
                ...prev,
                estado: newEstado,
                profesional: finalDocName,
                tipoDenticion,
                data: odontogramaData,
                plan: planTratamiento,
                observaciones
            }));

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
            const isGeneral = GENERAL_TOOLS.includes(item.toolId);

            if (item.zona === "Completo" || isGeneral || (c.general && c.general.id === item.toolId)) {
                delete c.general;
            } else {
                delete c[item.zona];
            }
            return { ...prev, [item.diente]: c };
        });
    };

    const isReadOnly = isReadOnlyMode || currentSesion?.estado === "Finalizado";
    const filtered = sesiones;

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
                            Registro clínico cronológico — {embeddedPatient?.nombreCompleto} • {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
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

                                <div className="col-span-2 flex justify-end items-center relative">
                                    <button
                                        type="button"
                                        onClick={() => setActiveMenuId(activeMenuId === s.id ? null : s.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-[11px] font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                                        title="Opciones del odontograma"
                                    >
                                        <span>Acciones</span>
                                        <FiChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${activeMenuId === s.id ? "rotate-180" : ""}`} />
                                    </button>

                                    {activeMenuId === s.id && (
                                        <>
                                            <div 
                                                className="fixed inset-0 z-30" 
                                                onClick={() => setActiveMenuId(null)} 
                                            />
                                            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40 text-left animate-fadeIn">
                                                {/* 1. Ver */}
                                                <button
                                                    type="button"
                                                    onClick={() => { setActiveMenuId(null); abrirEditor(s, true); }}
                                                    className="w-full px-3.5 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                >
                                                    <FiEye size={15} className="text-slate-400" />
                                                    <span>Ver odontograma</span>
                                                </button>

                                                {/* 2. Editar */}
                                                {!finalizado && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setActiveMenuId(null); abrirEditor(s, false); }}
                                                        className="w-full px-3.5 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                    >
                                                        <FiEdit3 size={15} className="text-slate-400" />
                                                        <span>Editar odontograma</span>
                                                    </button>
                                                )}

                                                {/* 3. Imprimir */}
                                                <button
                                                    type="button"
                                                    onClick={() => { setActiveMenuId(null); handlePrintSesion(s); }}
                                                    className="w-full px-3.5 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                >
                                                    <FiPrinter size={15} className="text-slate-400" />
                                                    <span>Imprimir / PDF</span>
                                                </button>

                                                <div className="my-1 border-t border-slate-100" />

                                                {/* 4. Firma del doctor */}
                                                <button
                                                    type="button"
                                                    onClick={() => { setActiveMenuId(null); setFirmaModal({ ...s, tipoFirma: "doctor" }); }}
                                                    className="w-full px-3.5 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                >
                                                    <FiPenTool size={15} className="text-blue-500" />
                                                    <span>Firma del doctor</span>
                                                </button>

                                                {/* 5. Firma del paciente */}
                                                <button
                                                    type="button"
                                                    onClick={() => { setActiveMenuId(null); setFirmaModal({ ...s, tipoFirma: "paciente" }); }}
                                                    className="w-full px-3.5 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                >
                                                    <FiEdit2 size={15} className="text-emerald-500" />
                                                    <span>Firma del paciente</span>
                                                </button>

                                                <div className="my-1 border-t border-slate-100" />

                                                {/* 6. Borrar */}
                                                <button
                                                    type="button"
                                                    onClick={() => { setActiveMenuId(null); setDeleteConfirmSesion(s); }}
                                                    className="w-full px-3.5 py-2 text-left text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                >
                                                    <FiTrash2 size={15} className="text-rose-500" />
                                                    <span>Eliminar odontograma</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
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

                {/* MODAL PARA CREAR NUEVO ODONTOGRAMA (SELECCIÓN DE PROFESIONAL) */}
                {showNewModal && (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                        <div className="bg-white rounded-[24px] shadow-2xl border border-slate-100 max-w-md w-full p-6 animate-scaleUp">
                            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                        <FiAward size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Nuevo Odontograma Clínico</h3>
                                        <p className="text-[11px] text-slate-400 font-semibold">Asignar odontólogo responsable</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowNewModal(false)}
                                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    <FiX size={18} />
                                </button>
                            </div>

                            <div className="py-5 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                        Profesional Odontólogo a cargo *
                                    </label>
                                    <select
                                        value={newModalDoctor}
                                        onChange={e => setNewModalDoctor(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                                    >
                                        <option value="">
                                            {catalogProfesionales.length === 0 ? "Sin doctores disponibles" : "Seleccione un profesional..."}
                                        </option>
                                        {catalogProfesionales.map(doc => (
                                            <option key={doc.id} value={doc.nombreCompleto || doc.nombre}>
                                                {doc.nombreCompleto || doc.nombre}
                                            </option>
                                        ))}
                                    </select>
                                    {catalogProfesionales.length === 0 && (
                                        <p className="text-[11px] text-amber-600 font-medium mt-1.5">
                                            ⚠️ No se encontraron odontólogos activos vinculados al paciente o a la clínica.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                        Tipo de Dentición Inicial
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'adulto', label: 'Permanente', icon: '🦷' },
                                            { id: 'nino', label: 'Temporal', icon: '👶' },
                                            { id: 'completo', label: 'Mixta', icon: '🌓' }
                                        ].map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setNewModalDenticion(item.id)}
                                                className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                                                    newModalDenticion === item.id
                                                        ? "bg-indigo-50/70 border-indigo-300 text-indigo-700 shadow-sm"
                                                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                                }`}
                                            >
                                                <span className="text-base">{item.icon}</span>
                                                <span>{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2.5">
                                    <div className="text-[11px] text-slate-500 font-medium">
                                        <span className="font-bold text-slate-700">Registrado por:</span> {currentUserName}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowNewModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCreateWithDoctor(newModalDoctor, newModalDenticion)}
                                    disabled={loading || !newModalDoctor}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                                >
                                    {loading ? "Iniciando..." : "Iniciar Odontograma"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL PARA CONFIRMAR ELIMINACIÓN DE ODONTOGRAMA */}
                {deleteConfirmSesion && (
                    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                        <div className="bg-white rounded-[24px] shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center animate-scaleUp">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100">
                                <FiTrash2 size={24} />
                            </div>
                            <h3 className="text-base font-black text-slate-800 tracking-tight mb-2">
                                ¿Eliminar odontograma?
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
                                Esta acción eliminará permanentemente la sesión clínica y todos sus hallazgos asociados. Esta acción no se puede deshacer.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDeleteConfirmSesion(null)}
                                    disabled={deletingId !== null}
                                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => executeDelete(deleteConfirmSesion.id)}
                                    disabled={deletingId !== null}
                                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                                >
                                    {deletingId ? "Eliminando..." : "Sí, eliminar"}
                                </button>
                            </div>
                        </div>
                    </div>
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

                {/* Selector / Indicador de Profesional Odontólogo */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 px-3 py-1.5 rounded-xl ml-1">
                    <FiAward size={14} className="text-indigo-600 shrink-0" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Doctor:</span>
                    {!isReadOnly && (!esDoctor || catalogProfesionales.length > 1) ? (
                        <select
                            value={currentDoctor}
                            onChange={e => setCurrentDoctor(e.target.value)}
                            className="bg-transparent text-[11px] font-bold text-indigo-900 border-none outline-none cursor-pointer pr-1"
                            title="Seleccione el profesional odontólogo a cargo"
                        >
                            <option value="">Seleccione profesional...</option>
                            {catalogProfesionales.map(doc => (
                                <option key={doc.id} value={doc.nombreCompleto || doc.nombre}>
                                    {doc.nombreCompleto || doc.nombre}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-[11px] font-bold text-slate-800">
                            {currentDoctor || "Odontólogo Tratante"}
                        </span>
                    )}
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
                            {/* Leyenda: 4 columnas como OralDrive */}
                            <div className="flex-1 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 bg-slate-50/50 p-4 rounded-[20px] border border-slate-100 shadow-sm w-full">
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
                                            <th className="py-2.5 px-4 text-left">Doctor / Profesional</th>
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
                                                        <td className="py-2.5 px-4 text-slate-700 font-semibold">{currentDoctor || currentSesion?.profesional || "Doctor"}</td>
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
