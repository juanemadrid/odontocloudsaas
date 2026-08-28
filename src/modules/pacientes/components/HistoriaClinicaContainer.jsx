import React, { useState, useEffect, useCallback } from "react";
import { 
    FiPrinter, 
    FiFileText, 
    FiPlus, 
    FiSearch, 
    FiEye, 
    FiEdit2, 
    FiTrash2, 
    FiDownload,
    FiPenTool,
    FiClock,
    FiLock
} from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { getAnamnesis } from "../../../services/clinicalService";
import { getDoctorSignatureAndData, validateDoctorCanSign } from "../../../services/doctorSignatureService";
const DocClinicoModal = React.lazy(() => import("./DocClinicoModal"));

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

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, 150);
};

export default function HistoriaClinicaContainer({ patient }) {
    const toast = useToast();
    const { userProfile } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [clinicConfig, setClinicConfig] = useState(null);

    useEffect(() => {
        if (!userProfile?.inquilino) return;
        const loadClinicConfig = async () => {
            try {
                const { data: tenantData } = await supabase
                    .from("tenants")
                    .select("*")
                    .eq("id", userProfile.inquilino)
                    .maybeSingle();
                if (tenantData) setClinicConfig(tenantData);
            } catch (err) {
                console.error("Error loading clinic config", err);
            }
        };
        loadClinicConfig();
    }, [userProfile?.inquilino]);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState("");
    const [editingDoc, setEditingDoc] = useState(null);
    const [isViewOnly, setIsViewOnly] = useState(false);
    
    // Filters state
    const [filterFecha, setFilterFecha] = useState("");
    const [filterTipo, setFilterTipo] = useState("");
    const [filterProf, setFilterProf] = useState("");
    const [filterTrans, setFilterTrans] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [signModal, setSignModal] = useState({ isOpen: false, doc: null });
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, docId: null });

    // Filter logic computed before print handlers
    const filteredDocs = documents.filter(d => {
        const dFecha = new Date(d.fechaIso).toLocaleDateString().toLowerCase();
        if (filterFecha && !dFecha.includes(filterFecha.toLowerCase())) return false;
        if (filterTipo && !d.tipoDocumento?.toLowerCase().includes(filterTipo.toLowerCase())) return false;
        if (filterProf && !d.profesional?.toLowerCase().includes(filterProf.toLowerCase())) return false;
        if (filterTrans && !d.transcribe?.toLowerCase().includes(filterTrans.toLowerCase())) return false;
        
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            const matchesTipo = d.tipoDocumento?.toLowerCase().includes(lowerTerm);
            const matchesProf = d.profesional?.toLowerCase().includes(lowerTerm);
            const matchesTrans = d.transcribe?.toLowerCase().includes(lowerTerm);
            const matchesContenido = d.contenido?.toLowerCase().includes(lowerTerm);
            const matchesDiagnostico = d.diagnostico?.toLowerCase().includes(lowerTerm);
            if (!matchesTipo && !matchesProf && !matchesTrans && !matchesContenido && !matchesDiagnostico) return false;
        }
        
        return true;
    });

    const handleSignPrescription = (docObj) => {
        setSignModal({ isOpen: true, doc: docObj });
    };

    const loadDocs = useCallback(async () => {
        if (!patient?.id) return;
        try {
            let tableDocs = [];
            try {
                const { data: docData, error } = await supabase
                    .from("documentos_clinicos")
                    .select("*")
                    .eq("paciente_id", patient.id)
                    .order("created_at", { ascending: false });
                if (!error && docData) {
                    tableDocs = docData;
                }
            } catch (e) {
                // Table direct read notice
            }

            let hmDocs = [];
            try {
                const { data: pData } = await supabase
                    .from("pacientes")
                    .select("historial_medico")
                    .eq("id", patient.id)
                    .maybeSingle();
                const hm = pData?.historial_medico || patient?.historial_medico;
                if (Array.isArray(hm?.documentosClinicos)) {
                    hmDocs = hm.documentosClinicos;
                }
            } catch (e) {
                if (Array.isArray(patient?.historial_medico?.documentosClinicos)) {
                    hmDocs = patient.historial_medico.documentosClinicos;
                }
            }

            const docMap = new Map();
            hmDocs.forEach(d => {
                if (d && d.id) docMap.set(String(d.id), d);
            });
            tableDocs.forEach(d => {
                if (d && d.id) {
                    const meta = d.metadata || {};
                    docMap.set(String(d.id), {
                        ...meta,
                        ...d,
                        id: d.legacy_id || d.id,
                        database_id: d.id,
                        motivoConsulta: meta.motivoConsulta || d.motivoConsulta || "",
                        enfermedadActual: meta.enfermedadActual || d.enfermedadActual || "",
                        antecedentes: meta.antecedentes || d.antecedentes || [],
                        antNoRefiere: meta.antNoRefiere ?? d.antNoRefiere ?? false,
                        alergias: meta.alergias || d.alergias || [],
                        alerNoRefiere: meta.alerNoRefiere ?? d.alerNoRefiere ?? false,
                        antFamiliares: meta.antFamiliares || d.antFamiliares || [],
                        famNoRefiere: meta.famNoRefiere ?? d.famNoRefiere ?? false,
                        medicamentosPrev: meta.medicamentosPrev || d.medicamentosPrev || [],
                        medPrevNoRefiere: meta.medPrevNoRefiere ?? d.medPrevNoRefiere ?? false,
                        tipoDocumento: meta.tipoDocumento || d.tipo || d.titulo || "Documento",
                        tipo: d.tipo || meta.tipoDocumento || d.titulo || "Documento",
                        recetaItems: d.receta_items || meta.recetaItems || [],
                        fechaIso: meta.fechaIso || d.created_at,
                        profesional: meta.profesional || meta.doctor || "",
                        transcribe: meta.transcribe || "",
                        diagnostico: meta.diagnostico || ""
                    });
                }
            });

            const parsedDocs = Array.from(docMap.values()).map(d => {
                const meta = d.metadata || {};
                return {
                    ...meta,
                    ...d,
                    motivoConsulta: d.motivoConsulta || meta.motivoConsulta || "",
                    enfermedadActual: d.enfermedadActual || meta.enfermedadActual || "",
                    antecedentes: d.antecedentes || meta.antecedentes || [],
                    antNoRefiere: d.antNoRefiere ?? meta.antNoRefiere ?? false,
                    alergias: d.alergias || meta.alergias || [],
                    alerNoRefiere: d.alerNoRefiere ?? meta.alerNoRefiere ?? false,
                    antFamiliares: d.antFamiliares || meta.antFamiliares || [],
                    famNoRefiere: d.famNoRefiere ?? meta.famNoRefiere ?? false,
                    medicamentosPrev: d.medicamentosPrev || meta.medicamentosPrev || [],
                    medPrevNoRefiere: d.medPrevNoRefiere ?? meta.medPrevNoRefiere ?? false,
                    tipoDocumento: d.tipoDocumento || meta.tipoDocumento || d.tipo || d.titulo || "Documento",
                    tipo: d.tipo || d.tipoDocumento || meta.tipoDocumento || d.titulo || "Documento",
                    recetaItems: d.receta_items || d.recetaItems || meta.recetaItems || [],
                    fechaIso: d.fechaIso || meta.fechaIso || d.created_at,
                    profesional: d.profesional || meta.profesional || meta.doctor || "",
                    transcribe: d.transcribe || meta.transcribe || "",
                    diagnostico: d.diagnostico || meta.diagnostico || ""
                };
            }).sort((a, b) => new Date(b.fechaIso || b.created_at || 0) - new Date(a.fechaIso || a.created_at || 0));

            setDocuments(parsedDocs);
        } catch (err) {
            console.error("Error loading clinical documents", err);
        }
    }, [patient?.id, patient?.historial_medico]);

    // Real-time synchronization / initial load of clinical documents
    useEffect(() => {
        loadDocs();
    }, [loadDocs]);

    const confirmSignPrescription = async () => {
        const docObj = signModal.doc;
        setSignModal({ isOpen: false, doc: null });
        if (!docObj) return;

        const validation = validateDoctorCanSign(userProfile, docObj);
        if (!validation.canSign) {
            toast.error(validation.message || "Sólo el doctor asociado a este documento puede firmar");
            return;
        }

        try {
            const updatedItems = (docObj.recetaItems || []).map(item => ({
                ...item,
                doctorSignature: userProfile?.nombreCompleto || userProfile?.nombre || "Doctor",
                signedAt: new Date().toISOString(),
                signedBy: userProfile?.uid
            }));
            
            // 1. Table update
            try {
                let updateQuery = supabase
                    .from("documentos_clinicos")
                    .update({
                        firmado: true,
                        receta_items: updatedItems,
                        metadata: {
                            ...(docObj.metadata || {}),
                            recetaItems: updatedItems,
                            firmado: true
                        },
                        updated_at: new Date().toISOString()
                    });
                updateQuery = docObj.database_id
                    ? updateQuery.eq("id", docObj.database_id)
                    : updateQuery.eq("legacy_id", docObj.id);
                await updateQuery;
            } catch (e) {
                // Table notice
            }

            // 2. Historial medico update
            try {
                const { data: pData } = await supabase
                    .from("pacientes")
                    .select("id, historial_medico")
                    .eq("id", patient.id)
                    .maybeSingle();
                const hm = pData?.historial_medico || patient?.historial_medico || {};
                const currentDocs = Array.isArray(hm.documentosClinicos) ? [...hm.documentosClinicos] : [];
                const updatedDocs = currentDocs.map(d => (d.id === docObj.id ? {
                    ...d,
                    firmado: true,
                    recetaItems: updatedItems,
                    metadata: { ...(d.metadata || {}), recetaItems: updatedItems, firmado: true }
                } : d));
                const newHM = { ...hm, documentosClinicos: updatedDocs };
                await supabase.from("pacientes").update({ historial_medico: newHM }).eq("id", patient.id);
                if (patient) patient.historial_medico = newHM;
            } catch (e) {
                console.warn("HM sign sync:", e);
            }

            toast.success("Receta firmada digitalmente ✅");
            loadDocs();
        } catch (err) {
            console.error("Error signing prescription", err);
            toast.error("Error al firmar la receta");
        }
    };

    const handleOpenModal = (tipo) => {
        setSelectedDocType(tipo);
        setEditingDoc(null);
        setIsViewOnly(false);
        setModalOpen(true);
    };

    const handleEditDoc = (doc) => {
        const isConsulta = (doc.tipoDocumento === 'Consulta' || doc.tipo === 'Consulta' || doc.titulo === 'Consulta Odontológica');
        const isClosed = isConsulta && (doc.estado === 'Finalizada' || doc.finalizado === true || doc.firmado === true || doc.metadata?.estado === 'Finalizada' || doc.metadata?.finalizado === true);
        
        if (isClosed) {
            toast.error("Esta consulta odontológica ya ha sido finalizada y no puede ser modificada (Registro Clínico Cerrado).");
            handleViewDoc(doc);
            return;
        }

        setEditingDoc(doc);
        setSelectedDocType(doc.tipoDocumento);
        setIsViewOnly(false);
        setModalOpen(true);
    };

    const handleViewDoc = (doc) => {
        setEditingDoc(doc);
        setSelectedDocType(doc.tipoDocumento);
        setIsViewOnly(true);
        setModalOpen(true);
    };

    const handleDeleteDoc = (docId) => {
        setDeleteModal({ isOpen: true, docId });
    };

    const confirmDeleteDoc = async () => {
        const docId = deleteModal.docId;
        setDeleteModal({ isOpen: false, docId: null });
        try {
            // 1. Table delete
            try {
                let deleteQuery = supabase
                    .from("documentos_clinicos")
                    .delete();
                const selectedDoc = documents.find(doc => doc.id === docId);
                deleteQuery = selectedDoc?.database_id
                    ? deleteQuery.eq("id", selectedDoc.database_id)
                    : deleteQuery.eq("legacy_id", docId);
                await deleteQuery;
            } catch (e) {
                // Table notice
            }

            // 2. Historial medico delete
            try {
                const { data: pData } = await supabase
                    .from("pacientes")
                    .select("id, historial_medico")
                    .eq("id", patient.id)
                    .maybeSingle();
                const hm = pData?.historial_medico || patient?.historial_medico || {};
                const currentDocs = Array.isArray(hm.documentosClinicos) ? [...hm.documentosClinicos] : [];
                const updatedDocs = currentDocs.filter(d => d.id !== docId);
                const newHM = { ...hm, documentosClinicos: updatedDocs };
                await supabase.from("pacientes").update({ historial_medico: newHM }).eq("id", patient.id);
                if (patient) patient.historial_medico = newHM;
            } catch (e) {
                console.warn("HM delete sync:", e);
            }

            toast.success("Documento eliminado correctamente");
            loadDocs();
        } catch (err) {
            console.error("Error deleting doc", err);
            toast.error("Error al eliminar el documento");
        }
    };

    const handlePrintDoc = async (doc) => {
        const logoUrl = clinicConfig?.logo || "";
        const clinicName = clinicConfig?.nombreComercial || clinicConfig?.nombre || clinicConfig?.name || "CLÍNICA DENTAL";
        const isTemplate = doc.isTemplateDoc || !["Receta", "Orden", "Consulta", "Alerta"].includes(doc.tipoDocumento);

        // Resolver la firma y datos del profesional tratante (solo si tiene rol de doctor)
        const docProfIdentifier = doc.profesional || doc.doctor || doc.firmadoPor || (userProfile?.esDoctor ? userProfile?.nombreCompleto : "");
        const doctorData = await getDoctorSignatureAndData(docProfIdentifier, userProfile?.inquilino, userProfile);

        let contentHtml = "";
        if (doc.tipoDocumento === "Receta") {
            const items = doc.recetaItems || [];
            contentHtml = `
                <div class="section-title">Detalle de Medicamentos (Recetados)</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 80px;">Tipo</th>
                            <th style="width: 110px;">Código CUM</th>
                            <th>Medicamento (Principio Activo)</th>
                            <th style="width: 100px;">Dosis</th>
                            <th style="width: 100px;">Vía</th>
                            <th style="width: 100px;">Frecuencia</th>
                            <th style="width: 100px;">Duración</th>
                            <th style="width: 60px;" class="text-center">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(it => `
                            <tr>
                                <td><span class="badge ${it.tipo === 'POS' ? 'pos' : 'nopos'}">${it.tipo || 'POS'}</span></td>
                                <td class="font-mono" style="font-size: 11px;">${it.codigo || '-'}</td>
                                <td><strong>${it.principioActivo || ''}</strong>${it.marca && it.marca !== '-' ? ` <span class="text-muted">(${it.marca})</span>` : ''}</td>
                                <td>${it.dosis || it.concentracion || ''}</td>
                                <td>${it.viaAdministracion || ''}</td>
                                <td>${it.frecuencia || ''}</td>
                                <td>${it.duracion || ''}</td>
                                <td class="text-center font-bold">${it.cantidad || ''}</td>
                            </tr>
                            ${it.recomendacion ? `<tr><td colspan="8" class="rec-row"><strong>Recomendaciones:</strong> ${it.recomendacion}</td></tr>` : ''}
                        `).join("")}
                    </tbody>
                </table>
            `;
        } else if (doc.tipoDocumento === "Orden") {
            const dxRel = doc.dxRelacionados || [];
            const cups = doc.cupsItems || [];
            contentHtml = `
                <div class="section-title">Detalle de la Orden Médica</div>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <div style="margin-bottom: 12px;">
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Tipo de Orden:</span>
                        <span style="font-size: 13px; font-weight: 700; color: #1e293b; margin-left: 6px;">${doc.tipoOrden || 'Orden Médica'}</span>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Diagnóstico Principal:</span>
                        <span style="font-size: 13px; font-weight: 600; color: #1e293b; margin-left: 6px;">${doc.dxPrincipal ? `${doc.dxPrincipal.code} - ${doc.dxPrincipal.name}` : 'No especificado'}</span>
                    </div>
                    ${dxRel.length > 0 ? `
                        <div style="margin-bottom: 12px;">
                            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Diagnósticos Relacionados:</span>
                            <div style="margin-top: 4px;">
                                ${dxRel.map(r => `<span class="badge pos" style="margin-right: 5px;">${r.code} - ${r.name}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                ${cups.length > 0 ? `
                    <div class="section-title">Procedimientos Solicitados / CUPS</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 100px;">Código CUPS</th>
                                <th>Nombre del Procedimiento</th>
                                <th>Observaciones / Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cups.map(c => `
                                <tr>
                                    <td class="font-mono" style="font-weight: 700;">${c.code}</td>
                                    <td><strong>${c.name}</strong></td>
                                    <td>${c.descripcion || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                ${doc.observacionesGenerales ? `
                    <div class="section-title" style="margin-top: 20px;">Observaciones Generales</div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 15px; font-size: 12px; color: #334155;">
                        ${doc.observacionesGenerales}
                    </div>
                ` : ''}
            `;
        } else if (doc.tipoDocumento === "Consulta" || doc.tipoDocumento === "Consulta Odontológica" || doc.tipo === "Consulta") {
            const meta = doc.metadata || doc;
            const anteced = meta.antecedentes || doc.antecedentes || [];
            const alergias = meta.alergias || doc.alergias || [];
            const antFam = meta.antFamiliares || doc.antFamiliares || [];
            const medPrev = meta.medicamentosPrev || doc.medicamentosPrev || [];
            const examen = meta.examenOdontologico || doc.examenOdontologico || {};
            const dxPrinc = meta.dxPrincipalConsulta || doc.dxPrincipalConsulta;
            const dxRels = meta.dxRelacionadosConsulta || doc.dxRelacionadosConsulta || [];

            contentHtml = `
                <div class="section-title">Registro de Consulta Odontológica</div>
                
                <!-- 1. Motivo de Consulta -->
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 18px;">
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">1. Motivo de Consulta</div>
                        <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 3px;">${meta.motivoConsulta || doc.motivoConsulta || 'No registrado'}</div>
                    </div>
                    ${(meta.enfermedadActual || doc.enfermedadActual) ? `
                        <div>
                            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Enfermedad Actual</div>
                            <div style="font-size: 12.5px; color: #334155; margin-top: 3px; white-space: pre-wrap;">${meta.enfermedadActual || doc.enfermedadActual}</div>
                        </div>
                    ` : ''}
                </div>

                <!-- 2. Antecedentes -->
                ${(anteced.length > 0 || alergias.length > 0 || antFam.length > 0 || medPrev.length > 0) ? `
                    <div class="section-title">2. Antecedentes Clínicos</div>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 18px;">
                        ${anteced.length > 0 ? `
                            <table>
                                <thead><tr><th style="width: 100px;">CIE-10</th><th>Antecedentes Médicos</th><th>Observación</th></tr></thead>
                                <tbody>
                                    ${anteced.map(a => `<tr><td class="font-mono" style="font-weight: 700;">${a.code}</td><td>${a.name}</td><td>${a.obs || '-'}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        ` : ''}
                        ${alergias.length > 0 ? `
                            <table>
                                <thead><tr><th style="width: 160px;">Tipo de Alergia</th><th>Observaciones / Reacción</th></tr></thead>
                                <tbody>
                                    ${alergias.map(al => `<tr><td><strong style="color: #ef4444;">${al.tipo}</strong></td><td>${al.obs || 'No detallada'}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        ` : ''}
                        ${antFam.length > 0 ? `
                            <table>
                                <thead><tr><th style="width: 120px;">Parentesco</th><th style="width: 90px;">CIE-10</th><th>Antecedente Familiar</th><th>Observación</th></tr></thead>
                                <tbody>
                                    ${antFam.map(f => `<tr><td><strong>${f.parentesco}</strong></td><td class="font-mono">${f.code}</td><td>${f.name}</td><td>${f.obs || '-'}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        ` : ''}
                        ${medPrev.length > 0 ? `
                            <table>
                                <thead><tr><th>Medicamentos en Uso</th><th>Dosis / Observación</th></tr></thead>
                                <tbody>
                                    ${medPrev.map(m => `<tr><td><strong>${m.nombre}</strong></td><td>${m.obs || '-'}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- 3. Examen Odontológico -->
                ${(examen && (typeof examen === 'object') && Object.keys(examen).length > 0) ? `
                    <div class="section-title">3. Examen Odontológico</div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 18px;">
                        
                        <!-- 1. Estado General -->
                        ${(examen.estadoGeneral || examen.presionArterial || examen.frecuenciaCardiaca || examen.otrosSignos) ? `
                            <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
                                <strong style="font-size: 11px; color: #475569; text-transform: uppercase;">1. Estado General / Signos:</strong>
                                <div style="font-size: 12px; color: #1e293b; margin-top: 3px;">
                                    ${examen.estadoGeneral ? `<strong>Estado:</strong> ${examen.estadoGeneral}` : ''}
                                    ${examen.presionArterial ? ` | <strong>PA:</strong> ${examen.presionArterial} mmHg` : ''}
                                    ${examen.frecuenciaCardiaca ? ` | <strong>FC:</strong> ${examen.frecuenciaCardiaca} lpm` : ''}
                                    ${examen.otrosSignos ? ` | <strong>Otros:</strong> ${examen.otrosSignos}` : ''}
                                </div>
                            </div>
                        ` : ''}

                        <!-- 2. Examen Extraoral -->
                        ${(examen.simetriaFacial || examen.pielTejidos || examen.ganglios || examen.labios) ? `
                            <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
                                <strong style="font-size: 11px; color: #475569; text-transform: uppercase;">2. Examen Extraoral:</strong>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #1e293b; margin-top: 3px;">
                                    <div><strong>Simetría:</strong> ${examen.simetriaFacial || 'Normal'} ${examen.simetriaFacialObs ? `<em>(${examen.simetriaFacialObs})</em>` : ''}</div>
                                    <div><strong>Piel y tejidos:</strong> ${examen.pielTejidos || 'Normal'} ${examen.pielTejidosObs ? `<em>(${examen.pielTejidosObs})</em>` : ''}</div>
                                    <div><strong>Ganglios:</strong> ${examen.ganglios || 'Sin alteraciones'} ${examen.gangliosObs ? `<em>(${examen.gangliosObs})</em>` : ''}</div>
                                    <div><strong>Labios:</strong> ${examen.labios || 'Normal'} ${examen.labiosObs ? `<em>(${examen.labiosObs})</em>` : ''}</div>
                                </div>
                            </div>
                        ` : ''}

                        <!-- 3. ATM -->
                        <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
                            <strong style="font-size: 11px; color: #475569; text-transform: uppercase;">3. Articulación Temporomandibular (ATM):</strong>
                            <div style="font-size: 12px; color: #1e293b; margin-top: 3px;">
                                ${(Array.isArray(examen.atmItems) && examen.atmItems.length > 0) 
                                    ? `<strong>Alteraciones:</strong> ${examen.atmItems.join(', ')}${examen.atmOtros ? ` | <em>Otros: ${examen.atmOtros}</em>` : ''}`
                                    : (examen.atm || 'Sin alteraciones aparentes')
                                }
                            </div>
                        </div>

                        <!-- 4. Tejidos Blandos / Intraoral -->
                        ${(examen.mucosaYugal || examen.paladar || examen.lengua || examen.pisoBoca || examen.glandulasSalivales || examen.orofaringe) ? `
                            <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
                                <strong style="font-size: 11px; color: #475569; text-transform: uppercase;">4. Tejidos Blandos / Intraoral:</strong>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #1e293b; margin-top: 3px;">
                                    <div><strong>Mucosa yugal:</strong> ${examen.mucosaYugal || 'Normal'} ${examen.mucosaYugalObs ? `<em>(${examen.mucosaYugalObs})</em>` : ''}</div>
                                    <div><strong>Paladar:</strong> ${examen.paladar || 'Normal'} ${examen.paladarObs ? `<em>(${examen.paladarObs})</em>` : ''}</div>
                                    <div><strong>Lengua:</strong> ${examen.lengua || 'Normal'} ${examen.lenguaObs ? `<em>(${examen.lenguaObs})</em>` : ''}</div>
                                    <div><strong>Piso de boca:</strong> ${examen.pisoBoca || 'Normal'} ${examen.pisoBocaObs ? `<em>(${examen.pisoBocaObs})</em>` : ''}</div>
                                    <div><strong>Glándulas salivales:</strong> ${examen.glandulasSalivales || 'Normal'} ${examen.glandulasSalivalesObs ? `<em>(${examen.glandulasSalivalesObs})</em>` : ''}</div>
                                    <div><strong>Orofaringe:</strong> ${examen.orofaringe || 'Normal'} ${examen.orofaringeObs ? `<em>(${examen.orofaringeObs})</em>` : ''}</div>
                                </div>
                            </div>
                        ` : ''}

                        <!-- 5. Periodonto -->
                        ${(examen.encias?.length > 0 || examen.higieneOral || examen.placaBacteriana || examen.calculo || examen.movilidadDental || examen.periodontoOtros) ? `
                            <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
                                <strong style="font-size: 11px; color: #475569; text-transform: uppercase;">5. Periodonto:</strong>
                                <div style="font-size: 12px; color: #1e293b; margin-top: 3px;">
                                    ${examen.encias?.length > 0 ? `<strong>Encías:</strong> ${examen.encias.join(', ')} | ` : ''}
                                    ${examen.higieneOral ? `<strong>Higiene:</strong> ${examen.higieneOral} | ` : ''}
                                    ${examen.placaBacteriana ? `<strong>Placa:</strong> ${examen.placaBacteriana} | ` : ''}
                                    ${examen.calculo ? `<strong>Cálculo:</strong> ${examen.calculo} | ` : ''}
                                    ${examen.movilidadDental ? `<strong>Movilidad:</strong> ${examen.movilidadDental} | ` : ''}
                                    ${examen.periodontoOtros ? `<strong>Otros:</strong> ${examen.periodontoOtros}` : ''}
                                </div>
                            </div>
                        ` : ''}

                        <!-- 6. Oclusión -->
                        ${(examen.oclusionItems?.length > 0 || examen.oclusionObs) ? `
                            <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
                                <strong style="font-size: 11px; color: #475569; text-transform: uppercase;">6. Oclusión:</strong>
                                <div style="font-size: 12px; color: #1e293b; margin-top: 3px;">
                                    ${examen.oclusionItems?.length > 0 ? `<strong>Tipo:</strong> ${examen.oclusionItems.join(', ')} ` : ''}
                                    ${examen.oclusionObs ? `<em>(Obs: ${examen.oclusionObs})</em>` : ''}
                                </div>
                            </div>
                        ` : ''}

                        <!-- 7. Hallazgos adicionales -->
                        ${examen.hallazgosAdicionales ? `
                            <div>
                                <strong style="font-size: 11px; color: #475569; text-transform: uppercase;">7. Hallazgos Adicionales:</strong>
                                <div style="font-size: 12px; color: #1e293b; margin-top: 3px; white-space: pre-wrap;">${examen.hallazgosAdicionales}</div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- 4. Diagnóstico -->
                ${(dxPrinc || dxRels.length > 0 || meta.diagnosticoNotas || doc.diagnosticoNotas) ? `
                    <div class="section-title">4. Diagnóstico</div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 18px;">
                        ${dxPrinc ? `
                            <div style="margin-bottom: 10px;">
                                <span style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase;">Principal:</span>
                                <strong style="font-size: 12.5px; color: #1e293b; margin-left: 6px;">[${dxPrinc.code}] ${dxPrinc.name}</strong>
                            </div>
                        ` : ''}
                        ${dxRels.length > 0 ? `
                            <div style="margin-bottom: 10px;">
                                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Relacionados:</div>
                                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #334155;">
                                    ${dxRels.map(r => `<li><strong>[${r.code}]</strong> ${r.name} ${r.obs ? `<em>(${r.obs})</em>` : ''}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${(meta.diagnosticoNotas || doc.diagnosticoNotas) ? `
                            <div style="font-size: 12px; color: #475569; margin-top: 6px; font-style: italic;">
                                <strong>Notas:</strong> ${meta.diagnosticoNotas || doc.diagnosticoNotas}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- 5. Plan de Tratamiento -->
                ${(meta.planTratamiento || doc.planTratamiento || meta.recomendaciones || doc.recomendaciones) ? `
                    <div class="section-title">5. Plan de Tratamiento y Recomendaciones</div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 18px;">
                        ${(meta.planTratamiento || doc.planTratamiento) ? `
                            <div style="margin-bottom: 12px;">
                                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Procedimientos y Plan de Tratamiento</div>
                                <div style="font-size: 12.5px; color: #1e293b; margin-top: 3px; white-space: pre-wrap;">${meta.planTratamiento || doc.planTratamiento}</div>
                            </div>
                        ` : ''}
                        ${(meta.recomendaciones || doc.recomendaciones) ? `
                            <div>
                                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Conducta y Recomendaciones</div>
                                <div style="font-size: 12.5px; color: #334155; margin-top: 3px; white-space: pre-wrap;">${meta.recomendaciones || doc.recomendaciones}</div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Fallback content if everything else was empty -->
                ${(!meta.motivoConsulta && !doc.motivoConsulta && doc.contenido) ? `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-size: 12.5px; line-height: 1.6; white-space: pre-wrap;">
                        ${doc.contenido}
                    </div>
                ` : ''}
            `;
        } else {
            contentHtml = `
                <div class="section-title">${isTemplate ? (doc.nombrePlantilla || doc.tipoDocumento) : `Detalle de ${doc.tipoDocumento}`}</div>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; font-size: 12.5px; line-height: 1.6; white-space: pre-wrap; color: #334155;">
                    ${doc.contenido || 'Sin contenido registrado'}
                </div>
            `;
        }

        const html = `
            <html>
            <head>
                <title>${doc.tipoDocumento} - ${patient.nombreCompleto || ''}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #1e293b;
                        padding: 30px;
                        max-width: 850px;
                        margin: 0 auto;
                        line-height: 1.5;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #2563eb;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                        gap: 20px;
                    }
                    .logo-area {
                        display: flex;
                        justify-content: flex-start;
                        align-items: center;
                        max-width: 50%;
                    }
                    .logo-text {
                        font-size: 22px;
                        font-weight: 800;
                        color: #2563eb;
                        letter-spacing: -0.04em;
                        text-transform: uppercase;
                        line-height: 1;
                    }
                    .doc-title {
                        text-align: right;
                        max-width: 50%;
                    }
                    .doc-title h1 {
                        font-size: 18px;
                        font-weight: 800;
                        text-transform: uppercase;
                        margin: 0;
                        color: #1e3a8a;
                        letter-spacing: 0.02em;
                    }
                    .doc-title p {
                        font-size: 9px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                        margin: 4px 0 0 0;
                        letter-spacing: 0.15em;
                    }
                    .patient-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 16px 20px;
                        margin-bottom: 25px;
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 12px;
                    }
                    .info-group {
                        padding: 6px 10px;
                        background: #ffffff;
                        border-radius: 8px;
                        border: 1px solid #f1f5f9;
                    }
                    .info-label {
                        font-size: 8px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #94a3b8;
                        letter-spacing: 0.05em;
                        margin-bottom: 3px;
                    }
                    .info-value {
                        font-size: 11.5px;
                        font-weight: 600;
                        color: #1e293b;
                    }
                    .section-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #1e3a8a;
                        letter-spacing: 0.08em;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 5px;
                        margin-top: 25px;
                        margin-bottom: 12px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 8px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    th {
                        background: #f8fafc;
                        font-size: 9px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #475569;
                        letter-spacing: 0.05em;
                        padding: 8px 12px;
                        text-align: left;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    td {
                        padding: 9px 12px;
                        font-size: 11.5px;
                        color: #334155;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    tr:last-child td { border-bottom: none; }
                    .badge {
                        display: inline-block;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        font-weight: 800;
                    }
                    .badge.pos { background: #dcfce7; color: #166534; }
                    .badge.nopos { background: #fee2e2; color: #991b1b; }
                    .font-mono { font-family: monospace; }
                    .text-center { text-align: center; }
                    .rec-row { background: #fdfce7; font-size: 10.5px; color: #854d0e; }
                    @media print {
                        body { padding: 15px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-area">
                        ${logoUrl 
                            ? `<img src="${logoUrl}" style="max-height: 60px; max-width: 250px; object-fit: contain;" />`
                            : `<div class="logo-text">${clinicName.toUpperCase()}</div>`
                        }
                    </div>
                    <div class="doc-title">
                        <h1>${isTemplate ? (doc.nombrePlantilla || doc.tipoDocumento) : doc.tipoDocumento}</h1>
                        <p>Documento Clínico Oficial</p>
                    </div>
                </div>

                <div class="patient-card">
                    <div class="info-group">
                        <div class="info-label">Nombre Completo</div>
                        <div class="info-value">${patient.nombreCompleto || ''}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Identificación</div>
                        <div class="info-value">${patient.tipoDocumento || 'C.C.'} ${patient.nroDocumento || ''}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Nro. Historia</div>
                        <div class="info-value">#${patient.nroHistoria || 'S/N'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Fecha</div>
                        <div class="info-value">${new Date(doc.fechaIso).toLocaleDateString('es-CO')}</div>
                    </div>
                </div>

                ${contentHtml}

                <div class="footer-sig" style="margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px;">
                    <div class="sig-block" style="flex: 1; min-width: 200px; text-align: center; font-size: 11px;">
                        <div style="height: 65px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;">
                            ${(doctorData.isDoctor && doctorData.firma) ? `<img src="${doctorData.firma}" style="max-height: 60px; max-width: 200px; object-fit: contain;" />` : ''}
                        </div>
                        <div class="sig-line" style="border-top: 1.5px solid #64748b; margin-bottom: 5px;"></div>
                        <div class="sig-title" style="font-weight: 800; color: #0f172a; font-size: 12px; text-transform: uppercase;">
                            ${doctorData.nombreCompleto || doc.profesional || 'Doctor Tratante'}
                        </div>
                        <div class="sig-subtitle" style="color: #64748b; font-size: 9.5px; text-transform: uppercase; font-weight: 700;">
                            ${doctorData.especialidad ? `${doctorData.especialidad} — ` : ''}Profesional Tratante
                        </div>
                        ${doctorData.registroMedico ? `
                            <div style="color: #475569; font-size: 9px; font-weight: 600; margin-top: 2px;">
                                T.P. / Registro Médico: ${doctorData.registroMedico}
                            </div>
                        ` : ''}
                    </div>
                    
                    ${doc.terceraFirma ? `
                    <div class="sig-block" style="flex: 1; min-width: 180px; text-align: center; font-size: 11px;">
                        <div style="height: 65px;"></div>
                        <div class="sig-line" style="border-top: 1.5px solid #64748b; margin-bottom: 5px;"></div>
                        <div class="sig-title" style="font-weight: 800; color: #0f172a; font-size: 12px; text-transform: uppercase;">${patient.nombreCompleto || ''}</div>
                        <div class="sig-subtitle" style="color: #64748b; font-size: 9.5px; text-transform: uppercase; font-weight: 700;">Paciente / Aceptante</div>
                        <div style="color: #475569; font-size: 9px; font-weight: 600; margin-top: 2px;">Doc: ${patient.tipoDocumento || 'C.C.'} ${patient.nroDocumento || ''}</div>
                    </div>
                    ` : ''}

                    <div class="sig-block" style="flex: 1; min-width: 180px; text-align: center; font-size: 11px;">
                        <div style="height: 65px;"></div>
                        <div class="sig-line" style="border-top: 1.5px solid #64748b; margin-bottom: 5px;"></div>
                        <div class="sig-title" style="font-weight: 800; color: #0f172a; font-size: 12px; text-transform: uppercase;">${doc.transcribe || ''}</div>
                        <div class="sig-subtitle" style="color: #64748b; font-size: 9.5px; text-transform: uppercase; font-weight: 700;">Transcriptor / Auxiliar</div>
                    </div>
                </div>
            </body>
            </html>
        `;

        printHTMLInHiddenIframe(html);
    };

    const handlePrintFullHistory = async () => {
        toast.info("Generando historia clínica completa para impresión...");
        let anamnesis = {};
        try {
            anamnesis = await getAnamnesis(patient.id);
        } catch (e) {
            console.error("Error fetching anamnesis for print", e);
        }

        const logoUrl = clinicConfig?.logo || "";
        const clinicName = clinicConfig?.nombreComercial || clinicConfig?.nombre || clinicConfig?.name || "CLÍNICA DENTAL";

        const html = `
            <html>
            <head>
                <title>Historia Clínica - ${patient.nombreCompleto || ''}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #1e293b;
                        padding: 30px;
                        max-width: 850px;
                        margin: 0 auto;
                        line-height: 1.5;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 4px solid #2563eb;
                        padding-bottom: 25px;
                        margin-bottom: 30px;
                        gap: 20px;
                    }
                    .logo-container {
                        display: flex;
                        gap: 25px;
                        align-items: center;
                    }
                    .logo-text-placeholder {
                        width: 80px;
                        height: 80px;
                        background: #2563eb;
                        border-radius: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 36px;
                        font-weight: 900;
                        text-transform: uppercase;
                    }
                    .clinic-title {
                        margin: 0;
                        font-size: 24px;
                        font-weight: 900;
                        color: #0f172a;
                        text-transform: uppercase;
                        letter-spacing: -1px;
                    }
                    .clinic-meta {
                        margin: 2px 0;
                        font-size: 12px;
                        color: #64748b;
                        font-weight: 500;
                    }
                    .doc-info {
                        text-align: right;
                    }
                    .doc-badge {
                        background: #eff6ff;
                        padding: 12px 20px;
                        border-radius: 16px;
                        border: 2px solid #dbeafe;
                        margin-bottom: 8px;
                        display: inline-block;
                    }
                    .doc-badge span {
                        font-size: 16px;
                        font-weight: 900;
                        color: #1d4ed8;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .doc-meta {
                        margin: 0;
                        font-size: 11px;
                        color: #94a3b8;
                        font-weight: 900;
                        text-transform: uppercase;
                    }
                    .patient-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 16px 20px;
                        margin-bottom: 25px;
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 12px;
                    }
                    .info-group {
                        padding: 6px 10px;
                        background: #ffffff;
                        border-radius: 8px;
                        border: 1px solid #f1f5f9;
                    }
                    .info-label {
                        font-size: 8px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #94a3b8;
                        letter-spacing: 0.05em;
                        margin-bottom: 3px;
                    }
                    .info-value {
                        font-size: 11.5px;
                        font-weight: 600;
                        color: #1e293b;
                    }
                    .section-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #1e3a8a;
                        letter-spacing: 0.08em;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 5px;
                        margin-top: 30px;
                        margin-bottom: 15px;
                    }
                    .document-item {
                        border: 1px solid #e2e8f0;
                        border-left: 4px solid #2563eb;
                        border-radius: 8px;
                        padding: 15px 18px;
                        margin-bottom: 15px;
                        background: #ffffff;
                        page-break-inside: avoid;
                    }
                    .document-header {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                        font-weight: 700;
                        border-bottom: 1px solid #f1f5f9;
                        padding-bottom: 6px;
                        margin-bottom: 10px;
                        color: #475569;
                    }
                    .document-type {
                        color: #2563eb;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .document-body {
                        font-size: 11.5px;
                        color: #334155;
                        line-height: 1.45;
                        white-space: pre-wrap;
                    }
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    .receta-table th {
                        background: #f8fafc;
                        font-size: 9px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #475569;
                        letter-spacing: 0.05em;
                        padding: 8px 10px;
                        text-align: left;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .receta-table td {
                        padding: 8px 10px;
                        font-size: 11px;
                        color: #334155;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .receta-table tr:last-child td {
                        border-bottom: none;
                    }
                    @media print {
                        body { padding: 15px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-container">
                        ${logoUrl 
                            ? `<img src="${logoUrl}" style="max-height: 75px; max-width: 150px; object-fit: contain;" />`
                            : `<div class="logo-text-placeholder">${clinicName.substring(0, 1) || "O"}</div>`
                        }
                        <div>
                            <h1 class="clinic-title">${clinicName}</h1>
                            <p class="clinic-meta" style="font-weight: 800;">NIT: ${clinicConfig?.nit || "—"}</p>
                            <p class="clinic-meta">${clinicConfig?.address || clinicConfig?.direccion || "—"}</p>
                            <p class="clinic-meta">TEL: ${clinicConfig?.phone || clinicConfig?.telefono || "—"} | ${clinicConfig?.email || ""}</p>
                        </div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-badge">
                            <span>Historia Clínica</span>
                        </div>
                        <p class="doc-meta">Expediente Completo</p>
                    </div>
                </div>

                <div class="patient-card">
                    <div class="info-group">
                        <div class="info-label">Nombre Completo</div>
                        <div class="info-value">${patient.nombreCompleto || ''}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Identificación</div>
                        <div class="info-value">${patient.tipoDocumento || 'C.C.'} ${patient.nroDocumento || ''}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Nro. Historia</div>
                        <div class="info-value">#${patient.nroHistoria || 'S/N'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Celular</div>
                        <div class="info-value">${patient.celular || 'No registrado'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Correo Electrónico</div>
                        <div class="info-value">${patient.email || 'No registrado'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Edad</div>
                        <div class="info-value">${patient.edad || 'No registrada'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">EPS</div>
                        <div class="info-value">${patient.nombreEps || 'Particular'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Tipo Vinculación</div>
                        <div class="info-value">${patient.tipoVinculacion || 'N/A'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Fecha de Ingreso</div>
                        <div class="info-value">${patient.fechaIngreso || 'No registrada'}</div>
                    </div>
                </div>

                <div class="section-title">Anamnesis y Antecedentes</div>
                <div class="anamnesis-grid">
                    <div class="anamnesis-item">
                        <div class="anamnesis-title">Diagnóstico Principal (CIE-10)</div>
                        <div class="anamnesis-content">${anamnesis.diagnosticoPrincipal || 'Ninguno'}</div>
                    </div>
                    <div class="anamnesis-item">
                        <div class="anamnesis-title">Motivo de Consulta</div>
                        <div class="anamnesis-content">${anamnesis.motivoConsulta || 'No registrado'}</div>
                    </div>
                    <div class="anamnesis-item">
                        <div class="anamnesis-title">Antecedentes Médicos</div>
                        <div class="anamnesis-content">${anamnesis.antecedentes || 'No registrados'}</div>
                    </div>
                    <div class="anamnesis-item">
                        <div class="anamnesis-title">Alergias</div>
                        <div class="anamnesis-content">${anamnesis.alergias || 'No registradas'}</div>
                    </div>
                    <div class="anamnesis-item">
                        <div class="anamnesis-title">Medicamentos Actuales</div>
                        <div class="anamnesis-content">${anamnesis.medicamentos || 'No registrados'}</div>
                    </div>
                    <div class="anamnesis-item">
                        <div class="anamnesis-title">Notas Adicionales</div>
                        <div class="anamnesis-content">${anamnesis.notas || 'Ninguna'}</div>
                    </div>
                </div>

                <div class="section-title">Evoluciones y Documentos Clínicos</div>
                ${documents.length === 0 ? `
                    <p style="font-size: 13px; color: #64748b; font-style: italic;">No se registran documentos clínicos en el historial.</p>
                ` : documents.map(d => `
                    <div class="document-item">
                        <div class="document-header">
                            <div>
                                <span class="document-type">${d.tipoDocumento}</span>
                                <span style="color: #94a3b8; margin: 0 8px;">|</span>
                                <span>Dr(a). ${d.profesional || ''}</span>
                            </div>
                            <div style="color: #64748b;">
                                ${new Date(d.fechaIso).toLocaleString('es-ES')}
                            </div>
                        </div>
                        <div class="document-body">
                            ${d.tipoDocumento === 'Receta' ? `
                                <table class="receta-table">
                                    <thead>
                                        <tr>
                                            <th>Principio Activo</th>
                                            <th>Dosis</th>
                                            <th>Frecuencia</th>
                                            <th>Vía</th>
                                            <th>Duración</th>
                                            <th>Cant.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(d.recetaItems || []).map(it => `
                                            <tr>
                                                <td><strong>${it.principioActivo}</strong>${it.marca && it.marca !== '-' ? ` (${it.marca})` : ''}</td>
                                                <td>${it.dosis}</td>
                                                <td>${it.frecuencia}</td>
                                                <td>${it.viaAdministracion}</td>
                                                <td>${it.duracion}</td>
                                                <td>${it.cantidad}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : (d.contenido || '').replace(/\n/g, '<br/>')}
                        </div>
                    </div>
                `).join('')}

            </body>
            </html>
        `;

        printHTMLInHiddenIframe(html);
    };

    const handlePrintPartial = () => {
        const logoUrl = clinicConfig?.logo || "";
        const clinicName = clinicConfig?.nombreComercial || clinicConfig?.nombre || clinicConfig?.name || "CLÍNICA DENTAL";

        const html = `
            <html>
            <head>
                <title>Reporte de Historia Clínica - ${patient.nombreCompleto || ''}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #1e293b;
                        padding: 30px;
                        max-width: 850px;
                        margin: 0 auto;
                        line-height: 1.5;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #2563eb;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                        gap: 20px;
                    }
                    .logo-area {
                        display: flex;
                        justify-content: flex-start;
                        align-items: center;
                        max-width: 50%;
                    }
                    .logo-text {
                        font-size: 22px;
                        font-weight: 800;
                        color: #2563eb;
                        letter-spacing: -0.04em;
                        text-transform: uppercase;
                        line-height: 1;
                    }
                    .doc-title {
                        text-align: right;
                        max-width: 50%;
                    }
                    .doc-title h1 {
                        font-size: 18px;
                        font-weight: 800;
                        text-transform: uppercase;
                        margin: 0;
                        color: #1e3a8a;
                        letter-spacing: 0.02em;
                    }
                    .doc-title p {
                        font-size: 9px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                        margin: 4px 0 0 0;
                        letter-spacing: 0.15em;
                    }
                    .patient-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 16px 20px;
                        margin-bottom: 25px;
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 12px;
                    }
                    .info-group {
                        padding: 6px 10px;
                        background: #ffffff;
                        border-radius: 8px;
                        border: 1px solid #f1f5f9;
                    }
                    .info-label {
                        font-size: 8px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #94a3b8;
                        letter-spacing: 0.05em;
                        margin-bottom: 3px;
                    }
                    .info-value {
                        font-size: 11.5px;
                        font-weight: 600;
                        color: #1e293b;
                    }
                    .section-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #1e3a8a;
                        letter-spacing: 0.08em;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 5px;
                        margin-top: 30px;
                        margin-bottom: 15px;
                    }
                    .document-item {
                        border: 1px solid #e2e8f0;
                        border-left: 4px solid #2563eb;
                        border-radius: 8px;
                        padding: 15px 18px;
                        margin-bottom: 15px;
                        background: #ffffff;
                        page-break-inside: avoid;
                    }
                    .document-header {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                        font-weight: 700;
                        border-bottom: 1px solid #f1f5f9;
                        padding-bottom: 6px;
                        margin-bottom: 10px;
                        color: #475569;
                    }
                    .document-type {
                        color: #2563eb;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .document-body {
                        font-size: 11.5px;
                        color: #334155;
                        line-height: 1.45;
                        white-space: pre-wrap;
                    }
                    .receta-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    .receta-table th {
                        background: #f8fafc;
                        font-size: 9px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #475569;
                        letter-spacing: 0.05em;
                        padding: 8px 10px;
                        text-align: left;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .receta-table td {
                        padding: 8px 10px;
                        font-size: 11px;
                        color: #334155;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .receta-table tr:last-child td {
                        border-bottom: none;
                    }
                    @media print {
                        body { padding: 15px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-area">
                        ${logoUrl 
                            ? `<img src="${logoUrl}" style="max-height: 60px; max-width: 250px; object-fit: contain;" />`
                            : `<div class="logo-text">${clinicName.toUpperCase()}</div>`
                        }
                    </div>
                    <div class="doc-title">
                        <h1>Impresión Parcial de Historia</h1>
                        <p>Reporte de Documentos Filtrados</p>
                    </div>
                </div>

                <div class="patient-card">
                    <div class="info-group">
                        <div class="info-label">Nombre Completo</div>
                        <div class="info-value">${patient.nombreCompleto || ''}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Identificación</div>
                        <div class="info-value">${patient.tipoDocumento || 'C.C.'} ${patient.nroDocumento || ''}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Nro. Historia</div>
                        <div class="info-value">#${patient.nroHistoria || 'S/N'}</div>
                    </div>
                </div>

                <div class="section-title">Documentos Seleccionados / Filtrados</div>
                ${filteredDocs.length === 0 ? `
                    <p style="font-size: 13px; color: #64748b; font-style: italic;">No se registran documentos coincidentes con los filtros aplicados.</p>
                ` : filteredDocs.map(d => `
                    <div class="document-item">
                        <div class="document-header">
                            <div>
                                <span class="document-type">${d.tipoDocumento}</span>
                                <span style="color: #94a3b8; margin: 0 8px;">|</span>
                                <span>Dr(a). ${d.profesional || ''}</span>
                            </div>
                            <div style="color: #64748b;">
                                ${new Date(d.fechaIso).toLocaleString('es-ES')}
                            </div>
                        </div>
                        <div class="document-body">
                            ${d.tipoDocumento === 'Receta' ? `
                                <table class="receta-table">
                                    <thead>
                                        <tr>
                                            <th>Principio Activo</th>
                                            <th>Dosis</th>
                                            <th>Frecuencia</th>
                                            <th>Vía</th>
                                            <th>Duración</th>
                                            <th>Cant.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(d.recetaItems || []).map(it => `
                                            <tr>
                                                <td><strong>${it.principioActivo}</strong>${it.marca && it.marca !== '-' ? ` (${it.marca})` : ''}</td>
                                                <td>${it.dosis}</td>
                                                <td>${it.frecuencia}</td>
                                                <td>${it.viaAdministracion}</td>
                                                <td>${it.duracion}</td>
                                                <td>${it.cantidad}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : d.tipoDocumento === 'Orden' ? `
                                <div style="margin-top: 5px; font-size: 11px;">
                                    <p><strong>Tipo de Orden:</strong> ${d.tipoOrden || 'Orden médica'}</p>
                                    <p><strong>Dx Principal:</strong> ${d.dxPrincipal ? `${d.dxPrincipal.code} - ${d.dxPrincipal.name}` : '-'}</p>
                                    ${(d.dxRelacionados || []).length > 0 ? `
                                        <p><strong>Dx Relacionados:</strong> ${(d.dxRelacionados || []).map(r => r.code).join(', ')}</p>
                                    ` : ''}
                                    ${(d.cupsItems || []).length > 0 ? `
                                        <div style="margin-top: 5px;"><strong>Procedimientos (CUPS):</strong></div>
                                        <ul style="margin: 2px 0; padding-left: 15px;">
                                            ${(d.cupsItems || []).map(c => `<li>[${c.code}] ${c.name} ${c.descripcion ? `(${c.descripcion})` : ''}</li>`).join('')}
                                        </ul>
                                    ` : ''}
                                    ${d.observacionesGenerales ? `<p><strong>Observaciones:</strong> ${d.observacionesGenerales}</p>` : ''}
                                </div>
                            ` : d.tipoDocumento === 'Consulta' ? `
                                <div style="margin-top: 5px; font-size: 11px;">
                                    <p><strong>Motivo de Consulta:</strong> ${d.motivoConsulta || '-'}</p>
                                    <p><strong>Enfermedad Actual:</strong> ${d.enfermedadActual || '-'}</p>
                                    ${(d.antecedentes || []).length > 0 ? `
                                        <p><strong>Antecedentes:</strong> ${(d.antecedentes || []).map(a => `[${a.code}] ${a.name}${a.obs ? ` (${a.obs})` : ''}`).join(', ')}</p>
                                    ` : ''}
                                    ${(d.alergias || []).length > 0 ? `
                                        <p><strong>Alergias:</strong> ${(d.alergias || []).map(a => `${a.tipo}${a.obs ? ` (${a.obs})` : ''}`).join(', ')}</p>
                                    ` : ''}
                                    ${(d.antFamiliares || []).length > 0 ? `
                                        <p><strong>Antecedentes Familiares:</strong> ${(d.antFamiliares || []).map(f => `${f.parentesco}: [${f.code}] ${f.name}${f.obs ? ` (${f.obs})` : ''}`).join(', ')}</p>
                                    ` : ''}
                                    ${(d.medicamentosPrev || []).length > 0 ? `
                                        <p><strong>Medicamentos en Uso:</strong> ${(d.medicamentosPrev || []).map(m => `${m.nombre}${m.obs ? ` (${m.obs})` : ''}`).join(', ')}</p>
                                    ` : ''}
                                </div>
                            ` : (d.contenido || '').replace(/\n/g, '<br/>')}
                        </div>
                    </div>
                `).join('')}
            </body>
            </html>
        `;

        printHTMLInHiddenIframe(html);
    };

    if (!patient) return <div className="p-8 text-center text-slate-400">Cargando paciente...</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50 min-h-0 animate-fadeIn relative">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                
                {/* Header Actions */}
                <div className="flex justify-end gap-3 mb-8">
                    <button onClick={handlePrintFullHistory} className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 flex items-center gap-2 transition-all active:scale-95">
                        Imprimir historia clínica
                    </button>
                    <button onClick={handlePrintPartial} className="px-6 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#8CC63F]/20 flex items-center gap-2 transition-all active:scale-95">
                        Impresión parcial
                    </button>
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 md:p-8">
                    
                    {/* Creation Buttons Block */}
                    <div className="flex justify-end mb-10">
                        <div className="grid grid-cols-2 gap-3 max-w-sm w-full">
                            <button onClick={() => handleOpenModal("Receta")} className="bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full py-2 px-4 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                                <FiPlus size={14} /> Nueva receta
                            </button>
                            <button onClick={() => handleOpenModal("Orden")} className="bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full py-2 px-4 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                                <FiPlus size={14} /> Nueva orden
                            </button>
                            <button onClick={() => handleOpenModal("Consulta")} className="bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full py-2 px-4 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                                <FiPlus size={14} /> Consulta Odontológica
                            </button>
                            <button onClick={() => handleOpenModal("Alerta")} className="bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full py-2 px-4 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                                <FiPlus size={14} /> Nueva alerta
                            </button>
                            <div className="col-start-2">
                                <button onClick={() => handleOpenModal("Plantilla")} className="w-full bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full py-2 px-4 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                                    <FiPlus size={14} /> Nueva plantilla
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table Toolbar */}
                    <div className="flex justify-end mb-4">
                        <div className="relative w-64">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Elite Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-100 pb-1">
                        <table className="min-w-[900px] w-full text-left border-collapse">
                            <thead>
                                <tr>
                                    <th className="bg-slate-50 border-b border-slate-100 px-4 py-3 align-top min-w-[120px]">
                                        <div className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">Fecha <FiSearch size={10} /></div>
                                        <input type="text" value={filterFecha} onChange={(e) => setFilterFecha(e.target.value)} className="w-full text-xs p-1 border border-slate-200 rounded outline-none focus:border-blue-400" />
                                    </th>
                                    <th className="bg-slate-50 border-b border-slate-100 px-4 py-3 align-top min-w-[200px]">
                                        <div className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-2">Tipo documento</div>
                                        <div className="relative">
                                            <FiSearch size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="text" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-full text-xs pl-6 p-1 border border-slate-200 rounded outline-none focus:border-blue-400" />
                                        </div>
                                    </th>
                                    <th className="bg-slate-50 border-b border-slate-100 px-4 py-3 align-top min-w-[200px]">
                                        <div className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-2">Profesional</div>
                                        <div className="relative">
                                            <FiSearch size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="text" value={filterProf} onChange={(e) => setFilterProf(e.target.value)} className="w-full text-xs pl-6 p-1 border border-slate-200 rounded outline-none focus:border-blue-400" />
                                        </div>
                                    </th>
                                    <th className="bg-slate-50 border-b border-slate-100 px-4 py-3 align-top min-w-[200px]">
                                        <div className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><FiEdit2 size={10} className="text-slate-400" /> Transcribe</div>
                                        <input type="text" value={filterTrans} onChange={(e) => setFilterTrans(e.target.value)} className="w-full text-xs p-1 border border-slate-200 rounded outline-none focus:border-blue-400" />
                                    </th>
                                    <th className="bg-slate-50 border-b border-slate-100 px-3 py-3 align-top w-[160px] min-w-[160px] shrink-0">
                                        <div className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-2">Acciones</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm font-medium">
                                            No se encontraron documentos clínicos.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDocs.map(doc => {
                                        const isConsulta = (doc.tipoDocumento === 'Consulta' || doc.tipo === 'Consulta' || doc.titulo === 'Consulta Odontológica');
                                        const isFinalizada = isConsulta && (doc.estado === 'Finalizada' || doc.finalizado === true || doc.firmado === true || doc.metadata?.estado === 'Finalizada' || doc.metadata?.finalizado === true);
                                        const isEnProceso = isConsulta && !isFinalizada;

                                        return (
                                            <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-4 py-4 align-top">
                                                    <div className="text-xs font-medium text-slate-600">
                                                        {new Date(doc.fechaIso).toLocaleDateString('es-ES')}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        {new Date(doc.fechaIso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 align-top">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-sm font-medium text-slate-700">{doc.tipoDocumento}</span>
                                                        {isFinalizada && (
                                                            <span className="px-2 py-0.5 text-[9.5px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide inline-flex items-center gap-1">
                                                                <FiLock size={9} /> Finalizada
                                                            </span>
                                                        )}
                                                        {isEnProceso && (
                                                            <span className="px-2 py-0.5 text-[9.5px] font-black rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide inline-flex items-center gap-1">
                                                                <FiClock size={9} /> En proceso
                                                            </span>
                                                        )}
                                                    </div>
                                                    {doc.diagnostico && <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mt-1 truncate max-w-[200px]">{doc.diagnostico}</div>}
                                                </td>
                                                <td className="px-4 py-4 align-top">
                                                    <div className="text-sm text-slate-600 truncate max-w-[200px]">{doc.profesional}</div>
                                                </td>
                                                <td className="px-4 py-4 align-top">
                                                    <div className="text-sm text-slate-500 truncate max-w-[200px]">{doc.transcribe}</div>
                                                </td>
                                                <td className="px-3 py-3 align-middle w-[160px] min-w-[160px] shrink-0">
                                                    <div className="flex items-center flex-nowrap gap-1">
                                                        <button onClick={() => handleViewDoc(doc)} className="w-6 h-6 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer" title="Ver detalle">
                                                            <FiEye size={11} strokeWidth={2.5} />
                                                        </button>
                                                        <button onClick={() => handlePrintDoc(doc)} className="w-6 h-6 bg-cyan-100 hover:bg-cyan-200 text-cyan-600 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer" title="Imprimir/Descargar">
                                                            <FiDownload size={11} strokeWidth={2.5} />
                                                        </button>

                                                        {isFinalizada ? (
                                                            <button 
                                                                onClick={() => handleEditDoc(doc)} 
                                                                className="w-6 h-6 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-not-allowed opacity-75" 
                                                                title="Consulta finalizada (Registro clínico cerrado - No editable)"
                                                            >
                                                                <FiLock size={11} strokeWidth={2.5} />
                                                            </button>
                                                        ) : isEnProceso ? (
                                                            <button 
                                                                onClick={() => handleEditDoc(doc)} 
                                                                className="w-6 h-6 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer" 
                                                                title="Continuar diligenciando consulta"
                                                            >
                                                                <FiEdit2 size={11} strokeWidth={2.5} />
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleEditDoc(doc)} 
                                                                className="w-6 h-6 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer" 
                                                                title="Editar"
                                                            >
                                                                <FiEdit2 size={11} strokeWidth={2.5} />
                                                            </button>
                                                        )}

                                                        {doc.tipoDocumento === "Receta" && (
                                                            <button 
                                                                onClick={() => handleSignPrescription(doc)} 
                                                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                                                                    (doc.recetaItems || []).length > 0 && (doc.recetaItems || []).every(item => item.doctorSignature)
                                                                        ? 'bg-indigo-500 hover:bg-indigo-600 text-white' 
                                                                        : 'bg-violet-100 hover:bg-violet-200 text-violet-600'
                                                                }`} 
                                                                title="Firmar Receta"
                                                            >
                                                                <FiPenTool size={11} strokeWidth={2.5} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleDeleteDoc(doc.id)} className="w-6 h-6 bg-rose-100 hover:bg-rose-200 text-rose-500 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer" title="Eliminar">
                                                            <FiTrash2 size={11} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>

            {modalOpen && (
                <React.Suspense fallback={<div className="fixed inset-0 z-[9999] bg-slate-900/40 flex items-center justify-center text-white font-bold">Cargando editor clinico...</div>}>
                    <DocClinicoModal
                        isOpen={modalOpen}
                        onClose={(saved) => {
                            setModalOpen(false);
                            setEditingDoc(null);
                            if (saved) {
                                loadDocs();
                            }
                        }}
                        patient={patient}
                        docType={selectedDocType}
                        initialData={editingDoc}
                        isViewOnly={isViewOnly}
                    />
                </React.Suspense>
            )}

            {/* Modal: Confirmar Firma Digital de Receta */}
            {signModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn border border-violet-100">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center text-violet-500 mx-auto mb-6">
                                <FiPenTool size={36} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                                ¿Firmar Receta Digitalmente?
                            </h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                                Se firmará digitalmente con tu nombre de usuario (<strong>{userProfile?.nombreCompleto || userProfile?.nombre || "Doctor"}</strong>) todos los medicamentos de esta receta. Esta acción quedará registrada.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={confirmSignPrescription}
                                    className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-violet-200 hover:bg-violet-700 transition-all active:scale-95"
                                >
                                    ✅ SÍ, FIRMAR DIGITALMENTE
                                </button>
                                <button 
                                    onClick={() => setSignModal({ isOpen: false, doc: null })}
                                    className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirmar Eliminación de Documento Clínico */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn border border-rose-100">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6 animate-pulse">
                                <FiTrash2 size={40} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                                ¿Eliminar Documento?
                            </h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                                Estás a punto de eliminar este documento clínico. Esta acción <strong>no se puede deshacer</strong>.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={confirmDeleteDoc}
                                    className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
                                >
                                    SÍ, ELIMINAR PERMANENTEMENTE
                                </button>
                                <button 
                                    onClick={() => setDeleteModal({ isOpen: false, docId: null })}
                                    className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    NO, CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
