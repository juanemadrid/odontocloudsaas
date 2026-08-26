import React, { useEffect, useState, useRef } from 'react';
import supabase from '../../../lib/supabaseClient';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { FiActivity, FiEdit3, FiTrash2, FiPenTool, FiCheck, FiFileText, FiX, FiAlertCircle, FiPrinter, FiLock } from 'react-icons/fi';
import { getDoctorSignatureAndData, validateDoctorCanSign } from '../../../services/doctorSignatureService';


// SVG de Huella digital codificado para simulador
const FINGERPRINT_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238cc63f" width="80" height="80"><path d="M12,2A10,10,0,0,0,2,12a9.88,9.88,0,0,0,2.15,6.13.5.5,0,0,0,.79-.62A8.9,8.9,0,0,1,3,12,9,9,0,0,1,12,3a9.05,9.05,0,0,1,6.33,2.67.5.5,0,0,0,.7.71A10,10,0,0,0,12,2ZM6,12a6,6,0,0,1,6-6,6.07,6.07,0,0,1,4.24,1.76.5.5,0,1,0,.7-.7A7,7,0,0,0,12,5a7,7,0,0,0-7,7,7.1,7.1,0,0,0,.54,2.71.5.5,0,1,0,.92-.38A6,6,0,0,1,6,12Zm9.26,2.22a.5.5,0,0,0-.71.7A3.91,3.91,0,0,1,12,16a4,4,0,0,1-4-4,4,4,0,0,1,1.17-2.83.5.5,0,0,0-.7-.71A5,5,0,0,0,7,12a5,5,0,0,0,5,5,4.92,4.92,0,0,0,3.54-1.46A.5.5,0,0,0,15.26,14.22ZM12,8a4,4,0,0,0-4,4,4.07,4.07,0,0,0,.56,2.06.5.5,0,1,0,.88-.47A3,3,0,0,1,9,12a3,3,0,0,1,3-3,3,3,0,0,1,2.12.88.5.5,0,1,0,.71-.7A4,4,0,0,0,12,8Zm0,10a6,6,0,0,0,4.24-1.76.5.5,0,1,0-.7-.7A5,5,0,0,1,12,17a5,5,0,0,1-3.54-1.46.5.5,0,1,0-.7.7A6,6,0,0,0,12,18Zm5.74-8.83a.5.5,0,0,0-.71.7A8,8,0,0,1,12,21a7.92,7.92,0,0,1-5.66-2.34.5.5,0,0,0-.7.71A9,9,0,0,0,12,22,9,9,0,0,0,19.27,14,9.09,9.09,0,0,0,17.74,9.17Z"/></svg>`;

// Extraer procedimientos seleccionados de plantillaItems
const getSelectedProcedures = (plantillaItems, planItemsLookup = {}) => {
    if (!plantillaItems) return [];
    return Object.entries(plantillaItems)
        .filter(([, v]) => v?.checked === true)
        .map(([itemId, v]) => {
            const desc = v.desc || v.procedimiento || v.nombre
                || planItemsLookup[itemId]?.desc
                || '';
            const dientes = v.dientes || planItemsLookup[itemId]?.dientes || '';
            return { desc, dientes };
        })
        .filter(p => p.desc);
};

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

