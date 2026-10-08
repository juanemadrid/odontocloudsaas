import supabase from "../lib/supabaseClient";
import { toast } from "sonner";
import { getDoctorSignatureAndData } from "./doctorSignatureService";
import { getEvolutionAddendaBatch } from "./evolutionService";

const printHTMLInHiddenIframe = (htmlContent) => {
    let iframe = document.getElementById("oc-print-iframe");
    if (iframe) {
        try { document.body.removeChild(iframe); } catch {}
    }
    iframe = document.createElement("iframe");
    iframe.id = "oc-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "1024px";
    iframe.style.height = "768px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    let hasPrinted = false;
    const triggerPrint = () => {
        if (hasPrinted) return;
        hasPrinted = true;
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.error("Error al imprimir iframe:", e);
        }
    };

    iframe.onload = () => {
        setTimeout(triggerPrint, 150);
    };

    setTimeout(triggerPrint, 500);
};

export const EvolutionPrintService = {
    generatePDF: async (evolutionsList = [], patient = {}, clinic = {}, userProfile = {}) => {
        if (!patient) {
            toast.error("Error: Información del paciente no disponible para generar el reporte");
            return;
        }

        const toastId = toast.loading("Preparando evoluciones para impresión...");

        try {
            // 1. Resolve Company Details & Logo
            const tenantId = clinic.inquilino || clinic.id || userProfile?.inquilino || userProfile?.tenantId || userProfile?.tenant_id || "";
            let dbLogoUrl = "";
            let dbClinicName = "";
            let dbClinicNit = "";
            let dbClinicAddress = "";
            let dbClinicPhone = "";

            if (tenantId) {
                try {
                    const { data: clinicConfig } = await supabase
                        .from("tenants")
                        .select("*")
                        .eq("id", tenantId)
                        .maybeSingle();
                    if (clinicConfig) {
                        dbLogoUrl = clinicConfig.logo || clinicConfig.logo_url || clinicConfig.logoUrl || "";
                        dbClinicName = clinicConfig.nombre_comercial || clinicConfig.nombreComercial || clinicConfig.name || clinicConfig.nombre || "";
                        dbClinicNit = clinicConfig.nit || "";
                        dbClinicAddress = clinicConfig.address || clinicConfig.direccion || "";
                        dbClinicPhone = clinicConfig.phone || clinicConfig.telefono || "";
                    }
                } catch (err) {
                    console.error("Error loading tenant config for evolution print:", err);
                }
            }

            const logoUrl = dbLogoUrl || clinic?.logo || clinic?.logoUrl || userProfile?.tenant?.logo || "";
            const clinicName = dbClinicName || clinic?.nombreComercial || clinic?.nombre || clinic?.name || userProfile?.tenant?.nombreComercial || "CLÍNICA DENTAL";
            const clinicNit = dbClinicNit || clinic?.nit || clinic?.NIT || userProfile?.tenant?.nit || "—";
            const clinicAddress = dbClinicAddress || clinic?.direccion || clinic?.address || userProfile?.tenant?.direccion || "—";
            const clinicPhone = dbClinicPhone || clinic?.telefono || clinic?.phone || userProfile?.tenant?.telefono || "—";

            // 2. Fetch secure signatures batch & addendas batch for all evolutions
            const evoIds = (evolutionsList || []).map(e => e.id).filter(Boolean);
            let signaturesByEvoId = {};
            let addendasByEvoId = {};

            if (evoIds.length > 0) {
                try {
                    const { data: sigs, error: sigError } = await supabase.rpc(
                        "get_evolution_signatures_batch",
                        { p_evolution_ids: evoIds.slice(0, 100) }
                    );
                    if (!sigError && Array.isArray(sigs)) {
                        sigs.forEach(s => {
                            signaturesByEvoId[s.evolution_id] = s;
                        });
                    }
                } catch (e) {
                    console.warn("Aviso al consultar firmas digitales en lote:", e);
                }

                try {
                    const addendasList = await getEvolutionAddendaBatch(evoIds.slice(0, 100));
                    if (Array.isArray(addendasList)) {
                        addendasList.forEach(a => {
                            if (!addendasByEvoId[a.evolution_id]) {
                                addendasByEvoId[a.evolution_id] = [];
                            }
                            addendasByEvoId[a.evolution_id].push(a);
                        });
                    }
                } catch (e) {
                    console.warn("Aviso al consultar adendas en lote:", e);
                }
            }

            // 3. Normalize evolutions list
            const normalizedEvolutions = (evolutionsList || []).map((evo) => {
                let parsedTratamiento = {};
                if (evo.tratamiento) {
                    if (typeof evo.tratamiento === 'object') {
                        parsedTratamiento = evo.tratamiento;
                    } else if (typeof evo.tratamiento === 'string' && evo.tratamiento.startsWith('{')) {
                        try {
                            parsedTratamiento = JSON.parse(evo.tratamiento);
                        } catch (e) {}
                    }
                }
                const secureEvidence = signaturesByEvoId[evo.id] || null;
                const evoAddendas = addendasByEvoId[evo.id] || evo.addendas || parsedTratamiento.addendas || [];

                return {
                    ...evo,
                    ...parsedTratamiento,
                    id: evo.id,
                    status: evo.status || parsedTratamiento.status || 'borrador',
                    closure_origin: evo.closure_origin || parsedTratamiento.closure_origin || null,
                    closed_at: evo.closed_at || parsedTratamiento.closed_at || null,
                    professional_signature_snapshot: evo.professional_signature_snapshot || parsedTratamiento.professional_signature_snapshot || null,
                    addendas: evoAddendas,
                    profesional: evo.profesional || parsedTratamiento.profesional || evo.profesional_nombre || '',
                    profesionalId: evo.profesional_id || parsedTratamiento.profesionalId || evo.profesionalId || '',
                    description: evo.description || evo.comentario || parsedTratamiento.description || parsedTratamiento.comentario || '',
                    transcribe: parsedTratamiento.transcribe || parsedTratamiento.transcribedBy || evo.transcribe || evo.transcribed_by || '',
                    plantillaItems: evo.plantillaItems || parsedTratamiento.plantillaItems || {},
                    doctorSignature: parsedTratamiento.doctorSignature || evo.doctorSignature || null,
                    patientSignature: secureEvidence?.signature_data || parsedTratamiento.patientSignature || evo.patientSignature || null,
                    date: evo.date || evo.fecha || evo.created_at || new Date(),
                    reparaciones: evo.reparaciones || parsedTratamiento.reparaciones || [],
                    higieneOral: evo.higieneOral || parsedTratamiento.higieneOral || '',
                    horaInicio: evo.horaInicio || parsedTratamiento.horaInicio || '',
                    horaFin: evo.horaFin || parsedTratamiento.horaFin || '',
                    alambreSuperior: evo.alambreSuperior || parsedTratamiento.alambreSuperior || '',
                    alambreInferior: evo.alambreInferior || parsedTratamiento.alambreInferior || '',
                    accesoriosSuperior: evo.accesoriosSuperior || parsedTratamiento.accesoriosSuperior || [],
                    accesoriosInferior: evo.accesoriosInferior || parsedTratamiento.accesoriosInferior || [],
                };
            });

            // 4. Resolve Doctor por defecto para el encabezado del paciente
            const defaultDocName = normalizedEvolutions.find(e => e.profesional)?.profesional || patient?.doctorTratante || patient?.profesional || (userProfile?.esDoctor ? userProfile?.nombreCompleto : '') || '---';

            // 5. Patient Details & Age
            const patientName = patient?.nombreCompleto || `${patient?.nombre || ''} ${patient?.apellido || ''}`.trim() || 'Paciente Sin Nombre';
            const fechaNac = patient?.fechaNacimiento ? new Date(patient.fechaNacimiento) : null;
            const rawAge = patient?.edad || (fechaNac && !isNaN(fechaNac.getTime()) ? Math.floor((new Date() - fechaNac) / (365.25 * 24 * 60 * 60 * 1000)) : 'No registrada');
            const formatEdad = (val) => {
                if (!val || val === 'No registrada' || val === '---' || val === 'N/A') return val || 'No registrada';
                const str = String(val).trim();
                if (str.toLowerCase().includes('año') || str.toLowerCase().includes('mes')) return str;
                return `${str} años`;
            };
            const edad = formatEdad(rawAge);
            const printDate = new Date().toLocaleDateString("es-CO");

            // 6. Build Evolutions HTML
            let evolutionsHTML = "";
            if (normalizedEvolutions.length === 0) {
                evolutionsHTML = `
                    <div style="padding: 25px; text-align: center; border: 1px dashed #cbd5e1; border-radius: 6px; color: #64748b; font-weight: bold; font-size: 10px; margin-top: 15px;">
                        NO SE ENCONTRARON REGISTROS DE EVOLUCIÓN CLÍNICA PARA ESTE PACIENTE.
                    </div>
                `;
            } else {
                evolutionsHTML = normalizedEvolutions.map((evo, idx) => {
                    const isHistorical = evo.status === 'cerrada' && evo.closure_origin === 'legacy_migration';
                    const isProfessionalClosed = evo.status === 'cerrada' && evo.closure_origin === 'professional';
                    const isOrtho = evo.type === 'evolucion_ortodoncia' || evo.type === 'ortodoncia' || evo.isOrthodontic || (evo.treatment && String(evo.treatment).toLowerCase().includes('ortodoncia'));

                    // Etiqueta badge (NUNCA mostrar 'Firmada')
                    const docBadgeLabel = isHistorical
                        ? 'Registro Histórico Protegido'
                        : isProfessionalClosed
                        ? ''
                        : evo.status === 'borrador'
                        ? 'Borrador'
                        : evo.type === 'remission' ? 'Remisión' : evo.type === 'nota' ? 'Nota Aclaratoria' : isOrtho ? 'Evolución Ortodoncia' : 'Evolución';

                    // Parse date
                    const rawDate = evo.date instanceof Date ? evo.date : (evo.date ? new Date(evo.date) : new Date());
                    const dateStr = rawDate.toLocaleDateString('es-CO', {
                        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                    });
                    const timeStr = rawDate.toLocaleTimeString('es-CO', {
                        hour: '2-digit', minute: '2-digit', hour12: true
                    });

                    // Snapshot y resolución de firma
                    const rawSnap = evo.professional_signature_snapshot;
                    const sigSnap = typeof rawSnap === 'string' ? (() => { try { return JSON.parse(rawSnap); } catch { return null; } })() : rawSnap;
                    const isDoctorSigned = isProfessionalClosed || Boolean(evo.doctorSignature?.signature || evo.doctorSignature?.signatureImage || sigSnap);

                    const docSig = isProfessionalClosed
                        ? (
                            sigSnap?.signature_image 
                            || sigSnap?.firma_base64 
                            || sigSnap?.firma 
                            || evo.doctorSignature?.signatureImage 
                            || (userProfile?.esDoctor ? (userProfile?.firmaElectronica || userProfile?.firma) : null)
                            || (typeof localStorage !== 'undefined' && userProfile?.uid ? localStorage.getItem('odontocloud_doctor_signature_' + userProfile.uid) : null)
                            || null
                        )
                        : (evo.doctorSignature?.signatureImage || null);

                    const docNom = isProfessionalClosed
                        ? (
                            sigSnap?.signer_name 
                            || sigSnap?.nombre_completo 
                            || evo.doctorSignature?.signature 
                            || evo.profesional 
                            || userProfile?.nombreCompleto 
                            || 'Doctor Tratante'
                        )
                        : (evo.doctorSignature?.signature || evo.profesional || 'Doctor Tratante');

                    const docReg = isProfessionalClosed
                        ? (
                            sigSnap?.registro_medico 
                            || evo.doctorSignature?.registroMedico 
                            || userProfile?.registroMedico 
                            || ''
                        )
                        : (evo.doctorSignature?.registroMedico || '');

                    // Procedimientos
                    const plantillaItems = evo.plantillaItems || {};
                    const procedimientos = Object.values(plantillaItems)
                        .filter(v => v?.checked)
                        .map(v => {
                            const name = v.desc || v.procedimiento || v.nombre || '';
                            const tooth = v.dientes ? `[Diente ${v.dientes}] ` : '';
                            return tooth + name;
                        })
                        .filter(Boolean);

                    const addendas = evo.addendas || [];

                    return `
                      <div class="evo-block">
                        <div class="evo-header">
                          <div class="evo-title">
                            ${patientName} (${isHistorical ? (evo.profesional || '---') : docNom})
                          </div>
                          ${docBadgeLabel ? `<div class="evo-badge">${docBadgeLabel}</div>` : ''}
                        </div>
                        <div class="evo-date">${dateStr} ${timeStr}</div>

                        ${isHistorical ? `
                          <div class="notice-box">
                            <strong>REGISTRO HISTÓRICO PROTEGIDO:</strong> Registro previo a la implementación del sistema de cierre y firma clínica. Su contenido se encuentra protegido contra modificaciones.
                          </div>
                        ` : ''}

                        <div class="evo-desc">${(evo.description || evo.comentario || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>

                        ${isOrtho ? `
                          <div style="margin: 8px 0; padding: 8px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 9px; line-height: 1.5;">
                            <div style="font-weight: bold; margin-bottom: 4px; text-transform: uppercase; color: #1e293b;">Detalles de Ortodoncia</div>
                            ${evo.higieneOral ? `<div><strong>Higiene Oral:</strong> ${evo.higieneOral}</div>` : ''}
                            ${(evo.horaInicio || evo.horaFin) ? `<div><strong>Horario de atención:</strong> ${evo.horaInicio || '—'} a ${evo.horaFin || '—'}</div>` : ''}
                            ${Array.isArray(evo.reparaciones) && evo.reparaciones.length > 0 ? `<div><strong>Dientes Reparados:</strong> ${evo.reparaciones.join(', ')}</div>` : ''}
                            ${(evo.alambreSuperior || (Array.isArray(evo.accesoriosSuperior) && evo.accesoriosSuperior.length > 0)) ? `
                              <div><strong>Arcada Superior:</strong> ${evo.alambreSuperior ? `Alambre: ${evo.alambreSuperior}` : ''} ${Array.isArray(evo.accesoriosSuperior) && evo.accesoriosSuperior.length > 0 ? `· Accesorios: ${evo.accesoriosSuperior.join(', ')}` : ''}</div>
                            ` : ''}
                            ${(evo.alambreInferior || (Array.isArray(evo.accesoriosInferior) && evo.accesoriosInferior.length > 0)) ? `
                              <div><strong>Arcada Inferior:</strong> ${evo.alambreInferior ? `Alambre: ${evo.alambreInferior}` : ''} ${Array.isArray(evo.accesoriosInferior) && evo.accesoriosInferior.length > 0 ? `· Accesorios: ${evo.accesoriosInferior.join(', ')}` : ''}</div>
                            ` : ''}
                          </div>
                        ` : ''}

                        ${(evo.transcribe || evo.transcribedBy) ? `
                          <div style="font-size: 8.5px; font-weight: bold; color: #475569; margin-top: 4px; margin-bottom: 6px; text-transform: uppercase;">
                            Transcribe: <span style="color: #0f172a; font-weight: 800;">${evo.transcribe || evo.transcribedBy}</span>
                          </div>
                        ` : ''}

                        ${procedimientos.length > 0 ? procedimientos.map((p, pIdx) => `
                          <div class="evo-proc">${evo.treatment ? `${evo.treatment} - ` : 'odontología - '}${pIdx + 1}. ${p}</div>
                        `).join('') : (evo.treatment ? `<div class="evo-proc">${evo.treatment}</div>` : '')}

                        ${Array.isArray(addendas) && addendas.length > 0 ? `
                          <div class="addendas-box">
                            <div style="font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
                              Notas Aclaratorias (${addendas.length})
                            </div>
                            ${addendas.map((ad, aIdx) => `
                              <div class="addenda-item">
                                <div style="display: flex; justify-content: space-between; font-weight: bold; color: #0f172a; margin-bottom: 4px;">
                                  <span>Nota #${aIdx + 1} · ${ad.author_snapshot?.nombre_completo || 'Profesional'} ${ad.author_snapshot?.registro_medico ? `(TP: ${ad.author_snapshot.registro_medico})` : ''}</span>
                                  <span style="color: #64748b; font-weight: normal;">${new Date(ad.created_at).toLocaleString('es-CO')}</span>
                                </div>
                                <div style="color: #1e293b; white-space: pre-wrap;">${(ad.contenido || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                              </div>
                            `).join('')}
                          </div>
                        ` : ''}

                        <!-- FIRMA INDIVIDUAL DE ESTA EVOLUCIÓN (SI ESTÁ FIRMADA) -->
                        <div class="signature-container">
                          ${!isHistorical && isDoctorSigned && docSig ? `
                          <div class="sig-block">
                            <div class="sig-image-holder">
                              <img src="${docSig}" alt="Firma Profesional" />
                            </div>
                            <div class="sig-name">${docNom}</div>
                            <div class="sig-role">Doctor/Profesional ${docReg ? `· TP: ${docReg}` : ''}</div>
                          </div>
                          ` : ''}
                          ${evo.patientSignature ? `
                            <div class="sig-block">
                              <div class="sig-image-holder">
                                <img src="${evo.patientSignature}" alt="Firma Paciente" />
                              </div>
                              <div class="sig-name">${patientName}</div>
                              <div class="sig-role">Paciente / Aceptante</div>
                            </div>
                          ` : ''}
                        </div>
                      </div>
                      ${idx < normalizedEvolutions.length - 1 ? `<div class="evo-separator"></div>` : ''}
                    `;
                }).join('');
            }

            // 7. Assemble Full HTML (Exactamente idéntico a printEvolution)
            const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Evoluciones Clínicas — ${patientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      padding: 20px 25px;
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.35;
      font-size: 10px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
    }
    .header-left {
      width: 140px;
    }
    .clinic-logo {
      max-height: 60px;
      max-width: 130px;
      object-fit: contain;
    }
    .header-center {
      flex: 1;
      text-align: center;
      padding: 0 10px;
    }
    .clinic-name {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
      letter-spacing: 0.3px;
    }
    .clinic-sub {
      font-size: 9.5px;
      color: #1e293b;
      margin-bottom: 1px;
    }
    .header-right {
      width: 140px;
      text-align: right;
    }
    .patient-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      border: 1px solid #475569;
      font-size: 9.5px;
    }
    .patient-table td {
      border: 1px solid #475569;
      padding: 3.5px 6px;
      vertical-align: middle;
    }
    .td-label {
      font-weight: bold;
      color: #0f172a;
      width: 16%;
      white-space: nowrap;
    }
    .td-val {
      color: #1e293b;
    }
    .section-divider {
      text-align: center;
      margin: 14px 0 10px 0;
      border: 1px dashed #64748b;
      padding: 3px 0;
      font-size: 10.5px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .evo-block {
      margin-top: 10px;
      padding-top: 5px;
      page-break-inside: avoid;
    }
    .evo-separator {
      border-top: 1px dashed #cbd5e1;
      margin: 20px 0 15px 0;
    }
    .evo-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 3px;
    }
    .evo-title {
      font-size: 10px;
      font-weight: bold;
    }
    .evo-badge {
      font-size: 9.5px;
      color: #475569;
      font-weight: bold;
    }
    .evo-date {
      font-size: 9px;
      color: #475569;
      margin-bottom: 6px;
    }
    .evo-desc {
      font-size: 9.5px;
      color: #0f172a;
      line-height: 1.4;
      white-space: pre-wrap;
      margin-bottom: 6px;
    }
    .evo-proc {
      font-size: 9.5px;
      font-weight: bold;
      color: #0f172a;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .signature-container {
      display: flex;
      justify-content: flex-end;
      gap: 40px;
      margin-top: 20px;
      padding-top: 10px;
    }
    .sig-block {
      text-align: center;
      min-width: 200px;
    }
    .sig-image-holder {
      height: 75px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      border-bottom: 1px solid #475569;
      margin-bottom: 4px;
    }
    .sig-image-holder img {
      max-height: 70px;
      max-width: 220px;
      object-fit: contain;
    }
    .sig-name {
      font-size: 9.5px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .sig-role {
      font-size: 8.5px;
      color: #475569;
    }
    .notice-box {
      margin: 8px 0;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #64748b;
      font-size: 9px;
      line-height: 1.4;
      color: #334155;
    }
    .addendas-box {
      margin-top: 15px;
      border-top: 1px dashed #64748b;
      padding-top: 10px;
    }
    .addenda-item {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 6px;
      font-size: 9px;
      line-height: 1.4;
    }
    @media print {
      body { padding: 0; }
      @page { size: Letter; margin: 12mm 15mm; }
      .evo-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- CABECERA CLÍNICA -->
  <div class="header-container">
    <div class="header-left">
      ${logoUrl ? `<img src="${logoUrl}" class="clinic-logo" crossorigin="anonymous" />` : ''}
    </div>
    <div class="header-center">
      <div class="clinic-name">${clinicName}</div>
      <div class="clinic-sub">NIT: ${clinicNit}</div>
      <div class="clinic-sub">${clinicAddress}</div>
      ${clinicPhone ? `<div class="clinic-sub">TEL: ${clinicPhone}</div>` : ''}
    </div>
    <div class="header-right"></div>
  </div>

  <!-- TABLA DE DATOS DEL PACIENTE (FORMATO ORAL DRIVE) -->
  <table class="patient-table">
    <tbody>
      <tr>
        <td class="td-label">Nombre del paciente</td>
        <td class="td-val" style="width: 32%;">${patientName}</td>
        <td class="td-label" style="width: 10%;">Edad</td>
        <td class="td-val" style="width: 14%;">${edad}</td>
        <td class="td-label" style="width: 14%;">Nro Historia</td>
        <td class="td-val" style="width: 14%;">${patient?.documento || patient?.cedula || 'N/A'}</td>
      </tr>
      <tr>
        <td class="td-label">Tipo documento</td>
        <td class="td-val">${patient?.tipoDocumento || 'Cédula de ciudadanía'}</td>
        <td class="td-label">Nro de documento</td>
        <td class="td-val" colspan="3">${patient?.documento || patient?.cedula || 'N/A'}</td>
      </tr>
      <tr>
        <td class="td-label">Sexo</td>
        <td class="td-val">${patient?.genero || patient?.sexo || 'Femenino'}</td>
        <td class="td-label">Fecha y lugar de nacimiento</td>
        <td class="td-val" colspan="3">
          ${patient?.fechaNacimiento ? new Date(patient.fechaNacimiento).toLocaleDateString('es-CO') : 'N/A'}${patient?.lugarNacimiento ? `, ${patient.lugarNacimiento}` : ''}
        </td>
      </tr>
      <tr>
        <td class="td-label">Correo</td>
        <td class="td-val">${patient?.email || patient?.correo || 'N/A'}</td>
        <td class="td-label">Ocupación</td>
        <td class="td-val">${patient?.ocupacion || 'N/A'}</td>
        <td class="td-label">Fecha impresión</td>
        <td class="td-val">${printDate}</td>
      </tr>
      <tr>
        <td class="td-label">Teléfonos</td>
        <td class="td-val">${patient?.celular || patient?.telefono || 'N/A'}</td>
        <td class="td-label">Estado civil</td>
        <td class="td-val">${patient?.estadoCivil || 'Soltero'}</td>
        <td class="td-label">Dirección residencia</td>
        <td class="td-val">${patient?.direccion || patient?.direccionResidencia || 'N/A'}</td>
      </tr>
      <tr>
        <td class="td-label">EPS</td>
        <td class="td-val" colspan="2">${patient?.nombreEps || patient?.eps || 'N/A'}</td>
        <td class="td-label">Doctor/Profesional</td>
        <td class="td-val" colspan="2">${defaultDocName}</td>
      </tr>
      <tr>
        <td class="td-label">Nombre responsable</td>
        <td class="td-val">${patient?.nombreResponsable || 'N/A'}</td>
        <td class="td-label">Parentesco</td>
        <td class="td-val">${patient?.parentesco || 'N/A'}</td>
        <td class="td-label">Teléfono responsable</td>
        <td class="td-val">${patient?.celularResponsable || patient?.telefonoResponsable || 'N/A'}</td>
      </tr>
    </tbody>
  </table>

  <!-- SEPARADOR EVOLUCIONES -->
  <div class="section-divider">Evoluciones</div>

  <!-- LISTA DE BLOQUES DE EVOLUCIÓN -->
  ${evolutionsHTML}

</body>
</html>`;

            printHTMLInHiddenIframe(html);
            toast.dismiss(toastId);
        } catch (error) {
            console.error("Error al generar reporte de evoluciones:", error);
            toast.error("Error al preparar la impresión de evoluciones");
            toast.dismiss(toastId);
        }
    }
};
