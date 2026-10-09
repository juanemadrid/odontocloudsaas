import supabase from "../lib/supabaseClient";
import { toast } from "sonner";

/**
 * BudgetPrintService
 * Genera documentos impresos institucionales para Presupuestos y Planes de Tratamiento
 * con diseño sobrio y profesional en tonos oscuros (estilo unificado clínico).
 */

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
            console.error("Error al imprimir iframe de presupuesto:", e);
        }
    };

    iframe.onload = () => {
        setTimeout(triggerPrint, 150);
    };

    setTimeout(triggerPrint, 500);
};

export const BudgetPrintService = {
    generatePDF: async (plan, patient, clinic, userProfile) => {
        if (!plan || !patient) {
            toast.error("Datos insuficientes para generar el documento");
            return;
        }

        const toastId = toast.loading("Preparando documento para impresión...");

        try {
            // 1. Resolver Datos de la Empresa / Clínica
            const tenantId = clinic?.inquilino || clinic?.id || userProfile?.inquilino || userProfile?.tenantId || userProfile?.tenant_id || "";
            let dbLogoUrl = "";
            let dbClinicName = "";
            let dbClinicNit = "";
            let dbClinicAddress = "";
            let dbClinicPhone = "";
            let dbClinicEmail = "";
            let dbParametros = null;

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
                        dbClinicEmail = clinicConfig.email || "";
                        if (clinicConfig.parametros) {
                            try {
                                dbParametros = typeof clinicConfig.parametros === "string" 
                                    ? JSON.parse(clinicConfig.parametros) 
                                    : clinicConfig.parametros;
                            } catch (eParam) {
                                console.warn("Error parseando parametros del tenant:", eParam);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error cargando configuración de clínica:", err);
                }
            }

            const logoUrl = dbLogoUrl || clinic?.logo || clinic?.logoUrl || userProfile?.tenant?.logo || "";
            const clinicName = dbClinicName || clinic?.nombreComercial || clinic?.nombre || clinic?.name || userProfile?.tenant?.nombreComercial || "CLÍNICA DENTAL";
            const clinicNit = dbClinicNit || clinic?.nit || clinic?.NIT || userProfile?.tenant?.nit || "—";
            const clinicAddress = dbClinicAddress || clinic?.direccion || clinic?.address || userProfile?.tenant?.direccion || "—";
            const clinicPhone = dbClinicPhone || clinic?.telefono || clinic?.phone || userProfile?.tenant?.telefono || "—";
            const clinicEmail = dbClinicEmail || clinic?.email || userProfile?.tenant?.email || "";
            const generalParams = dbParametros?.general || userProfile?.tenant?.parametros?.general || {};

            // 2. Resolver Datos del Paciente
            const pName = (patient?.nombreCompleto || patient?.NombreCompleto || patient?.paciente || patient?.Paciente || "").toString().trim() || 
                         (patient?.nombres ? `${patient.nombres} ${patient.apellidos || ""}`.trim() : "") ||
                         (patient?.nombre || patient?.name || "").toString().trim() ||
                         "Paciente Sin Nombre";
            
            const pDoc = patient?.nroDocumento || 
                        patient?.documento || 
                        patient?.cedula || 
                        patient?.nroHistoria ||
                        "---";
            
            const pTipoDoc = patient?.tipoDocumento || "Cédula de ciudadanía";
            
            const pPhone = patient?.celular || 
                          patient?.telefono || 
                          patient?.celularPaciente || 
                          "---";

            const pAddress = patient?.lugarResidencia || patient?.direccion || patient?.direccionResidencia || "---";
            const pCity = patient?.ciudadDomicilio || patient?.ciudad || patient?.municipio || "---";

            // 3. Fechas y Vigencia (Sincronizada con Parámetros Institucionales)
            const date = plan.date ? new Date(plan.date) : new Date();
            const formattedDate = date.toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' });
            const vigencia = Number(plan.vigencia) || Number(generalParams.vigenciaPresupuestos) || 30;
            const validUntil = new Date(date);
            validUntil.setDate(validUntil.getDate() + vigencia);
            const formattedValidUntil = validUntil.toLocaleDateString("es-CO", { day: 'numeric', month: 'long', year: 'numeric' });
            const printDate = new Date().toLocaleDateString("es-CO");

            // 4. Totales y Cálculos
            const items = Array.isArray(plan.items) ? plan.items : [];
            const subtotal = plan.subtotal || items.reduce((acc, i) => acc + (Number(i.amount || 0) * Number(i.qty || 1)), 0);
            const discount = plan.totalDescuento || items.reduce((acc, i) => acc + Number(i.descuento || 0), 0);
            const total = plan.total || (subtotal - discount);

            // 5. Consecutivo institucional (sin mostrar identificadores técnicos UUID como #00F0DB39)
            const nroConsecutivo = plan.nroConsecutivo || plan.consecutivo || plan.numero || null;
            const consecutivoHTML = nroConsecutivo
                ? `<p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Nro. Consecutivo:</strong> ${nroConsecutivo}</p>`
                : '';

            // 6. Quien elaboró el presupuesto (inteligente según rol real)
            const elaboradorNombre = (
                plan.creadoPor || 
                plan.elaboradoPor || 
                plan.creado_por || 
                plan.created_by_name || 
                userProfile?.nombreCompleto || 
                userProfile?.nombre || 
                "Administración"
            ).toUpperCase();

            const rawRol = (plan.rolCreador || userProfile?.rol || userProfile?.cargo || "").toLowerCase();
            let elaboradorRol = "Administración";
            if (rawRol.includes("doc") || rawRol.includes("odont") || rawRol.includes("profesional") || userProfile?.esDoctor) {
                elaboradorRol = userProfile?.registroMedico ? `Odontólogo / Doctor • TP: ${userProfile.registroMedico}` : "Odontólogo / Doctor";
            } else if (rawRol.includes("recep")) {
                elaboradorRol = "Recepción";
            } else if (rawRol.includes("contad") || rawRol.includes("conta")) {
                elaboradorRol = "Contabilidad";
            } else if (rawRol.includes("admin")) {
                elaboradorRol = "Administrador";
            } else if (userProfile?.rol) {
                elaboradorRol = userProfile.rol;
            }

            // 7. Filas de Procedimientos (Sin columna "Realizado", con columna "Descuento")
            const itemsRowsHTML = items.map((item, index) => {
                const qty = Number(item.qty || 1);
                const unitPrice = Number(item.amount || item.precio || item.valor || 0);
                const itemDisc = Number(item.descuento || 0);
                const lineTotal = (unitPrice * qty) - itemDisc;

                return `
                    <tr style="border-bottom: 1px solid #cbd5e1; background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td style="padding: 6px 8px; color: #0f172a; font-weight: 700; font-family: monospace;">${item.code || item.codigo || "---"}</td>
                        <td style="padding: 6px 8px;">
                            <div style="font-weight: 700; text-transform: uppercase; color: #0f172a;">${item.desc || item.nombre || item.descripcion || "---"}</div>
                            ${item.line_obs ? `<div style="font-size: 8.5px; color: #64748b; font-style: italic; margin-top: 1px;">OBS: ${item.line_obs}</div>` : ""}
                        </td>
                        <td style="padding: 6px 8px; text-align: center; color: #334155; font-weight: 600;">${item.dientes || "---"}</td>
                        <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #0f172a;">${qty}</td>
                        <td style="padding: 6px 8px; text-align: right; color: #0f172a;">$${unitPrice.toLocaleString('es-CO')}</td>
                        <td style="padding: 6px 8px; text-align: right; color: #334155;">${itemDisc > 0 ? `-$${itemDisc.toLocaleString('es-CO')}` : '$0'}</td>
                        <td style="padding: 6px 8px; text-align: right; font-weight: 800; color: #0f172a;">$${lineTotal.toLocaleString('es-CO')}</td>
                    </tr>
                `;
            }).join('');

            // 7.1 Términos y Observaciones: prioridad nota del plan, luego parámetro institucional, o vacío limpio
            const planObs = (plan.observaciones || "").toString().trim();
            const configObs = (generalParams.textoAyudaPlan || "").toString().trim();
            const finalObservations = planObs || configObs || "";

            // 8. Construcción HTML Completo con Diseño Sobrio Monocromático
            const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${plan.type === 'plan' ? 'Plan de Tratamiento' : 'Presupuesto'} — ${pName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      padding: 20px 25px;
      max-width: 820px;
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
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
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
    }
    .info-card {
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 16px;
      background: #ffffff;
    }
    .info-col-left {
      border-right: 1px solid #cbd5e1;
      padding-right: 16px;
    }
    .info-title {
      font-size: 8.5px;
      font-weight: 900;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
      display: block;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border: 1px solid #475569;
      font-size: 9.5px;
    }
    .items-table th {
      background: #f8fafc;
      color: #0f172a;
      border-bottom: 1.5px solid #475569;
      padding: 6px 8px;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9px;
    }
    .items-table td {
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 25px;
      margin-bottom: 25px;
    }
    .observations-box {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .totals-box {
      width: 250px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 4px;
      padding: 0 4px;
    }
    .total-neto-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #0f172a;
      color: #0f172a;
      padding: 8px 12px;
      border-radius: 6px;
      margin-top: 6px;
    }
    .signatures-container {
      margin-top: 35px;
      display: flex;
      justify-content: space-between;
      gap: 60px;
      padding: 0 20px;
    }
    .sig-line-block {
      flex: 1;
      text-align: center;
    }
    .sig-line {
      height: 45px;
    }
    .sig-info {
      border-top: 1px solid #475569;
      padding-top: 6px;
    }
    @media print {
      body { padding: 0; }
      @page { size: Letter; margin: 12mm 15mm; }
    }
  </style>
</head>
<body>

  <!-- CABECERA INSTITUCIONAL -->
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

  <!-- INFORMACIÓN DEL PACIENTE Y DETALLES DEL DOCUMENTO -->
  <div class="info-card">
    <div class="info-col-left">
      <span class="info-title">Información del Paciente</span>
      <h2 style="margin: 0 0 6px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${pName}</h2>
      <div style="display: grid; grid-template-columns: 1fr; gap: 3px;">
        <p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Documento:</strong> ${pTipoDoc} ${pDoc}</p>
        <p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Dirección:</strong> ${pAddress}</p>
        <p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Ciudad:</strong> ${pCity}</p>
        <p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Teléfono:</strong> ${pPhone}</p>
      </div>
    </div>
    <div>
      <span class="info-title">Detalles del Documento</span>
      <div style="display: grid; grid-template-columns: 1fr; gap: 3px;">
        <p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Expedición:</strong> ${formattedDate}</p>
        ${plan.type !== 'plan' 
            ? `<p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Válido Hasta:</strong> ${formattedValidUntil} (${vigencia} días)</p>`
            : `<p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Tipo:</strong> Plan de Tratamiento Odontológico</p>`
        }
        ${consecutivoHTML}
        <p style="margin: 0; font-size: 10px; color: #475569; font-weight: 600;"><strong style="color: #0f172a; text-transform: uppercase; margin-right: 5px;">Fecha Impresión:</strong> ${printDate}</p>
      </div>
    </div>
  </div>

  <!-- TABLA DE PROCEDIMIENTOS -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 12%; text-align: left;">Código</th>
        <th style="width: 28%; text-align: left;">Descripción</th>
        <th style="width: 10%; text-align: center;">Dientes</th>
        <th style="width: 8%; text-align: center;">Cant.</th>
        <th style="width: 14%; text-align: right;">V. Unitario</th>
        <th style="width: 14%; text-align: right;">Descuento</th>
        <th style="width: 14%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRowsHTML}
    </tbody>
  </table>

  <!-- SECCIÓN DE OBSERVACIONES Y TOTALES -->
  <div class="summary-section">
    ${finalObservations ? `
      <div class="observations-box">
        <span style="font-size: 8.5px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Términos y Observaciones</span>
        <p style="margin: 0; font-size: 9.5px; color: #334155; line-height: 1.5; white-space: pre-wrap;">${finalObservations}</p>
      </div>
    ` : `<div style="flex: 1;"></div>`}
    <div class="totals-box">
      <div class="total-row">
        <span style="text-transform: uppercase;">Subtotal</span>
        <span>$${subtotal.toLocaleString('es-CO')}</span>
      </div>
      <div class="total-row">
        <span style="text-transform: uppercase;">Descuentos</span>
        <span>-$${discount.toLocaleString('es-CO')}</span>
      </div>
      <div style="border-top: 1.5px solid #0f172a; margin: 6px 0;"></div>
      <div class="total-neto-card">
        <span style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">TOTAL NETO</span>
        <span style="font-size: 13px; font-weight: 900;">$${total.toLocaleString('es-CO')}</span>
      </div>
    </div>
  </div>

  <!-- LÍNEAS DE FIRMA -->
  <div class="signatures-container">
    <div class="sig-line-block">
      <div class="sig-line"></div>
      <div class="sig-info">
        <p style="margin: 0; font-size: 10px; font-weight: bold; color: #000000; text-transform: uppercase;">Aceptado por el Paciente</p>
        <p style="margin: 2px 0 0 0; font-size: 8.5px; color: #475569;">C.C.: ____________________</p>
      </div>
    </div>
    <div class="sig-line-block">
      <div class="sig-line"></div>
      <div class="sig-info">
        <p style="margin: 0; font-size: 10px; font-weight: bold; color: #000000; text-transform: uppercase;">Elaborado por: ${elaboradorNombre}</p>
      </div>
    </div>
  </div>

</body>
</html>`;

            printHTMLInHiddenIframe(html);
            toast.dismiss(toastId);
        } catch (error) {
            console.error("Error al generar presupuesto:", error);
            toast.error("Error al preparar la impresión del presupuesto");
            toast.dismiss(toastId);
        }
    }
};