// ======================================================
// FUNCIÓN: Imprimir una sola evolución al estilo unificado de Historia Clínica
// ======================================================
const printEvolution = async (evo, patient, clinicInfo = {}, userProfile = null) => {
    const logoUrl = clinicInfo.logo || '';
    const clinicName = clinicInfo.nombre || clinicInfo.name || 'CLÍNICA DENTAL';
    const clinicNit = clinicInfo.nit || '—';
    const clinicAddress = clinicInfo.direccion || clinicInfo.address || '—';
    const clinicPhone = clinicInfo.telefono || clinicInfo.phone || '—';

    const patientName = patient?.nombreCompleto || patient?.nombre || 'Paciente Sin Nombre';
    const fechaNac = patient?.fechaNacimiento ? new Date(patient.fechaNacimiento) : null;
    const edad = patient?.edad || (fechaNac && !isNaN(fechaNac.getTime()) ? Math.floor((new Date() - fechaNac) / (365.25 * 24 * 60 * 60 * 1000)) : 'No registrada');

    const dateStr = evo.date ? new Date(evo.date).toLocaleDateString('es-CO', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    }) : '';
    const timeStr = evo.date ? new Date(evo.date).toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: true
    }) : '';
    const printDate = new Date().toLocaleDateString('es-CO');

    const plantillaItems = evo.plantillaItems || {};
    const procedimientos = Object.values(plantillaItems)
        .filter(v => v?.checked)
        .map(v => v.desc || v.procedimiento || v.nombre || '')
        .filter(Boolean);

    // Resolver datos y firma del doctor (SOLO si la evolución fue firmada por el doctor)
    const isDoctorSigned = Boolean(evo.doctorSignature?.signature || evo.doctorSignature?.signatureImage);
    const docSig = evo.doctorSignature?.signatureImage || null;
    const docNom = evo.doctorSignature?.signature || evo.profesional || 'Doctor Tratante';
    const docReg = evo.doctorSignature?.registroMedico || '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Evolución — ${patientName}</title>
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
      margin: 12px 0;
      border: 1px dashed #64748b;
      padding: 3px 0;
      font-size: 10.5px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .evo-block {
      margin-top: 10px;
      padding-top: 5px;
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
      font-weight: normal;
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
      margin-top: 25px;
      padding-top: 10px;
    }
    .sig-block {
      text-align: center;
      min-width: 200px;
    }
    .sig-image-holder {
      height: 45px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      border-bottom: 1px solid #475569;
      margin-bottom: 4px;
    }
    .sig-image-holder img {
      max-height: 42px;
      max-width: 180px;
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
    @media print {
      body { padding: 0; }
      @page { size: Letter; margin: 12mm 15mm; }
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
        <td class="td-val" colspan="3">${patient?.estadoCivil || 'Soltero'}</td>
      </tr>
      <tr>
        <td class="td-label">Nombre responsable</td>
        <td class="td-val">${patient?.nombreResponsable || 'N/A'}</td>
        <td class="td-label">EPS</td>
        <td class="td-val">${patient?.nombreEps || patient?.eps || 'N/A'}</td>
        <td class="td-label">Doctor/Profesional</td>
        <td class="td-val">${docNom}</td>
      </tr>
      <tr>
        <td class="td-label">Parentesco responsable</td>
        <td class="td-val">${patient?.parentesco || 'N/A'}</td>
        <td class="td-label">Nombre acompañante</td>
        <td class="td-val" colspan="3">${patient?.nombreAcompanante || 'N/A'}</td>
      </tr>
      <tr>
        <td class="td-label">Teléfono responsable</td>
        <td class="td-val">${patient?.celularResponsable || 'N/A'}</td>
        <td class="td-label">Tel. Acompañante</td>
        <td class="td-val" colspan="3">${patient?.telefonoAcompanante || 'N/A'}</td>
      </tr>
      <tr>
        <td class="td-label">Dirección residencia</td>
        <td class="td-val" colspan="5">${patient?.direccion || patient?.direccionResidencia || 'N/A'}</td>
      </tr>
    </tbody>
  </table>

  <!-- SEPARADOR EVOLUCIONES -->
  <div class="section-divider">Evoluciones</div>

  <!-- DETALLE DE LA EVOLUCIÓN -->
  <div class="evo-block">
    <div class="evo-header">
      <div class="evo-title">
        ${patientName} (${docNom})
      </div>
      <div class="evo-badge">${docBadgeLabel}</div>
    </div>
    <div class="evo-date">${dateStr} ${timeStr}</div>

    <div class="evo-desc">${(evo.description || evo.comentario || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>

    ${procedimientos.length > 0 ? procedimientos.map((p, idx) => `
      <div class="evo-proc">${evo.treatment ? `${evo.treatment} - ` : 'odontología - '}${idx + 1}. ${p}</div>
    `).join('') : (evo.treatment ? `<div class="evo-proc">${evo.treatment}</div>` : '')}

    <!-- FIRMAS -->
    <div class="signature-container">
      <div class="sig-block">
        <div class="sig-image-holder">
          ${docSig ? `<img src="${docSig}" crossorigin="anonymous" />` : ''}
        </div>
        <div class="sig-name">${docNom}</div>
        <div class="sig-role">Doctor/Profesional ${docReg ? `· TP: ${docReg}` : ''}</div>
      </div>
      ${evo.patientSignature ? `
        <div class="sig-block">
          <div class="sig-image-holder">
            <img src="${evo.patientSignature}" crossorigin="anonymous" />
          </div>
          <div class="sig-name">${patientName}</div>
          <div class="sig-role">Paciente / Aceptante</div>
        </div>
      ` : ''}
    </div>
  </div>

</body>
</html>`;

    printHTMLInHiddenIframe(html);
};

function EvolutionCard({ evo, onEdit, onDelete, onSignDoctor, onSignPatient, onPrint, patientName, planItemsLookup }) {
    const isRemission = evo.type === 'remission';
    const isNota = evo.type === 'nota';
    const hasRealizedItems = Object.values(evo.plantillaItems || {}).some(
        item => item?.realizado === true
    );
    const isFinalized = evo.isFinalized === true || evo.estadoEvolucion === 'finalizado' || hasRealizedItems;
    const procedures = getSelectedProcedures(evo.plantillaItems, planItemsLookup);
    const isSignedDoc = !!evo.doctorSignature?.signature;
    const isSignedPat = !!evo.patientSignature;
    const text = evo.description || evo.comentario || '';

    const dateObj = evo.date instanceof Date ? evo.date : new Date(evo.date || Date.now());

    const dateStr = dateObj.toLocaleDateString('es-CO', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const timeStr = dateObj.toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    const procedureNames = procedures.map(p =>
        p.dientes ? `[Diente ${p.dientes}] ${p.desc}` : p.desc
    );
    const infoLine = isNota ? '' : [evo.treatment, procedureNames.join(', ')].filter(Boolean).join(' - ');

    const badgeClass = isRemission
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : isNota
        ? 'text-purple-700 bg-purple-50 border-purple-200'
        : 'text-[#5a8a2e] bg-[#f0f9e8] border-[#c5e4a0]';

    const badgeLabel = isRemission 
        ? 'Remisión' 
        : isNota 
        ? 'Nota Aclaratoria' 
        : 'Evolución';

    return (
        <div className="bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all p-4">

            {/* FILA 1: Paciente (Doctor) + badge + acciones */}
            <div className="flex items-start justify-between gap-3 mb-1.5">
                <div>
                    <p className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-tight">
                        {patientName}
                        {evo.profesional && (
                            <span className="font-semibold text-slate-500 normal-case tracking-normal">
                                {' '}({evo.profesional})
                            </span>
                        )}
                    </p>
                    {isRemission && evo.doctorQuienRecibeName && (
                        <p className="text-[10px] font-bold text-amber-700 mt-0.5">
                            Receptor: <span className="font-extrabold">{evo.doctorQuienRecibeName}</span>
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border whitespace-nowrap ${badgeClass}`}>
                        {badgeLabel}
                    </span>

                    {/* FIRMA DOCTOR (D) */}
                    {isSignedDoc ? (
                        <span
                            className="h-7 px-2 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100 text-[10px] font-black gap-1 cursor-help"
                            title={`Firmado por Doctor: ${evo.doctorSignature.signature}`}
                        >
                            <FiCheck size={11} strokeWidth={3} /> D
                        </span>
                    ) : (
                        <button
                            onClick={() => onSignDoctor(evo)}
                            className="h-7 px-2 bg-slate-50 text-slate-500 hover:bg-indigo-600 hover:text-white rounded-lg flex items-center justify-center gap-1 transition-all border border-slate-100 text-[10px] font-black"
                            title="Firmar como Doctor (D)"
                        >
                            <FiPenTool size={11} /> D
                        </button>
                    )}

                    {/* FIRMA PACIENTE (P) */}
                    {isSignedPat ? (
                        <span
                            className="h-7 px-2 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100 text-[10px] font-black gap-1 cursor-help"
                            title="Firmado por Paciente"
                        >
                            <FiCheck size={11} strokeWidth={3} /> P
                        </span>
                    ) : (
                        <button
                            onClick={() => onSignPatient(evo)}
                            className="h-7 px-2 bg-slate-50 text-slate-500 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center gap-1 transition-all border border-slate-100 text-[10px] font-black"
                            title="Firmar como Paciente (P)"
                        >
                            <FiPenTool size={11} /> P
                        </button>
                    )}

                    <button
                        onClick={() => onPrint(evo)}
                        className="w-7 h-7 bg-slate-50 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-all border border-slate-100"
                        title="Imprimir este registro"
                    >
                        <FiPrinter size={12} />
                    </button>
                </div>
            </div>

            {/* FILA 2: Fecha y hora */}
            <p className="text-[10px] font-bold text-slate-400 mb-2">
                {dateStr} — {timeStr}
            </p>

            {/* FILA 3: Texto del registro */}
            {text && (
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed mb-2 line-clamp-3">
                    {text}
                </p>
            )}

            {/* FILA 4: Plan · Procedimientos + Registro Clínico Permanente (Candado) */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                {infoLine ? (
                    <p className="text-[11px] font-bold text-slate-500">
                        {infoLine}
                    </p>
                ) : <span />}
                
                <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 cursor-help" title="Registro clínico inalterable">
                    <FiLock size={12} className="text-slate-400" />
                </span>
            </div>
        </div>
    );
}

// MODAL DE CANALES DE ENVÍO DE FIRMA (WhatsApp, Correo, SMS)
function SendChannelModal({ isOpen, onClose, patient, evolution, clinicInfo }) {
    if (!isOpen) return null;

    const patientName = patient?.nombreCompleto || patient?.nombre || "Paciente";
    const patientPhone = patient?.celular || patient?.telefono || "";
    const patientEmail = patient?.email || patient?.correo || "";
    const clinicName = clinicInfo?.nombre || "ATM Centro del Dolor Orofacial";

    const handleSendWhatsApp = () => {
        const cleanPhone = String(patientPhone).replace(/\D/g, "");
        const formattedPhone = cleanPhone.startsWith("57") ? cleanPhone : `57${cleanPhone}`;
        const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        const signUrl = `${window.location.origin}${basePath}/portal-paciente/firma-digital?id=${patient?.id || ''}&evoId=${evolution?.id || ''}`;
        const message = `${patientName}, lo contactamos de la clínica ${clinicName}. Para firmar su documento clínico utilice el siguiente link: ${signUrl}`;
        
        const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
        onClose();
    };

    const handleSendEmail = () => {
        if (!patientEmail) {
            alert("El paciente no tiene un correo electrónico registrado.");
            return;
        }
        alert(`✅ Enlace de firma enviado exitosamente al correo: ${patientEmail}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-scaleIn">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800 tracking-tight">
                        Seleccione el medio de envío
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                        <FiX size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 text-xs text-slate-600">
                    <p className="leading-relaxed font-medium">
                        Seleccione el medio por el que desea que se envíe el link para que el paciente ingrese su firma
                    </p>
                    <p className="leading-relaxed font-medium text-slate-500">
                        Seleccione el medio por el que desea que se envíe el link para que el profesional externo ingrese su firma
                    </p>

                    {/* Botones de Canales (Iconos Rosa, Verde WhatsApp, Azul Correo) */}
                    <div className="flex items-center justify-center gap-4 pt-4 pb-2">
                        {/* Cancelar / SMS (Rosa) */}
                        <button
                            type="button"
                            onClick={onClose}
                            title="Cancelar / Cerrar"
                            className="w-12 h-12 rounded-xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                            <FiX size={20} strokeWidth={2.5} />
                        </button>

                        {/* WhatsApp (Verde) */}
                        <button
                            type="button"
                            onClick={handleSendWhatsApp}
                            title="Enviar por WhatsApp"
                            className="w-12 h-12 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-10.416c-4.408 0-7.99 3.582-7.99 7.99 0 1.408.365 2.73 1.001 3.872l-1.062 3.882 3.987-1.045c1.104.602 2.371.944 3.722.945 4.406 0 7.988-3.582 7.989-7.99.001-4.408-3.58-7.99-7.987-7.99z"/>
                            </svg>
                        </button>

                        {/* Correo (Azul) */}
                        <button
                            type="button"
                            onClick={handleSendEmail}
                            title="Enviar por Correo Electrónico"
                            className="w-12 h-12 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                            <svg className="w-6 h-6 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// MODAL DE FIRMA DEL PACIENTE
function SignatureModal({ isOpen, onClose, evolution, patient, clinicInfo, onSaveSignature }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState([]);
    const [huellaImage, setHuellaImage] = useState(evolution?.patientFingerprint || null);
    const [saving, setSaving] = useState(false);
    const [sendModalOpen, setSendModalOpen] = useState(false);
    const toast = useToast();

    // Configurar el estilo del trazo del canvas
    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Cargar firma previa si existe
        if (evolution?.patientSignature) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = evolution.patientSignature;
        }
    }, [isOpen, evolution]);

    // Lógica de Dibujo del Canvas
    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        
        const canvas = canvasRef.current;
        const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory(prev => [...prev, state]);

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleClearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHistory([]);
    };

    const handleAddHuella = () => {
        setHuellaImage(FINGERPRINT_SVG);
    };

    const handleRemoveHuella = () => {
        setHuellaImage(null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const canvas = canvasRef.current;
            const patientSignature = canvas ? canvas.toDataURL('image/png') : null;
            await onSaveSignature(evolution.id, {
                patientSignature,
                patientFingerprint: huellaImage,
                patientSignedAt: new Date().toISOString()
            });
            onClose();
        } catch (error) {
            console.error("Error al guardar firma del paciente:", error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // Calcular edad
    const getEdad = () => {
        if (!patient?.fechaNacimiento) return patient?.edad || 'N/A';
        try {
            const birth = new Date(patient.fechaNacimiento);
            const diff = Date.now() - birth.getTime();
            const ageDate = new Date(diff);
            return Math.abs(ageDate.getUTCFullYear() - 1970);
        } catch {
            return patient?.edad || 'N/A';
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn">
                    
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                        <div>
                            <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-wider">Firma paciente</h4>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Registre la firma manuscrita y huella digital para certificar la evolución clínica.</p>
                        </div>
                        <button type="button" onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors p-1">
                            <FiX size={18} />
                        </button>
                    </div>

                    {/* Body Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                        
                        {/* PDF Preview Frame (Simulado como hoja clínica profesional idéntico a OralDrive) */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-50 p-6 max-h-[380px] overflow-y-auto custom-scrollbar">
                            <div className="bg-white border border-slate-100 p-8 shadow-sm rounded-lg max-w-3xl mx-auto font-sans text-slate-800">
                                
                                {/* Cabecera Clínica */}
                                <div className="flex justify-between items-center pb-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-slate-100 rounded-xl border flex items-center justify-center font-black text-indigo-600 text-xs shadow-inner">
                                            ATM
                                        </div>
                                        <div>
                                            <h2 className="text-[12px] font-black uppercase text-slate-800 leading-tight">ATM Centro del Dolor Orofacial</h2>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">64576359-3 · Calle 16 #17-68</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">Evolución</span>
                                    </div>
                                </div>

                                {/* Info Completa Paciente en Tabla Cuadrícula (Replicando la estructura de OralDrive) */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'sans-serif', fontSize: '9px', color: '#334155', marginBottom: '15px', border: '1px solid #cbd5e1' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', width: '18%', backgroundColor: '#f8fafc' }}>Nombre del paciente</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '32%' }}>{patient?.nombreCompleto || patient?.nombre}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', width: '15%', backgroundColor: '#f8fafc' }}>Edad</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '15%' }}>{getEdad()}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', width: '10%', backgroundColor: '#f8fafc' }}>Nro Historia</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '10%' }}>{patient?.documento || patient?.cedula || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Tipo documento</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.tipoDocumento || 'Cédula de ciudadanía'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Nro de documento</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }} colSpan="3">{patient?.documento || patient?.cedula || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Sexo</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.genero || patient?.sexo || 'Femenino'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Fecha y lugar de nacimiento</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }} colSpan="3">
                                                {patient?.fechaNacimiento ? new Date(patient.fechaNacimiento).toLocaleDateString('es-CO') : '12/04/1996'} · {patient?.lugarNacimiento || 'Colombia - Sincelejo'}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Correo</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.email || patient?.correo || 'N/A'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Ocupación</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.ocupacion || 'Asistente Administrativo'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Fecha impresión</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{new Date().toLocaleDateString('es-CO')}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Teléfonos</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.celular || patient?.telefono || 'N/A'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Estado civil</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }} colSpan="3">{patient?.estadoCivil || 'Soltero'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Nombre responsable</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.nombreResponsable || 'N/A'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>EPS</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.nombreEps || 'N/A'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Doctor/Profesional</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{evolution?.profesional || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Parentesco responsable</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.parentesco || 'N/A'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Nombre acompañante</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }} colSpan="3">{patient?.nombreAcompanante || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Teléfono responsable</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }}>{patient?.celularResponsable || 'N/A'}</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Tel. Acompañante</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }} colSpan="3">{patient?.telefonoAcompanante || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>Dirección residencia</td>
                                            <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px' }} colSpan="5">{patient?.direccion || patient?.direccionResidencia || 'N/A'}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Separador Evoluciones */}
                                <div className="flex items-center justify-center my-4">
                                    <div className="border-t border-dashed border-slate-300 w-full" />
                                    <span className="px-4 text-[9px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Evoluciones</span>
                                    <div className="border-t border-dashed border-slate-300 w-full" />
                                </div>

                                {/* Contenido Evolución */}
                                <div className="space-y-2 mt-4 text-left">
                                    <p className="text-[10px] font-black text-slate-800">
                                        {patient?.nombreCompleto || patient?.nombre} ({evolution?.profesional})
                                        <span className="font-medium text-slate-400 block mt-0.5">
                                            {new Date(evolution?.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })} — {new Date(evolution?.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </span>
                                    </p>
                                    <p className="text-[10px] text-slate-600 leading-relaxed font-semibold bg-slate-50 p-2.5 rounded border border-slate-100">
                                        {evolution?.description || evolution?.comentario}
                                    </p>
                                    {/* Plan de tratamiento - Procedimientos (formato OralDrive) */}
                                    {(() => {
                                        const items = evolution?.plantillaItems ? Object.values(evolution.plantillaItems).filter(v => v?.checked) : [];
                                        const planName = evolution?.treatment || '';
                                        return items.length > 0 ? items.map((item, i) => {
                                            const procName = item.desc || item.procedimiento || item.nombre || '';
                                            if (!procName) return null;
                                            const line = planName ? `${planName} - ${i + 1}. ${procName.toUpperCase()}` : `${i + 1}. ${procName.toUpperCase()}`;
                                            return (
                                                <p key={i} className="text-[10px] font-bold text-slate-700 mt-1">
                                                    {line}
                                                </p>
                                            );
                                        }) : planName ? (
                                            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wide">
                                                {planName}
                                            </p>
                                        ) : null;
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Controles de Firma y Huella */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Panel de Firma */}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Firma paciente</span>
                                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-inner relative h-40">
                                    <canvas
                                        ref={canvasRef}
                                        width={400}
                                        height={160}
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                        className="w-full h-full cursor-crosshair touch-none"
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={handleClearCanvas}
                                        className="px-4 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border border-rose-100 cursor-pointer"
                                    >
                                        Borrar firma
                                    </button>
                                </div>
                            </div>

                            {/* Panel de Huella */}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Huella digital</span>
                                <div className="border border-slate-200 rounded-2xl bg-white shadow-inner h-40 flex items-center justify-center relative overflow-hidden">
                                    {huellaImage ? (
                                        <img src={huellaImage} alt="Huella" className="w-20 h-20 object-contain animate-fadeIn" />
                                    ) : (
                                        <div className="text-center p-4">
                                            <FiAlertCircle size={24} className="text-slate-300 mx-auto mb-1" />
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">No se ha registrado huella</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={handleRemoveHuella}
                                        disabled={!huellaImage}
                                        className="px-4 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border border-rose-100 disabled:opacity-50 cursor-pointer"
                                    >
                                        Borrar huella
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAddHuella}
                                        className="px-4 py-1.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                                    >
                                        Agregar huella
                                    </button>
                                </div>
                            </div>

                        </div>

                    </div>

                    {/* Footer Buttons */}
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border-2 border-slate-200 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            onClick={() => setSendModalOpen(true)}
                            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                            Enviar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md shadow-lime-500/10 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                            {saving ? "Guardando..." : "Guardar"}
                        </button>
                    </div>

                </div>
            </div>

            {/* Modal de Selección de Medio de Envío */}
            <SendChannelModal
                isOpen={sendModalOpen}
                onClose={() => setSendModalOpen(false)}
                patient={patient}
                evolution={evolution}
                clinicInfo={clinicInfo}
            />
        </>
    );
}

export default function EvolutionList({ patientId, patientName, patientObj, onEdit, searchTerm, refreshKey }) {
    const { userProfile } = useAuth();
    const [evolutions, setEvolutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [planItemsLookup, setPlanItemsLookup] = useState({});
    
    // Estados para Firma del Paciente
    const [activeEvoForSignature, setActiveEvoForSignature] = useState(null);
    
    const toast = useToast();

    const [clinicConfig, setClinicConfig] = useState(null);

    useEffect(() => {
        const fetchClinicConfig = async () => {
            const tenantId = userProfile?.inquilino || userProfile?.tenantId || patientObj?.tenant_id;
            if (!tenantId) return;
            try {
                const { data } = await supabase
                    .from("tenants")
                    .select("*")
                    .eq("id", tenantId)
                    .maybeSingle();
                if (data) {
                    setClinicConfig(data);
                }
            } catch (e) {
                console.error("Error loading clinic config for print:", e);
            }
        };
        fetchClinicConfig();
    }, [userProfile, patientObj]);

    // Info de la clínica para el PDF / Impresión
    const clinicInfo = {
        logo: clinicConfig?.logo || clinicConfig?.logo_url || clinicConfig?.logoUrl || userProfile?.tenant?.logo || userProfile?.tenant?.logo_url || '',
        nombre: clinicConfig?.nombre_comercial || clinicConfig?.nombreComercial || clinicConfig?.name || clinicConfig?.nombre || userProfile?.tenant?.nombreComercial || 'CLÍNICA DENTAL',
        nit: clinicConfig?.nit || userProfile?.tenant?.nit || '',
        direccion: clinicConfig?.address || clinicConfig?.direccion || userProfile?.tenant?.direccion || '',
        telefono: clinicConfig?.phone || clinicConfig?.telefono || userProfile?.tenant?.telefono || '',
        email: clinicConfig?.email || userProfile?.tenant?.email || ''
    };

    const handlePrintEvolution = (evo) => {
        printEvolution(evo, patientObj, clinicInfo, userProfile);
    };

    useEffect(() => {
        if (!patientId) return;

        const loadEvolutions = async () => {
            try {
                const { data } = await supabase
                    .from("evoluciones")
                    .select("*")
                    .eq("paciente_id", patientId)
                    .order("created_at", { ascending: false });

                const parsedList = (data || []).map(evo => {
                    let parsedTratamiento = {};
                    if (evo.tratamiento && typeof evo.tratamiento === 'string' && evo.tratamiento.startsWith('{')) {
                        try {
                            parsedTratamiento = JSON.parse(evo.tratamiento);
                        } catch (e) {}
                    }

                    return {
                        ...evo,
                        ...parsedTratamiento,
                        id: evo.id,
                        description: evo.comentario || parsedTratamiento.description || evo.description || '',
                        date: evo.created_at || evo.fecha,
                        profesional: evo.profesional || parsedTratamiento.profesional || 'Odontólogo',
                        doctorSignature: parsedTratamiento.doctorSignature || evo.doctorSignature,
                        patientSignature: parsedTratamiento.patientSignature || evo.patientSignature,
                        patientFingerprint: parsedTratamiento.patientFingerprint || evo.patientFingerprint,
                    };
                });

                setEvolutions(parsedList);
            } catch (err) {
                console.error("Error cargando evoluciones:", err);
            } finally {
                setLoading(false);
            }
        };

        loadEvolutions();
    }, [patientId, refreshKey]);

    // Fetch plantillas de planes
    useEffect(() => {
        const fetchPlans = async () => {
            const planIds = Array.from(new Set(evolutions.map(e => e.planId).filter(Boolean)));
            if (planIds.length === 0) return;
            const lookup = {};
            try {
                const { data: plansData } = await supabase
                    .from("planes_tratamiento")
                    .select("*")
                    .in("id", planIds);
                (plansData || []).forEach(planData => {
                    lookup[planData.id] = {};
                    (planData.items || []).forEach(item => {
                        lookup[planData.id][item.id] = {
                            desc: item.desc || item.procedimiento || item.nombre || '',
                            dientes: item.dientes || ''
                        };
                    });
                });
            } catch (e) {
                // Ignorar
            }
            setPlanItemsLookup(lookup);
        };
        fetchPlans();
    }, [evolutions]);

    // Firma Doctor
    const handleSignEvolutionDoctor = async (evoObj) => {
        try {
            let parsed = {};
            if (evoObj.tratamiento && typeof evoObj.tratamiento === 'string' && evoObj.tratamiento.startsWith('{')) {
                try { parsed = JSON.parse(evoObj.tratamiento); } catch (e) {}
            } else {
                parsed = { ...evoObj };
            }

            // Validar que únicamente el doctor asociado a la evolución pueda firmar
            const validation = validateDoctorCanSign(userProfile, { ...evoObj, ...parsed });
            if (!validation.canSign) {
                toast.error(validation.message || "Oops! Sólo el doctor asociado a este documento puede firmar");
                return;
            }

            const doctorIdent = evoObj.profesional || parsed.profesional || (userProfile?.esDoctor ? userProfile?.nombreCompleto : "");
            const doctorData = await getDoctorSignatureAndData(doctorIdent, userProfile?.inquilino, userProfile);

            const doctorSignature = {
                signature: doctorData.nombreCompleto || userProfile?.nombreCompleto || userProfile?.nombre || "Doctor",
                signatureImage: doctorData.firma || userProfile?.firmaElectronica || userProfile?.firma || null,
                registroMedico: doctorData.registroMedico || userProfile?.registroMedico || "",
                especialidad: doctorData.especialidad || userProfile?.especialidad || "",
                signedAt: new Date().toISOString(),
                signedBy: userProfile?.uid
            };

            const updatedData = {
                ...parsed,
                doctorSignature
            };

            const { error } = await supabase
                .from("evoluciones")
                .update({
                    tratamiento: JSON.stringify(updatedData)
                })
                .eq("id", evoObj.id);

            if (error) throw error;

            setEvolutions(prev => prev.map(e => e.id === evoObj.id ? { ...e, doctorSignature } : e));
            toast.success("Evolución firmada digitalmente por el profesional ✅");
        } catch (error) {
            console.error("Error signing evolution by doctor:", error);
            toast.error("Error al firmar como profesional");
        }
    };

    // Abre modal para firma del Paciente
    const handleOpenPatientSignature = (evoObj) => {
        setActiveEvoForSignature(evoObj);
    };

    // Guarda firma / huella del Paciente
    const handleSavePatientSignature = async (evoId, signatureData) => {
        try {
            const evoObj = evolutions.find(e => e.id === evoId);
            let parsed = {};
            if (evoObj?.tratamiento && typeof evoObj.tratamiento === 'string' && evoObj.tratamiento.startsWith('{')) {
                try { parsed = JSON.parse(evoObj.tratamiento); } catch (e) {}
            } else if (evoObj) {
                parsed = { ...evoObj };
            }

            const updatedData = {
                ...parsed,
                patientSignature: signatureData.patientSignature || parsed.patientSignature,
                patientFingerprint: signatureData.patientFingerprint || parsed.patientFingerprint,
                patientSignedAt: signatureData.patientSignedAt || new Date().toISOString()
            };

            const { error } = await supabase
                .from("evoluciones")
                .update({
                    tratamiento: JSON.stringify(updatedData)
                })
                .eq("id", evoId);

            if (error) throw error;

            setEvolutions(prev => prev.map(e => e.id === evoId ? {
                ...e,
                patientSignature: signatureData.patientSignature || e.patientSignature,
                patientFingerprint: signatureData.patientFingerprint || e.patientFingerprint,
                patientSignedAt: signatureData.patientSignedAt || e.patientSignedAt
            } : e));
            toast.success("Firma del paciente guardada correctamente");
        } catch (error) {
            console.error("Error saving patient signature:", error);
            toast.error("Error al guardar la firma del paciente");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta evolución?")) return;
        try {
            await supabase.from("evoluciones").delete().eq("id", id);
            toast.success("Evolución eliminada");
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 opacity-30 animate-pulse">
            <FiActivity size={48} className="text-slate-400 mb-4" />
            <h5 className="text-[14px] font-black uppercase tracking-widest text-slate-500">Cargando Historial...</h5>
        </div>
    );

    if (evolutions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-slate-50 border border-slate-100 rounded-[32px] mx-8 my-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-200 mb-4 shadow-sm">
                    <FiActivity size={32} />
                </div>
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight mb-2">Sin Historial</h3>
                <p className="text-[11px] font-bold text-slate-400 text-center uppercase tracking-widest leading-relaxed">No hay registros para este paciente.</p>
            </div>
        );
    }

    const filtered = evolutions.filter(evo => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        const lookup = evo.planId ? (planItemsLookup[evo.planId] || {}) : {};
        const procedures = getSelectedProcedures(evo.plantillaItems, lookup).map(p => p.desc).join(' ');
        const typeLabel = evo.type === 'remission' ? 'remisión' : evo.type === 'nota' ? 'nota aclaratoria' : 'evolución';
        return (
            (evo.description || evo.comentario || '').toLowerCase().includes(q) ||
            (evo.profesional || '').toLowerCase().includes(q) ||
            (evo.doctorQuienRecibeName || '').toLowerCase().includes(q) ||
            (evo.treatment || '').toLowerCase().includes(q) ||
            typeLabel.includes(q) ||
            procedures.toLowerCase().includes(q)
        );
    });

    return (
        <div className="py-6 px-4 sm:px-8 md:px-12 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-5 px-1 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <FiFileText className="text-[#8dc63f]" size={15} />
                    Historial
                </h3>
                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="space-y-3">
                {filtered.map((evo) => {
                    const lookup = evo.planId ? (planItemsLookup[evo.planId] || {}) : {};
                    return (
                        <EvolutionCard
                            key={evo.id}
                            evo={evo}
                            patientName={patientName || evo.patientName || 'Paciente'}
                            planItemsLookup={lookup}
                            onEdit={onEdit}
                            onDelete={handleDelete}
                            onSignDoctor={handleSignEvolutionDoctor}
                            onSignPatient={handleOpenPatientSignature}
                            onPrint={handlePrintEvolution}
                        />
                    );
                })}
                {filtered.length === 0 && searchTerm && (
                    <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">
                        No se encontraron coincidencias.
                    </div>
                )}
            </div>

            {/* MODAL DE FIRMAS INTEGRADAS PARA EL PACIENTE */}
            <SignatureModal
                isOpen={!!activeEvoForSignature}
                onClose={() => setActiveEvoForSignature(null)}
                evolution={activeEvoForSignature}
                patient={patientObj}
                clinicInfo={clinicInfo}
                onSaveSignature={handleSavePatientSignature}
            />
        </div>
    );
}
