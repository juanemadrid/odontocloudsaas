import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiSave, FiPlus, FiTrash2, FiSearch, FiBox, FiList, FiPenTool, FiClock, FiLock, FiCheckCircle, FiChevronRight, FiChevronLeft, FiAlertTriangle } from 'react-icons/fi';
import supabase from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import CIE10Search from './CIE10Search';
import MedicamentoSearch from './MedicamentoSearch';
import MEDICAMENTOS_COLOMBIA from '../../../data/medicamentosColombia';
import VIAS_ADMINISTRACION from '../../../data/viasAdministracionColombia';
import COLOMBIAN_CUM_REGISTRY from '../../../data/cumCompleto';
import { CUPS_DENTAL_CODES } from "../../../data/cupsCodes";
import CUPSSearch from './CUPSSearch';
import { PREDEFINED_TEMPLATES } from '../../../data/plantillasPredeterminadas';
import { getConfigItems } from '../../../services/configPersistenceService';
import { getDoctorsList } from '../../../services/supabaseServices';
import { getDoctorSignatureAndData, validateDoctorCanSign } from '../../../services/doctorSignatureService';


export default function DocClinicoModal({ isOpen, onClose, patient, docType, initialData = null, isViewOnly = false }) {
    const { userProfile } = useAuth();
    const toast = useToast();

    // Determinar si es un registro cerrado / finalizado
    const isClosedRecord = (
        (docType === 'Consulta' || initialData?.tipoDocumento === 'Consulta' || initialData?.tipo === 'Consulta') &&
        (initialData?.estado === 'Finalizada' || initialData?.finalizado === true || initialData?.metadata?.estado === 'Finalizada' || initialData?.metadata?.finalizado === true)
    );
    const effectiveIsViewOnly = isViewOnly || isClosedRecord;
    
    const [activeDocId, setActiveDocId] = useState(initialData?.id || null);
    const [saving, setSaving] = useState(false);
    const [confirmFinalizeWithMissing, setConfirmFinalizeWithMissing] = useState(false);
    const [missingConsultaTabs, setMissingConsultaTabs] = useState([]);
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
    const [medicalTabs, setMedicalTabs] = useState([]);
    const [medicalTabValues, setMedicalTabValues] = useState({});

    // ── Consulta Odontológica form states ────────────────────────────────────
    const [consultaTab, setConsultaTab] = useState('motivo');
    // 1. Motivo de Consulta
    const [motivoConsulta, setMotivoConsulta] = useState('');
    const [enfermedadActual, setEnfermedadActual] = useState('');
    // 2. Antecedentes
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
    // 3. Examen Odontológico Estructurado
    const DEFAULT_EXAMEN_ODONTO = {
        // 1. Estado general
        estadoGeneral: '',
        presionArterial: '',
        frecuenciaCardiaca: '',
        otrosSignos: '',
        // 2. Examen extraoral
        simetriaFacial: '',
        simetriaFacialObs: '',
        pielTejidos: '',
        pielTejidosObs: '',
        ganglios: '',
        gangliosObs: '',
        labios: '',
        labiosObs: '',
        // 3. ATM
        atmItems: [],
        atmOtros: '',
        // 4. Tejidos blandos / Intraoral
        mucosaYugal: '',
        mucosaYugalObs: '',
        paladar: '',
        paladarObs: '',
        lengua: '',
        lenguaObs: '',
        pisoBoca: '',
        pisoBocaObs: '',
        glandulasSalivales: '',
        glandulasSalivalesObs: '',
        orofaringe: '',
        orofaringeObs: '',
        // 5. Periodonto
        encias: [],
        higieneOral: '',
        placaBacteriana: '',
        calculo: '',
        movilidadDental: '',
        periodontoOtros: '',
        // 6. Oclusión
        oclusionItems: [],
        oclusionObs: '',
        // 7. Hallazgos adicionales
        hallazgosAdicionales: ''
    };
    const [examenOdonto, setExamenOdonto] = useState(DEFAULT_EXAMEN_ODONTO);

    const updateExamenOdonto = (key, value) => {
        setExamenOdonto(prev => ({ ...prev, [key]: value }));
    };

    // 4. Diagnóstico
    const [dxPrincipalConsulta, setDxPrincipalConsulta] = useState(null);
    const [dxRelacionadosConsulta, setDxRelacionadosConsulta] = useState([]);
    const [tempDxRelConsultaCIE10, setTempDxRelConsultaCIE10] = useState(null);
    const [tempDxRelConsultaObs, setTempDxRelConsultaObs] = useState('');
    const [diagnosticoNotas, setDiagnosticoNotas] = useState('');
    // 5. Plan de Tratamiento
    const [planTratamiento, setPlanTratamiento] = useState('');
    const [recomendaciones, setRecomendaciones] = useState('');

    // ── Asociar Consulta (for Orden form) ────────────────────────────────────
    const [asocConsultaModal, setAsocConsultaModal] = useState(false);
    const [consultasList, setConsultasList] = useState([]);
    const [asocConsultaId, setAsocConsultaId] = useState(null);
    const [associatedConsulta, setAssociatedConsulta] = useState(null);

    const formatConsultaDate = (dateVal) => {
        if (!dateVal) return '';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return String(dateVal);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            let hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const strHours = String(hours).padStart(2, '0');
            return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
        } catch {
            return '';
        }
    };

    const getConsultaDoctor = (c) => {
        if (!c) return '-';
        return c.profesional || c.transcribe || c.metadata?.profesional || c.metadata?.transcribe || c.doctor || c.doctorName || '-';
    };

    // ── Consulta Odontológica summary generator ───────────────────────────
    const generateConsultaSummary = (
        motivo, enfermedad, ants, aler, fams, meds,
        examen, dxPrinc, dxRels, dxNotas,
        plan, recs
    ) => {
        const sections = [];
        // 1. Motivo de Consulta
        const motivoLines = [];
        if (motivo) motivoLines.push(`Motivo de consulta: ${motivo}`);
        if (enfermedad) motivoLines.push(`Enfermedad actual: ${enfermedad}`);
        if (motivoLines.length > 0) sections.push(`1. MOTIVO DE CONSULTA:\n${motivoLines.join('\n')}`);

        // 2. Antecedentes
        const antLines = [];
        if (ants && ants.length > 0) {
            antLines.push(`  • Médicos:`);
            ants.forEach(a => antLines.push(`    - [${a.code}] ${a.name}${a.obs ? ' (' + a.obs + ')' : ''}`));
        }
        if (aler && aler.length > 0) {
            antLines.push(`  • Alergias:`);
            aler.forEach(a => antLines.push(`    - ${a.tipo}${a.obs ? ' (' + a.obs + ')' : ''}`));
        }
        if (fams && fams.length > 0) {
            antLines.push(`  • Familiares:`);
            fams.forEach(f => antLines.push(`    - ${f.parentesco}: [${f.code}] ${f.name}${f.obs ? ' (' + f.obs + ')' : ''}`));
        }
        if (meds && meds.length > 0) {
            antLines.push(`  • Medicamentos:`);
            meds.forEach(m => antLines.push(`    - ${m.nombre}${m.obs ? ' (' + m.obs + ')' : ''}`));
        }
        if (antLines.length > 0) sections.push(`2. ANTECEDENTES:\n${antLines.join('\n')}`);

        // 3. Examen Odontológico
        const exLines = [];
        if (examen) {
            // 1. Estado general
            const eg = [];
            if (examen.estadoGeneral) eg.push(`Estado general: ${examen.estadoGeneral}`);
            if (examen.presionArterial) eg.push(`PA: ${examen.presionArterial} mmHg`);
            if (examen.frecuenciaCardiaca) eg.push(`FC: ${examen.frecuenciaCardiaca} lpm`);
            if (examen.otrosSignos) eg.push(`Otros signos: ${examen.otrosSignos}`);
            if (eg.length > 0) exLines.push(`  • 1. Estado general / Signos: ${eg.join(' | ')}`);

            // 2. Examen extraoral
            const extra = [];
            if (examen.simetriaFacial) extra.push(`Simetría facial: ${examen.simetriaFacial}${examen.simetriaFacialObs ? ` (Obs: ${examen.simetriaFacialObs})` : ''}`);
            if (examen.pielTejidos) extra.push(`Piel y tejidos: ${examen.pielTejidos}${examen.pielTejidosObs ? ` (Obs: ${examen.pielTejidosObs})` : ''}`);
            if (examen.ganglios) extra.push(`Ganglios: ${examen.ganglios}${examen.gangliosObs ? ` (Obs: ${examen.gangliosObs})` : ''}`);
            if (examen.labios) extra.push(`Labios: ${examen.labios}${examen.labiosObs ? ` (Obs: ${examen.labiosObs})` : ''}`);
            if (extra.length > 0) exLines.push(`  • 2. Examen extraoral: ${extra.join(' | ')}`);

            // 3. ATM
            const atmList = examen.atmItems || [];
            if (atmList.length > 0 || examen.atmOtros) {
                const atmStr = [...atmList, examen.atmOtros ? `Otros: ${examen.atmOtros}` : ''].filter(Boolean).join(', ');
                exLines.push(`  • 3. ATM (Alteraciones): ${atmStr}`);
            } else {
                exLines.push(`  • 3. ATM: Sin alteraciones aparentes`);
            }

            // 4. Tejidos blandos / Intraoral
            const intra = [];
            if (examen.mucosaYugal) intra.push(`Mucosa yugal: ${examen.mucosaYugal}${examen.mucosaYugalObs ? ` (Obs: ${examen.mucosaYugalObs})` : ''}`);
            if (examen.paladar) intra.push(`Paladar: ${examen.paladar}${examen.paladarObs ? ` (Obs: ${examen.paladarObs})` : ''}`);
            if (examen.lengua) intra.push(`Lengua: ${examen.lengua}${examen.lenguaObs ? ` (Obs: ${examen.lenguaObs})` : ''}`);
            if (examen.pisoBoca) intra.push(`Piso de boca: ${examen.pisoBoca}${examen.pisoBocaObs ? ` (Obs: ${examen.pisoBocaObs})` : ''}`);
            if (examen.glandulasSalivales) intra.push(`Glándulas: ${examen.glandulasSalivales}${examen.glandulasSalivalesObs ? ` (Obs: ${examen.glandulasSalivalesObs})` : ''}`);
            if (examen.orofaringe) intra.push(`Orofaringe: ${examen.orofaringe}${examen.orofaringeObs ? ` (Obs: ${examen.orofaringeObs})` : ''}`);
            if (intra.length > 0) exLines.push(`  • 4. Tejidos blandos / Examen intraoral: ${intra.join(' | ')}`);

            // 5. Periodonto
            const perio = [];
            if (examen.encias && examen.encias.length > 0) perio.push(`Encías: ${examen.encias.join(', ')}`);
            if (examen.higieneOral) perio.push(`Higiene oral: ${examen.higieneOral}`);
            if (examen.placaBacteriana) perio.push(`Placa: ${examen.placaBacteriana}`);
            if (examen.calculo) perio.push(`Cálculo: ${examen.calculo}`);
            if (examen.movilidadDental) perio.push(`Movilidad: ${examen.movilidadDental}`);
            if (examen.periodontoOtros) perio.push(`Otros: ${examen.periodontoOtros}`);
            if (perio.length > 0) exLines.push(`  • 5. Periodonto: ${perio.join(' | ')}`);

            // 6. Oclusión
            const ocluList = examen.oclusionItems || [];
            if (ocluList.length > 0 || examen.oclusionObs) {
                const ocluStr = [...ocluList, examen.oclusionObs ? `Obs: ${examen.oclusionObs}` : ''].filter(Boolean).join(' | ');
                exLines.push(`  • 6. Oclusión: ${ocluStr}`);
            }

            // 7. Hallazgos adicionales
            if (examen.hallazgosAdicionales) {
                exLines.push(`  • 7. Hallazgos adicionales: ${examen.hallazgosAdicionales}`);
            }
        }
        if (exLines.length > 0) sections.push(`3. EXAMEN ODONTOLÓGICO:\n${exLines.join('\n')}`);

        // 4. Diagnóstico
        const dxLines = [];
        if (dxPrinc) dxLines.push(`  • Diagnóstico principal: [${dxPrinc.code}] ${dxPrinc.name}`);
        if (dxRels && dxRels.length > 0) {
            dxLines.push(`  • Diagnósticos relacionados:`);
            dxRels.forEach(d => dxLines.push(`    - [${d.code}] ${d.name}${d.obs ? ' (' + d.obs + ')' : ''}`));
        }
        if (dxNotas) dxLines.push(`  • Observaciones diagnósticas: ${dxNotas}`);
        if (dxLines.length > 0) sections.push(`4. DIAGNÓSTICO:\n${dxLines.join('\n')}`);

        // 5. Plan de Tratamiento
        const planLines = [];
        if (plan) planLines.push(`  • Plan de tratamiento / Procedimientos: ${plan}`);
        if (recs) planLines.push(`  • Recomendaciones y conducta: ${recs}`);
        if (planLines.length > 0) sections.push(`5. PLAN DE TRATAMIENTO:\n${planLines.join('\n')}`);

        return sections.join('\n\n');
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

    const wasOpenRef = React.useRef(false);
    const prevInitialDataRef = React.useRef(null);

    // Initialize/Reset only when modal opens or initialData changes upon opening
    useEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            prevInitialDataRef.current = null;
            setContenido("");
            setDiagnostico("");
            setProfesional("");
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
            setAssociatedConsulta(null);
            // Reset Consulta Odontológica states
            setConsultaTab('motivo');
            setMotivoConsulta('');
            setEnfermedadActual('');
            setAntNoRefiere(false); setTempAntCIE10(null); setTempAntObs(''); setAntecedentes([]);
            setAlerNoRefiere(false); setTempAlerTipo(''); setTempAlerObs(''); setAlergias([]);
            setFamNoRefiere(false); setTempFamParentesco(''); setTempFamCIE10(null); setTempFamObs(''); setAntFamiliares([]);
            setMedPrevNoRefiere(false); setTempMedPrevItem(null); setTempMedPrevObs(''); setMedicamentosPrev([]);
            setExamenOdonto(DEFAULT_EXAMEN_ODONTO);
            setDxPrincipalConsulta(null); setDxRelacionadosConsulta([]); setTempDxRelConsultaCIE10(null); setTempDxRelConsultaObs(''); setDiagnosticoNotas('');
            setPlanTratamiento(''); setRecomendaciones('');
            // Reset Plantilla states
            setTemplates([]);
            setSelectedTemplate(null);
            setTemplateValues({});
            setMedicalTabs([]);
            setMedicalTabValues({});
            return;
        }

        const justOpened = !wasOpenRef.current;
        const initialDataChanged = initialData !== prevInitialDataRef.current;

        if (justOpened || initialDataChanged) {
            wasOpenRef.current = true;
            prevInitialDataRef.current = initialData;

            if (initialData) {
                setContenido(initialData.contenido || "");
                setDiagnostico(initialData.diagnostico || "");
                setProfesional(initialData.profesional || "");
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
                    setAsocConsultaId(initialData.asocConsultaId || initialData.metadata?.asocConsultaId || null);
                    setAssociatedConsulta(initialData.associatedConsulta || initialData.metadata?.associatedConsulta || null);
                }
                // Initialize Consulta states if editing/viewing
                const isConsulta = (initialData.tipoDocumento === 'Consulta' || initialData.tipo === 'Consulta' || docType === 'Consulta' || (initialData.tipoDocumento || initialData.tipo || '').toLowerCase() === 'consulta');
                if (isConsulta) {
                    setConsultaTab('motivo');
                    const meta = initialData.metadata || {};
                    setMotivoConsulta(initialData.motivoConsulta || meta.motivoConsulta || '');
                    setEnfermedadActual(initialData.enfermedadActual || meta.enfermedadActual || '');
                    setAntecedentes(initialData.antecedentes || meta.antecedentes || []);
                    setAntNoRefiere(initialData.antNoRefiere ?? meta.antNoRefiere ?? false);
                    setAlergias(initialData.alergias || meta.alergias || []);
                    setAlerNoRefiere(initialData.alerNoRefiere ?? meta.alerNoRefiere ?? false);
                    setAntFamiliares(initialData.antFamiliares || meta.antFamiliares || []);
                    setFamNoRefiere(initialData.famNoRefiere ?? meta.famNoRefiere ?? false);
                    setMedicamentosPrev(initialData.medicamentosPrev || meta.medicamentosPrev || []);
                    setMedPrevNoRefiere(initialData.medPrevNoRefiere ?? meta.medPrevNoRefiere ?? false);
                    
                    // Examen Odontológico
                    const ex = initialData.examenOdontologico || meta.examenOdontologico || {};
                    setExamenOdonto({
                        estadoGeneral: ex.estadoGeneral || 'Bueno',
                        presionArterial: ex.presionArterial || '',
                        frecuenciaCardiaca: ex.frecuenciaCardiaca || '',
                        otrosSignos: ex.otrosSignos || '',
                        simetriaFacial: ex.simetriaFacial || (ex.examenExtraoral?.includes('Alter') ? 'Alterada' : 'Normal'),
                        simetriaFacialObs: ex.simetriaFacialObs || '',
                        pielTejidos: ex.pielTejidos || 'Normal',
                        pielTejidosObs: ex.pielTejidosObs || '',
                        ganglios: ex.ganglios || 'Sin alteraciones',
                        gangliosObs: ex.gangliosObs || '',
                        labios: ex.labios || 'Normal',
                        labiosObs: ex.labiosObs || '',
                        atmItems: Array.isArray(ex.atmItems) ? ex.atmItems : [],
                        atmOtros: ex.atmOtros || ex.atm || '',
                        mucosaYugal: ex.mucosaYugal || 'Normal',
                        mucosaYugalObs: ex.mucosaYugalObs || '',
                        paladar: ex.paladar || 'Normal',
                        paladarObs: ex.paladarObs || '',
                        lengua: ex.lengua || 'Normal',
                        lenguaObs: ex.lenguaObs || '',
                        pisoBoca: ex.pisoBoca || 'Normal',
                        pisoBocaObs: ex.pisoBocaObs || '',
                        glandulasSalivales: ex.glandulasSalivales || 'Normal',
                        glandulasSalivalesObs: ex.glandulasSalivalesObs || '',
                        orofaringe: ex.orofaringe || 'Normal',
                        orofaringeObs: ex.orofaringeObs || '',
                        encias: Array.isArray(ex.encias) ? ex.encias : (ex.encias ? [ex.encias] : ['Normales']),
                        higieneOral: ex.higieneOral || 'Buena',
                        placaBacteriana: ex.placaBacteriana || 'Ausente',
                        calculo: ex.calculo || 'Ausente',
                        movilidadDental: ex.movilidadDental || 'No',
                        periodontoOtros: ex.periodontoOtros || (typeof ex.periodonto === 'string' ? ex.periodonto : ''),
                        oclusionItems: Array.isArray(ex.oclusionItems) ? ex.oclusionItems : (ex.oclusion ? [ex.oclusion] : ['Normal']),
                        oclusionObs: ex.oclusionObs || '',
                        hallazgosAdicionales: ex.hallazgosAdicionales || ex.otrosHallazgos || ''
                    });

                    // Diagnóstico
                    setDxPrincipalConsulta(initialData.dxPrincipalConsulta || initialData.dxPrincipal || meta.dxPrincipalConsulta || meta.dxPrincipal || null);
                    setDxRelacionadosConsulta(initialData.dxRelacionadosConsulta || initialData.dxRelacionados || meta.dxRelacionadosConsulta || meta.dxRelacionados || []);
                    setDiagnosticoNotas(initialData.diagnosticoNotas || meta.diagnosticoNotas || '');

                    // Plan de Tratamiento
                    setPlanTratamiento(initialData.planTratamiento || meta.planTratamiento || '');
                    setRecomendaciones(initialData.recomendaciones || meta.recomendaciones || '');
                    
                    setMedicalTabValues(
                        initialData.pestanasMedicas || meta.pestanasMedicas || {}
                    );
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
                setAsocConsultaId(null);
                setAssociatedConsulta(null);
                // Reset Plantilla states for new doc
                setSelectedTemplate(null);
                setTemplateValues({});
                setMedicalTabValues({});
            }
        }
    }, [isOpen, initialData, docType]);

    useEffect(() => {
        const loadMedicalTabs = async () => {
            const tenantId = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId;
            if (!isOpen || docType !== 'Consulta' || !tenantId) return;
            try {
                const rows = await getConfigItems(tenantId, "pestanas_medicas", null);
                setMedicalTabs(
                    rows
                        .filter(item => item.activo !== false)
                        .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
                );
            } catch (error) {
                console.error("Error loading medical tabs:", error);
                setMedicalTabs([]);
            }
        };
        loadMedicalTabs();
    }, [isOpen, docType, userProfile?.inquilino]);

    // Load configured clinical templates (Plantillas Clínicas)
    useEffect(() => {
        const loadTemplates = async () => {
            const inq = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId;
            if (!isOpen || !inq) return;
            const isTemplateMode = docType === 'Plantilla' || docType === 'Consulta';
            const isEditingTemplate = initialData?.isTemplateDoc;
            if (!isTemplateMode && !isEditingTemplate) return;
            
            try {
                const dbTemplates = await getConfigItems(inq, "plantillas_clinicas", "plantillas_clinicas");
                const list = Array.isArray(dbTemplates) ? dbTemplates : [];
                setTemplates(list);
                
                // Auto-select template ONLY when editing an existing document or for specific docTypes
                if (initialData?.isTemplateDoc || initialData?.templateId || initialData?.nombrePlantilla) {
                    setSelectedTemplate(prev => {
                        const targetId = initialData?.templateId || initialData?.nombrePlantilla || initialData?.tipoDocumento || prev?.id;
                        if (targetId) {
                            return list.find(t => t.id === targetId || t.nombre?.toLowerCase() === String(targetId).toLowerCase()) || null;
                        }
                        return null;
                    });
                } else if (docType && docType !== 'Plantilla') {
                    setSelectedTemplate(list.find(t => t.nombre?.toLowerCase() === docType?.toLowerCase() || t.id === docType) || null);
                } else {
                    // For a new Plantilla document, remain unselected so user picks from dropdown
                    setSelectedTemplate(null);
                }
            } catch (err) {
                console.error('Error loading templates:', err);
                setTemplates([]);
                setSelectedTemplate(null);
            }
        };
        loadTemplates();
    }, [isOpen, docType, initialData]);

    // Load active professionals
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const list = await getDoctorsList(userProfile, patient);
                setCatalogProfesionales(list);

                // Keep initialData professional ONLY if it is in the patient's linked professionals
                if (initialData?.profesional) {
                    const isAssigned = (list || []).some(p => {
                        const name = p.nombreCompleto || p.nombre || p.displayName || p.id || "";
                        return name.toLowerCase().trim() === initialData.profesional.toLowerCase().trim();
                    });
                    setProfesional(isAssigned ? initialData.profesional : "");
                } else {
                    setProfesional(prev => {
                        const isAssigned = (list || []).some(p => {
                            const name = p.nombreCompleto || p.nombre || p.displayName || p.id || "";
                            return name.toLowerCase().trim() === (prev || "").toLowerCase().trim();
                        });
                        return isAssigned ? prev : "";
                    });
                }
            } catch (err) {
                console.error("Error loading doctor catalog in modal", err);
            }
        };
        if (isOpen) loadCatalog();
    }, [isOpen, patient?.id, initialData]);

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
            if (field.visible === false) return; // Skip hidden fields configured by tenant
            const fLabel = field.fullLabel || field.label || field.editLabel || field.viewLabel || field.id;
            const val = valores?.[field.id] ?? valores?.[field.key];
            if (field.type === 'section') {
                lines.push(`\n── ${fLabel} ──`);
            } else if (field.type === 'checkbox' || field.type === 'toggle') {
                if (Array.isArray(val)) {
                    lines.push(`${fLabel}: ${val.length > 0 ? val.join(', ') : 'Ninguno'}`);
                } else {
                    lines.push(`${fLabel}: ${val ? 'SÍ' : 'NO'}`);
                }
            } else {
                if (val !== undefined && val !== null && val !== '') {
                    lines.push(`${fLabel}: ${val}`);
                }
            }
        });
        if (valores?.tercera_firma || valores?.terceraFirma) {
            lines.push(`Tercera firma: Habilitada`);
        }
        return lines.join('\n');
    };

    const handleSave = async (isFinalize = true) => {
        let finalContent = contenido;
        let diagVal = diagnostico;
        const isTemplateDoc = docType === 'Plantilla' || initialData?.isTemplateDoc;
        const isConsultaDoc = docType === 'Consulta' || initialData?.tipoDocumento === 'Consulta' || initialData?.tipo === 'Consulta';

        // 1. Validar profesional responsable u odontólogo obligatorio
        if (!profesional || !profesional.trim() || profesional.toLowerCase().includes('seleccione')) {
            toast.error("Debe seleccionar el profesional responsable (*)");
            return;
        }

        let finalAntecedentes = [...antecedentes];
        let finalAlergias = [...alergias];
        let finalAntFamiliares = [...antFamiliares];
        let finalMedicamentosPrev = [...medicamentosPrev];

        if (docType === 'Receta') {
            if (recetaItems.length === 0) {
                toast.error("Debe añadir al menos un medicamento a la receta (*)");
                return;
            }
            finalContent = generateContenidoSummary(recetaItems);
        } else if (isConsultaDoc) {
            // Automatically commit any temporary/pending inputs in Antecedentes tab before saving
            if (!antNoRefiere && tempAntCIE10) {
                finalAntecedentes.push({ ...tempAntCIE10, obs: tempAntObs });
                setAntecedentes(finalAntecedentes);
                setTempAntCIE10(null);
                setTempAntObs('');
            }

            if (!alerNoRefiere && tempAlerTipo) {
                finalAlergias.push({ tipo: tempAlerTipo, obs: tempAlerObs });
                setAlergias(finalAlergias);
                setTempAlerTipo('');
                setTempAlerObs('');
            }

            if (!famNoRefiere && tempFamParentesco && tempFamCIE10) {
                finalAntFamiliares.push({ parentesco: tempFamParentesco, ...tempFamCIE10, obs: tempFamObs });
                setAntFamiliares(finalAntFamiliares);
                setTempFamParentesco('');
                setTempFamCIE10(null);
                setTempFamObs('');
            }

            if (!medPrevNoRefiere && tempMedPrevItem) {
                const medName = typeof tempMedPrevItem === 'object' 
                    ? `${tempMedPrevItem.code ? `[${tempMedPrevItem.code}] ` : ''}${tempMedPrevItem.name || tempMedPrevItem.principioActivo || ''}`.trim() 
                    : String(tempMedPrevItem);
                finalMedicamentosPrev.push({ 
                    nombre: medName, 
                    obs: tempMedPrevObs.trim() 
                });
                setMedicamentosPrev(finalMedicamentosPrev);
                setTempMedPrevItem(null);
                setTempMedPrevObs('');
            }

            // Para finalizar la consulta sí es obligatorio el motivo de consulta; en proceso se usa default si está vacío
            const effectiveMotivo = motivoConsulta.trim() || (isFinalize ? '' : 'Consulta Odontológica en proceso');
            if (isFinalize && !effectiveMotivo) {
                toast.error("El motivo de consulta no puede estar vacío (*)");
                return;
            }

            let finalDxRelsConsulta = [...dxRelacionadosConsulta];
            if (tempDxRelConsultaCIE10) {
                finalDxRelsConsulta.push({ ...tempDxRelConsultaCIE10, obs: tempDxRelConsultaObs });
                setDxRelacionadosConsulta(finalDxRelsConsulta);
                setTempDxRelConsultaCIE10(null);
                setTempDxRelConsultaObs('');
            }

            finalContent = generateConsultaSummary(
                effectiveMotivo || 'Consulta Odontológica',
                enfermedadActual,
                finalAntecedentes,
                finalAlergias,
                finalAntFamiliares,
                finalMedicamentosPrev,
                examenOdonto,
                dxPrincipalConsulta,
                finalDxRelsConsulta,
                diagnosticoNotas,
                planTratamiento,
                recomendaciones
            );

            if (dxPrincipalConsulta) {
                diagVal = `${dxPrincipalConsulta.code} - ${dxPrincipalConsulta.name}`;
            }
        } else if (docType === 'Orden') {
            if (!tipoOrden || !tipoOrden.trim()) {
                toast.error("Debe seleccionar el tipo de orden (*)");
                return;
            }
            finalContent = generateOrdenSummary(tipoOrden, dxPrincipal, diagnosticosRelacionados, cupsItems, observacionesGenerales);
            if (dxPrincipal) diagVal = `${dxPrincipal.code} - ${dxPrincipal.name}`;
        } else if (isTemplateDoc) {
            if (!selectedTemplate && !contenido?.trim()) {
                toast.error("Debe seleccionar una plantilla (*)");
                return;
            }
            if (selectedTemplate) {
                if (selectedTemplate.campos && selectedTemplate.campos.length > 0) {
                    for (const field of selectedTemplate.campos) {
                        if (field.visible === false) continue;
                        if (field.required) {
                            const val = templateValues[field.id] ?? templateValues[field.key];
                            if (val === undefined || val === null || val === '' || (typeof val === 'string' && !val.trim())) {
                                toast.error(`El campo "${field.label || field.editLabel}" es obligatorio (*)`);
                                return;
                            }
                        }
                    }
                }
                finalContent = generateTemplateSummary(selectedTemplate.campos, templateValues);
                if (!finalContent || !finalContent.trim()) {
                    finalContent = `Documento generado a partir de la plantilla: ${selectedTemplate.nombre}`;
                }
            } else {
                finalContent = contenido;
            }
        }

        if (!finalContent.trim()) {
            toast.error("El contenido no puede estar vacío");
            return;
        }
        
        setSaving(true);
        try {
            const isEditing = !!(activeDocId || initialData?.id);
            const targetDocId = activeDocId || initialData?.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            const finalDocEstado = isConsultaDoc ? (isFinalize ? 'Finalizada' : 'En proceso') : (initialData?.estado || 'Finalizada');
            const finalDocFirmado = isConsultaDoc ? isFinalize : (isEditing ? (initialData.firmado ?? false) : false);

            const docTipo = isEditing 
                ? (initialData?.tipo || initialData?.tipoDocumento || docType) 
                : (isTemplateDoc && selectedTemplate ? selectedTemplate.nombre : docType);
            const docTitulo = isTemplateDoc && selectedTemplate 
                ? selectedTemplate.nombre 
                : (isConsultaDoc ? "Consulta Odontológica" : (docType || initialData?.tipoDocumento || "Documento Clínico"));
            const docTranscribe = isEditing 
                ? (initialData?.transcribe || initialData?.metadata?.transcribe || "Sistema") 
                : (userProfile?.nombreCompleto || userProfile?.nombre || "Sistema");
            const docCreadorId = isEditing 
                ? (initialData?.creadorId || initialData?.metadata?.creadorId || "") 
                : (userProfile?.uid || "");
            const docFechaIso = isEditing 
                ? (initialData?.fechaIso || initialData?.created_at || new Date().toISOString()) 
                : new Date().toISOString();

            const extraMetadata = {
                tipoDocumento: docTipo,
                titulo: docTitulo,
                profesional: profesional,
                transcribe: docTranscribe,
                creadorId: docCreadorId,
                diagnostico: diagVal,
                fechaIso: docFechaIso,
                estado: finalDocEstado,
                finalizado: isConsultaDoc ? isFinalize : true,
                firmado: finalDocFirmado,
                ...(isConsultaDoc && isFinalize && { fechaFinalizadaIso: new Date().toISOString() }),
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
                    asocConsultaId: asocConsultaId || null,
                    associatedConsulta: associatedConsulta || null
                }),
                ...(isTemplateDoc && {
                    isTemplateDoc: true,
                    templateId: selectedTemplate?.id || initialData?.templateId || null,
                    campos: selectedTemplate?.campos || initialData?.campos || [],
                    valoresCampos: templateValues
                }),
                ...(isConsultaDoc && {
                    estado: finalDocEstado,
                    finalizado: isFinalize,
                    firmado: finalDocFirmado,
                    motivoConsulta,
                    enfermedadActual,
                    antecedentes: finalAntecedentes,
                    antNoRefiere,
                    alergias: finalAlergias,
                    alerNoRefiere,
                    antFamiliares: finalAntFamiliares,
                    famNoRefiere,
                    medicamentosPrev: finalMedicamentosPrev,
                    medPrevNoRefiere,
                    examenOdontologico: examenOdonto,
                    dxPrincipalConsulta,
                    dxRelacionadosConsulta,
                    diagnosticoNotas,
                    planTratamiento,
                    recomendaciones,
                    pestanasMedicas: medicalTabValues
                })
            };

            const tenantId = userProfile?.inquilino || patient.tenant_id || userProfile?.tenant_id;

            // Enlazar firma digital y datos del doctor tratante
            const docProfIdentifier = profesional || (userProfile?.esDoctor ? userProfile?.nombreCompleto : "");
            const doctorData = await getDoctorSignatureAndData(docProfIdentifier, tenantId, userProfile);
            if (doctorData.isDoctor) {
                extraMetadata.isDoctor = true;
                extraMetadata.doctorSignature = doctorData.firma || null;
                extraMetadata.doctorRegistroMedico = doctorData.registroMedico || null;
                extraMetadata.doctorEspecialidad = doctorData.especialidad || null;
                extraMetadata.profesionalNombre = doctorData.nombreCompleto || profesional;
            }

            const dbPayload = {
                tenant_id: tenantId,
                paciente_id: patient.id,
                tipo: docTipo,
                titulo: docTitulo,
                contenido: finalContent,
                estado: finalDocEstado,
                firmado: finalDocFirmado,
                receta_items: docType === 'Receta' ? recetaItems : (initialData?.receta_items || null),
                metadata: extraMetadata,
                updated_at: new Date().toISOString()
            };

            let saveSuccess = false;

            // 1. Intentar guardar en la tabla documentos_clinicos si está disponible
            try {
                if (isEditing) {
                    let updateQuery = supabase
                        .from("documentos_clinicos")
                        .update(dbPayload);
                    updateQuery = initialData?.database_id
                        ? updateQuery.eq("id", initialData.database_id)
                        : updateQuery.eq("legacy_id", targetDocId);
                    const { error: updateErr } = await updateQuery;
                    if (!updateErr) saveSuccess = true;
                } else {
                    const { error: insertErr } = await supabase
                        .from("documentos_clinicos")
                        .insert([{ ...dbPayload, legacy_id: targetDocId, created_at: new Date().toISOString() }]);
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
                    id: targetDocId,
                    ...extraMetadata,
                    ...dbPayload,
                    tipoDocumento: docTipo,
                    estado: finalDocEstado,
                    finalizado: isConsultaDoc ? isFinalize : true,
                    firmado: finalDocFirmado,
                    recetaItems: docType === 'Receta' ? recetaItems : (initialData?.receta_items || []),
                    created_at: isEditing ? (initialData?.created_at || new Date().toISOString()) : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                // Si la tabla dedicada confirmó la escritura, el historial conserva
                // solo un índice liviano. El documento completo permanece en
                // documentos_clinicos y el bloque legacy sigue siendo el fallback.
                const historyDocRecord = saveSuccess ? {
                    id: targetDocId,
                    tipoDocumento: docTipo,
                    tipo: docTipo,
                    titulo: docTitulo,
                    estado: finalDocEstado,
                    finalizado: isConsultaDoc ? isFinalize : true,
                    firmado: finalDocFirmado,
                    created_at: isEditing ? (initialData?.created_at || new Date().toISOString()) : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                } : docRecord;

                let updatedDocs;
                if (isEditing) {
                    updatedDocs = currentDocs.map(d => (d.id === targetDocId ? historyDocRecord : d));
                    if (!updatedDocs.some(d => d.id === targetDocId)) {
                        updatedDocs.unshift(historyDocRecord);
                    }
                } else {
                    updatedDocs = [historyDocRecord, ...currentDocs];
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

            setActiveDocId(targetDocId);

            if (isConsultaDoc) {
                if (isFinalize) {
                    toast.success("Consulta Odontológica finalizada y cerrada exitosamente ✅");
                } else {
                    toast.success("Progreso de consulta guardado exitosamente ⏳");
                }
            } else {
                toast.success(`${docType || initialData?.tipoDocumento || "Documento"} guardado correctamente`);
            }

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

    const getMissingConsultaTabs = () => {
        const missing = [];
        // 1. Motivo
        if (!motivoConsulta || !motivoConsulta.trim()) {
            missing.push({ id: 'motivo', label: '1. Motivo de Consulta' });
        }
        // 2. Antecedentes
        const hasAntecedentes = antNoRefiere || alerNoRefiere || famNoRefiere || medPrevNoRefiere || 
            antecedentes.length > 0 || alergias.length > 0 || antFamiliares.length > 0 || medicamentosPrev.length > 0 || 
            !!tempAntCIE10 || !!tempAlerTipo || !!tempFamParentesco || !!tempMedPrevItem;
        if (!hasAntecedentes) {
            missing.push({ id: 'antecedentes', label: '2. Antecedentes' });
        }
        // 3. Examen Odontológico
        const hasExamen = examenOdonto && (
            !!examenOdonto.estadoGeneral ||
            !!examenOdonto.presionArterial?.trim() ||
            !!examenOdonto.frecuenciaCardiaca?.trim() ||
            !!examenOdonto.otrosSignos?.trim() ||
            !!examenOdonto.simetriaFacial ||
            !!examenOdonto.pielTejidos ||
            !!examenOdonto.ganglios ||
            !!examenOdonto.labios ||
            (examenOdonto.atmItems && examenOdonto.atmItems.length > 0) ||
            !!examenOdonto.atmOtros?.trim() ||
            !!examenOdonto.mucosaYugal ||
            !!examenOdonto.paladar ||
            !!examenOdonto.lengua ||
            !!examenOdonto.pisoBoca ||
            !!examenOdonto.glandulasSalivales ||
            !!examenOdonto.orofaringe ||
            (examenOdonto.encias && examenOdonto.encias.length > 0) ||
            !!examenOdonto.higieneOral ||
            !!examenOdonto.placaBacteriana ||
            !!examenOdonto.calculo ||
            !!examenOdonto.movilidadDental ||
            (examenOdonto.oclusionItems && examenOdonto.oclusionItems.length > 0) ||
            !!examenOdonto.oclusionObs?.trim() ||
            !!examenOdonto.hallazgosAdicionales?.trim()
        );
        if (!hasExamen) {
            missing.push({ id: 'examen', label: '3. Examen Odontológico' });
        }
        // 4. Diagnóstico
        const hasDiagnostico = !!(dxPrincipalConsulta || (diagnosticoNotas && diagnosticoNotas.trim()) || (dxRelacionadosConsulta && dxRelacionadosConsulta.length > 0));
        if (!hasDiagnostico) {
            missing.push({ id: 'diagnostico', label: '4. Diagnóstico' });
        }
        // 5. Plan de Tratamiento
        if (!planTratamiento || !planTratamiento.trim()) {
            missing.push({ id: 'plan', label: '5. Plan de Tratamiento' });
        }
        return missing;
    };

    const handleAttemptFinalize = () => {
        const isConsultaDoc = docType === 'Consulta' || initialData?.tipoDocumento === 'Consulta' || initialData?.tipo === 'Consulta';
        if (isConsultaDoc) {
            const missing = getMissingConsultaTabs();
            if (missing.length > 0) {
                setMissingConsultaTabs(missing);
                setConfirmFinalizeWithMissing(true);
                return;
            }
        }
        handleSave(true);
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
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${docType === 'Alerta' ? 'max-w-lg' : (docType === 'Plantilla' && !selectedTemplate && !initialData) ? 'max-w-lg' : (docType === 'Receta' || docType === 'Orden' || docType === 'Plantilla' || docType === 'Consulta' || initialData?.isTemplateDoc) ? 'max-w-3xl md:max-w-4xl' : 'max-w-2xl'} flex flex-col max-h-[90vh] overflow-hidden`}>
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-slate-800 tracking-tight">
                                {docType === 'Alerta' ? "Nueva alerta" : 
                                 docType === 'Consulta' ? (effectiveIsViewOnly ? "Detalle de Consulta Odontológica" : (initialData ? "Editar Consulta Odontológica" : "Consulta Odontológica")) :
                                 (docType === 'Plantilla' || initialData?.isTemplateDoc) ? 
                                    (effectiveIsViewOnly ? `Detalle de ${selectedTemplate?.nombre || initialData?.tipoDocumento}` : 
                                     (initialData ? `Editar ${initialData.tipoDocumento}` : `Nuevo documento: ${selectedTemplate?.nombre || "Plantilla clínica"}`)) :
                                 (effectiveIsViewOnly ? `Detalle de ${initialData?.tipoDocumento || docType}` : 
                                  (initialData ? `Editar ${initialData.tipoDocumento}` : `Nueva ${docType}`))}
                            </h2>
                            {docType === 'Consulta' && (
                                isClosedRecord ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide inline-flex items-center gap-1">
                                        <FiLock size={9} /> Finalizada
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide inline-flex items-center gap-1">
                                        <FiClock size={9} /> En proceso
                                    </span>
                                )
                            )}
                        </div>
                        {docType !== 'Alerta' && docType !== 'Plantilla' && (
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                <span>Pacientes</span> <span className="text-slate-350">-</span>
                                <span>Doc. Clínicos</span> <span className="text-slate-350">-</span>
                                <span className="text-indigo-600 font-black">{effectiveIsViewOnly ? "Detalle" : (docType === 'Consulta' ? (initialData ? "Editar Consulta Odontológica" : "Nueva Consulta Odontológica") : (initialData ? `Editar ${docType.toLowerCase()}` : `Nueva ${docType.toLowerCase()}`))}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!effectiveIsViewOnly && docType === 'Consulta' && (
                            <button 
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                className="px-4 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-full font-black text-[11px] uppercase tracking-wider shadow-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                title="Guardar avance actual"
                            >
                                <FiClock size={12} /> {saving ? "Guardando..." : "Guardar progreso"}
                            </button>
                        )}
                        {!effectiveIsViewOnly && docType !== 'Consulta' && (
                            <button 
                                onClick={() => handleSave(true)}
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

                {/* Banner de registro clínico cerrado */}
                {isClosedRecord && (
                    <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center gap-2 text-emerald-800 text-xs font-bold shrink-0">
                        <FiLock className="shrink-0 text-emerald-600" size={14} />
                        <span>Registro Clínico Cerrado: Esta consulta odontológica fue finalizada y se encuentra protegida contra modificaciones.</span>
                    </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar text-left">
                    
                    {/* General information blocks */}
                    {docType !== 'Receta' && (
                        <div className={`grid ${docType === 'Alerta' || docType === 'Consulta' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4 pb-4 border-b border-slate-100`}>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">
                                    Profesional Responsable *
                                </label>
                                <select 
                                    value={profesional}
                                    onChange={(e) => setProfesional(e.target.value)}
                                    disabled={isViewOnly}
                                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                >
                                    <option value="">Seleccione un profesional...</option>
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
                        ) : (docType === 'Alerta' || docType === 'Consulta') ? null : (
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
                            <div className="space-y-5">
                                {selectedTemplate.campos.filter(f => f.visible !== false).map(field => {
                                    const fieldKey = field.id || field.key;
                                    const labelText = field.fullLabel || field.label || field.editLabel || field.viewLabel || fieldKey;

                                    if (field.type === 'section') {
                                        return (
                                            <div key={fieldKey} className="flex items-center gap-3 pt-3 pb-1 border-b border-slate-100">
                                                <div className="h-px w-6 bg-blue-500" />
                                                <span className="text-[12px] font-black text-blue-600 uppercase tracking-widest">
                                                    {labelText}
                                                </span>
                                                <div className="h-px flex-1 bg-gradient-to-r from-blue-200 to-transparent" />
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={fieldKey} className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                                                {labelText}
                                                {field.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                                            </label>

                                            {(field.type === 'text' || field.type === 'input') && (
                                                <input
                                                    type="text"
                                                    value={templateValues[fieldKey] || ''}
                                                    onChange={e => setTemplateValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                    readOnly={isViewOnly}
                                                    placeholder="Escriba aquí..."
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all read-only:opacity-70"
                                                />
                                            )}

                                            {field.type === 'number' && (
                                                <input
                                                    type="number"
                                                    value={templateValues[fieldKey] || ''}
                                                    onChange={e => setTemplateValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                    readOnly={isViewOnly}
                                                    placeholder="0"
                                                    className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all read-only:opacity-70"
                                                />
                                            )}

                                            {field.type === 'date' && (
                                                <input
                                                    type="date"
                                                    value={templateValues[fieldKey] || ''}
                                                    onChange={e => setTemplateValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                    disabled={isViewOnly}
                                                    className="w-full sm:w-56 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all disabled:opacity-70"
                                                    max="9999-12-31"
                                                    min="1900-01-01"
                                                />
                                            )}

                                            {field.type === 'select' && (
                                                <select
                                                    value={templateValues[fieldKey] || ''}
                                                    onChange={e => setTemplateValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                    disabled={isViewOnly}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none disabled:opacity-70"
                                                >
                                                    <option value="">-- Seleccione una opción --</option>
                                                    {(field.options || []).map((op, i) => {
                                                        const optVal = typeof op === 'object' ? op.value : op;
                                                        const optLabel = typeof op === 'object' ? op.label : op;
                                                        return <option key={i} value={optVal}>{optLabel}</option>;
                                                    })}
                                                </select>
                                            )}

                                            {field.type === 'textarea' && (
                                                <textarea
                                                    value={templateValues[fieldKey] || ''}
                                                    onChange={e => setTemplateValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                    readOnly={isViewOnly}
                                                    rows={4}
                                                    placeholder="Escriba aquí el detalle..."
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all resize-y read-only:opacity-70"
                                                />
                                            )}

                                            {(field.type === 'checkbox' || field.type === 'toggle') && (
                                                (field.options && field.options.length > 0) ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                        {field.options.map((opt, oIdx) => {
                                                            const optVal = typeof opt === 'object' ? opt.value : opt;
                                                            const optLabel = typeof opt === 'object' ? opt.label : opt;
                                                            const currentArr = Array.isArray(templateValues[fieldKey])
                                                                ? templateValues[fieldKey]
                                                                : (templateValues[fieldKey] ? [templateValues[fieldKey]] : []);
                                                            const isChecked = currentArr.includes(optVal);
                                                            return (
                                                                <label
                                                                    key={oIdx}
                                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                                                        isChecked
                                                                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-2xs font-bold'
                                                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70 font-semibold'
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        disabled={isViewOnly}
                                                                        onChange={e => {
                                                                            const newArr = e.target.checked
                                                                                ? [...currentArr, optVal]
                                                                                : currentArr.filter(v => v !== optVal);
                                                                            setTemplateValues(prev => ({ ...prev, [fieldKey]: newArr }));
                                                                        }}
                                                                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                                    />
                                                                    <span className="text-xs uppercase tracking-wide">{optLabel}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-all select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!templateValues[fieldKey]}
                                                            disabled={isViewOnly}
                                                            onChange={e => setTemplateValues(prev => ({ ...prev, [fieldKey]: e.target.checked }))}
                                                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <span className="text-xs font-bold text-slate-700">{labelText}</span>
                                                    </label>
                                                )
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Tercera Firma Footer if enabled on template */}
                                {(selectedTemplate.terceraFirma || selectedTemplate.tercera_firma) && (
                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-wide block">Tercera Firma Autorizada</span>
                                            <span className="text-[11px] text-slate-400 font-medium">Habilitar firma de tutor, testigo o especialista</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={!!templateValues['tercera_firma']}
                                            onChange={e => setTemplateValues(prev => ({ ...prev, tercera_firma: e.target.checked }))}
                                            disabled={isViewOnly}
                                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                )}
                            </div>
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
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Profesional Responsable *</label>
                                    <select 
                                        value={profesional}
                                        onChange={(e) => setProfesional(e.target.value)}
                                        disabled={isViewOnly}
                                        className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl px-3 h-9 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Seleccione un profesional...</option>
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
                                                                        const validation = validateDoctorCanSign(userProfile, {
                                                                            profesional: formData?.profesional || initialData?.profesional,
                                                                            created_by: initialData?.created_by || initialData?.usuario_id
                                                                        });
                                                                        if (!validation.canSign) {
                                                                            toast.error(validation.message || "Sólo el doctor asociado a este documento puede firmar");
                                                                            return;
                                                                        }

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
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Diagnóstico Principal (CIE10)</label>
                                    
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
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
                                        {!isViewOnly && (
                                            <button
                                                type="button"
                                                onClick={handleOpenAsocConsulta}
                                                className="w-9 h-9 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm shrink-0"
                                                title="Asociar consulta"
                                            >
                                                <FiSearch size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Card de Consulta Asociada al estilo OralDrive */}
                                    {(associatedConsulta || asocConsultaId) && (
                                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/90 border border-slate-200 rounded-xl text-xs mt-1.5 shadow-sm animate-in fade-in duration-200">
                                            <div className="flex items-center gap-2 overflow-hidden text-slate-700">
                                                <span className="font-bold text-slate-800 shrink-0">Consulta</span>
                                                <span className="text-slate-600 truncate font-medium text-[11px]">
                                                    {associatedConsulta 
                                                        ? `${formatConsultaDate(associatedConsulta.fechaIso || associatedConsulta.created_at || associatedConsulta.date)} - ${getConsultaDoctor(associatedConsulta)}`
                                                        : 'Consulta asociada'
                                                    }
                                                </span>
                                            </div>
                                            {!isViewOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAssociatedConsulta(null);
                                                        setAsocConsultaId(null);
                                                        toast.success("Asociación de consulta eliminada");
                                                    }}
                                                    className="p-1.5 bg-[#e65353] hover:bg-rose-600 text-white rounded-lg transition-all active:scale-95 shrink-0 ml-2 cursor-pointer shadow-sm flex items-center justify-center"
                                                    title="Eliminar asociación de consulta"
                                                >
                                                    <FiTrash2 size={13} />
                                                </button>
                                            )}
                                        </div>
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
                        // ── Formulario estructurado de Consulta Odontológica ────────
                        <div className="space-y-0">
                            {/* Tabs */}
                            <div className="flex overflow-x-auto border-b border-slate-200 mb-6 gap-1 custom-scrollbar">
                                {[
                                    { id: 'motivo', label: '1. Motivo de Consulta' },
                                    { id: 'antecedentes', label: '2. Antecedentes' },
                                    { id: 'examen', label: '3. Examen Odontológico' },
                                    { id: 'diagnostico', label: '4. Diagnóstico' },
                                    { id: 'tratamiento', label: '5. Plan de Tratamiento' },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setConsultaTab(tab.id)}
                                        className={`px-4 py-3 text-[11px] font-black uppercase tracking-wider transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                                            consultaTab === tab.id
                                                ? 'border-[#8CC63F] text-[#8CC63F] bg-lime-50/50 rounded-t-xl font-black'
                                                : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-t-xl'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* TAB 1: MOTIVO DE CONSULTA */}
                            {consultaTab === 'motivo' && (
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                            Motivo de la consulta <span className="text-red-500 font-bold">*</span>
                                        </label>
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
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                            Enfermedad actual
                                        </label>
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
                            )}

                            {/* TAB 2: ANTECEDENTES */}
                            {consultaTab === 'antecedentes' && (
                                <div className="space-y-6">
                                    {/* 1. Médicos */}
                                    <div className="space-y-3 p-5 bg-slate-50/70 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Antecedentes Médicos</h4>
                                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
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
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Diagnóstico CIE-10</label>
                                                                <CIE10Search value={tempAntCIE10} onSelect={setTempAntCIE10} className="w-full" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Observación / Detalle</label>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Observación..."
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
                                                {antecedentes.length > 0 ? (
                                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                        <table className="w-full text-left text-xs">
                                                            <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Código</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Diagnóstico</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {antecedentes.map((a, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-3 py-2 font-bold text-slate-500 font-mono">{a.code}</td>
                                                                        <td className="px-3 py-2 font-bold text-slate-700 uppercase">{a.name}</td>
                                                                        <td className="px-3 py-2 text-slate-500">{a.obs || '-'}</td>
                                                                        <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setAntecedentes(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><FiTrash2 size={13} /></button>}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : isViewOnly ? (
                                                    <p className="text-xs text-slate-400 italic py-1">Sin antecedentes registrados</p>
                                                ) : null}
                                            </>
                                        )}
                                    </div>

                                    {/* 2. Alergias */}
                                    <div className="space-y-3 p-5 bg-slate-50/70 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Alergias</h4>
                                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
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
                                                                    {['Medicamento','Alimento','Ambiental','Látex','Anestésicos locales','Otro'].map(t => <option key={t} value={t}>{t}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Observación / Reacción</label>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Observación..."
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
                                                {alergias.length > 0 ? (
                                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                        <table className="w-full text-left text-xs">
                                                            <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Tipo</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {alergias.map((a, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-3 py-2 font-bold text-slate-700">{a.tipo}</td>
                                                                        <td className="px-3 py-2 text-slate-500">{a.obs || '-'}</td>
                                                                        <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setAlergias(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><FiTrash2 size={13} /></button>}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : isViewOnly ? (
                                                    <p className="text-xs text-slate-400 italic py-1">Sin alergias registradas</p>
                                                ) : null}
                                            </>
                                        )}
                                    </div>

                                    {/* 3. Familiares */}
                                    <div className="space-y-3 p-5 bg-slate-50/70 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Antecedentes Familiares</h4>
                                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
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
                                                                    <label className="text-[10px] font-bold text-slate-500 pl-0.5">Diagnóstico CIE-10</label>
                                                                    <CIE10Search value={tempFamCIE10} onSelect={setTempFamCIE10} className="w-full" />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Observación</label>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Observación..."
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
                                                {antFamiliares.length > 0 ? (
                                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                        <table className="w-full text-left text-xs">
                                                            <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Parentesco</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Código</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Diagnóstico</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {antFamiliares.map((f, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-3 py-2 font-bold text-slate-700">{f.parentesco}</td>
                                                                        <td className="px-3 py-2 font-bold text-slate-500 font-mono">{f.code}</td>
                                                                        <td className="px-3 py-2 font-bold text-slate-700 uppercase">{f.name}</td>
                                                                        <td className="px-3 py-2 text-slate-500">{f.obs || '-'}</td>
                                                                        <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setAntFamiliares(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><FiTrash2 size={13} /></button>}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : isViewOnly ? (
                                                    <p className="text-xs text-slate-400 italic py-1">Sin antecedentes familiares registrados</p>
                                                ) : null}
                                            </>
                                        )}
                                    </div>

                                    {/* 4. Medicamentos */}
                                    <div className="space-y-3 p-5 bg-slate-50/70 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Medicamentos en Uso</h4>
                                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
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
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Medicamento (DCI)</label>
                                                                <MedicamentoSearch 
                                                                    value={tempMedPrevItem} 
                                                                    onChange={setTempMedPrevItem} 
                                                                    disabled={isViewOnly} 
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-slate-500 pl-0.5">Dosis / Frecuencia / Observación</label>
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Dosis y observación..."
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
                                                                const medName = typeof tempMedPrevItem === 'object' 
                                                                    ? `${tempMedPrevItem.code ? `[${tempMedPrevItem.code}] ` : ''}${tempMedPrevItem.name || tempMedPrevItem.principioActivo || ''}`.trim() 
                                                                    : String(tempMedPrevItem);
                                                                setMedicamentosPrev(prev => [...prev, { 
                                                                    nombre: medName, 
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
                                                {medicamentosPrev.length > 0 ? (
                                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                        <table className="w-full text-left text-xs">
                                                            <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Medicamento</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {medicamentosPrev.map((m, i) => (
                                                                    <tr key={i}>
                                                                        <td className="px-3 py-2 font-bold text-slate-700">{m.nombre}</td>
                                                                        <td className="px-3 py-2 text-slate-500">{m.obs || '-'}</td>
                                                                        <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setMedicamentosPrev(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><FiTrash2 size={13} /></button>}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : isViewOnly ? (
                                                    <p className="text-xs text-slate-400 italic py-1">Sin medicamentos registrados</p>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: EXAMEN ODONTOLÓGICO ESTRUCTURADO */}
                            {consultaTab === 'examen' && (
                                <div className="space-y-6">
                                    {/* 1. Estado General / Signos Relevantes */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center text-[10px] font-black">1</span>
                                                Estado General / Signos Relevantes
                                                <span className="text-[10px] font-semibold text-slate-400 normal-case">(Opcionales)</span>
                                            </h4>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Estado general</label>
                                                <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                                                    {['Bueno', 'Regular', 'Malo'].map(opt => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            disabled={isViewOnly}
                                                            onClick={() => updateExamenOdonto('estadoGeneral', opt)}
                                                            className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                                                examenOdonto.estadoGeneral === opt
                                                                    ? opt === 'Bueno' ? 'bg-[#8CC63F] text-white shadow-xs' : opt === 'Regular' ? 'bg-amber-500 text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                    : 'text-slate-500 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Presión arterial</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        readOnly={isViewOnly}
                                                        placeholder="120/80"
                                                        value={examenOdonto.presionArterial}
                                                        onChange={e => updateExamenOdonto('presionArterial', e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 pr-12 h-9 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">mmHg</span>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Frecuencia cardíaca</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        readOnly={isViewOnly}
                                                        placeholder="75"
                                                        value={examenOdonto.frecuenciaCardiaca}
                                                        onChange={e => updateExamenOdonto('frecuenciaCardiaca', e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 pr-10 h-9 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">lpm</span>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Otros signos</label>
                                                <input
                                                    type="text"
                                                    readOnly={isViewOnly}
                                                    placeholder="Temperatura, saturación..."
                                                    value={examenOdonto.otrosSignos}
                                                    onChange={e => updateExamenOdonto('otrosSignos', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 h-9 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Examen Extraoral */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center text-[10px] font-black">2</span>
                                                Examen Extraoral
                                            </h4>
                                            {!isViewOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExamenOdonto(prev => ({
                                                            ...prev,
                                                            simetriaFacial: 'Normal', simetriaFacialObs: '',
                                                            pielTejidos: 'Normal', pielTejidosObs: '',
                                                            ganglios: 'Sin alteraciones', gangliosObs: '',
                                                            labios: 'Normal', labiosObs: ''
                                                        }));
                                                    }}
                                                    className="text-[11px] font-bold text-[#8CC63F] hover:underline cursor-pointer flex items-center gap-1"
                                                >
                                                    <FiCheck size={13} /> Marcar todo normal
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                            {/* Simetría facial */}
                                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold text-slate-700">Simetría facial</label>
                                                    <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                                        {['Normal', 'Alterada'].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => updateExamenOdonto('simetriaFacial', val)}
                                                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                                    examenOdonto.simetriaFacial === val
                                                                        ? val === 'Normal' ? 'bg-[#8CC63F] text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                            >
                                                                {val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly={isViewOnly}
                                                    placeholder="Observación..."
                                                    value={examenOdonto.simetriaFacialObs}
                                                    onChange={e => updateExamenOdonto('simetriaFacialObs', e.target.value)}
                                                    className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-500 ${examenOdonto.simetriaFacial === 'Alterada' ? 'border-rose-300 bg-rose-50/30' : ''}`}
                                                />
                                            </div>

                                            {/* Piel y tejidos faciales */}
                                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold text-slate-700">Piel y tejidos faciales</label>
                                                    <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                                        {['Normal', 'Alteración'].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => updateExamenOdonto('pielTejidos', val)}
                                                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                                    examenOdonto.pielTejidos === val
                                                                        ? val === 'Normal' ? 'bg-[#8CC63F] text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                            >
                                                                {val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly={isViewOnly}
                                                    placeholder="Observación..."
                                                    value={examenOdonto.pielTejidosObs}
                                                    onChange={e => updateExamenOdonto('pielTejidosObs', e.target.value)}
                                                    className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-500 ${examenOdonto.pielTejidos === 'Alteración' ? 'border-rose-300 bg-rose-50/30' : ''}`}
                                                />
                                            </div>

                                            {/* Ganglios / cadenas ganglionares */}
                                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold text-slate-700">Ganglios / cadenas</label>
                                                    <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                                        {['Sin alteraciones', 'Alterados'].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => updateExamenOdonto('ganglios', val)}
                                                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                                    examenOdonto.ganglios === val
                                                                        ? val === 'Sin alteraciones' ? 'bg-[#8CC63F] text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                            >
                                                                {val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly={isViewOnly}
                                                    placeholder="Observación..."
                                                    value={examenOdonto.gangliosObs}
                                                    onChange={e => updateExamenOdonto('gangliosObs', e.target.value)}
                                                    className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-500 ${examenOdonto.ganglios === 'Alterados' ? 'border-rose-300 bg-rose-50/30' : ''}`}
                                                />
                                            </div>

                                            {/* Labios */}
                                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold text-slate-700">Labios</label>
                                                    <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                                        {['Normal', 'Alterado'].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => updateExamenOdonto('labios', val)}
                                                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                                    examenOdonto.labios === val
                                                                        ? val === 'Normal' ? 'bg-[#8CC63F] text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                            >
                                                                {val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    readOnly={isViewOnly}
                                                    placeholder="Observación..."
                                                    value={examenOdonto.labiosObs}
                                                    onChange={e => updateExamenOdonto('labiosObs', e.target.value)}
                                                    className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-500 ${examenOdonto.labios === 'Alterado' ? 'border-rose-300 bg-rose-50/30' : ''}`}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Articulación Temporomandibular — ATM */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center text-[10px] font-black">3</span>
                                                    Articulación Temporomandibular — ATM
                                                </h4>
                                                <p className="text-[11px] text-slate-400 mt-0.5">Seleccione las alteraciones presentes en la evaluación articular</p>
                                            </div>
                                            {!isViewOnly && examenOdonto.atmItems.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => updateExamenOdonto('atmItems', [])}
                                                    className="text-[11px] font-bold text-slate-400 hover:text-rose-500 cursor-pointer"
                                                >
                                                    Limpiar alteraciones
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {[
                                                'Presencia de síntomas subjetivos',
                                                'Ruidos',
                                                'Dolor ATM',
                                                'Dolor muscular',
                                                'Desviaciones',
                                                'Limitación apertura',
                                                'Brinco',
                                                'Cambio de volumen',
                                                'Bloqueo mandibular',
                                                'Crepitación'
                                            ].map(item => {
                                                const active = examenOdonto.atmItems.includes(item);
                                                return (
                                                    <button
                                                        key={item}
                                                        type="button"
                                                        disabled={isViewOnly}
                                                        onClick={() => {
                                                            const newItems = active 
                                                                ? examenOdonto.atmItems.filter(i => i !== item)
                                                                : [...examenOdonto.atmItems, item];
                                                            updateExamenOdonto('atmItems', newItems);
                                                        }}
                                                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all flex items-start gap-2 select-none cursor-pointer ${
                                                            active 
                                                                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={active}
                                                            readOnly
                                                            className="mt-0.5 w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer pointer-events-none"
                                                        />
                                                        <span className="leading-tight">{item}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Otros hallazgos / Observaciones ATM</label>
                                            <input
                                                type="text"
                                                readOnly={isViewOnly}
                                                placeholder="Describa otros hallazgos en la ATM..."
                                                value={examenOdonto.atmOtros}
                                                onChange={e => updateExamenOdonto('atmOtros', e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 h-9 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* 4. Tejidos Blandos / Examen Intraoral */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center text-[10px] font-black">4</span>
                                                Tejidos Blandos / Examen Intraoral
                                            </h4>
                                            {!isViewOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExamenOdonto(prev => ({
                                                            ...prev,
                                                            mucosaYugal: 'Normal', mucosaYugalObs: '',
                                                            paladar: 'Normal', paladarObs: '',
                                                            lengua: 'Normal', lenguaObs: '',
                                                            pisoBoca: 'Normal', pisoBocaObs: '',
                                                            glandulasSalivales: 'Normal', glandulasSalivalesObs: '',
                                                            orofaringe: 'Normal', orofaringeObs: ''
                                                        }));
                                                    }}
                                                    className="text-[11px] font-bold text-[#8CC63F] hover:underline cursor-pointer flex items-center gap-1"
                                                >
                                                    <FiCheck size={13} /> Marcar todo normal
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                            {[
                                                { id: 'mucosaYugal', label: 'Mucosa yugal', optA: 'Normal', optB: 'Alterada', obsKey: 'mucosaYugalObs' },
                                                { id: 'paladar', label: 'Paladar', optA: 'Normal', optB: 'Alterado', obsKey: 'paladarObs' },
                                                { id: 'lengua', label: 'Lengua', optA: 'Normal', optB: 'Alterada', obsKey: 'lenguaObs' },
                                                { id: 'pisoBoca', label: 'Piso de boca', optA: 'Normal', optB: 'Alterado', obsKey: 'pisoBocaObs' },
                                                { id: 'glandulasSalivales', label: 'Glándulas salivales', optA: 'Normal', optB: 'Alteradas', obsKey: 'glandulasSalivalesObs' },
                                                { id: 'orofaringe', label: 'Orofaringe', optA: 'Normal', optB: 'Alterada', obsKey: 'orofaringeObs' },
                                            ].map(t => (
                                                <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold text-slate-700">{t.label}</label>
                                                        <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                                            {[t.optA, t.optB].map(val => (
                                                                <button
                                                                    key={val}
                                                                    type="button"
                                                                    disabled={isViewOnly}
                                                                    onClick={() => updateExamenOdonto(t.id, val)}
                                                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                                        examenOdonto[t.id] === val
                                                                            ? val === t.optA ? 'bg-[#8CC63F] text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                            : 'text-slate-500 hover:text-slate-800'
                                                                    }`}
                                                                >
                                                                    {val}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        readOnly={isViewOnly}
                                                        placeholder="Observación..."
                                                        value={examenOdonto[t.obsKey]}
                                                        onChange={e => updateExamenOdonto(t.obsKey, e.target.value)}
                                                        className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-500 ${examenOdonto[t.id] === t.optB ? 'border-rose-300 bg-rose-50/30' : ''}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 5. Periodonto */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                                        <div className="border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center text-[10px] font-black">5</span>
                                                Periodonto
                                            </h4>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Encías */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Encías (Selección múltiple)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Normales', 'Inflamadas', 'Sangrado', 'Recesión'].map(opt => {
                                                        const active = examenOdonto.encias.includes(opt);
                                                        return (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => {
                                                                    let newEnc;
                                                                    if (opt === 'Normales') {
                                                                        newEnc = ['Normales'];
                                                                    } else {
                                                                        const filtered = examenOdonto.encias.filter(e => e !== 'Normales');
                                                                        newEnc = active ? filtered.filter(e => e !== opt) : [...filtered, opt];
                                                                        if (newEnc.length === 0) newEnc = ['Normales'];
                                                                    }
                                                                    updateExamenOdonto('encias', newEnc);
                                                                }}
                                                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                                                    active 
                                                                        ? opt === 'Normales' ? 'bg-[#8CC63F] border-[#8CC63F] text-white shadow-xs' : 'bg-rose-500 border-rose-500 text-white shadow-xs'
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Higiene, Placa, Cálculo, Movilidad in a grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                {/* Higiene oral */}
                                                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Higiene oral</label>
                                                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg">
                                                        {['Buena', 'Regular', 'Deficiente'].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => updateExamenOdonto('higieneOral', val)}
                                                                className={`py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                                    examenOdonto.higieneOral === val
                                                                        ? val === 'Buena' ? 'bg-[#8CC63F] text-white shadow-xs' : val === 'Regular' ? 'bg-amber-500 text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                            >
                                                                {val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Placa bacteriana */}
                                                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Placa bacteriana</label>
                                                    <div className="grid grid-cols-4 gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                                                        {['Ausente', 'Leve', 'Moderada', 'Abundante'].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => updateExamenOdonto('placaBacteriana', val)}
                                                                className={`py-1 text-[10px] font-bold rounded-md transition-all truncate cursor-pointer ${
                                                                    examenOdonto.placaBacteriana === val
                                                                        ? val === 'Ausente' ? 'bg-[#8CC63F] text-white shadow-xs' : val === 'Leve' ? 'bg-blue-500 text-white shadow-xs' : val === 'Moderada' ? 'bg-amber-500 text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                                title={val}
                                                            >
                                                                {val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Cálculo */}
                                                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cálculo</label>
                                                    <div className="grid grid-cols-4 gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                                                        {['Ausente', 'Leve', 'Moderado', 'Abundante'].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => updateExamenOdonto('calculo', val)}
                                                                className={`py-1 text-[10px] font-bold rounded-md transition-all truncate cursor-pointer ${
                                                                    examenOdonto.calculo === val
                                                                        ? val === 'Ausente' ? 'bg-[#8CC63F] text-white shadow-xs' : val === 'Leve' ? 'bg-blue-500 text-white shadow-xs' : val === 'Moderado' ? 'bg-amber-500 text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                                title={val}
                                                            >
                                                                {val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Movilidad dental */}
                                                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Movilidad dental</label>
                                                    <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                                                        {['No', 'Sí'].map(val => (
                                                            <button
                                                                key={val}
                                                                type="button"
                                                                disabled={isViewOnly}
                                                                onClick={() => updateExamenOdonto('movilidadDental', val)}
                                                                className={`py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                                                    examenOdonto.movilidadDental === val
                                                                        ? val === 'No' ? 'bg-[#8CC63F] text-white shadow-xs' : 'bg-rose-500 text-white shadow-xs'
                                                                        : 'text-slate-500 hover:text-slate-800'
                                                                }`}
                                                            >
                                                                {val}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Otros hallazgos periodonto */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Otros hallazgos periodontales</label>
                                                <input
                                                    type="text"
                                                    readOnly={isViewOnly}
                                                    placeholder="Observaciones periodontales adicionales..."
                                                    value={examenOdonto.periodontoOtros}
                                                    onChange={e => updateExamenOdonto('periodontoOtros', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 h-9 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 6. Oclusión */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                                        <div className="border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center text-[10px] font-black">6</span>
                                                Oclusión
                                            </h4>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    'Normal',
                                                    'Maloclusión',
                                                    'Mordida abierta',
                                                    'Mordida profunda',
                                                    'Mordida cruzada',
                                                    'Desviación de línea media',
                                                    'Otros'
                                                ].map(opt => {
                                                    const active = examenOdonto.oclusionItems.includes(opt);
                                                    return (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            disabled={isViewOnly}
                                                            onClick={() => {
                                                                let newOclu;
                                                                if (opt === 'Normal') {
                                                                    newOclu = ['Normal'];
                                                                } else {
                                                                    const filtered = examenOdonto.oclusionItems.filter(o => o !== 'Normal');
                                                                    newOclu = active ? filtered.filter(o => o !== opt) : [...filtered, opt];
                                                                    if (newOclu.length === 0) newOclu = ['Normal'];
                                                                }
                                                                updateExamenOdonto('oclusionItems', newOclu);
                                                            }}
                                                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                                                active 
                                                                    ? opt === 'Normal' ? 'bg-[#8CC63F] border-[#8CC63F] text-white shadow-xs' : 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">Observaciones de oclusión</label>
                                                <input
                                                    type="text"
                                                    readOnly={isViewOnly}
                                                    placeholder="Observaciones de oclusión, guía anterior, relación molar..."
                                                    value={examenOdonto.oclusionObs}
                                                    onChange={e => updateExamenOdonto('oclusionObs', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 h-9 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 7. Hallazgos Clínicos Adicionales */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-3">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center text-[10px] font-black">7</span>
                                            Hallazgos Clínicos Adicionales
                                        </h4>
                                        <textarea
                                            rows={3}
                                            readOnly={isViewOnly}
                                            placeholder="Observaciones adicionales, hábitos, hallazgos radiográficos o clínicos relevantes..."
                                            value={examenOdonto.hallazgosAdicionales}
                                            onChange={e => updateExamenOdonto('hallazgosAdicionales', e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 resize-none transition-all read-only:opacity-75"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: DIAGNÓSTICO */}
                            {consultaTab === 'diagnostico' && (
                                <div className="space-y-6">
                                    {/* Diagnóstico Principal */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                                Diagnóstico Principal (CIE-10)
                                            </h4>
                                            {dxPrincipalConsulta && !isViewOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDxPrincipalConsulta(null)}
                                                    className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                                                >
                                                    Cambiar / Quitar
                                                </button>
                                            )}
                                        </div>

                                        {dxPrincipalConsulta ? (
                                            <div className="flex items-center justify-between p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black font-mono">
                                                        {dxPrincipalConsulta.code}
                                                    </span>
                                                    <span className="text-xs font-bold text-blue-900 uppercase">
                                                        {dxPrincipalConsulta.name}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                                                    Principal
                                                </span>
                                            </div>
                                        ) : (
                                            !isViewOnly ? (
                                                <div className="space-y-1">
                                                    <CIE10Search 
                                                        value={dxPrincipalConsulta} 
                                                        onSelect={setDxPrincipalConsulta} 
                                                        className="w-full" 
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Sin diagnóstico principal asignado</p>
                                            )
                                        )}
                                    </div>

                                    {/* Diagnósticos Relacionados */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-3">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                            Diagnósticos Relacionados (CIE-10)
                                        </h4>
                                        {!isViewOnly && (
                                            <div className="flex items-end gap-3">
                                                <div className="flex-1 space-y-2 text-left">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 pl-0.5">Buscar Diagnóstico Relacionado</label>
                                                        <CIE10Search value={tempDxRelConsultaCIE10} onSelect={setTempDxRelConsultaCIE10} className="w-full" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 pl-0.5">Observación / Tipo</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Observación o tipo de diagnóstico..."
                                                            value={tempDxRelConsultaObs}
                                                            onChange={e => setTempDxRelConsultaObs(e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 h-9 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        if (!tempDxRelConsultaCIE10) { toast.error('Seleccione un código CIE10'); return; }
                                                        setDxRelacionadosConsulta(prev => [...prev, { ...tempDxRelConsultaCIE10, obs: tempDxRelConsultaObs }]);
                                                        setTempDxRelConsultaCIE10(null); setTempDxRelConsultaObs('');
                                                    }} 
                                                    className="w-9 h-9 rounded-full bg-[#8CC63F] hover:bg-[#7bb335] text-white flex items-center justify-center shadow active:scale-95 transition-all cursor-pointer shrink-0 mb-1"
                                                    title="Agregar Diagnóstico Relacionado"
                                                >
                                                    <FiPlus size={18} />
                                                </button>
                                            </div>
                                        )}

                                        {dxRelacionadosConsulta.length > 0 ? (
                                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                <table className="w-full text-left text-xs">
                                                    <thead><tr className="bg-slate-50"><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Código</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Diagnóstico</th><th className="px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Observación</th><th className="px-3 py-2"></th></tr></thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {dxRelacionadosConsulta.map((d, i) => (
                                                            <tr key={i}>
                                                                <td className="px-3 py-2 font-bold text-slate-500 font-mono">{d.code}</td>
                                                                <td className="px-3 py-2 font-bold text-slate-700 uppercase">{d.name}</td>
                                                                <td className="px-3 py-2 text-slate-500">{d.obs || '-'}</td>
                                                                <td className="px-3 py-2 text-right">{!isViewOnly && <button type="button" onClick={() => setDxRelacionadosConsulta(prev => prev.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><FiTrash2 size={13} /></button>}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : isViewOnly ? (
                                            <p className="text-xs text-slate-400 italic py-1">Sin diagnósticos relacionados registrados</p>
                                        ) : null}
                                    </div>

                                    {/* Observaciones / Notas Diagnósticas */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                            Observaciones y Notas Diagnósticas
                                        </label>
                                        <textarea
                                            rows={3}
                                            readOnly={isViewOnly}
                                            placeholder="Pronóstico, hipótesis diagnósticas adicionales o comentarios del odontólogo..."
                                            value={diagnosticoNotas}
                                            onChange={e => setDiagnosticoNotas(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 resize-none transition-all read-only:opacity-75"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: PLAN DE TRATAMIENTO */}
                            {consultaTab === 'tratamiento' && (
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                            Plan de Tratamiento y Procedimientos
                                        </label>
                                        <textarea
                                            rows={5}
                                            readOnly={isViewOnly}
                                            placeholder="Detalle de los procedimientos a realizar por fases (Fase higiénica, operatoria, endodoncia, periodoncia, rehabilitación, etc.)..."
                                            value={planTratamiento}
                                            onChange={e => setPlanTratamiento(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 resize-none transition-all read-only:opacity-75"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                            Conducta y Recomendaciones al Paciente
                                        </label>
                                        <textarea
                                            rows={4}
                                            readOnly={isViewOnly}
                                            placeholder="Instrucciones de higiene oral, cuidados post-consulta, remisiones a especialidades, pautas o próximos controles..."
                                            value={recomendaciones}
                                            onChange={e => setRecomendaciones(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 resize-none transition-all read-only:opacity-75"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (docType === 'Plantilla' || initialData?.isTemplateDoc) ? null : (
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

                <div className="p-4 sm:p-6 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 flex-none">
                    <div>
                        {docType === 'Consulta' && !isClosedRecord && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold">
                                <FiClock size={12} /> Estado: En proceso
                            </span>
                        )}
                        {docType === 'Consulta' && isClosedRecord && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold">
                                <FiLock size={12} /> Registro Clínico Cerrado
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-full font-bold text-xs text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200 bg-white cursor-pointer">
                            {docType === 'Alerta' || effectiveIsViewOnly ? "Cerrar" : "Cancelar"}
                        </button>

                        {!effectiveIsViewOnly && docType === 'Consulta' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSave(false)}
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-full font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                    title="Guardar avance actual sin finalizar"
                                >
                                    <FiClock size={14} /> {saving ? "Guardando..." : "Guardar progreso"}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleAttemptFinalize}
                                    disabled={saving}
                                    className="px-6 sm:px-8 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/25 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                                >
                                    <FiCheckCircle size={16} /> {saving ? "Finalizando..." : "Finalizar Consulta Odontológica"}
                                </button>
                            </>
                        )}

                        {!effectiveIsViewOnly && docType !== 'Consulta' && (
                            <button onClick={() => handleSave(true)} disabled={saving} className="px-8 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer">
                                <FiCheck size={16} /> {saving ? "Guardando..." : (docType === 'Receta' ? "Guardar receta" : docType === 'Orden' ? "Guardar orden" : "Guardar")}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL DE CONFIRMACIÓN: FINALIZAR CON PESTAÑAS PENDIENTES */}
            {confirmFinalizeWithMissing && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                <FiAlertTriangle size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                    Pestañas pendientes por diligenciar
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                    Se detectaron secciones de la consulta sin completar.
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-2">
                            <p className="text-xs text-slate-700 font-medium">
                                Las siguientes pestañas no han sido diligenciadas:
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {missingConsultaTabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            setConfirmFinalizeWithMissing(false);
                                            setConsultaTab(tab.id);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                        title={`Ir a ${tab.label}`}
                                    >
                                        • {tab.label} <FiChevronRight size={12} className="text-amber-600" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            ¿Desea <strong>finalizar la consulta odontológica</strong> sin diligenciar estas secciones, o prefiere completarlas antes de cerrar el registro clínico?
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setConfirmFinalizeWithMissing(false);
                                    if (missingConsultaTabs.length > 0) {
                                        setConsultaTab(missingConsultaTabs[0].id);
                                    }
                                }}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-all cursor-pointer"
                            >
                                Completar {missingConsultaTabs[0]?.label || "pestaña"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setConfirmFinalizeWithMissing(false);
                                    handleSave(true);
                                }}
                                className="px-5 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
                            >
                                Sí, finalizar consulta
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                                        {formatConsultaDate(c.fechaIso || c.created_at || c.date) || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-700">{getConsultaDoctor(c)}</td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAsocConsultaId(c.id);
                                                                setAssociatedConsulta(c);
                                                                // Auto-fill dx principal if available in the consultation
                                                                if (c.metadata?.dxPrincipal) {
                                                                    setDxPrincipal(c.metadata.dxPrincipal);
                                                                } else if (c.dxPrincipal) {
                                                                    setDxPrincipal(c.dxPrincipal);
                                                                } else if (c.diagnostico && typeof c.diagnostico === 'string') {
                                                                    const parts = c.diagnostico.split(' - ');
                                                                    if (parts.length >= 2) {
                                                                        setDxPrincipal({ code: parts[0].trim(), name: parts.slice(1).join(' - ').trim() });
                                                                    } else {
                                                                        setDxPrincipal({ code: 'DX', name: c.diagnostico });
                                                                    }
                                                                } else if (c.antecedentes && c.antecedentes.length > 0) {
                                                                    setDxPrincipal({ code: c.antecedentes[0].code, name: c.antecedentes[0].name });
                                                                }
                                                                setAsocConsultaModal(false);
                                                                toast.success('Consulta asociada correctamente');
                                                            }}
                                                            className="p-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-lg transition-all cursor-pointer"
                                                            title="Seleccionar consulta"
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
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Procedimiento o Código (CUPS) *</label>
                                <CUPSSearch 
                                    value={selectedCups}
                                    onSelect={(item) => setSelectedCups(item)}
                                    placeholder="Buscar código o nombre del procedimiento (ej: 890201, 870112, hemograma...)"
                                    className="w-full"
                                />
                            </div>

                            {/* Observaciones */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Observaciones</label>
                                <textarea 
                                    rows={3}
                                    placeholder="Observaciones adicionales del procedimiento..."
                                    value={cupsObservaciones} 
                                    onChange={e => setCupsObservaciones(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#8CC63F] placeholder:text-slate-350 resize-none custom-scrollbar"
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
                                className="px-5 py-2.5 rounded-full font-bold text-xs text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
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
                                className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white text-xs font-black rounded-full uppercase tracking-wider shadow cursor-pointer transition-all active:scale-95"
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
