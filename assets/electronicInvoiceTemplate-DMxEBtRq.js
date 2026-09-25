var e=e=>{let t=Number(e||0);return`$`+Math.round(t).toLocaleString(`es-CO`)},t=e=>{if(!e)return`—`;let t=String(e).trim();return/^\d{7,12}$/.test(t)?Number(t).toLocaleString(`es-CO`):t},n=e=>{if(!e)return`—`;try{let t=e?.toDate?e.toDate():new Date(e);return isNaN(t.getTime())?`—`:`${String(t.getDate()).padStart(2,`0`)}/${String(t.getMonth()+1).padStart(2,`0`)}/${t.getFullYear()}`}catch{return`—`}},r=e=>{if(!e)return`Cédula de ciudadanía`;let t=String(e).toUpperCase().trim();switch(t){case`CC`:case`13`:case`CEDULA`:case`CÉDULA`:return`Cédula de ciudadanía`;case`NIT`:case`31`:return`NIT`;case`CE`:case`21`:case`22`:case`CEDULA_EXTRANJERIA`:return`Cédula de extranjería`;case`TI`:case`12`:return`Tarjeta de identidad`;case`RC`:case`11`:return`Registro civil`;case`PA`:case`PAS`:case`41`:return`Pasaporte`;case`PEP`:case`47`:return`PEP`;case`PPT`:return`PPT`;default:return t.length>3?t:`Cédula de ciudadanía`}},i=e=>{if(!e&&e!==0)return`Instrumento no definido`;let t=String(e).trim();switch(t){case`10`:return`Efectivo`;case`47`:return`Tarjeta débito`;case`48`:return`Tarjeta crédito`;case`42`:case`31`:return`Transferencia débito`;case`20`:case`41`:return`Cheque`;case`1`:return`Contado`;case`2`:return`Crédito`;case`ZZZ`:case`ZZ`:return`Instrumento no definido`;default:return t}},a=({factura:a={},patient:o={},tenant:s={},options:c={}})=>{let l=!!(a?.tercero_nombre||a?.es_entidad&&a?.cliente_nombre),u=o?.nombreCompleto||[o?.nombres||o?.nombre,o?.apellidos||o?.apellido].filter(Boolean).join(` `).trim()||a?.pacienteNombre||a?.paciente_nombre||`Paciente`,d=l?a?.tercero_nombre||a?.cliente_nombre||`Entidad Convenio`:u,f=o?.lugarResidencia||o?.direccion||a?.pacienteDireccion||`—`,p=o?.ciudadDomicilio||o?.ciudad||o?.municipio||a?.pacienteCiudad||`—`,m=o?.tipoDocumento||o?.tipo_documento||a?.pacienteTipoDocumento||`CC`,h=l?a?.tercero_documento||a?.cliente_documento||o?.nroDocumento||`—`:o?.nroDocumento||o?.documento||o?.cedula||o?.identificacion||a?.pacienteDocumento||`—`,g=r(m),_=t(h),v=a?.fecha_emision||a?.fechaExpedicion||a?.fechaISO||a?.created_at||a?.createdAt||new Date,y=a?.fecha_vencimiento||a?.fechaVencimiento||v,b=n(v),x=n(y),S=a?.factusNumero||a?.factusInvoiceNumber||a?.numero||a?.nroFactura||(a?.id?`FCEV${a.id.slice(-4).toUpperCase()}`:`—`),C=a?.factusCufe||a?.cufe||a?.factusResponse?.bill?.cufe||a?.factusResponse?.cufe||a?.cude||``,w=a?.factusQr||a?.qrCode||a?.qr||a?.factusPdfUrl||``;!w&&C?w=`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${C}`:w||=`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=Simulated_${S}`;let T=`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(w)}&bgcolor=ffffff&color=000000&margin=0`,E=a?.profesional||a?.doctor||a?.elaboradoPor||a?.usuarioNombre||s?.nombreComercial||`—`,D=i(a?.medioPago||a?.medio_pago||`10`),O=a?.items||[],k=0,A=O.length>0?O.map(t=>{let n=parseFloat(t.cantidad||t.quantity||1)||1,r=parseFloat(t.precioUnitario||t.precio||t.valor||t.unit_price||0)||0,i=parseFloat(t.descuento||t.discount||0)||0,a=t.total===void 0?r*n*(1-i/100):parseFloat(t.total);return k+=a,`
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${t.descripcion||t.nombre||t.concepto||t.name||`Servicio Odontológico`}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${e(r)}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">${n}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${e(a)}</td>
        </tr>`}).join(``):`
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">Servicio Odontológico</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${e(a?.total||0)}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">1</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${e(a?.total||0)}</td>
        </tr>`,j=a?.total===void 0?k:parseFloat(a.total),M=a?.subtotal===void 0?j:parseFloat(a.subtotal),N=s?.nombreComercial||s?.razonSocial||s?.nombre||`ATM Centro del Dolor Orofacial`,P=s?.nit?`NIT ${s.nit}`:``,F=s?.direccion||``,I=s?.ciudad?` - ${s.ciudad}`:``,L=s?.telefono||s?.celular||``,R=s?.email||``,z=s?.logoUrl?`<img src="${s.logoUrl}" style="max-height: 80px; max-width: 170px; object-fit: contain; display: block;" alt="Logo" />`:`<div style="font-size: 18px; font-weight: bold; color: #333; line-height: 1.1; text-transform: uppercase;">${N}</div>`,B=s?.dianResolucion||a?.dianResolucion||``,V=s?.dianFechaResolucion?n(s.dianFechaResolucion):``,H=s?.dianPrefijo||a?.dianPrefijo||`FCEV`,U=s?.dianRangoDesde||a?.dianRangoDesde||`1`,W=s?.dianRangoHasta||a?.dianRangoHasta||`5000`,G=s?.dianVigenciaHasta||s?.dianVigencia||(s?.dianFechaResolucion?n(new Date(new Date(s.dianFechaResolucion).setFullYear(new Date(s.dianFechaResolucion).getFullYear()+2))):``),K=``;K=B?`Autorización de numeración de facturación de número ${B} de ${V} Modalidad Factura Electrónica desde ${H}${U} hasta ${H}${W}${G?` con vigencia hasta ${G}`:``}`:`Autorización de numeración de facturación de número 18764103302433 de 18/12/2025 Modalidad Factura Electrónica desde ${H}1201 hasta ${H}2500 con vigencia hasta 18/12/2027`;let q=c?.providerText||s?.tecnologicalProvider||`Proveedor Tecnológico: Factus S.A.S. Nit:901.403.490-1 / www.factus.com.co`,J=a?.observaciones||``;return`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura Electrónica ${S}</title>
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
        ${z}
      </td>
      <td class="header-company">
        <div class="company-title">${N}</div>
        ${P?`<div>${P}</div>`:``}
        ${F||I?`<div>${F}${I}</div>`:``}
        ${L?`<div>${L}</div>`:``}
        ${R?`<div>${R}</div>`:``}
      </td>
      <td class="header-meta">
        <div class="meta-container">
          <div class="meta-text-block">
            <div class="doc-type">Factura electronica de<br/>venta</div>
            <div class="doc-number">No. ${S}</div>
            <div class="doc-sub">Factura de venta original</div>
            <div class="doc-sub">Los servicios de salud<br/>están</div>
            <div class="doc-sub" style="font-weight: bold;">excluidos de IVA</div>
          </div>
          <div class="qr-container">
            <img id="qrImg" src="${T}" alt="QR DIAN" onload="markQrLoaded();" onerror="markQrLoaded();" />
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- INFO GRID -->
  <table class="info-table">
    <tr>
      <td class="lbl" style="width: 16%;">SEÑOR(A)</td>
      <td style="width: 38%; font-weight: 500;">${d}</td>
      <td class="lbl" style="width: 26%;">FECHA DE EXPEDICIÓN (DD/MM/AA)</td>
      <td style="width: 20%; text-align: center;">${b}</td>
    </tr>
    <tr>
      <td class="lbl">DIRECCIÓN</td>
      <td>${f}</td>
      <td class="lbl">FECHA DE VENCIMIENTO(DD/MM/AA)</td>
      <td style="text-align: center;">${x}</td>
    </tr>
    <tr>
      <td class="lbl">CIUDAD</td>
      <td>${p}</td>
      <td class="lbl">${g}</td>
      <td style="text-align: center; font-weight: 500;">${_}</td>
    </tr>
    <tr>
      <td class="lbl">ELABORADO POR</td>
      <td>${E}</td>
      <td class="lbl">MEDIO DE PAGO</td>
      <td style="text-align: center;">${D}</td>
    </tr>
    <tr>
      <td class="lbl">CUFE</td>
      <td colspan="3" class="cufe-cell">${C||`9000e53ee1a46ed90f9c58004b903b75ebc1bc3ce1d1003e9c07a8722f36d759115d64b37996c97673635c0232b2feb`}</td>
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
      ${A}
    </tbody>
  </table>

  <!-- OBSERVACIONES & TOTALS -->
  <table class="summary-table">
    <tr>
      <td class="obs-cell">
        <div class="obs-title">Observaciones:</div>
        <div class="obs-content">${J}</div>
      </td>
      <td class="totals-cell">
        <table class="totals-inner-table">
          <tr>
            <td class="tot-label">Subtotal</td>
            <td class="tot-val">${e(M)}</td>
          </tr>
          <tr>
            <td class="tot-label">Total</td>
            <td class="tot-val">${e(j)}</td>
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
    ${K}
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td class="left" style="width: 20%;">1 de 1</td>
      <td class="right" style="width: 80%;">${q}</td>
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
  <\/script>
</body>
</html>`},o=({recibo:a={},patient:o={},tenant:s={},planInfo:c={}})=>{let l=o?.nombreCompleto||[o?.nombres||o?.nombre,o?.apellidos||o?.apellido].filter(Boolean).join(` `).trim()||a?.pacienteNombre||`Consumidor Final`,u=o?.lugarResidencia||o?.direccion||a?.pacienteDireccion||`—`,d=o?.ciudadDomicilio||o?.ciudad||o?.municipio||o?.lugarResidencia||o?.ciudad_domicilio||a?.pacienteCiudad||a?.ciudad||s?.ciudad||`Sincelejo`,f=o?.tipoDocumento||o?.tipo_documento||a?.pacienteTipoDocumento||`CC`,p=o?.nroDocumento||o?.documento||o?.cedula||a?.pacienteDocumento||`—`,m=r(f),h=t(p),g=n(a?.fecha||a?.fecha_emision||a?.created_at||new Date),_=a?.nroConsecutivo||a?.consecutivo||a?.numero||(a?.id?a.id.slice(-4).toUpperCase():`2026`),v=a?.profesionalNombre||a?.profesional||a?.creadoPor||s?.nombreComercial||`—`,y=i(a?.medioPago||a?.metodo||a?.medio_pago||`10`),b=a?.conceptos||[],x=``,S=0;b.length>0?x=b.map(t=>{let n=parseFloat(t.cantidad||1)||1,r=parseFloat(t.precioUnitario||t.precio||t.valor||0)||0,i=t.total===void 0?r*n:parseFloat(t.total);return S+=i,`
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${t.concepto||t.descripcion||`Servicio Odontológico`}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${e(r)}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">${n}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${e(i)}</td>
        </tr>`}).join(``):(S=parseFloat(a?.total||a?.monto||0),x=`
      <tr>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${a?.concepto||`Abono a tratamiento`}</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${e(S)}</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">1</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${e(S)}</td>
      </tr>`);let C=a?.total===void 0?a?.monto===void 0?S:parseFloat(a.monto):parseFloat(a.total),w=s?.nombreComercial||s?.razonSocial||s?.nombre||`ATM Centro del Dolor Orofacial`,T=s?.nit?`NIT ${s.nit}`:``,E=s?.direccion||``,D=s?.ciudad?` - ${s.ciudad}`:``,O=s?.telefono||s?.celular||``,k=s?.email||``,A=s?.logoUrl?`<img src="${s.logoUrl}" style="max-height: 80px; max-width: 170px; object-fit: contain; display: block;" alt="Logo" />`:`<div style="font-size: 18px; font-weight: bold; color: #333; line-height: 1.1; text-transform: uppercase;">${w}</div>`,j=a?.observaciones||a?.notas||``;return`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Caja No.${_}</title>
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
      <td class="header-logo">${A}</td>
      <td class="header-company">
        <div class="company-title">${w}</div>
        ${T?`<div>${T}</div>`:``}
        ${E||D?`<div>${E}${D}</div>`:``}
        ${O?`<div>${O}</div>`:``}
        ${k?`<div>${k}</div>`:``}
      </td>
      <td class="header-meta">
        <div style="text-align: right;">
          <div style="font-size: 12px; font-weight: normal;">Recibo de caja</div>
          <div style="font-size: 15px; font-weight: bold; margin-top: 2px;">No.${_}</div>
        </div>
      </td>
    </tr>
  </table>

  <table class="info-table">
    <tr>
      <td class="lbl" style="width: 16%;">SEÑOR(A)</td>
      <td style="width: 38%; font-weight: 500;">${l}</td>
      <td class="lbl" style="width: 26%;">FECHA DE EXPEDICIÓN (DD/MM/AA)</td>
      <td style="width: 20%; text-align: center;">${g}</td>
    </tr>
    <tr>
      <td class="lbl">DIRECCIÓN</td>
      <td>${u}</td>
      <td class="lbl"></td>
      <td></td>
    </tr>
    <tr>
      <td class="lbl">CIUDAD</td>
      <td>${d}</td>
      <td class="lbl">${m}</td>
      <td style="text-align: center; font-weight: 500;">${h}</td>
    </tr>
    <tr>
      <td class="lbl">TELÉFONO</td>
      <td>${o?.telefono||o?.celular||`—`}</td>
      <td class="lbl"></td>
      <td></td>
    </tr>
    <tr>
      <td class="lbl">ELABORADO POR</td>
      <td>${v}</td>
      <td class="lbl">MEDIO DE PAGO</td>
      <td style="text-align: center;">${y}</td>
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
      ${x}
    </tbody>
  </table>

  <table class="summary-table">
    <tr>
      <td class="obs-cell">
        <div style="font-weight: bold; margin-bottom: 4px;">Observaciones:</div>
        <div>${j}</div>
      </td>
      <td class="totals-cell">
        <table class="totals-inner-table">
          <tr>
            <td class="tot-label">Subtotal</td>
            <td class="tot-val">${e(C)}</td>
          </tr>
          <tr>
            <td class="tot-label">Total</td>
            <td class="tot-val">${e(C)}</td>
          </tr>
          ${c?.planTitle?`
          <tr>
            <td class="tot-label">P. de trat.</td>
            <td class="tot-val">${c.planTitle}</td>
          </tr>`:``}
          ${c?.totalPlan===void 0?``:`
          <tr>
            <td class="tot-label">Total plan</td>
            <td class="tot-val">${e(c.totalPlan)}</td>
          </tr>`}
          ${c?.totalPagado===void 0?``:`
          <tr>
            <td class="tot-label">Total pagado</td>
            <td class="tot-val">${e(c.totalPagado)}</td>
          </tr>`}
          ${c?.saldo===void 0?``:`
          <tr>
            <td class="tot-label">Saldo total</td>
            <td class="tot-val">${e(c.saldo)}</td>
          </tr>`}
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
  <\/script>
</body>
</html>`},s=e=>{let t=o(e),n=window.open(``,`_blank`,`width=800,height=900`);if(!n){alert(`Por favor permite las ventanas emergentes para imprimir el recibo.`);return}n.document.open(),n.document.write(t),n.document.close()},c=e=>{let t=a(e),n=window.open(``,`_blank`,`width=800,height=900`);if(!n){alert(`Por favor permite las ventanas emergentes (popups) para imprimir la factura.`);return}n.document.open(),n.document.write(t),n.document.close()};export{s as n,c as t};