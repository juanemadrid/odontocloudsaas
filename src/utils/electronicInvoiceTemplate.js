/**
 * electronicInvoiceTemplate.js
 * Generador HTML y de impresión para Facturas Electrónicas DIAN / Factus
 * Diseñado milimétricamente con el estándar de Factura Electrónica de Venta (Colombia).
 */

const formatCOP = (val) => {
  const num = Number(val || 0);
  return '$' + Math.round(num).toLocaleString('es-CO');
};

const formatDocNumber = (doc) => {
  if (!doc) return '—';
  const clean = String(doc).trim();
  // If purely digits and > 6 digits, format with dots e.g. 1.102.885.391
  if (/^\d{7,12}$/.test(clean)) {
    return Number(clean).toLocaleString('es-CO');
  }
  return clean;
};

const formatDateSlash = (dateInput) => {
  if (!dateInput) return '—';
  try {
    const d = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

const getDocumentTypeLabel = (type) => {
  if (!type) return 'Cédula de ciudadanía';
  const t = String(type).toUpperCase().trim();
  switch (t) {
    case 'CC':
    case '13':
    case 'CEDULA':
    case 'CÉDULA':
      return 'Cédula de ciudadanía';
    case 'NIT':
    case '31':
      return 'NIT';
    case 'CE':
    case '21':
    case '22':
    case 'CEDULA_EXTRANJERIA':
      return 'Cédula de extranjería';
    case 'TI':
    case '12':
      return 'Tarjeta de identidad';
    case 'RC':
    case '11':
      return 'Registro civil';
    case 'PA':
    case 'PAS':
    case '41':
      return 'Pasaporte';
    case 'PEP':
    case '47':
      return 'PEP';
    case 'PPT':
      return 'PPT';
    default:
      return t.length > 3 ? t : 'Cédula de ciudadanía';
  }
};

const getPaymentMethodLabel = (code) => {
  if (!code && code !== 0) return 'Instrumento no definido';
  const c = String(code).trim();
  switch (c) {
    case '10':
      return 'Efectivo';
    case '47':
      return 'Tarjeta débito';
    case '48':
      return 'Tarjeta crédito';
    case '42':
    case '31':
      return 'Transferencia débito';
    case '20':
    case '41':
      return 'Cheque';
    case '1':
      return 'Contado';
    case '2':
      return 'Crédito';
    case 'ZZZ':
    case 'ZZ':
      return 'Instrumento no definido';
    default:
      return c;
  }
};

export const generateElectronicInvoiceHtml = ({
  factura = {},
  patient = {},
  tenant = {},
  options = {},
}) => {
  const patientName =
    patient?.nombreCompleto ||
    [patient?.nombres || patient?.nombre, patient?.apellidos || patient?.apellido]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    factura?.pacienteNombre ||
    'Consumidor Final';

  const patientAddress =
    patient?.lugarResidencia ||
    patient?.direccion ||
    factura?.pacienteDireccion ||
    '—';

  const patientCity =
    patient?.ciudadDomicilio ||
    patient?.ciudad ||
    patient?.municipio ||
    factura?.pacienteCiudad ||
    '—';

  const patientDocType =
    patient?.tipoDocumento ||
    patient?.tipo_documento ||
    factura?.pacienteTipoDocumento ||
    'CC';

  const patientDocNumber =
    patient?.nroDocumento ||
    patient?.documento ||
    patient?.cedula ||
    patient?.identificacion ||
    factura?.pacienteDocumento ||
    '—';

  const docTypeLabel = getDocumentTypeLabel(patientDocType);
  const docNumberFormatted = formatDocNumber(patientDocNumber);

  // Dates
  const issueDate =
    factura?.fecha_emision ||
    factura?.fechaExpedicion ||
    factura?.fechaISO ||
    factura?.created_at ||
    factura?.createdAt ||
    new Date();

  const dueDate =
    factura?.fecha_vencimiento ||
    factura?.fechaVencimiento ||
    issueDate;

  const fechaExpFormatted = formatDateSlash(issueDate);
  const fechaVencFormatted = formatDateSlash(dueDate);

  // Invoice Number
  const facturaNumero =
    factura?.factusNumero ||
    factura?.factusInvoiceNumber ||
    factura?.numero ||
    factura?.nroFactura ||
    (factura?.id ? `FCEV${factura.id.slice(-4).toUpperCase()}` : '—');

  // CUFE
  const cufe =
    factura?.factusCufe ||
    factura?.cufe ||
    factura?.factusResponse?.bill?.cufe ||
    factura?.factusResponse?.cufe ||
    factura?.cude ||
    '';

  // QR Code
  let qrData =
    factura?.factusQr ||
    factura?.qrCode ||
    factura?.qr ||
    factura?.factusPdfUrl ||
    '';

  if (!qrData && cufe) {
    qrData = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`;
  } else if (!qrData) {
    // Fallback sandbox simulation QR
    qrData = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=Simulated_${facturaNumero}`;
  }

  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    qrData
  )}&bgcolor=ffffff&color=000000&margin=0`;

  // Elaborado por / Doctor
  const elaboradoPor =
    factura?.profesional ||
    factura?.doctor ||
    factura?.elaboradoPor ||
    factura?.usuarioNombre ||
    tenant?.nombreComercial ||
    '—';

  // Payment method
  const paymentMethodLabel = getPaymentMethodLabel(
    factura?.medioPago || factura?.medio_pago || '10'
  );

  // Items calculation
  const rawItems = factura?.items || [];
  let calculatedSubtotal = 0;

  const itemRowsHtml =
    rawItems.length > 0
      ? rawItems
          .map((it) => {
            const qty = parseFloat(it.cantidad || it.quantity || 1) || 1;
            const price =
              parseFloat(
                it.precioUnitario || it.precio || it.valor || it.unit_price || 0
              ) || 0;
            const discountPct = parseFloat(it.descuento || it.discount || 0) || 0;
            const lineTotal =
              it.total !== undefined
                ? parseFloat(it.total)
                : price * qty * (1 - discountPct / 100);

            calculatedSubtotal += lineTotal;
            const desc =
              it.descripcion ||
              it.nombre ||
              it.concepto ||
              it.name ||
              'Servicio Odontológico';

            return `
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${desc}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${formatCOP(
            price
          )}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">${qty}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${formatCOP(
            lineTotal
          )}</td>
        </tr>`;
          })
          .join('')
      : `
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">Servicio Odontológico</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${formatCOP(
            factura?.total || 0
          )}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">1</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${formatCOP(
            factura?.total || 0
          )}</td>
        </tr>`;

  const finalTotal =
    factura?.total !== undefined
      ? parseFloat(factura.total)
      : calculatedSubtotal;
  const finalSubtotal =
    factura?.subtotal !== undefined
      ? parseFloat(factura.subtotal)
      : finalTotal;

  // Tenant / Clinic details
  const clinicName =
    tenant?.nombreComercial ||
    tenant?.razonSocial ||
    tenant?.nombre ||
    'ATM Centro del Dolor Orofacial';

  const clinicNit = tenant?.nit ? `NIT ${tenant.nit}` : '';
  const clinicAddress = tenant?.direccion || '';
  const clinicCity = tenant?.ciudad ? ` - ${tenant.ciudad}` : '';
  const clinicPhone = tenant?.telefono || tenant?.celular || '';
  const clinicEmail = tenant?.email || '';

  const logoHtml = tenant?.logoUrl
    ? `<img src="${tenant.logoUrl}" style="max-height: 80px; max-width: 170px; object-fit: contain; display: block;" alt="Logo" />`
    : `<div style="font-size: 18px; font-weight: bold; color: #333; line-height: 1.1; text-transform: uppercase;">${clinicName}</div>`;

  // Resolution text
  const resNumber = tenant?.dianResolucion || factura?.dianResolucion || '';
  const resDate = tenant?.dianFechaResolucion
    ? formatDateSlash(tenant.dianFechaResolucion)
    : '';
  const resPrefix = tenant?.dianPrefijo || factura?.dianPrefijo || 'FCEV';
  const resFrom = tenant?.dianRangoDesde || factura?.dianRangoDesde || '1';
  const resTo = tenant?.dianRangoHasta || factura?.dianRangoHasta || '5000';
  const resValidity =
    tenant?.dianVigenciaHasta ||
    tenant?.dianVigencia ||
    (tenant?.dianFechaResolucion
      ? formatDateSlash(
          new Date(
            new Date(tenant.dianFechaResolucion).setFullYear(
              new Date(tenant.dianFechaResolucion).getFullYear() + 2
            )
          )
        )
      : '');

  let resolutionText = '';
  if (resNumber) {
    resolutionText = `Autorización de numeración de facturación de número ${resNumber} de ${resDate} Modalidad Factura Electrónica desde ${resPrefix}${resFrom} hasta ${resPrefix}${resTo}${
      resValidity ? ` con vigencia hasta ${resValidity}` : ''
    }`;
  } else {
    resolutionText = `Autorización de numeración de facturación de número 18764103302433 de 18/12/2025 Modalidad Factura Electrónica desde ${resPrefix}1201 hasta ${resPrefix}2500 con vigencia hasta 18/12/2027`;
  }

  const providerText =
    options?.providerText ||
    tenant?.tecnologicalProvider ||
    'Proveedor Tecnológico: Factus S.A.S. Nit:901.403.490-1 / www.factus.com.co';

  const observacionesText = factura?.observaciones || '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura Electrónica ${facturaNumero}</title>
  <style>
    @page {
      size: portrait;
      margin: 10mm 12mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      padding: 16px 20px;
      max-width: 780px;
      margin: 0 auto;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .header-logo {
      width: 25%;
      vertical-align: middle;
      text-align: left;
    }
    .header-company {
      width: 45%;
      text-align: center;
      vertical-align: middle;
      font-size: 11px;
      line-height: 1.35;
    }
    .company-title {
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .header-meta {
      width: 30%;
      text-align: right;
      vertical-align: middle;
    }
    .meta-container {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .meta-text-block {
      text-align: right;
      font-size: 9.5px;
      line-height: 1.25;
    }
    .meta-text-block .doc-type {
      font-size: 10px;
      font-weight: normal;
    }
    .meta-text-block .doc-number {
      font-size: 13px;
      font-weight: bold;
      margin: 1px 0;
    }
    .meta-text-block .doc-sub {
      font-size: 9px;
      color: #111;
    }
    .qr-container {
      width: 82px;
      height: 82px;
      border: 1px solid #222;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: #fff;
    }
    .qr-container img {
      width: 78px;
      height: 78px;
      display: block;
    }
    
    /* INFO GRID TABLE */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .info-table td {
      border: 1px solid #111;
      padding: 4.5px 7px;
      font-size: 10.5px;
      vertical-align: middle;
    }
    .info-table td.lbl {
      background: #ffffff;
      font-weight: bold;
      font-size: 9.5px;
      text-transform: uppercase;
      color: #000;
    }
    .info-table td.cufe-cell {
      font-family: 'Courier New', Courier, monospace;
      font-size: 8.5px;
      word-break: break-all;
      line-height: 1.15;
      padding: 4px 6px;
    }

    /* ITEMS TABLE */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .items-table th {
      border: 1px solid #111;
      background: #ffffff;
      font-weight: bold;
      font-size: 10.5px;
      padding: 5px 8px;
      text-transform: none;
    }
    .items-table td {
      border: 1px solid #111;
    }

    /* SUMMARY / TOTALS SECTION */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .obs-cell {
      width: 58%;
      vertical-align: top;
      padding-right: 12px;
      font-size: 10.5px;
    }
    .obs-title {
      font-weight: bold;
      margin-bottom: 4px;
    }
    .obs-content {
      min-height: 40px;
      color: #222;
    }
    .totals-cell {
      width: 42%;
      vertical-align: top;
    }
    .totals-inner-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-inner-table td {
      padding: 4.5px 8px;
      font-size: 11px;
    }
    .totals-inner-table td.tot-label {
      font-weight: bold;
      text-align: right;
      width: 45%;
    }
    .totals-inner-table td.tot-val {
      font-weight: bold;
      text-align: right;
      width: 55%;
      white-space: nowrap;
    }

    /* SIGNATURES SECTION */
    .signatures-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 36px;
      margin-bottom: 20px;
    }
    .sig-block {
      width: 50%;
      text-align: center;
      vertical-align: bottom;
      padding: 0 30px;
    }
    .sig-line {
      border-top: 1px solid #000;
      width: 85%;
      margin: 0 auto 6px auto;
    }
    .sig-title {
      font-size: 9.5px;
      font-weight: bold;
      text-transform: uppercase;
    }

    /* RESOLUTION & FOOTER */
    .resolution-block {
      text-align: center;
      font-size: 9px;
      color: #222;
      margin-top: 14px;
      margin-bottom: 12px;
      line-height: 1.35;
      padding: 0 10px;
    }
    .footer-table {
      width: 100%;
      border-collapse: collapse;
      border-top: 1px solid #ddd;
      padding-top: 6px;
      margin-top: 8px;
      font-size: 9px;
      color: #666;
    }
    .footer-table td.left {
      text-align: left;
    }
    .footer-table td.right {
      text-align: right;
    }

    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <table class="header-table">
    <tr>
      <td class="header-logo">
        ${logoHtml}
      </td>
      <td class="header-company">
        <div class="company-title">${clinicName}</div>
        ${clinicNit ? `<div>${clinicNit}</div>` : ''}
        ${clinicAddress || clinicCity ? `<div>${clinicAddress}${clinicCity}</div>` : ''}
        ${clinicPhone ? `<div>${clinicPhone}</div>` : ''}
        ${clinicEmail ? `<div>${clinicEmail}</div>` : ''}
      </td>
      <td class="header-meta">
        <div class="meta-container">
          <div class="meta-text-block">
            <div class="doc-type">Factura electronica de<br/>venta</div>
            <div class="doc-number">No. ${facturaNumero}</div>
            <div class="doc-sub">Factura de venta original</div>
            <div class="doc-sub">Los servicios de salud<br/>están</div>
            <div class="doc-sub" style="font-weight: bold;">excluidos de IVA</div>
          </div>
          <div class="qr-container">
            <img id="qrImg" src="${qrImgUrl}" alt="QR DIAN" onload="markQrLoaded();" onerror="markQrLoaded();" />
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- INFO GRID -->
  <table class="info-table">
    <tr>
      <td class="lbl" style="width: 16%;">SEÑOR(A)</td>
      <td style="width: 38%; font-weight: 500;">${patientName}</td>
      <td class="lbl" style="width: 26%;">FECHA DE EXPEDICIÓN (DD/MM/AA)</td>
      <td style="width: 20%; text-align: center;">${fechaExpFormatted}</td>
    </tr>
    <tr>
      <td class="lbl">DIRECCIÓN</td>
      <td>${patientAddress}</td>
      <td class="lbl">FECHA DE VENCIMIENTO(DD/MM/AA)</td>
      <td style="text-align: center;">${fechaVencFormatted}</td>
    </tr>
    <tr>
      <td class="lbl">CIUDAD</td>
      <td>${patientCity}</td>
      <td class="lbl">${docTypeLabel}</td>
      <td style="text-align: center; font-weight: 500;">${docNumberFormatted}</td>
    </tr>
    <tr>
      <td class="lbl">ELABORADO POR</td>
      <td>${elaboradoPor}</td>
      <td class="lbl">MEDIO DE PAGO</td>
      <td style="text-align: center;">${paymentMethodLabel}</td>
    </tr>
    <tr>
      <td class="lbl">CUFE</td>
      <td colspan="3" class="cufe-cell">${cufe || '9000e53ee1a46ed90f9c58004b903b75ebc1bc3ce1d1003e9c07a8722f36d759115d64b37996c97673635c0232b2feb'}</td>
    </tr>
  </table>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 60%; text-align: left;">Item</th>
        <th style="width: 15%; text-align: right;">Precio</th>
        <th style="width: 10%; text-align: center;">Cantidad</th>
        <th style="width: 15%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
    </tbody>
  </table>

  <!-- OBSERVACIONES & TOTALS -->
  <table class="summary-table">
    <tr>
      <td class="obs-cell">
        <div class="obs-title">Observaciones:</div>
        <div class="obs-content">${observacionesText}</div>
      </td>
      <td class="totals-cell">
        <table class="totals-inner-table">
          <tr>
            <td class="tot-label">Subtotal</td>
            <td class="tot-val">${formatCOP(finalSubtotal)}</td>
          </tr>
          <tr>
            <td class="tot-label">Total</td>
            <td class="tot-val">${formatCOP(finalTotal)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- SIGNATURES -->
  <table class="signatures-table">
    <tr>
      <td class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">ELABORADO POR</div>
      </td>
      <td class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">ACEPTADA, FIRMA Y/O SELLO Y FECHA</div>
      </td>
    </tr>
  </table>

  <!-- RESOLUTION -->
  <div class="resolution-block">
    ${resolutionText}
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td class="left" style="width: 20%;">1 de 1</td>
      <td class="right" style="width: 80%;">${providerText}</td>
    </tr>
  </table>

  <span id="qrLoadedStatus" style="display: none;">0</span>
  <script>
    var isPrinting = false;
    function markQrLoaded() {
      document.getElementById('qrLoadedStatus').textContent = '1';
      if (!isPrinting) {
        isPrinting = true;
        setTimeout(function() {
          window.print();
        }, 150);
      }
    }
    window.onload = function() {
      setTimeout(function() {
        if (!isPrinting) {
          isPrinting = true;
          window.print();
        }
      }, 500);
    };
  </script>
</body>
</html>`;
};

