import React, { useEffect, useState, useRef } from 'react';
import supabase from '../../../lib/supabaseClient';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { FiActivity, FiEdit3, FiTrash2, FiPenTool, FiCheck, FiFileText, FiX, FiAlertCircle, FiPrinter, FiLock } from 'react-icons/fi';


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
const printEvolution = (evo, patient, clinicInfo = {}) => {
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

    const docBadgeLabel = evo.type === 'remission' ? 'Remisión' : evo.type === 'nota' ? 'Nota Aclaratoria' : 'Evolución';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Evolución — ${patientName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
      margin-bottom: 25px;
      gap: 20px;
    }
    .logo-container {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .clinic-logo {
      max-height: 75px;
      max-width: 160px;
      object-fit: contain;
    }
    .logo-text-placeholder {
      width: 70px;
      height: 70px;
      background: #2563eb;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 32px;
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
      padding: 16px 20px;
      margin-bottom: 15px;
      background: #ffffff;
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
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .proc-tag {
      display: inline-block;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 8pt;
      font-weight: 800;
      margin: 3px 4px 6px 0;
      color: #166534;
      text-transform: uppercase;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-box {
      text-align: center;
    }
    .sig-line {
      border-bottom: 1.5px solid #64748b;
      height: 45px;
      margin-bottom: 8px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .sig-title {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
    }
    @media print {
      body { padding: 15px; }
      @page { size: Letter; margin: 15mm 12mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      ${logoUrl ? `<img src="${logoUrl}" class="clinic-logo" crossorigin="anonymous" />` : `<div class="logo-text-placeholder">${clinicName.substring(0, 1) || "O"}</div>`}
      <div>
        <h1 class="clinic-title">${clinicName}</h1>
        <p class="clinic-meta" style="font-weight: 800;">NIT: ${clinicNit}</p>
        <p class="clinic-meta">${clinicAddress}</p>
        <p class="clinic-meta">TEL: ${clinicPhone}</p>
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-badge">
        <span>${docBadgeLabel}</span>
      </div>
      <p class="doc-meta">EXPEDIENTE REGISTRO CLÍNICO</p>
    </div>
  </div>

  <div class="patient-card">
    <div class="info-group">
      <div class="info-label">Nombre Completo</div>
      <div class="info-value">${patientName}</div>
    </div>
    <div class="info-group">
      <div class="info-label">Identificación</div>
      <div class="info-value">${patient?.tipoDocumento || 'Cédula de ciudadanía'} ${patient?.documento || patient?.cedula || 'N/A'}</div>
    </div>
    <div class="info-group">
      <div class="info-label">Nro. Historia</div>
      <div class="info-value">${patient?.documento || patient?.cedula || patient?.id || 'N/A'}</div>
    </div>
    <div class="info-group">
      <div class="info-label">Celular</div>
      <div class="info-value">${patient?.celular || patient?.telefono || 'No registrado'}</div>
    </div>
    <div class="info-group">
      <div class="info-label">Correo Electrónico</div>
      <div class="info-value">${patient?.email || patient?.correo || 'No registrado'}</div>
    </div>
    <div class="info-group">
      <div class="info-label">Edad</div>
      <div class="info-value">${edad}</div>
    </div>
    <div class="info-group">
      <div class="info-label">EPS</div>
      <div class="info-value">${patient?.nombreEps || patient?.eps || 'No registrada'}</div>
    </div>
    <div class="info-group">
      <div class="info-label">Tipo Vinculación</div>
      <div class="info-value">${patient?.tipoVinculacion || 'Particular'}</div>
    </div>
    <div class="info-group">
      <div class="info-label">Fecha de Ingreso</div>
      <div class="info-value">${patient?.created_at ? new Date(patient.created_at).toLocaleDateString('es-CO') : printDate}</div>
    </div>
  </div>

  <div class="section-title">Evoluciones y Documentos Clínicos</div>

  <div class="document-item">
    <div class="document-header">
      <div>
        <span class="document-type">${docBadgeLabel}</span>
        <span style="color:#64748b; margin-left: 8px;">(${evo.profesional || 'Odontólogo Responsable'})</span>
      </div>
      <div>${dateStr} — ${timeStr}</div>
    </div>

    ${procedimientos.length > 0 ? `<div style="margin-bottom: 10px;">${procedimientos.map(p => `<span class="proc-tag">${p}</span>`).join('')}</div>` : ''}

    <div class="document-body">${(evo.description || evo.comentario || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>

    ${(evo.doctorSignature || evo.patientSignature) ? `
    <div class="signature-grid">
      <div class="sig-box">
        <div class="sig-line">
          ${evo.doctorSignature?.signature ? `<span style="font-size:10px;font-weight:900;color:#1e293b;">${evo.doctorSignature.signature}</span>` : ''}
        </div>
        <div class="sig-title">Doctor / Profesional</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">
          ${evo.patientSignature ? `<img src="${evo.patientSignature}" style="max-height:40px;object-fit:contain;" />` : ''}
        </div>
        <div class="sig-title">Paciente</div>
      </div>
    </div>` : ''}
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

// MODAL DE FIRMA DEL PACIENTE
function SignatureModal({ isOpen, onClose, evolution, patient, onSaveSignature }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState([]);
    const [huellaImage, setHuellaImage] = useState(evolution?.patientFingerprint || null);
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    // Configurar el estilo del trazo del canvas
    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0f172a'; // Color slate-900 para el trazo
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

    const handleUndo = () => {
        if (history.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const prevHistory = [...history];
        const lastState = prevHistory.pop();
        setHistory(prevHistory);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (lastState) {
            ctx.putImageData(lastState, 0, 0);
        }
    };

    const handleAddHuella = () => {
        toast.error("No se detectó huella. Dispositivo lector (huellero) no conectado.");
    };

    const handleRemoveHuella = () => {
        setHuellaImage(null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const canvas = canvasRef.current;
            const dataUrl = canvas.toDataURL('image/png');
            
            const blank = document.createElement('canvas');
            blank.width = canvas.width;
            blank.height = canvas.height;
            const isCanvasBlank = canvas.toDataURL() === blank.toDataURL() && !evolution?.patientSignature;

            const updateData = {
                patientSignature: isCanvasBlank ? null : dataUrl,
                patientFingerprint: huellaImage,
                patientSignedAt: new Date().toISOString()
            };

            await onSaveSignature(evolution.id, updateData);
            toast.success("Firma del paciente guardada");
            onClose();
        } catch (err) {
            console.error("Error saving patient signature:", err);
            toast.error("Error al guardar la firma del paciente");
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
                                    className="px-4 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border border-rose-100"
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
                                    className="px-4 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border border-rose-100 disabled:opacity-50"
                                >
                                    Borrar huella
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddHuella}
                                    className="px-4 py-1.5 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm"
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
                        className="px-6 py-2 border-2 border-slate-200 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            toast.info("Documento clínico enviado al paciente (Simulado)");
                        }}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                    >
                        Enviar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-2 bg-[#8dc63f] hover:bg-[#7cb035] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md shadow-lime-500/10 transition-all disabled:opacity-50"
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>

            </div>
        </div>
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
        printEvolution(evo, patientObj, clinicInfo);
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

                const list = (data || []).map(row => {
                    let parsed = {};
                    if (row.tratamiento && typeof row.tratamiento === 'string' && row.tratamiento.startsWith('{')) {
                        try { parsed = JSON.parse(row.tratamiento); } catch (e) {}
                    }
                    return {
                        id: row.id,
                        ...parsed,
                        ...row,
                        comentario: parsed.comentario || parsed.description || (typeof row.tratamiento === 'string' && !row.tratamiento.startsWith('{') ? row.tratamiento : ''),
                        type: parsed.type || 'evolution',
                        date: row.fecha ? new Date(row.fecha) : (parsed.date ? new Date(parsed.date) : (row.created_at ? new Date(row.created_at) : new Date()))
                    };
                });
                setEvolutions(list);
            } catch (err) {
                console.error("Error loading evolutions:", err);
            } finally {
                setLoading(false);
            }
        };

        loadEvolutions();
    }, [patientId, refreshKey]);

    // Cargar planes para lookup
    useEffect(() => {
        if (evolutions.length === 0) return;

        const planIds = [...new Set(
            evolutions
                .filter(e => e.planId)
                .map(e => e.planId)
        )];
        if (planIds.length === 0) return;

        const fetchPlans = async () => {
            const lookup = {};
            try {
                const { data: plansData } = await supabase
                    .from("treatment_plans")
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

            const doctorSignature = {
                signature: userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.displayName || userProfile?.email || "Doctor",
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
            toast.success("Evolución firmada por el profesional");
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
                onSaveSignature={handleSavePatientSignature}
            />
        </div>
    );
}
