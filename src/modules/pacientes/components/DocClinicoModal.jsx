import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiSave, FiPlus, FiTrash2, FiSearch, FiBox, FiList, FiPenTool } from 'react-icons/fi';
import supabase from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import CIE10Search from './CIE10Search';
import MedicamentoSearch from './MedicamentoSearch';
import MEDICAMENTOS_COLOMBIA from '../../../data/medicamentosColombia';
import VIAS_ADMINISTRACION from '../../../data/viasAdministracionColombia';
import COLOMBIAN_CUM_REGISTRY from '../../../data/cumCompleto';
import { CUPS_DENTAL_CODES } from "../../../data/cupsCodes";
import { PREDEFINED_TEMPLATES } from '../../../data/plantillasPredeterminadas';
import { getConfigItems } from '../../../services/configPersistenceService';
import { getDoctorsList } from '../../../services/supabaseServices';


export default function DocClinicoModal({ isOpen, onClose, patient, docType, initialData = null, isViewOnly = false }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    
    const [saving, setSaving] = useState(false);
    const [contenido, setContenido] = useState("");
    const [profesional, setProfesional] = useState("");
    const [diagnostico, setDiagnostico] = useState("");
    
    // Lista de profesionales
    const [catalogProfesionales, setCatalogProfesionales] = useState([]);

    // Receta structured states
    const [recetaItems, setRecetaItems] = useState([]);
    const [treatmentPlans, setTreatmentPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState("");
    
    // Search states
    const [medSearchTerm, setMedSearchTerm] = useState("");
    const [selectedMed, setSelectedMed] = useState(null);
    const [medSuggestions, setMedSuggestions] = useState([]);

    // Step for Orden: 'profesional' or 'details'
    const [ordenStep, setOrdenStep] = useState('profesional');

    // Form states for Orden
    const [tipoOrden, setTipoOrden] = useState('Orden médica');
    const [dxPrincipal, setDxPrincipal] = useState(null);
    const [diagnosticosRelacionados, setDiagnosticosRelacionados] = useState([]);
    const [tempDxRelacionado, setTempDxRelacionado] = useState(null);
    const [observacionesGenerales, setObservacionesGenerales] = useState('');

    // CUPS items for Orden
    const [cupsItems, setCupsItems] = useState([]);
    const [cupsModalOpen, setCupsModalOpen] = useState(false);
    const [selectedCups, setSelectedCups] = useState(null);
    const [cupsObservaciones, setCupsObservaciones] = useState('');
    const [cupsQuery, setCupsQuery] = useState('');
    const [showCupsSuggestions, setShowCupsSuggestions] = useState(false);

    // ── Plantillas Clínicas states ───────────────────────────────────────────
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [templateValues, setTemplateValues] = useState({});

    // ── Consulta Médica form states ────────────────────────────────────────
    const [consultaTab, setConsultaTab] = useState('motivo');
    const [motivoConsulta, setMotivoConsulta] = useState('');
    const [enfermedadActual, setEnfermedadActual] = useState('');
    // Antecedentes
    const [antNoRefiere, setAntNoRefiere] = useState(false);
    const [tempAntCIE10, setTempAntCIE10] = useState(null);
    const [tempAntObs, setTempAntObs] = useState('');
    const [antecedentes, setAntecedentes] = useState([]);
    // Alergias
    const [alerNoRefiere, setAlerNoRefiere] = useState(false);
    const [tempAlerTipo, setTempAlerTipo] = useState('');
    const [tempAlerObs, setTempAlerObs] = useState('');
    const [alergias, setAlergias] = useState([]);
    // Antecedentes Familiares
    const [famNoRefiere, setFamNoRefiere] = useState(false);
    const [tempFamParentesco, setTempFamParentesco] = useState('');
    const [tempFamCIE10, setTempFamCIE10] = useState(null);
    const [tempFamObs, setTempFamObs] = useState('');
    const [antFamiliares, setAntFamiliares] = useState([]);
    // Medicamentos previos
    const [medPrevNoRefiere, setMedPrevNoRefiere] = useState(false);
    const [tempMedPrevItem, setTempMedPrevItem] = useState(null);
    const [tempMedPrevObs, setTempMedPrevObs] = useState('');
    const [medicamentosPrev, setMedicamentosPrev] = useState([]);

    // ── Asociar Consulta (for Orden form) ────────────────────────────────────
    const [asocConsultaModal, setAsocConsultaModal] = useState(false);
    const [consultasList, setConsultasList] = useState([]);
    const [asocConsultaId, setAsocConsultaId] = useState(null);

    // ── Consulta summary generator ────────────────────────────────────────
    const generateConsultaSummary = (motivo, enfermedad, ants, aler, fams, meds) => {
        const lines = [];
        if (motivo) lines.push(`MOTIVO DE CONSULTA:\n${motivo}`);
        if (enfermedad) lines.push(`ENFERMEDAD ACTUAL:\n${enfermedad}`);
        if (ants && ants.length > 0) {
            lines.push(`ANTECEDENTES:`);
            ants.forEach(a => lines.push(`  • [${a.code}] ${a.name}${a.obs ? ' – ' + a.obs : ''}`));
        }
        if (aler && aler.length > 0) {
            lines.push(`ALERGIAS:`);
            aler.forEach(a => lines.push(`  • ${a.tipo}${a.obs ? ' – ' + a.obs : ''}`));
        }
        if (fams && fams.length > 0) {
            lines.push(`ANTECEDENTES FAMILIARES:`);
            fams.forEach(f => lines.push(`  • ${f.parentesco}: [${f.code}] ${f.name}${f.obs ? ' – ' + f.obs : ''}`));
        }
        if (meds && meds.length > 0) {
            lines.push(`MEDICAMENTOS EN USO:`);
            meds.forEach(m => lines.push(`  • ${m.nombre}${m.obs ? ' – ' + m.obs : ''}`));
        }
        return lines.join('\n');
    };

    // Summary generator helper
    const generateOrdenSummary = (tOrden, dxPrin, dxRels, cups, obs) => {
        const summaryLines = [];
        summaryLines.push(`TIPO DE ORDEN: ${tOrden}`);
        if (dxPrin) {
            summaryLines.push(`DIAGNÓSTICO PRINCIPAL: ${dxPrin.code} - ${dxPrin.name}`);
        }
        if (dxRels && dxRels.length > 0) {
            summaryLines.push(`DIAGNÓSTICOS RELACIONADOS:`);
            dxRels.forEach(dx => {
                summaryLines.push(`  • ${dx.code} - ${dx.name}`);
            });
        }
        if (cups && cups.length > 0) {
            summaryLines.push(`PROCEDIMIENTOS (CUPS):`);
            cups.forEach(c => {
                summaryLines.push(`  • [${c.code}] ${c.name} ${c.descripcion ? `(Obs: ${c.descripcion})` : ''}`);
            });
        }
        if (obs) {
            summaryLines.push(`OBSERVACIONES GENERALES: ${obs}`);
        }
        return summaryLines.join('\n');
    };
 
    // Sub-modal states for "Detalle de Prescripción"
    const [prescriptionDetailOpen, setPrescriptionDetailOpen] = useState(false);
    const [prescripcionDescripcion, setPrescripcionDescripcion] = useState("");
    const [prescripcionMarca, setPrescripcionMarca] = useState("");
    const [prescripcionDosisValor, setPrescripcionDosisValor] = useState("");
    const [prescripcionDosisUnidad, setPrescripcionDosisUnidad] = useState("mg");
    const [prescripcionFrecuenciaValor, setPrescripcionFrecuenciaValor] = useState("");
    const [prescripcionFrecuenciaUnidad, setPrescripcionFrecuenciaUnidad] = useState("Horas");
    const [prescripcionVia, setPrescripcionVia] = useState("ORAL");
    const [prescripcionDuracionValor, setPrescripcionDuracionValor] = useState("");
    const [prescripcionDuracionUnidad, setPrescripcionDuracionUnidad] = useState("Días");
    const [prescripcionCantidad, setPrescripcionCantidad] = useState("");
    const [recetaSearchFilter, setRecetaSearchFilter] = useState("");

    // State for "Nuevo medicamento" modal (OralDrive 1:1)
    const [newMedModalOpen, setNewMedModalOpen] = useState(false);
    const [newMedTipo, setNewMedTipo] = useState("");
    const [newMedCodigo, setNewMedCodigo] = useState("");
    const [newMedPrincipioActivo, setNewMedPrincipioActivo] = useState("");
    const [newMedDescripcion, setNewMedDescripcion] = useState("");
    const [newMedMarca, setNewMedMarca] = useState("");
    const [showNewMedCodeSuggestions, setShowNewMedCodeSuggestions] = useState(false);
    const [showNewMedNameSuggestions, setShowNewMedNameSuggestions] = useState(false);

    const handleOpenNewMedModal = () => {
        setNewMedTipo("");
        setNewMedCodigo("");
        setNewMedPrincipioActivo(medSearchTerm.trim());
        setNewMedDescripcion("");
        setNewMedMarca("");
        setShowNewMedCodeSuggestions(false);
        setShowNewMedNameSuggestions(false);
        setNewMedModalOpen(true);
    };

    const handleSaveNewMed = () => {
        if (!newMedTipo || !newMedCodigo.trim() || !newMedPrincipioActivo.trim()) {
            toast.error("Complete los campos obligatorios (*)");
            return;
        }
        const customMed = {
            cum: newMedCodigo.trim(),
            principioActivo: newMedPrincipioActivo.trim(),
            tipo: newMedTipo,
            descripcion: newMedDescripcion.trim(),
            marca: newMedMarca.trim(),
            formaFarmaceutica: "TABLETA",
            viaAdministracion: "ORAL"
        };
        setNewMedModalOpen(false);
        handleSelectMedication(customMed);
    };

    // Auto-calculate quantity when frequency or duration changes
    const calculateQuantity = (frecuencia, duracion, frecUnidad, durUnidad) => {
        if (frecUnidad === "Única dosis" || durUnidad === "Única vez") {
            return "1";
        }
        
        const freq = parseFloat(frecuencia);
        const dur = parseFloat(duracion);
        
        if (isNaN(freq) || isNaN(dur) || freq <= 0 || dur <= 0) return "";
        
        let dailyDoses = 1;
        if (frecUnidad === "Horas") {
            dailyDoses = 24 / freq;
        } else if (frecUnidad === "Días") {
            dailyDoses = 1 / freq;
        } else if (frecUnidad === "Semanas") {
            dailyDoses = 1 / (freq * 7);
        } else if (frecUnidad === "Con las comidas" || frecUnidad === "Antes de dormir") {
            dailyDoses = isNaN(freq) ? 3 : freq;
        }
        
        let durationDays = 1;
        if (durUnidad === "Minutos") {
            durationDays = dur / (24 * 60);
        } else if (durUnidad === "Horas") {
            durationDays = dur / 24;
        } else if (durUnidad === "Días") {
            durationDays = dur;
        } else if (durUnidad === "Semanas") {
            durationDays = dur * 7;
        } else if (durUnidad === "Meses") {
            durationDays = dur * 30;
        } else if (durUnidad === "Años") {
            durationDays = dur * 365;
        }
        
        const totalQuantity = Math.ceil(dailyDoses * durationDays);
        return totalQuantity > 0 ? totalQuantity.toString() : "1";
    };

    // Effect to auto-calculate quantity
    React.useEffect(() => {
        const needsFreqValue = !["Única dosis", "Con las comidas", "Antes de dormir"].includes(prescripcionFrecuenciaUnidad);
        const needsDurValue = !["Única vez"].includes(prescripcionDuracionUnidad);
        
        const freqOk = !needsFreqValue || prescripcionFrecuenciaValor;
        const durOk = !needsDurValue || prescripcionDuracionValor;
        
        if (freqOk && durOk) {
            const autoQuantity = calculateQuantity(
                prescripcionFrecuenciaValor, 
                prescripcionDuracionValor,
                prescripcionFrecuenciaUnidad,
                prescripcionDuracionUnidad
            );
            if (autoQuantity) {
                setPrescripcionCantidad(autoQuantity);
            }
        }
    }, [prescripcionFrecuenciaValor, prescripcionDuracionValor, prescripcionFrecuenciaUnidad, prescripcionDuracionUnidad]);
    const [prescripcionRecomendacion, setPrescripcionRecomendacion] = useState("");

    // Load active treatment plans with date and status indicators (loads all, preserving duplicates)
    useEffect(() => {
        const loadPlans = async () => {
            if (!isOpen || docType !== 'Receta' || !patient?.id) return;
            try {
                const { data: list } = await supabase
                    .from("treatment_plans")
                    .select("*")
                    .eq("paciente_id", patient.id);
                const formatted = (list || []).map(d => {
                    let dateStr = "";
                    if (d.created_at || d.createdAt) {
                        const dateObj = new Date(d.created_at || d.createdAt);
                        dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    } else if (d.date) {
                        dateStr = new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    }
                    
                    return {
                        id: d.id,
                        nombre: `${d.title || d.nombre || 'Plan'}${dateStr ? ' – ' + dateStr : ''}`
                    };
                });

                setTreatmentPlans(formatted);
            } catch (err) { }
        };
        loadPlans();
    }, [isOpen, docType, patient?.id]);

    // Filter CUM registry suggestions in the main search input
    useEffect(() => {
        if (!medSearchTerm.trim()) {
            setMedSuggestions([]);
            return;
        }
        if (selectedMed && (medSearchTerm === `${selectedMed.principioActivo} ${selectedMed.concentracion || ''}`.trim())) {
            setMedSuggestions([]);
            return;
        }
        const lower = medSearchTerm.toLowerCase();
        const filtered = COLOMBIAN_CUM_REGISTRY.filter(c =>
            c.principioActivo.toLowerCase().includes(lower) ||
            c.cum.toLowerCase().includes(lower) ||
            (c.descripcion && c.descripcion.toLowerCase().includes(lower)) ||
            (c.marca && c.marca.toLowerCase().includes(lower))
        ).slice(0, 8);
        setMedSuggestions(filtered);
    }, [medSearchTerm, selectedMed]);

    // Initialize/Reset
    useEffect(() => {
        if (!isOpen) {
            setContenido("");
            setDiagnostico("");
            setProfesional(userProfile?.nombreCompleto || userProfile?.nombre || "");
            setRecetaItems([]);
            setSelectedPlan("");
            setMedSearchTerm("");
            setSelectedMed(null);
            clearPrescriptionDetailFields();
            
            // Reset Orden states
            setOrdenStep('profesional');
            setTipoOrden('Orden médica');
            setDxPrincipal(null);
            setDiagnosticosRelacionados([]);
            setTempDxRelacionado(null);
            setObservacionesGenerales('');
            setCupsItems([]);
            setSelectedCups(null);
            setCupsObservaciones('');
            setCupsQuery('');
            setAsocConsultaId(null);
            // Reset Consulta states
            setConsultaTab('motivo');
            setMotivoConsulta('');
            setEnfermedadActual('');
            setAntNoRefiere(false); setTempAntCIE10(null); setTempAntObs(''); setAntecedentes([]);
            setAlerNoRefiere(false); setTempAlerTipo(''); setTempAlerObs(''); setAlergias([]);
            setFamNoRefiere(false); setTempFamParentesco(''); setTempFamCIE10(null); setTempFamObs(''); setAntFamiliares([]);
            setMedPrevNoRefiere(false); setTempMedPrevItem(null); setTempMedPrevObs(''); setMedicamentosPrev([]);
            // Reset Plantilla states
            setTemplates([]);
            setSelectedTemplate(null);
            setTemplateValues({});
        } else if (initialData) {
            setContenido(initialData.contenido || "");
            setDiagnostico(initialData.diagnostico || "");
            setProfesional(initialData.profesional || userProfile?.nombreCompleto || userProfile?.nombre || "");
            setRecetaItems(initialData.recetaItems || []);
            setSelectedPlan(initialData.planFormulacion || "");
            
            // Initialize Orden states if we are editing/viewing an existing Orden
            if (initialData.tipoDocumento === 'Orden') {
                setOrdenStep('details'); // Go directly to details when editing or viewing
                setTipoOrden(initialData.tipoOrden || 'Orden médica');
                setDxPrincipal(initialData.dxPrincipal || null);
                setDiagnosticosRelacionados(initialData.dxRelacionados || []);
                setObservacionesGenerales(initialData.observacionesGenerales || '');
                setCupsItems(initialData.cupsItems || []);
                setAsocConsultaId(initialData.asocConsultaId || null);
            }
            // Initialize Consulta states if editing/viewing
            if (initialData.tipoDocumento === 'Consulta') {
                setConsultaTab('motivo');
                setMotivoConsulta(initialData.motivoConsulta || '');
                setEnfermedadActual(initialData.enfermedadActual || '');
                setAntecedentes(initialData.antecedentes || []);
                setAntNoRefiere(initialData.antNoRefiere || false);
                setAlergias(initialData.alergias || []);
                setAlerNoRefiere(initialData.alerNoRefiere || false);
                setAntFamiliares(initialData.antFamiliares || []);
                setFamNoRefiere(initialData.famNoRefiere || false);
                setMedicamentosPrev(initialData.medicamentosPrev || []);
                setMedPrevNoRefiere(initialData.medPrevNoRefiere || false);
            }
            // Initialize Template states if editing/viewing a template document
            if (initialData.isTemplateDoc) {
                const predefined = PREDEFINED_TEMPLATES.find(t => t.id === initialData.templateId || t.nombre === initialData.tipoDocumento);
                if (predefined) {
                    setSelectedTemplate(predefined);
                } else {
                    setSelectedTemplate({ nombre: initialData.tipoDocumento, campos: initialData.campos || [] });
                }
                setTemplateValues(initialData.valoresCampos || {});
            }
        } else {
            setRecetaItems([]);
            setSelectedPlan("");
            
            // For a new Orden, start with empty professional so they must choose
            if (docType === 'Orden') {
                setProfesional("");
            } else {
                setProfesional(userProfile?.nombreCompleto || userProfile?.nombre || "");
            }
            
            // Initialize new Orden defaults
            setOrdenStep('profesional');
            setTipoOrden('Orden médica');
            setDxPrincipal(null);
            setDiagnosticosRelacionados([]);
            setTempDxRelacionado(null);
            setObservacionesGenerales('');
            setCupsItems([]);
            setSelectedCups(null);
            setCupsObservaciones('');
            setCupsQuery('');
            // Reset Plantilla states for new doc
            setSelectedTemplate(null);
            setTemplateValues({});
        }
    }, [isOpen, initialData, userProfile, docType]);

    // Load configured clinical templates (Plantillas Clínicas)
    useEffect(() => {
        const loadTemplates = async () => {
            const inq = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId;
            if (!isOpen || !inq) return;
            const isTemplateMode = docType === 'Plantilla';
            const isEditingTemplate = initialData?.isTemplateDoc;
            if (!isTemplateMode && !isEditingTemplate) return;
            
            try {
                const dbTemplates = await getConfigItems(inq, "plantillas_clinicas", "plantillas_clinicas");
                const merged = [...PREDEFINED_TEMPLATES];
                
                if (Array.isArray(dbTemplates)) {
                    dbTemplates.forEach(t => {
                        if (!merged.some(existing => existing.id === t.id || existing.nombre === t.nombre)) {
                            merged.push(t);
                        }
                    });
                }
                
                setTemplates(merged);
                
                // Auto-select template if none selected or when creating a new template document
                if (!selectedTemplate) {
                    let matched = null;
                    if (initialData?.templateId || initialData?.nombrePlantilla || initialData?.tipoDocumento) {
                        matched = merged.find(t => t.id === initialData.templateId || t.nombre === initialData.nombrePlantilla || t.nombre === initialData.tipoDocumento);
                    }
                    if (!matched && docType && docType !== 'Plantilla') {
                        matched = merged.find(t => t.nombre?.toLowerCase() === docType?.toLowerCase() || t.id === docType);
                    }
                    if (!matched) {
                        matched = merged.find(t => t.id === 'ficha_ttm') || merged.find(t => t.id === 'atm') || merged[0];
                    }
                    if (matched) {
                        setSelectedTemplate(matched);
                        if (initialData?.valoresCampos) {
                            setTemplateValues(initialData.valoresCampos);
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading templates:', err);
                setTemplates(PREDEFINED_TEMPLATES);
                if (!selectedTemplate && PREDEFINED_TEMPLATES.length > 0) {
                    setSelectedTemplate(PREDEFINED_TEMPLATES[0]);
                }
            }
        };
        loadTemplates();
    }, [isOpen, docType, userProfile, initialData]);

    // Load active professionals
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const list = await getDoctorsList(userProfile, patient);
                setCatalogProfesionales(list);

                // Keep initialData professional if present, otherwise let user select
                if (initialData?.profesional) {
                    setProfesional(initialData.profesional);
                } else if (profesional && list.some(l => (l.nombreCompleto || l.nombre) === profesional)) {
                    // keep current user choice
                } else {
                    setProfesional("");
                }
            } catch (err) {
                console.error("Error loading doctor catalog in modal", err);
            }
        };
        if (isOpen) loadCatalog();
    }, [isOpen, userProfile, patient?.profesionales, patient?.id]);

    const clearPrescriptionDetailFields = () => {
        setPrescripcionDescripcion("");
        setPrescripcionMarca("");
        setPrescripcionDosisValor("");
        setPrescripcionDosisUnidad("mg");
        setPrescripcionFrecuenciaValor("");
        setPrescripcionFrecuenciaUnidad("Horas");
        setPrescripcionVia("ORAL");
        setPrescripcionDuracionValor("");
        setPrescripcionDuracionUnidad("Días");
        setPrescripcionCantidad("");
        setPrescripcionRecomendacion("");
    };

    const extractDoseAndUnit = (m) => {
        if (!m) return { valor: "", unidad: "mg" };
        
        // Priority 1: Check m.concentracion
        let raw = (m.concentracion || "").trim();
        
        // Priority 2: If no concentracion, search inside descripcion or principioActivo
        if (!raw && m.descripcion) {
            const descMatch = m.descripcion.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|ml|ui|iu|gotas?|tabletas?|capsulas?|cápsulas?|ampollas?|unidades?|u\b)/i);
            if (descMatch) {
                raw = descMatch[0];
            }
        }
        if (!raw && m.principioActivo) {
            const paMatch = m.principioActivo.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|ml|ui|iu|gotas?|tabletas?|capsulas?|cápsulas?|ampollas?|unidades?|u\b)/i);
            if (paMatch) {
                raw = paMatch[0];
            }
        }

        if (!raw) {
            let defaultUnit = "mg";
            const altUnit = (m.unidadConcentracion || m.unidadMedida || "").toLowerCase();
            if (altUnit.includes("ml")) defaultUnit = "ml";
            else if (altUnit.includes("g") && !altUnit.includes("got")) defaultUnit = "g";
            else if (altUnit.includes("cap")) defaultUnit = "cápsula";
            else if (altUnit.includes("tab")) defaultUnit = "tableta";
            return { valor: "", unidad: defaultUnit };
        }

        // If compound concentration like "100mg/5ml" or "100 mg / 5 ml", take ONLY the primary (first) part before the slash
        const primaryPart = raw.split('/')[0].trim();

        // Match numeric digits (with optional decimal point) and letters
        const match = primaryPart.match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚµμ%]+)?/i) ||
                      primaryPart.match(/([0-9]+(?:\.[0-9]+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚµμ%]+)?/i);

        let valor = "";
        let unidad = "mg";

        if (match) {
            valor = match[1] || "";
            const rawUnit = (match[2] || "").toLowerCase();
            
            if (rawUnit.startsWith("mg")) unidad = "mg";
            else if (rawUnit.startsWith("g") && !rawUnit.startsWith("got")) unidad = "g";
            else if (rawUnit.startsWith("ml")) unidad = "ml";
            else if (rawUnit.startsWith("cap") || rawUnit.startsWith("cáp")) unidad = "cápsula";
            else if (rawUnit.startsWith("tab")) unidad = "tableta";
            else if (rawUnit.startsWith("u") || rawUnit.startsWith("ui") || rawUnit.startsWith("iu")) unidad = "unidad";
            else if (rawUnit.startsWith("amp")) unidad = "ampolla";
            else if (rawUnit.startsWith("cár") || rawUnit.startsWith("car")) unidad = "cárpula";
            else if (rawUnit.startsWith("got")) unidad = "gota";
            else if (rawUnit.startsWith("apli")) unidad = "aplicación";
            else if (m.unidadConcentracion) {
                const u = m.unidadConcentracion.toLowerCase();
                if (u.includes("mg")) unidad = "mg";
                else if (u.includes("ml")) unidad = "ml";
                else if (u.includes("g")) unidad = "g";
            }
        } else {
            // Fallback: only numbers in primaryPart
            const numOnly = primaryPart.replace(/[^0-9.]/g, '');
            valor = numOnly;
        }

        return { valor, unidad };
    };

    const handleSelectMedication = (m) => {
        setSelectedMed(m);
        const displayTerm = `${m.cum ? m.cum + ' - ' : ''}${m.principioActivo}${m.marca ? ' - ' + m.marca : ''}`.trim();
        setMedSearchTerm(displayTerm);
        setMedSuggestions([]);
        
        // Pre-fill prescription details sub-modal fields
        setPrescripcionDescripcion(m.descripcion || "");
        setPrescripcionMarca(m.marca || "");
        
        // Correctly extract single dosage and unit (prevent merging compound 100mg/5ml into 1005mg)
        const { valor: dosisVal, unidad: dosisUnit } = extractDoseAndUnit(m);
        setPrescripcionDosisValor(dosisVal);
        setPrescripcionDosisUnidad(dosisUnit);
        
        setPrescripcionFrecuenciaValor("");
        setPrescripcionFrecuenciaUnidad("Horas");
        setPrescripcionVia(m.viaAdministracion ? m.viaAdministracion.toUpperCase() : "ORAL");
        setPrescripcionDuracionValor("");
        setPrescripcionDuracionUnidad("Días");
        setPrescripcionCantidad("");
        setPrescripcionRecomendacion("");
        
        // Per OralDrive 1:1, selecting from catalog fills the input field.
        // The Prescription Detail modal opens ONLY when clicking the "Añadir" button.
    };

    const handleAnadirClick = () => {
        if (selectedMed) {
            setPrescriptionDetailOpen(true);
        } else if (medSearchTerm.trim()) {
            const customMed = {
                cum: `CUST-${Date.now().toString().slice(-4)}`,
                principioActivo: medSearchTerm.trim(),
                tipo: "POS",
                concentracion: "",
                formaFarmaceutica: "TABLETA",
                viaAdministracion: "ORAL"
            };
            setSelectedMed(customMed);
            const { valor: dosisVal, unidad: dosisUnit } = extractDoseAndUnit(customMed);
            setPrescripcionDescripcion("");
            setPrescripcionMarca("");
            setPrescripcionDosisValor(dosisVal);
            setPrescripcionDosisUnidad(dosisUnit);
            setPrescripcionFrecuenciaValor("");
            setPrescripcionFrecuenciaUnidad("Horas");
            setPrescripcionVia("ORAL");
            setPrescripcionDuracionValor("");
            setPrescripcionDuracionUnidad("Días");
            setPrescripcionCantidad("");
            setPrescripcionRecomendacion("");
            setPrescriptionDetailOpen(true);
        } else {
            toast.error("Ingrese o seleccione un medicamento para añadir");
        }
    };

    const handleSavePrescriptionItem = () => {
        if (!selectedMed) {
            toast.error("Debe seleccionar un medicamento válido");
            return;
        }
        const needsFreqValue = !["Única dosis", "Con las comidas", "Antes de dormir"].includes(prescripcionFrecuenciaUnidad);
        if (!prescripcionDosisValor.trim() || (needsFreqValue && !prescripcionFrecuenciaValor.trim()) || !prescripcionCantidad.trim()) {
            toast.error("Complete dosis, frecuencia y cantidad");
            return;
        }

        const newItem = {
            tipo: selectedMed.tipo || "POS",
            codigo: selectedMed.cum || "",
            principioActivo: selectedMed.principioActivo || "",
            dosis: `${prescripcionDosisValor} ${prescripcionDosisUnidad}`.trim(),
            frecuencia: needsFreqValue 
                ? `Cada ${prescripcionFrecuenciaValor} ${prescripcionFrecuenciaUnidad}`
                : prescripcionFrecuenciaUnidad,
            viaAdministracion: prescripcionVia,
            duracion: prescripcionDuracionValor ? `${prescripcionDuracionValor} ${prescripcionDuracionUnidad}` : "Única vez",
            cantidad: prescripcionCantidad,
            marca: prescripcionMarca || "-",
            descripcion: prescripcionDescripcion || "",
            recomendacion: prescripcionRecomendacion || "",
            // Resolution 255 fields
            concentracion: selectedMed.concentracion || "",
            unidadConcentracion: selectedMed.unidadConcentracion || "",
            formaFarmaceutica: selectedMed.formaFarmaceutica || "",
            unidadMedida: selectedMed.unidadMedida || ""
        };

        setRecetaItems(prev => [...prev, newItem]);
        setPrescriptionDetailOpen(false);
        setSelectedMed(null);
        setMedSearchTerm("");
        clearPrescriptionDetailFields();
        toast.success("Medicamento añadido a la receta");
    };

    const handleRemoveItem = (index) => {
                setRecetaItems(prev => prev.filter((_, idx) => idx !== index));
    };

    const generateContenidoSummary = (items) => {
        return items.map((it, idx) => 
            `• ${it.principioActivo.toUpperCase()} [Concentración: ${it.concentracion || '-'} ${it.unidadConcentracion || ''} | Forma: ${it.formaFarmaceutica || '-'} | ATC: ${it.atc || '-'} | Reg. INVIMA: ${it.registroInvima || '-'}] - Código CUM: ${it.codigo} - Dosis: ${it.dosis} cada ${it.frecuencia}, Vía: ${it.viaAdministracion}, Unidad de Medida: ${it.unidadMedida || 'N/A'}, Duración: ${it.duracion}, Cantidad: ${it.cantidad}. Marca: ${it.marca || 'N/A'}${it.descripcion ? ` | Obs: ${it.descripcion}` : ''}`
        ).join("\n");
    };

    // Generate a human-readable text summary from filled template fields
    const generateTemplateSummary = (campos, valores) => {
        const lines = [];
        (campos || []).forEach(field => {
            if (field.type === 'section') {
                lines.push(`\n── ${field.label} ──`);
            } else if (field.type === 'checkbox' || field.type === 'toggle') {
                const val = valores[field.id];
                lines.push(`${field.label}: ${val ? 'SÍ' : 'NO'}`);
            } else {
                const val = valores[field.id] || '';
                if (val) lines.push(`${field.label}: ${val}`);
            }
        });
        return lines.join('\n');
    };

    const handleSave = async () => {
        let finalContent = contenido;
        let diagVal = diagnostico;
        const isTemplateDoc = docType === 'Plantilla' || initialData?.isTemplateDoc;

        if (docType === 'Receta') {
            if (recetaItems.length === 0) {
                toast.error("Debe añadir al menos un medicamento a la receta");
                return;
            }
            finalContent = generateContenidoSummary(recetaItems);
        } else if (docType === 'Consulta') {
            if (!motivoConsulta.trim()) {
                toast.error("El motivo de consulta no puede estar vacío");
                return;
            }
            finalContent = generateConsultaSummary(motivoConsulta, enfermedadActual, antecedentes, alergias, antFamiliares, medicamentosPrev);
        } else if (docType === 'Orden') {
            finalContent = generateOrdenSummary(tipoOrden, dxPrincipal, diagnosticosRelacionados, cupsItems, observacionesGenerales);
            if (dxPrincipal) diagVal = `${dxPrincipal.code} - ${dxPrincipal.name}`;
        } else if (isTemplateDoc && selectedTemplate) {
            finalContent = generateTemplateSummary(selectedTemplate.campos, templateValues);
            if (!finalContent || !finalContent.trim()) {
                finalContent = `Documento generado a partir de la plantilla: ${selectedTemplate.nombre}`;
            }
        }

        if (!finalContent.trim()) {
            toast.error("El contenido no puede estar vacío");
            return;
        }
        
        setSaving(true);
        try {
            const isEditing = !!initialData;
            const docTipo = isEditing 
                ? (initialData.tipo || initialData.tipoDocumento || docType) 
                : (isTemplateDoc && selectedTemplate ? selectedTemplate.nombre : docType);
            const docTitulo = isTemplateDoc && selectedTemplate 
                ? selectedTemplate.nombre 
                : (docType || initialData?.tipoDocumento || "Documento Clínico");
            const docTranscribe = isEditing 
                ? (initialData.transcribe || initialData.metadata?.transcribe || "Sistema") 
                : (userProfile?.nombreCompleto || userProfile?.nombre || "Sistema");
            const docCreadorId = isEditing 
                ? (initialData.creadorId || initialData.metadata?.creadorId || "") 
                : (userProfile?.uid || "");
            const docFechaIso = isEditing 
                ? (initialData.fechaIso || initialData.created_at || new Date().toISOString()) 
                : new Date().toISOString();

            const extraMetadata = {
                tipoDocumento: docTipo,
                titulo: docTitulo,
                profesional: profesional,
                transcribe: docTranscribe,
                creadorId: docCreadorId,
                diagnostico: diagVal,
                fechaIso: docFechaIso,
                // Structured properties for recovery
                ...(docType === 'Receta' && {
                    recetaItems: recetaItems,
                    planFormulacion: selectedPlan
                }),
                ...(docType === 'Orden' && {
                    tipoOrden: tipoOrden,
                    dxPrincipal: dxPrincipal,
                    dxRelacionados: diagnosticosRelacionados,
                    cupsItems: cupsItems,
                    observacionesGenerales: observacionesGenerales,
                    asocConsultaId: asocConsultaId || null
                }),
                ...(isTemplateDoc && {
                    isTemplateDoc: true,
                    templateId: selectedTemplate?.id || initialData?.templateId || null,
                    campos: selectedTemplate?.campos || initialData?.campos || [],
                    valoresCampos: templateValues
                }),
                ...(docType === 'Consulta' && {
                    motivoConsulta,
                    enfermedadActual,
                    antecedentes,
                    antNoRefiere,
                    alergias,
                    alerNoRefiere,
                    antFamiliares,
                    famNoRefiere,
                    medicamentosPrev,
                    medPrevNoRefiere
                })
            };

            const tenantId = userProfile?.inquilino || patient.tenant_id || userProfile?.tenant_id;

            const dbPayload = {
                tenant_id: tenantId,
                paciente_id: patient.id,
                tipo: docTipo,
                titulo: docTitulo,
                contenido: finalContent,
                firmado: isEditing ? (initialData.firmado ?? false) : false,
                receta_items: docType === 'Receta' ? recetaItems : (initialData?.receta_items || null),
                metadata: extraMetadata,
                updated_at: new Date().toISOString()
            };

            const docId = isEditing ? (initialData.id || `doc-${Date.now()}`) : `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            let saveSuccess = false;

            // 1. Intentar guardar en la tabla documentos_clinicos si está disponible
            try {
                if (isEditing) {
                    const { error: updateErr } = await supabase
                        .from("documentos_clinicos")
                        .update(dbPayload)
                        .eq("id", initialData.id);
                    if (!updateErr) saveSuccess = true;
                } else {
                    const { error: insertErr } = await supabase
                        .from("documentos_clinicos")
                        .insert([{ ...dbPayload, id: docId, created_at: new Date().toISOString() }]);
                    if (!insertErr) saveSuccess = true;
                }
            } catch (tblErr) {
                console.warn("Notice: documentos_clinicos table direct write:", tblErr);
            }

            // 2. Persistir siempre en el historial_medico del paciente (Garantía 100% de persistencia)
            try {
                const { data: pData } = await supabase
                    .from("pacientes")
                    .select("id, historial_medico")
                    .eq("id", patient.id)
                    .maybeSingle();

                const currentHM = pData?.historial_medico || patient?.historial_medico || {};
                const currentDocs = Array.isArray(currentHM.documentosClinicos) ? [...currentHM.documentosClinicos] : [];

                const docRecord = {
                    id: docId,
                    ...extraMetadata,
                    ...dbPayload,
                    tipoDocumento: docTipo,
                    recetaItems: docType === 'Receta' ? recetaItems : (initialData?.receta_items || []),
                    created_at: isEditing ? (initialData.created_at || new Date().toISOString()) : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                let updatedDocs;
                if (isEditing) {
                    updatedDocs = currentDocs.map(d => (d.id === initialData.id ? { ...d, ...docRecord } : d));
                    if (!updatedDocs.some(d => d.id === initialData.id)) {
                        updatedDocs.unshift(docRecord);
                    }
                } else {
                    updatedDocs = [docRecord, ...currentDocs];
                }

                const updatedHM = {
                    ...currentHM,
                    documentosClinicos: updatedDocs
                };

                const { error: patErr } = await supabase
                    .from("pacientes")
                    .update({
                        historial_medico: updatedHM,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", patient.id);

                if (!patErr) {
                    saveSuccess = true;
                    if (patient) {
                        patient.historial_medico = updatedHM;
                    }
                }
            } catch (hmErr) {
                console.error("Error sincronizando historial_medico del paciente:", hmErr);
            }

            if (!saveSuccess) {
                throw new Error("No se pudo guardar el documento clínico");
            }

            toast.success(`${docType || initialData?.tipoDocumento || "Documento"} guardado correctamente`);
            if (typeof onClose === 'function') {
                onClose(true);
            }
        } catch (error) {
            console.error("Error saving document:", error);
            toast.error("Error al guardar el documento");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // ── Load consultas for Asociar Consulta modal ───────────────────────────
    const handleOpenAsocConsulta = async () => {
        setAsocConsultaModal(true);
        try {
            let list = [];
            const { data: dbList, error } = await supabase
                .from("documentos_clinicos")
                .select("*")
                .eq("paciente_id", patient.id)
                .or("tipo.eq.Consulta,tipoDocumento.eq.Consulta")
                .order("created_at", { ascending: false });
            if (!error && dbList) {
                list = dbList;
            }

            const hmDocs = (patient?.historial_medico?.documentosClinicos || []).filter(d => 
                d.tipo === "Consulta" || d.tipoDocumento === "Consulta"
            );
            
            const merged = [...list];
            hmDocs.forEach(h => {
                if (!merged.some(m => m.id === h.id)) {
                    merged.push(h);
                }
            });

            setConsultasList(merged);
        } catch (e) {
            toast.error('Error cargando consultas');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${docType === 'Alerta' ? 'max-w-lg' : (docType === 'Plantilla' && !selectedTemplate && !initialData) ? 'max-w-lg' : (docType === 'Receta' || docType === 'Orden' || docType === 'Plantilla' || initialData?.isTemplateDoc) ? 'max-w-3xl md:max-w-4xl' : 'max-w-2xl'} flex flex-col max-h-[90vh] overflow-hidden`}>
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
                    <div>
                        <h2 className="text-base font-black text-slate-800 tracking-tight">
                            {docType === 'Alerta' ? "Nueva alerta" : 
                             (docType === 'Plantilla' || initialData?.isTemplateDoc) ? 
                                (isViewOnly ? `Detalle de ${selectedTemplate?.nombre || initialData?.tipoDocumento}` : 
                                 (initialData ? `Editar ${initialData.tipoDocumento}` : `Nuevo documento: ${selectedTemplate?.nombre || "Plantilla clínica"}`)) :
                             (isViewOnly ? `Detalle de ${initialData?.tipoDocumento || docType}` : 
                              (initialData ? `Editar ${initialData.tipoDocumento}` : `Nueva ${docType}`))}
                        </h2>
                        {docType !== 'Alerta' && docType !== 'Plantilla' && (
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                <span>Pacientes</span> <span className="text-slate-350">-</span>
                                <span>Doc. Clínicos</span> <span className="text-slate-350">-</span>
                                <span className="text-indigo-600 font-black">{isViewOnly ? "Detalle" : (initialData ? `Editar ${docType.toLowerCase()}` : `Nueva ${docType.toLowerCase()}`)}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!isViewOnly && (
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-1.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-wider shadow flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                {saving ? "Guardando..." : (docType === 'Receta' ? "Guardar receta" : docType === 'Orden' ? "Guardar orden" : "Guardar")}
                            </button>
                        )}
                        <button onClick={onClose} disabled={saving} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors border border-slate-200 bg-white cursor-pointer">
                            <FiX size={16} />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar text-left">
                    
                    {/* General information blocks */}
                    {docType !== 'Receta' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Odontólogo Prescriptor *</label>
                                <select 
                                    value={profesional}
                                    onChange={(e) => setProfesional(e.target.value)}
                                    disabled={isViewOnly}
                                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                >
                                    <option value="" disabled>Seleccione un profesional...</option>
                                    {catalogProfesionales.map(p => {
                                        const name = p.nombreCompleto || p.nombre || p.displayName || p.id || "";
                                        return (
                                            <option key={p.id || name} value={name}>{name.toUpperCase()}</option>
                                        );
                                    })}
                                </select>
                            </div>
                            
                            {docType === 'Orden' ? (
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Tipo de orden *</label>
                                    <select 
                                        value={tipoOrden}
                                        onChange={(e) => setTipoOrden(e.target.value)}
                                        disabled={isViewOnly}
                                        className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                    >
                                        <option value="Orden médica">Orden médica</option>
                                        <option value="Ayuda diagnóstica">Ayuda diagnóstica</option>
                                        <option value="Examen de laboratorio">Examen de laboratorio</option>
                                        <option value="Anexo 3">Anexo 3</option>
                                        <option value="Fórmula de uso crónico">Fórmula de uso crónico</option>
                                    </select>
                                </div>
                            ) : (docType === 'Plantilla' || initialData?.isTemplateDoc) ? (
                            /* ── PLANTILLA: selector de plantilla ── */
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">
                                    {docType === 'Plantilla' && !initialData ? 'Seleccione la plantilla' : 'Plantilla utilizada'}
                                </label>
                                {docType === 'Plantilla' && !initialData ? (
                                    <select
                                        value={selectedTemplate?.id || ''}
                                        onChange={e => {
                                            const tmpl = templates.find(t => t.id === e.target.value) || null;
                                            setSelectedTemplate(tmpl);
                                            setTemplateValues({});
                                        }}
                                        className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                    >
                                        <option value="">Escriba el nombre de la plantilla</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.nombre}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 flex items-center text-xs font-semibold text-slate-700 opacity-75">
                                        {selectedTemplate?.nombre || initialData?.tipoDocumento || '—'}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Diagnóstico asoc. (Opcional)</label>
                                {isViewOnly ? (
                                    <div className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 flex items-center text-xs font-semibold text-slate-700 opacity-75">
                                        {diagnostico || <span className="text-slate-400 font-normal">Sin diagnóstico asociado</span>}
                                    </div>
                                ) : (
                                    <CIE10Search
                                        value={diagnostico ? { code: diagnostico.split(' - ')[0], name: diagnostico.split(' - ').slice(1).join(' - ') } : null}
                                        onSelect={(item) => setDiagnostico(item ? `${item.code} - ${item.name}` : '')}
                                        className="w-full"
                                        label=""
                                    />
                                )}
                            </div>
                        )}
                    </div>
                    )}

                    {/* PLANTILLA: Dynamic fields from selected template */}
                    {(docType === 'Plantilla' || initialData?.isTemplateDoc) && selectedTemplate?.campos?.length > 0 && (
                        <div className="space-y-6 pb-6 border-b border-slate-100">
                            {selectedTemplate.id === 'atm' ? (
                                <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                    {/* 2 Column Checkbox Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                                        {/* Column 1 */}
                                        <div className="space-y-3.5">
                                            {[
                                                { id: 'normal', label: 'NORMAL' },
                                                { id: 'problem_art_mandibula', label: 'PROBLEM. ARTI. DE MANDIBULA' },
                                                { id: 'presencia_sintomas_subjetivos', label: 'PRESENCIA DE SINTOMAS SUBJETIVOS' },
                                                { id: 'ruidos', label: 'RUIDOS' },
                                                { id: 'dolor_atm', label: 'DOLOR ATM' },
                                                { id: 'dolor_muscular', label: 'DOLOR MUSCULAR' },
                                                { id: 'remision_especialista', label: 'REMISIÓN ESPECIALISTA' }
                                            ].map(item => (
                                                <label key={item.id} className="flex items-center gap-3.5 cursor-pointer group select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!templateValues[item.id]}
                                                        disabled={isViewOnly}
                                                        onChange={e => setTemplateValues(prev => ({ ...prev, [item.id]: e.target.checked }))}
                                                        className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                                                    />
                                                    <span className="text-[11px] font-black text-slate-500 group-hover:text-slate-800 transition-colors uppercase tracking-wider">{item.label}</span>
                                                </label>
                                            ))}
                                        </div>

                                        {/* Column 2 */}
                                        <div className="space-y-3.5">
                                            {[
                                                { id: 'desviaciones', label: 'DESVIACIONES' },
                                                { id: 'limitacion_apertura', label: 'LIMITACIÓN APERTURA' },
                                                { id: 'brinco', label: 'BRINCO' },
                                                { id: 'cambio_volumen', label: 'CAMBIO DE VOLUMEN' },
                                                { id: 'bloqueo_mandibular', label: 'BLOQUEO MANDIBULAR' },
                                                { id: 'crepitacion', label: 'CREPITACIÓN' },
                                                { id: 'maloclusion', label: 'MALOCLUSIÓN' }
                                            ].map(item => (
                                                <label key={item.id} className="flex items-center gap-3.5 cursor-pointer group select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!templateValues[item.id]}
                                                        disabled={isViewOnly}
                                                        onChange={e => setTemplateValues(prev => ({ ...prev, [item.id]: e.target.checked }))}
                                                        className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                                                    />
                                                    <span className="text-[11px] font-black text-slate-500 group-hover:text-slate-800 transition-colors uppercase tracking-wider">{item.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Observaciones Textarea */}
                                    <div className="space-y-1.5 pt-4 border-t border-slate-100">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Observaciones</label>
                                        <textarea
                                            value={templateValues['observaciones'] || ''}
                                            onChange={e => setTemplateValues(prev => ({ ...prev, observaciones: e.target.value }))}
                                            readOnly={isViewOnly}
                                            rows={4}
                                            placeholder="Escriba las observaciones aquí..."
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 transition-all resize-y read-only:opacity-70"
                                        />
                                    </div>

                                    {/* Tercera Firma Toggle */}
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider pl-1">Tercera firma</span>
                                        <button
                                            type="button"
                                            disabled={isViewOnly}
                                            onClick={() => setTemplateValues(prev => ({ ...prev, tercera_firma: !prev.tercera_firma }))}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${templateValues['tercera_firma'] ? 'bg-blue-600' : 'bg-slate-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${templateValues['tercera_firma'] ? 'translate-x-5' : 'translate-x-0'}`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {selectedTemplate.campos.map(field => (
                                        <div key={field.id}>
                                            {field.type === 'section' ? (
                                                <div className="flex items-center gap-3 pt-2">
                                                    <div className="h-px flex-1 bg-gradient-to-r from-blue-200 to-transparent" />
                                                    <span className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em]">{field.label}</span>
                                                    <div className="h-px flex-1 bg-gradient-to-l from-blue-200 to-transparent" />
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                                                        {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                                                    </label>
                                                    {field.type === 'text' && (
                                                        <input type="text" value={templateValues[field.id] || ''} onChange={e => setTemplateValues(prev => ({ ...prev, [field.id]: e.target.value }))} readOnly={isViewOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all read-only:opacity-70" />
                                                    )}
                                                    {field.type === 'number' && (
                                                        <input type="number" value={templateValues[field.id] || ''} onChange={e => setTemplateValues(prev => ({ ...prev, [field.id]: e.target.value }))} readOnly={isViewOnly} className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all read-only:opacity-70" />
                                                    )}
                                                    {field.type === 'date' && (
                                                        <input type="date" value={templateValues[field.id] || ''} onChange={e => setTemplateValues(prev => ({ ...prev, [field.id]: e.target.value }))} disabled={isViewOnly} className="w-56 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all disabled:opacity-70"  max="9999-12-31" min="1900-01-01" />
                                                    )}
                                                    {field.type === 'select' && (
                                                        <select value={templateValues[field.id] || ''} onChange={e => setTemplateValues(prev => ({ ...prev, [field.id]: e.target.value }))} disabled={isViewOnly} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none disabled:opacity-70">
                                                            <option value="">-- Seleccione --</option>
                                                            {(field.options || []).map((op, i) => (
                                                                <option key={i} value={op}>{op}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    {field.type === 'textarea' && (
                                                        <textarea value={templateValues[field.id] || ''} onChange={e => setTemplateValues(prev => ({ ...prev, [field.id]: e.target.value }))} readOnly={isViewOnly} rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all resize-y read-only:opacity-70" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {(docType === 'Plantilla') && !selectedTemplate && (
                        <div className="py-12 text-center border-b border-slate-100">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-4">
                                <FiList size={32} />
                            </div>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Seleccione una plantilla para continuar</p>
                        </div>
                    )}

                    {/* INTERACTIVE PRESCRIPTION EDITOR */}
                    {docType === 'Receta' ? (
                        <div className="space-y-4">
                            {/* Row 1: Odontólogo Prescriptor* & Plan de formulación */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Odontólogo Prescriptor *</label>
                                    <select 
                                        value={profesional}
                                        onChange={(e) => setProfesional(e.target.value)}
                                        disabled={isViewOnly}
                                        className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                    >
                                        <option value="" disabled>Seleccione...</option>
                                        {catalogProfesionales.map(p => {
                                            const name = p.nombreCompleto || p.nombre || p.displayName || p.id || "";
                                            return (
                                                <option key={p.id || name} value={name}>{name.toUpperCase()}</option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Plan de formulación</label>
                                    <div className="flex gap-2 items-center">
                                        <select 
                                            value={selectedPlan}
                                            onChange={(e) => setSelectedPlan(e.target.value)}
                                            disabled={isViewOnly}
                                            className="flex-1 bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Seleccione...</option>
                                            {treatmentPlans.map(plan => (
                                                <option key={plan.id} value={plan.nombre}>{(plan.nombre || "").toUpperCase()}</option>
                                            ))}
                                        </select>
                                        <button 
                                            type="button"
                                            onClick={() => toast.info("Planes de formulación")}
                                            className="w-9 h-9 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
                                            title="Ver plan de formulación"
                                        >
                                            <FiList size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Ingrese el medicamento a añadir, Añadir, + Nuevo medicamento, Asociar consulta */}
                            {!isViewOnly && (
                                <div className="flex flex-wrap md:flex-nowrap gap-2 items-end pt-1">
                                    <div className="flex-1 relative">
                                        <input 
                                            type="text"
                                            placeholder="Ingrese el medicamento a añadir"
                                            value={medSearchTerm}
                                            onChange={(e) => {
                                                setMedSearchTerm(e.target.value);
                                                if (selectedMed) setSelectedMed(null);
                                            }}
                                            className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                        />
                                        {/* Suggestions Dropdown */}
                                        {medSuggestions.length > 0 && (
                                            <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden divide-y divide-slate-50 max-h-48 overflow-y-auto">
                                                {medSuggestions.map(m => (
                                                    <div 
                                                        key={m.cum}
                                                        onClick={() => handleSelectMedication(m)}
                                                        className="px-3 py-2 text-xs hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition-colors"
                                                    >
                                                        <div className="text-left">
                                                            <p className="font-bold text-slate-700 uppercase tracking-tight">
                                                                {m.principioActivo} {m.concentracion}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                                                <span className="text-indigo-500">{m.formaFarmaceutica}</span>
                                                                {m.marca && <span className="text-slate-400"> · Marca: {m.marca}</span>}
                                                                <span className="text-slate-400"> · CUM: {m.cum}</span>
                                                            </p>
                                                        </div>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${m.tipo === 'POS' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            {m.tipo}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        type="button"
                                        onClick={handleAnadirClick}
                                        className="px-5 h-9 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                                    >
                                        Añadir
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={handleOpenNewMedModal}
                                        className="px-5 h-9 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
                                    >
                                        <FiPlus size={14} /> Nuevo medicamento
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={handleOpenAsocConsulta}
                                        className="w-9 h-9 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
                                        title="Asociar consulta"
                                    >
                                        <FiSearch size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Row 3: Structured Prescribed items Table */}
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 italic">
                                        Arrastra una columna aquí para agrupar por ella
                                    </span>
                                    <div className="relative w-48">
                                        <FiSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text"
                                            placeholder="Buscar..."
                                            value={recetaSearchFilter}
                                            onChange={(e) => setRecetaSearchFilter(e.target.value)}
                                            className="w-full pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Tipo</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Código</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Principio Activo</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Dosis</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Frecuencia</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Vía de administración</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Duración</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Cantidad</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Descripción</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">Marca</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {recetaItems.filter(item => {
                                                if (!recetaSearchFilter.trim()) return true;
                                                const q = recetaSearchFilter.toLowerCase();
                                                return (
                                                    (item.principioActivo || '').toLowerCase().includes(q) ||
                                                    (item.codigo || '').toLowerCase().includes(q) ||
                                                    (item.marca || '').toLowerCase().includes(q)
                                                );
                                            }).length === 0 ? (
                                                <tr>
                                                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-xs font-medium">
                                                        Sin datos
                                                    </td>
                                                </tr>
                                            ) : (
                                                recetaItems.filter(item => {
                                                    if (!recetaSearchFilter.trim()) return true;
                                                    const q = recetaSearchFilter.toLowerCase();
                                                    return (
                                                        (item.principioActivo || '').toLowerCase().includes(q) ||
                                                        (item.codigo || '').toLowerCase().includes(q) ||
                                                        (item.marca || '').toLowerCase().includes(q)
                                                    );
                                                }).map((item, idx) => (
                                                    <tr key={idx} className={`hover:bg-slate-50/30 transition-colors ${item.doctorSignature ? 'bg-green-50/50 border-l-4 border-green-400' : ''}`}>
                                                        <td className="px-3 py-2 text-xs font-bold text-indigo-600">{item.tipo}</td>
                                                        <td className="px-3 py-2 text-xs font-bold text-slate-500 font-mono">{item.codigo}</td>
                                                        <td className="px-3 py-2 text-xs font-bold text-slate-700 uppercase">{item.principioActivo}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-600">{item.dosis}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-600">{item.frecuencia}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-500 uppercase">{item.viaAdministracion}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-500">{item.duracion}</td>
                                                        <td className="px-3 py-2 text-xs font-black text-slate-800 text-center">{item.cantidad}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-500">{item.descripcion || "-"}</td>
                                                        <td className="px-3 py-2 text-xs text-slate-500 uppercase">{item.marca || "-"}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button 
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        const updatedItems = [...recetaItems];
                                                                        updatedItems[idx] = { 
                                                                            ...item, 
                                                                            doctorSignature: userProfile?.nombreCompleto || userProfile?.nombre || "Doctor",
                                                                            signedAt: new Date().toISOString(),
                                                                            signedBy: userProfile?.uid
                                                                        };
                                                                        setRecetaItems(updatedItems);
                                                                        toast.success("Receta firmada por el doctor");
                                                                    }}
                                                                    className="p-1 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                                                    title="Firmar receta"
                                                                    disabled={item.doctorSignature}
                                                                >
                                                                    {item.doctorSignature ? <FiCheck size={14} className="text-green-600" /> : <FiPenTool size={14} />}
                                                                </button>
                                                                {!isViewOnly && (
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleRemoveItem(idx)}
                                                                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                                        title="Eliminar ítem"
                                                                    >
                                                                        <FiTrash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : docType === 'Orden' ? (
                        <div className="space-y-4">
                            {/* Diagnóstico Principal y Relacionado */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Diagnóstico Principal (CIE10)</label>
                                        {!isViewOnly && (
                                            <button
                                                type="button"
                                                onClick={handleOpenAsocConsulta}
                                                className="text-[9px] font-black uppercase tracking-widest text-[#8CC63F] hover:text-[#7bb335] flex items-center gap-1 transition-colors"
                                            >
                                                <FiSearch size={11} /> Asociar consulta
                                            </button>
                                        )}
                                    </div>
                                    {asocConsultaId && (
                                        <p className="text-[10px] text-emerald-600 font-bold pl-1">✓ Consulta asociada</p>
                                    )}
                                    {isViewOnly ? (
                                        <div className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 flex items-center">
                                            {dxPrincipal ? `${dxPrincipal.code} - ${dxPrincipal.name}` : '-'}
                                        </div>
                                    ) : (
                                        <CIE10Search 
                                            value={dxPrincipal}
                                            onSelect={(item) => setDxPrincipal(item)}
                                            className="w-full"
                                        />
                                    )}
                                </div>

                                {/* Diagnósticos Relacionados (Buscador) */}
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Diagnóstico relacionado (CIE10)</label>
                                    {isViewOnly ? (
                                        <div className="text-xs text-slate-400 italic font-medium pl-1">
                                            Lista de diagnósticos relacionados en la tabla de abajo
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 items-center">
                                            <CIE10Search 
                                                value={tempDxRelacionado}
                                                onSelect={(item) => setTempDxRelacionado(item)}
                                                className="flex-1"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    if (!tempDxRelacionado) {
                                                        toast.error("Seleccione un diagnóstico para agregar");
                                                        return;
                                                    }
                                                    if (diagnosticosRelacionados.some(d => d.code === tempDxRelacionado.code)) {
                                                        toast.error("El diagnóstico ya fue agregado");
                                                        return;
                                                    }
                                                    setDiagnosticosRelacionados(prev => [...prev, tempDxRelacionado]);
                                                    setTempDxRelacionado(null);
                                                }}
                                                className="w-9 h-9 flex items-center justify-center bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl font-bold transition-all active:scale-95 shadow-sm shrink-0 cursor-pointer"
                                                title="Agregar diagnóstico relacionado"
                                            >
                                                <FiPlus size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tabla Diagnósticos Relacionados */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Diagnósticos relacionados agregados</label>
                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Código</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Nombre</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {diagnosticosRelacionados.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-xs font-medium">
                                                        No ha agregado CIE10
                                                    </td>
                                                </tr>
                                            ) : (
                                                diagnosticosRelacionados.map((dx, idx) => (
                                                    <tr key={dx.code} className="hover:bg-slate-50/30 transition-colors">
                                                        <td className="px-4 py-3 text-xs font-bold text-slate-500">{dx.code}</td>
                                                        <td className="px-4 py-3 text-xs font-bold text-slate-700 uppercase">{dx.name}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {!isViewOnly && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setDiagnosticosRelacionados(prev => prev.filter((_, i) => i !== idx));
                                                                    }}
                                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                                >
                                                                    <FiTrash2 size={14} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Procedimientos CUPS */}
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <div className="flex justify-between items-center">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Procedimientos (CUPS)</label>
                                    {!isViewOnly && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setCupsModalOpen(true);
                                                setSelectedCups(null);
                                                setCupsObservaciones('');
                                                setCupsQuery('');
                                            }}
                                            className="bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full py-1.5 px-4 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-colors shadow-sm w-fit"
                                        >
                                            <FiPlus size={12} /> Agregar CUPS
                                        </button>
                                    )}
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Código</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Nombre</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Descripción</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {cupsItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs font-medium">
                                                        No ha agregado CUPS
                                                    </td>
                                                </tr>
                                            ) : (
                                                cupsItems.map((c, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                        <td className="px-4 py-3 text-xs font-bold text-slate-500 font-mono">{c.code}</td>
                                                        <td className="px-4 py-3 text-xs font-bold text-slate-700 uppercase">{c.name}</td>
                                                        <td className="px-4 py-3 text-xs text-slate-500 uppercase">{c.descripcion || "-"}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {!isViewOnly && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCupsItems(prev => prev.filter((_, i) => i !== idx));
                                                                    }}
                                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                                >
                                                                    <FiTrash2 size={14} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Observaciones generales */}
                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 font-bold">Observaciones Generales</label>
                                <textarea 
                                    rows={4}
                                    placeholder="Escriba las observaciones generales de la orden aquí..."
                                    value={observacionesGenerales}
                                    onChange={(e) => setObservacionesGenerales(e.target.value)}
                                    disabled={isViewOnly}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 resize-none custom-scrollbar transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    ) : docType === 'Consulta' ? (
                        // ── Formulario estructurado de Consulta Médica ──────────────
                        <div className="space-y-0">
                            {/* Tabs */}
                            <div className="flex border-b border-slate-100 mb-6">
                                {['motivo', 'antecedentes'].map(tab => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setConsultaTab(tab)}
                                        className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 -mb-px ${
                                            consultaTab === tab
                                                ? 'border-[#8CC63F] text-[#8CC63F]'
                                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {tab === 'motivo' ? 'Motivo Consulta' : 'Antecedentes'}
                                    </button>
                                ))}
                            </div>

                            {consultaTab === 'motivo' ? (
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Motivo de la consulta *</label>
                                        <textarea
                                            rows={4}
                                            readOnly={isViewOnly}
                                            placeholder="Describa el motivo principal de la consulta..."
                                            value={motivoConsulta}
                                            onChange={e => setMotivoConsulta(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 resize-none transition-all read-only:opacity-75 read-only:cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Enfermedad actual</label>
                                        <textarea
                                            rows={4}
                                            readOnly={isViewOnly}
                                            placeholder="Descripción de la enfermedad actual del paciente..."
                                            value={enfermedadActual}
                                            onChange={e => setEnfermedadActual(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 resize-none transition-all read-only:opacity-75 read-only:cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8">

                                    {/* ── Antecedentes ── */}
                                    <div className="space-y-3 p-5 bg-slate-50/60 rounded-2xl border border-slate-150">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-xs font-black text-slate-700">Antecedentes</h4>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" checked={antNoRefiere} onChange={e => setAntNoRefiere(e.target.checked)} disabled={isViewOnly} className="w-4 h-4 rounded border-slate-300 text-[#8CC63F] focus:ring-[#8CC63F]" />
                                                <span className="text-xs font-semibold text-slate-500">No refiere</span>
                                            </label>
                                        </div>
                                        {!antNoRefiere && (
                                            <>
                                                {!isViewOnly && (
                                                    <div className="flex items-end gap-3">
                                                        <div className="flex-1 space-y-2 text-left">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">CIE10</label>
                                                                <CIE10Search value={tempAntCIE10} onSelect={setTempAntCIE10} className="w-full" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Observación</label>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Observación"
                                                                    value={tempAntObs}
                                                                    onChange={e => setTempAntObs(e.target.value)}
                                                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 resize-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                if (!tempAntCIE10) { toast.error('Seleccione un código CIE10'); return; }
                                                                setAntecedentes(prev => [...prev, { ...tempAntCIE10, obs: tempAntObs }]);
                                                                setTempAntCIE10(null); setTempAntObs('');
                                                            }} 
                                                            className="w-9 h-9 rounded-full bg-[#8CC63F] hover:bg-[#7bb335] text-white flex items-center justify-center shadow active:scale-95 transition-all cursor-pointer shrink-0 mb-1"
                                                            title="Agregar Antecedente"
                                                        >
                                                            <FiPlus size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                                {antecedentes.length > 0 && (
                                                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                                        <table className="w-full text-left text-xs">
                                                            <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Código</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Diagnóstico</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {antecedentes.map((a, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-3 py-2 font-bold text-slate-500 font-mono">{a.code}</td>
                                                                        <td className="px-3 py-2 font-bold text-slate-700 uppercase">{a.name}</td>
                                                                        <td className="px-3 py-2 text-slate-500">{a.obs || '-'}</td>
                                                                        <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setAntecedentes(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><FiTrash2 size={13} /></button>}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* ── Alergias ── */}
                                    <div className="space-y-3 p-5 bg-slate-50/60 rounded-2xl border border-slate-150">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-xs font-black text-slate-700">Alergias</h4>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" checked={alerNoRefiere} onChange={e => setAlerNoRefiere(e.target.checked)} disabled={isViewOnly} className="w-4 h-4 rounded border-slate-300 text-[#8CC63F] focus:ring-[#8CC63F]" />
                                                <span className="text-xs font-semibold text-slate-500">No refiere</span>
                                            </label>
                                        </div>
                                        {!alerNoRefiere && (
                                            <>
                                                {!isViewOnly && (
                                                    <div className="flex items-end gap-3">
                                                        <div className="flex-1 space-y-2 text-left">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Tipo de alergia</label>
                                                                <select 
                                                                    value={tempAlerTipo} 
                                                                    onChange={e => setTempAlerTipo(e.target.value)} 
                                                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                                >
                                                                    <option value="">Seleccione...</option>
                                                                    {['Medicamento','Alimento','Ambiental','Látex','Otro'].map(t => <option key={t} value={t}>{t}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Observación</label>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Observación"
                                                                    value={tempAlerObs}
                                                                    onChange={e => setTempAlerObs(e.target.value)}
                                                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 resize-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                if (!tempAlerTipo) { toast.error('Seleccione tipo de alergia'); return; }
                                                                setAlergias(prev => [...prev, { tipo: tempAlerTipo, obs: tempAlerObs }]);
                                                                setTempAlerTipo(''); setTempAlerObs('');
                                                            }} 
                                                            className="w-9 h-9 rounded-full bg-[#8CC63F] hover:bg-[#7bb335] text-white flex items-center justify-center shadow active:scale-95 transition-all cursor-pointer shrink-0 mb-1"
                                                            title="Agregar Alergia"
                                                        >
                                                            <FiPlus size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                                {alergias.length > 0 && (
                                                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                                        <table className="w-full text-left text-xs">
                                                            <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Tipo</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {alergias.map((a, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-3 py-2 font-bold text-slate-700">{a.tipo}</td>
                                                                        <td className="px-3 py-2 text-slate-500">{a.obs || '-'}</td>
                                                                        <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setAlergias(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><FiTrash2 size={13} /></button>}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* ── Antecedentes Familiares ── */}
                                    <div className="space-y-3 p-5 bg-slate-50/60 rounded-2xl border border-slate-150">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-xs font-black text-slate-700">Antecedentes Familiares</h4>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" checked={famNoRefiere} onChange={e => setFamNoRefiere(e.target.checked)} disabled={isViewOnly} className="w-4 h-4 rounded border-slate-300 text-[#8CC63F] focus:ring-[#8CC63F]" />
                                                <span className="text-xs font-semibold text-slate-500">No refiere</span>
                                            </label>
                                        </div>
                                        {!famNoRefiere && (
                                            <>
                                                {!isViewOnly && (
                                                    <div className="flex items-end gap-3">
                                                        <div className="flex-1 space-y-2 text-left">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-slate-500 pl-0.5">Parentesco</label>
                                                                    <select 
                                                                        value={tempFamParentesco} 
                                                                        onChange={e => setTempFamParentesco(e.target.value)} 
                                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                                                    >
                                                                        <option value="">Seleccione...</option>
                                                                        {['Madre','Padre','Hermano(a)','Abuelo(a)','Tío(a)','Hijo(a)','Otro'].map(t => <option key={t} value={t}>{t}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-slate-500 pl-0.5">CIE10</label>
                                                                    <CIE10Search value={tempFamCIE10} onSelect={setTempFamCIE10} className="w-full" />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Observación</label>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Observación"
                                                                    value={tempFamObs}
                                                                    onChange={e => setTempFamObs(e.target.value)}
                                                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 resize-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                if (!tempFamParentesco || !tempFamCIE10) { toast.error('Complete parentesco y diagnóstico'); return; }
                                                                setAntFamiliares(prev => [...prev, { parentesco: tempFamParentesco, ...tempFamCIE10, obs: tempFamObs }]);
                                                                setTempFamParentesco(''); setTempFamCIE10(null); setTempFamObs('');
                                                            }} 
                                                            className="w-9 h-9 rounded-full bg-[#8CC63F] hover:bg-[#7bb335] text-white flex items-center justify-center shadow active:scale-95 transition-all cursor-pointer shrink-0 mb-1"
                                                            title="Agregar Antecedente Familiar"
                                                        >
                                                            <FiPlus size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                                {antFamiliares.length > 0 && (
                                                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                                        <table className="w-full text-left text-xs">
                                                            <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Parentesco</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Código</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Diagnóstico</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {antFamiliares.map((f, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-3 py-2 font-bold text-slate-700">{f.parentesco}</td>
                                                                        <td className="px-3 py-2 font-bold text-slate-500 font-mono">{f.code}</td>
                                                                        <td className="px-3 py-2 font-bold text-slate-700 uppercase">{f.name}</td>
                                                                        <td className="px-3 py-2 text-slate-500">{f.obs || '-'}</td>
                                                                        <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setAntFamiliares(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><FiTrash2 size={13} /></button>}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* ── Medicamentos ── */}
                                    <div className="space-y-3 p-5 bg-slate-50/60 rounded-2xl border border-slate-150">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-xs font-black text-slate-700">Medicamentos</h4>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" checked={medPrevNoRefiere} onChange={e => setMedPrevNoRefiere(e.target.checked)} disabled={isViewOnly} className="w-4 h-4 rounded border-slate-300 text-[#8CC63F] focus:ring-[#8CC63F]" />
                                                <span className="text-xs font-semibold text-slate-500">No refiere</span>
                                            </label>
                                        </div>
                                        {!medPrevNoRefiere && (
                                            <>
                                                {!isViewOnly && (
                                                    <div className="flex items-end gap-3">
                                                        <div className="flex-1 space-y-2 text-left">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">DCI</label>
                                                                <MedicamentoSearch 
                                                                    value={tempMedPrevItem} 
                                                                    onChange={setTempMedPrevItem} 
                                                                    disabled={isViewOnly} 
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Observación</label>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Observación"
                                                                    value={tempMedPrevObs}
                                                                    onChange={e => setTempMedPrevObs(e.target.value)}
                                                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 resize-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                if (!tempMedPrevItem) { toast.error('Seleccione un medicamento de la lista'); return; }
                                                                setMedicamentosPrev(prev => [...prev, { 
                                                                    nombre: `${tempMedPrevItem.code} - ${tempMedPrevItem.name}`, 
                                                                    obs: tempMedPrevObs.trim() 
                                                                }]);
                                                                setTempMedPrevItem(null); 
                                                                setTempMedPrevObs('');
                                                            }} 
                                                            className="w-9 h-9 rounded-full bg-[#8CC63F] hover:bg-[#7bb335] text-white flex items-center justify-center shadow active:scale-95 transition-all cursor-pointer shrink-0 mb-1"
                                                            title="Agregar Medicamento"
                                                        >
                                                            <FiPlus size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                                {medicamentosPrev.length > 0 && (
                                                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                                        <table className="w-full text-left text-xs">
                                                            <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Medicamento</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {medicamentosPrev.map((m, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-3 py-2 font-bold text-slate-700">{m.nombre}</td>
                                                                        <td className="px-3 py-2 text-slate-500">{m.obs || '-'}</td>
                                                                        <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setMedicamentosPrev(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><FiTrash2 size={13} /></button>}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            {docType !== 'Alerta' && (
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Detalle / Contenido *</label>
                            )}
                            <textarea 
                                rows={docType === 'Alerta' ? 6 : 8}
                                required
                                readOnly={isViewOnly}
                                placeholder={docType === 'Alerta' ? "Agregar alerta" : `Escriba el detalle de la ${(initialData?.tipoDocumento || docType).toLowerCase()} aquí...`}
                                value={contenido}
                                onChange={(e) => setContenido(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 resize-none custom-scrollbar transition-all read-only:bg-slate-50 read-only:cursor-not-allowed" 
                            />
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-none bg-white">
                    <button onClick={onClose} disabled={saving} className="px-6 py-2.5 rounded-full font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors border border-slate-200 bg-white cursor-pointer">
                        {docType === 'Alerta' ? "Cerrar" : (isViewOnly ? "Cerrar" : "Cancelar")}
                    </button>
                    {!isViewOnly && (
                        <button onClick={handleSave} disabled={saving} className="px-8 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer">
                            <FiCheck size={16} /> {saving ? "Guardando..." : (docType === 'Receta' ? "Guardar receta" : docType === 'Orden' ? "Guardar orden" : "Guardar")}
                        </button>
                    )}
                </div>
            </div>

            {/* SUB-MODAL: ASOCIAR CONSULTA */}
            {asocConsultaModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[80vh]">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Consultas con código CUPS de consulta</h4>
                            <button onClick={() => setAsocConsultaModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"><FiX size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {consultasList.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-8">No se encontraron consultas médicas para este paciente.</p>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="px-4 py-3 font-black text-slate-500 uppercase tracking-wider">Fecha</th>
                                                <th className="px-4 py-3 font-black text-slate-500 uppercase tracking-wider">Creado por</th>
                                                <th className="px-4 py-3 font-black text-slate-500 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {consultasList.map(c => (
                                                <tr key={c.id} className={`hover:bg-slate-50/50 transition-colors ${asocConsultaId === c.id ? 'bg-emerald-50' : ''}`}>
                                                    <td className="px-4 py-3 font-bold text-[#8CC63F]">
                                                        {c.fechaIso ? new Date(c.fechaIso).toLocaleString('es-ES') : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-700">{c.transcribe || c.profesional || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAsocConsultaId(c.id);
                                                                // Auto-fill dx principal from first antecedente
                                                                if (c.antecedentes && c.antecedentes.length > 0) {
                                                                    setDxPrincipal({ code: c.antecedentes[0].code, name: c.antecedentes[0].name });
                                                                }
                                                                setAsocConsultaModal(false);
                                                                toast.success('Consulta asociada correctamente');
                                                            }}
                                                            className="p-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-lg transition-all"
                                                        >
                                                            <FiCheck size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setAsocConsultaModal(false)} className="px-6 py-2 rounded-full font-bold text-sm text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUB-MODAL: DETALLE DE PRESCRIPCIÓN */}
            {prescriptionDetailOpen && selectedMed && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide text-left">
                                Detalle de Prescripción – {selectedMed.principioActivo.toUpperCase()}
                            </h4>
                            <button 
                                onClick={() => {
                                    setPrescriptionDetailOpen(false);
                                    setSelectedMed(null);
                                    setMedSearchTerm("");
                                    clearPrescriptionDetailFields();
                                }} 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"
                            >
                                <FiX size={16} />
                            </button>
                        </div>
                        
                        {/* Body Content */}
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-left">
                            
                            {/* Tipo, Código, Principio Activo */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo *</label>
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={selectedMed.tipo || "POS"} 
                                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-505 text-slate-500 outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Código *</label>
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={selectedMed.cum || ""} 
                                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 outline-none cursor-not-allowed font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Principio activo *</label>
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={selectedMed.principioActivo || ""} 
                                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 outline-none cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Descripción</label>
                                <input 
                                    type="text" 
                                    placeholder="Descripción para el medicamento"
                                    value={prescripcionDescripcion} 
                                    onChange={e => setPrescripcionDescripcion(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350"
                                />
                            </div>

                            {/* Marca */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Marca</label>
                                <input 
                                    type="text" 
                                    placeholder="Marca para el medicamento"
                                    value={prescripcionMarca} 
                                    onChange={e => setPrescripcionMarca(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350"
                                />
                            </div>

                            {/* Dosis y Frecuencia */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Dosis (Valor + Unidad) */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Dosis *</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="text" 
                                            placeholder="Ej: 500"
                                            value={prescripcionDosisValor} 
                                            onChange={e => setPrescripcionDosisValor(e.target.value)} 
                                            className="w-2/3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350"
                                        />
                                        <select 
                                            value={prescripcionDosisUnidad} 
                                            onChange={e => setPrescripcionDosisUnidad(e.target.value)} 
                                            className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 appearance-none text-center"
                                        >
                                            <option value="mg">mg</option>
                                            <option value="g">g</option>
                                            <option value="ml">ml</option>
                                            <option value="cápsula">cápsula</option>
                                            <option value="tableta">tableta</option>
                                            <option value="unidad">unidad</option>
                                            <option value="ampolla">ampolla</option>
                                            <option value="cárpula">cárpula</option>
                                            <option value="gota">gota</option>
                                            <option value="aplicación">aplicación</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Frecuencia (Valor + Unidad) */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Frecuencia *</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="text" 
                                            placeholder="Ej: 8"
                                            value={prescripcionFrecuenciaValor} 
                                            onChange={e => setPrescripcionFrecuenciaValor(e.target.value)} 
                                            className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350"
                                        />
                                        <select 
                                            value={prescripcionFrecuenciaUnidad} 
                                            onChange={e => setPrescripcionFrecuenciaUnidad(e.target.value)} 
                                            className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 appearance-none"
                                        >
                                            <option value="Horas">Horas</option>
                                            <option value="Días">Días</option>
                                            <option value="Semanas">Semanas</option>
                                            <option value="Única dosis">Única dosis</option>
                                            <option value="Con las comidas">Con comidas</option>
                                            <option value="Antes de dormir">Al dormir</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Vía administración y Duración */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Vía Administración */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Vía administración *</label>
                                    <select 
                                        value={prescripcionVia} 
                                        onChange={e => setPrescripcionVia(e.target.value)} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500"
                                    >
                                        {VIAS_ADMINISTRACION.map(via => (
                                            <option key={via.code} value={via.name}>
                                                {via.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Duración (Valor + Unidad) */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Duración *</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="text" 
                                            placeholder="Ej: 5"
                                            value={prescripcionDuracionValor} 
                                            onChange={e => setPrescripcionDuracionValor(e.target.value)} 
                                            className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350"
                                        />
                                        <select 
                                            value={prescripcionDuracionUnidad} 
                                            onChange={e => setPrescripcionDuracionUnidad(e.target.value)} 
                                            className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 appearance-none"
                                        >
                                            <option value="Minutos">Minutos</option>
                                            <option value="Horas">Horas</option>
                                            <option value="Días">Días</option>
                                            <option value="Semanas">Semanas</option>
                                            <option value="Meses">Meses</option>
                                            <option value="Años">Años</option>
                                            <option value="Única vez">Única vez</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Cantidad */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                                    Cantidad *
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: 1"
                                    value={prescripcionCantidad} 
                                    onChange={e => setPrescripcionCantidad(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350 transition-all"
                                />
                            </div>

                            {/* Recomendación */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Recomendación</label>
                                <textarea 
                                    rows={3}
                                    placeholder="Instrucciones adicionales para el paciente..."
                                    value={prescripcionRecomendacion} 
                                    onChange={e => setPrescripcionRecomendacion(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350 resize-none custom-scrollbar"
                                />
                            </div>

                        </div>
                        
                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => {
                                    setPrescriptionDetailOpen(false);
                                    setSelectedMed(null);
                                    setMedSearchTerm("");
                                    clearPrescriptionDetailFields();
                                }}
                                className="px-5 py-2.5 rounded-full font-bold text-xs text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSavePrescriptionItem}
                                className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white text-xs font-black rounded-full uppercase tracking-wider shadow"
                            >
                                Agregar a la Receta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUB-MODAL: AGREGAR CUPS */}
            {cupsModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide text-left">
                                Agregar CUPS
                            </h4>
                            <button 
                                onClick={() => {
                                    setCupsModalOpen(false);
                                    setSelectedCups(null);
                                    setCupsQuery('');
                                    setCupsObservaciones('');
                                }} 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"
                            >
                                <FiX size={16} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-left relative">
                            {/* Search field */}
                            <div className="space-y-1 relative">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Código *</label>
                                <input 
                                    type="text" 
                                    placeholder="Escriba la consulta o el código CUPS"
                                    value={cupsQuery} 
                                    onChange={(e) => {
                                        setCupsQuery(e.target.value);
                                        setShowCupsSuggestions(true);
                                        if (selectedCups) setSelectedCups(null);
                                    }}
                                    onFocus={() => setShowCupsSuggestions(true)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350"
                                />
                                
                                {/* CUPS Suggestions Dropdown */}
                                {showCupsSuggestions && cupsQuery.length >= 2 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-50">
                                        {CUPS_DENTAL_CODES.filter(c => 
                                            c.code.toLowerCase().includes(cupsQuery.toLowerCase()) ||
                                            c.name.toLowerCase().includes(cupsQuery.toLowerCase())
                                        ).slice(0, 5).map(c => (
                                            <div 
                                                key={c.code}
                                                onClick={() => {
                                                    setSelectedCups(c);
                                                    setCupsQuery(`${c.code} - ${c.name}`);
                                                    setShowCupsSuggestions(false);
                                                }}
                                                className="p-3 hover:bg-indigo-50 cursor-pointer text-xs text-slate-700 flex justify-between items-center transition-all"
                                            >
                                                <span><span className="font-bold text-indigo-600">{c.code}</span> - {c.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Observaciones */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Observaciones</label>
                                <textarea 
                                    rows={3}
                                    placeholder="Observaciones"
                                    value={cupsObservaciones} 
                                    onChange={e => setCupsObservaciones(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 placeholder:text-slate-350 resize-none custom-scrollbar"
                                />
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => {
                                    setCupsModalOpen(false);
                                    setSelectedCups(null);
                                    setCupsQuery('');
                                    setCupsObservaciones('');
                                }}
                                className="px-5 py-2.5 rounded-full font-bold text-xs text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                                Cerrar
                            </button>
                            <button 
                                type="button" 
                                onClick={() => {
                                    if (!selectedCups) {
                                        toast.error("Debe seleccionar un código CUPS de la lista");
                                        return;
                                    }
                                    const newItem = {
                                        code: selectedCups.code,
                                        name: selectedCups.name,
                                        descripcion: cupsObservaciones
                                    };
                                    setCupsItems(prev => [...prev, newItem]);
                                    setCupsModalOpen(false);
                                    setSelectedCups(null);
                                    setCupsQuery('');
                                    setCupsObservaciones('');
                                    toast.success("CUPS agregado");
                                }}
                                className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white text-xs font-black rounded-full uppercase tracking-wider shadow"
                            >
                                Agregar CUPS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUB-MODAL: NUEVO MEDICAMENTO (OralDrive 1:1) */}
            {newMedModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-800 tracking-tight text-left">
                                Nuevo medicamento
                            </h4>
                            <button 
                                onClick={() => setNewMedModalOpen(false)} 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-left">
                            {/* Tipo* */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Tipo *</label>
                                <select 
                                    value={newMedTipo}
                                    onChange={(e) => setNewMedTipo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                >
                                    <option value="">Seleccione...</option>
                                    <option value="POS">POS</option>
                                    <option value="NO POS">NO POS</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>

                            {/* Código* con Autocompletado CUM 1:1 OralDrive */}
                            <div className="space-y-1 relative">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Código *</label>
                                <input 
                                    type="text" 
                                    placeholder="Código del medicamento"
                                    value={newMedCodigo} 
                                    onChange={(e) => {
                                        setNewMedCodigo(e.target.value);
                                        setShowNewMedCodeSuggestions(true);
                                    }} 
                                    onFocus={() => setShowNewMedCodeSuggestions(true)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                />

                                {/* Dropdown de Sugerencias CUM (OralDrive 1:1) */}
                                {showNewMedCodeSuggestions && newMedCodigo.trim().length >= 1 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[300] max-h-52 overflow-y-auto divide-y divide-slate-100">
                                        {MEDICAMENTOS_COLOMBIA.filter(m => 
                                            m.code.toLowerCase().includes(newMedCodigo.trim().toLowerCase()) ||
                                            m.name.toLowerCase().includes(newMedCodigo.trim().toLowerCase())
                                        ).slice(0, 10).map((m, idx) => (
                                            <div 
                                                key={idx}
                                                onClick={() => {
                                                    setNewMedCodigo(m.code);
                                                    setNewMedPrincipioActivo(m.name);
                                                    setNewMedTipo(m.group || "POS");
                                                    setShowNewMedCodeSuggestions(false);
                                                    setShowNewMedNameSuggestions(false);
                                                }}
                                                className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer flex items-center justify-between transition-colors"
                                            >
                                                <span className="font-bold text-slate-700 uppercase tracking-tight">
                                                    {m.name} - <span className="text-slate-500 font-normal">{m.code}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Principio activo* con Autocompletado CUM 1:1 OralDrive */}
                            <div className="space-y-1 relative">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Principio activo *</label>
                                <input 
                                    type="text" 
                                    placeholder="Principio activo del medicamento"
                                    value={newMedPrincipioActivo} 
                                    onChange={(e) => {
                                        setNewMedPrincipioActivo(e.target.value);
                                        setShowNewMedNameSuggestions(true);
                                    }} 
                                    onFocus={() => setShowNewMedNameSuggestions(true)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                />

                                {showNewMedNameSuggestions && newMedPrincipioActivo.trim().length >= 2 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[300] max-h-52 overflow-y-auto divide-y divide-slate-100">
                                        {MEDICAMENTOS_COLOMBIA.filter(m => 
                                            m.name.toLowerCase().includes(newMedPrincipioActivo.trim().toLowerCase()) ||
                                            m.code.toLowerCase().includes(newMedPrincipioActivo.trim().toLowerCase())
                                        ).slice(0, 10).map((m, idx) => (
                                            <div 
                                                key={idx}
                                                onClick={() => {
                                                    setNewMedCodigo(m.code);
                                                    setNewMedPrincipioActivo(m.name);
                                                    setNewMedTipo(m.group || "POS");
                                                    setShowNewMedNameSuggestions(false);
                                                    setShowNewMedCodeSuggestions(false);
                                                }}
                                                className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer flex items-center justify-between transition-colors"
                                            >
                                                <span className="font-bold text-slate-700 uppercase tracking-tight">
                                                    {m.name} - <span className="text-slate-500 font-normal">{m.code}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Descripción</label>
                                <input 
                                    type="text" 
                                    placeholder="Descripción para el medicamento"
                                    value={newMedDescripcion} 
                                    onChange={(e) => setNewMedDescripcion(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                />
                            </div>

                            {/* Marca */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Marca</label>
                                <input 
                                    type="text" 
                                    placeholder="Marca para el medicamento"
                                    value={newMedMarca} 
                                    onChange={(e) => setNewMedMarca(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button 
                                type="button" 
                                onClick={handleSaveNewMed}
                                className="px-6 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white text-xs font-black rounded-full uppercase tracking-wider shadow active:scale-95 transition-all cursor-pointer"
                            >
                                Guardar
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setNewMedModalOpen(false)}
                                className="px-5 py-2 rounded-full font-bold text-xs text-slate-500 hover:bg-slate-200 transition-colors border border-slate-200 bg-white cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