export const generateReciboCajaHtml = ({
  recibo = {},
  patient = {},
  tenant = {},
  planInfo = {},
}) => {
  const patientName =
    patient?.nombreCompleto ||
    [patient?.nombres || patient?.nombre, patient?.apellidos || patient?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    recibo?.pacienteNombre ||
    "Consumidor Final";

  const patientAddress =
    patient?.lugarResidencia ||
    patient?.direccion ||
    recibo?.pacienteDireccion ||
    "—";

  const patientCity =
    patient?.ciudadDomicilio ||
    patient?.ciudad ||
    patient?.municipio ||
    patient?.lugarResidencia ||
    patient?.ciudad_domicilio ||
    recibo?.pacienteCiudad ||
    recibo?.ciudad ||
    tenant?.ciudad ||
    "Sincelejo";

  const patientDocType =
    patient?.tipoDocumento ||
    patient?.tipo_documento ||
    recibo?.pacienteTipoDocumento ||
    "CC";

  const patientDocNumber =
    patient?.nroDocumento ||
    patient?.documento ||
    patient?.cedula ||
    recibo?.pacienteDocumento ||
    "—";

  const docTypeLabel = getDocumentTypeLabel(patientDocType);
  const docNumberFormatted = formatDocNumber(patientDocNumber);

  const issueDate =
    recibo?.fecha ||
    recibo?.fecha_emision ||
    recibo?.created_at ||
    new Date();

  const fechaExpFormatted = formatDateSlash(issueDate);

  const nroRecibo =
    recibo?.nroConsecutivo ||
    recibo?.consecutivo ||
    recibo?.numero ||
    (recibo?.id ? recibo.id.slice(-4).toUpperCase() : "2026");

  const elaboradoPor =
    recibo?.profesionalNombre ||
    recibo?.profesional ||
    recibo?.creadoPor ||
    tenant?.nombreComercial ||
    "—";

  const paymentMethodLabel = getPaymentMethodLabel(
    recibo?.medioPago || recibo?.metodo || recibo?.medio_pago || "10"
  );

  const rawConceptos = recibo?.conceptos || [];
  let itemRowsHtml = "";
  let calculatedTotal = 0;

  if (rawConceptos.length > 0) {
    itemRowsHtml = rawConceptos
      .map((c) => {
        const qty = parseFloat(c.cantidad || 1) || 1;
        const price = parseFloat(c.precioUnitario || c.precio || c.valor || 0) || 0;
        const line = c.total !== undefined ? parseFloat(c.total) : price * qty;
        calculatedTotal += line;
        return `
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${c.concepto || c.descripcion || "Servicio Odontológico"}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${formatCOP(price)}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">${qty}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${formatCOP(line)}</td>
        </tr>`;
      })
      .join("");
  } else {
    calculatedTotal = parseFloat(recibo?.total || recibo?.monto || 0);
    itemRowsHtml = `
      <tr>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${recibo?.concepto || "Abono a tratamiento"}</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${formatCOP(calculatedTotal)}</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">1</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${formatCOP(calculatedTotal)}</td>
      </tr>`;
  }

  const finalTotal = recibo?.total !== undefined ? parseFloat(recibo.total) : (recibo?.monto !== undefined ? parseFloat(recibo.monto) : calculatedTotal);

  const clinicName =
    tenant?.nombreComercial ||
    tenant?.razonSocial ||
    tenant?.nombre ||
    "ATM Centro del Dolor Orofacial";

  const clinicNit = tenant?.nit ? `NIT ${tenant.nit}` : "";
  const clinicAddress = tenant?.direccion || "";
  const clinicCity = tenant?.ciudad ? ` - ${tenant.ciudad}` : "";
  const clinicPhone = tenant?.telefono || tenant?.celular || "";
  const clinicEmail = tenant?.email || "";

  const logoHtml = tenant?.logoUrl
    ? `<img src="${tenant.logoUrl}" style="max-height: 80px; max-width: 170px; object-fit: contain; display: block;" alt="Logo" />`
    : `<div style="font-size: 18px; font-weight: bold; color: #333; line-height: 1.1; text-transform: uppercase;">${clinicName}</div>`;

  const observacionesText = recibo?.observaciones || recibo?.notas || "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Caja No.${nroRecibo}</title>
  <style>
    @page { size: portrait; margin: 10mm 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      padding: 16px 20px;
      max-width: 780px;
      margin: 0 auto;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .header-logo { width: 25%; vertical-align: middle; text-align: left; }
    .header-company { width: 50%; text-align: center; vertical-align: middle; font-size: 11px; line-height: 1.35; }
    .company-title { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
    .header-meta { width: 25%; text-align: right; vertical-align: middle; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .info-table td { border: 1px solid #111; padding: 4.5px 7px; font-size: 10.5px; vertical-align: middle; }
    .info-table td.lbl { font-weight: bold; font-size: 9.5px; text-transform: uppercase; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .items-table th { border: 1px solid #111; font-weight: bold; font-size: 10.5px; padding: 5px 8px; text-align: left; }
    .items-table td { border: 1px solid #111; }
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .obs-cell { width: 58%; vertical-align: top; padding-right: 12px; font-size: 10.5px; }
    .totals-cell { width: 42%; vertical-align: top; }
    .totals-inner-table { width: 100%; border-collapse: collapse; }
    .totals-inner-table td { padding: 4px 8px; font-size: 11px; }
    .totals-inner-table td.tot-label { font-weight: bold; text-align: right; width: 45%; }
    .totals-inner-table td.tot-val { font-weight: bold; text-align: right; width: 55%; white-space: nowrap; }
    .signatures-table { width: 100%; border-collapse: collapse; margin-top: 50px; margin-bottom: 20px; }
    .sig-block { width: 50%; text-align: center; vertical-align: bottom; padding: 0 30px; }
    .sig-line { border-top: 1px solid #000; width: 85%; margin: 0 auto 6px auto; }
    .sig-title { font-size: 9.5px; font-weight: bold; text-transform: uppercase; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td class="header-logo">${logoHtml}</td>
      <td class="header-company">
        <div class="company-title">${clinicName}</div>
        ${clinicNit ? `<div>${clinicNit}</div>` : ""}
        ${clinicAddress || clinicCity ? `<div>${clinicAddress}${clinicCity}</div>` : ""}
        ${clinicPhone ? `<div>${clinicPhone}</div>` : ""}
        ${clinicEmail ? `<div>${clinicEmail}</div>` : ""}
      </td>
      <td class="header-meta">
        <div style="text-align: right;">
          <div style="font-size: 12px; font-weight: normal;">Recibo de caja</div>
          <div style="font-size: 15px; font-weight: bold; margin-top: 2px;">No.${nroRecibo}</div>
        </div>
      </td>
    </tr>
  </table>

  <table class="info-table">
    <tr>
      <td class="lbl" style="width: 16%;">SEÑOR(A)</td>
      <td style="width: 38%; font-weight: 500;">${patientName}</td>
      <td class="lbl" style="width: 26%;">FECHA DE EXPEDICIÓN (DD/MM/AA)</td>
      <td style="width: 20%; text-align: center;">${fechaExpFormatted}</td>
    </tr>
    <tr>
      <td class="lbl">DIRECCIÓN</td>
      <td>${patientAddress}</td>
      <td class="lbl"></td>
      <td></td>
    </tr>
    <tr>
      <td class="lbl">CIUDAD</td>
      <td>${patientCity}</td>
      <td class="lbl">${docTypeLabel}</td>
      <td style="text-align: center; font-weight: 500;">${docNumberFormatted}</td>
    </tr>
    <tr>
      <td class="lbl">TELÉFONO</td>
      <td>${patient?.telefono || patient?.celular || "—"}</td>
      <td class="lbl"></td>
      <td></td>
    </tr>
    <tr>
      <td class="lbl">ELABORADO POR</td>
      <td>${elaboradoPor}</td>
      <td class="lbl">MEDIO DE PAGO</td>
      <td style="text-align: center;">${paymentMethodLabel}</td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 60%;">Concepto</th>
        <th style="width: 15%; text-align: right;">Precio</th>
        <th style="width: 10%; text-align: center;">Cantidad</th>
        <th style="width: 15%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
    </tbody>
  </table>

  <table class="summary-table">
    <tr>
      <td class="obs-cell">
        <div style="font-weight: bold; margin-bottom: 4px;">Observaciones:</div>
        <div>${observacionesText}</div>
      </td>
      <td class="totals-cell">
        <table class="totals-inner-table">
          <tr>
            <td class="tot-label">Subtotal</td>
            <td class="tot-val">${formatCOP(finalTotal)}</td>
          </tr>
          <tr>
            <td class="tot-label">Total</td>
            <td class="tot-val">${formatCOP(finalTotal)}</td>
          </tr>
          ${planInfo?.planTitle ? `
          <tr>
            <td class="tot-label">P. de trat.</td>
            <td class="tot-val">${planInfo.planTitle}</td>
          </tr>` : ""}
          ${planInfo?.totalPlan !== undefined ? `
          <tr>
            <td class="tot-label">Total plan</td>
            <td class="tot-val">${formatCOP(planInfo.totalPlan)}</td>
          </tr>` : ""}
          ${planInfo?.totalPagado !== undefined ? `
          <tr>
            <td class="tot-label">Total pagado</td>
            <td class="tot-val">${formatCOP(planInfo.totalPagado)}</td>
          </tr>` : ""}
          ${planInfo?.saldo !== undefined ? `
          <tr>
            <td class="tot-label">Saldo total</td>
            <td class="tot-val">${formatCOP(planInfo.saldo)}</td>
          </tr>` : ""}
        </table>
      </td>
    </tr>
  </table>

  <table class="signatures-table">
    <tr>
      <td class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">ELABORADO POR</div>
      </td>
      <td class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-title">ACEPTADA, FIRMA Y/O SELLO Y FECHA</div>
      </td>
    </tr>
  </table>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 200);
    };
  </script>
</body>
</html>`;
};

export const printReciboCaja = (data) => {
  const html = generateReciboCajaHtml(data);
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) {
    alert("Por favor permite las ventanas emergentes para imprimir el recibo.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
};

export const printElectronicInvoice = (data) => {
  const html = generateElectronicInvoiceHtml(data);
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) {
    alert('Por favor permite las ventanas emergentes (popups) para imprimir la factura.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
};

export default {
  generateElectronicInvoiceHtml,
  printElectronicInvoice,
  generateReciboCajaHtml,
  printReciboCaja,
};
