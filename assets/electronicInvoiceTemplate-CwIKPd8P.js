const s=l=>{const d=Number(l||0);return"$"+Math.round(d).toLocaleString("es-CO")},Y=l=>{if(!l)return"—";const d=String(l).trim();return/^\d{7,12}$/.test(d)?Number(d).toLocaleString("es-CO"):d},w=l=>{if(!l)return"—";try{const d=l!=null&&l.toDate?l.toDate():new Date(l);if(isNaN(d.getTime()))return"—";const o=String(d.getDate()).padStart(2,"0"),e=String(d.getMonth()+1).padStart(2,"0"),m=d.getFullYear();return`${o}/${e}/${m}`}catch{return"—"}},G=l=>{if(!l)return"Cédula de ciudadanía";const d=String(l).toUpperCase().trim();switch(d){case"CC":case"13":case"CEDULA":case"CÉDULA":return"Cédula de ciudadanía";case"NIT":case"31":return"NIT";case"CE":case"21":case"22":case"CEDULA_EXTRANJERIA":return"Cédula de extranjería";case"TI":case"12":return"Tarjeta de identidad";case"RC":case"11":return"Registro civil";case"PA":case"PAS":case"41":return"Pasaporte";case"PEP":case"47":return"PEP";case"PPT":return"PPT";default:return d.length>3?d:"Cédula de ciudadanía"}},Q=l=>{if(!l&&l!==0)return"Instrumento no definido";const d=String(l).trim();switch(d){case"10":return"Efectivo";case"47":return"Tarjeta débito";case"48":return"Tarjeta crédito";case"42":case"31":return"Transferencia débito";case"20":case"41":return"Cheque";case"1":return"Contado";case"2":return"Crédito";case"ZZZ":case"ZZ":return"Instrumento no definido";default:return d}},dl=({factura:l={},patient:d={},tenant:o={},options:e={}})=>{var I,q,H;const m=(d==null?void 0:d.nombreCompleto)||[(d==null?void 0:d.nombres)||(d==null?void 0:d.nombre),(d==null?void 0:d.apellidos)||(d==null?void 0:d.apellido)].filter(Boolean).join(" ").trim()||(l==null?void 0:l.pacienteNombre)||"Consumidor Final",P=(d==null?void 0:d.lugarResidencia)||(d==null?void 0:d.direccion)||(l==null?void 0:l.pacienteDireccion)||"—",R=(d==null?void 0:d.ciudadDomicilio)||(d==null?void 0:d.ciudad)||(d==null?void 0:d.municipio)||(l==null?void 0:l.pacienteCiudad)||"—",F=(d==null?void 0:d.tipoDocumento)||(d==null?void 0:d.tipo_documento)||(l==null?void 0:l.pacienteTipoDocumento)||"CC",N=(d==null?void 0:d.nroDocumento)||(d==null?void 0:d.documento)||(d==null?void 0:d.cedula)||(d==null?void 0:d.identificacion)||(l==null?void 0:l.pacienteDocumento)||"—",S=G(F),L=Y(N),y=(l==null?void 0:l.fecha_emision)||(l==null?void 0:l.fechaExpedicion)||(l==null?void 0:l.fechaISO)||(l==null?void 0:l.created_at)||(l==null?void 0:l.createdAt)||new Date,k=(l==null?void 0:l.fecha_vencimiento)||(l==null?void 0:l.fechaVencimiento)||y,$=w(y),U=w(k),n=(l==null?void 0:l.factusNumero)||(l==null?void 0:l.factusInvoiceNumber)||(l==null?void 0:l.numero)||(l==null?void 0:l.nroFactura)||(l!=null&&l.id?`FCEV${l.id.slice(-4).toUpperCase()}`:"—"),g=(l==null?void 0:l.factusCufe)||(l==null?void 0:l.cufe)||((q=(I=l==null?void 0:l.factusResponse)==null?void 0:I.bill)==null?void 0:q.cufe)||((H=l==null?void 0:l.factusResponse)==null?void 0:H.cufe)||(l==null?void 0:l.cude)||"";let r=(l==null?void 0:l.factusQr)||(l==null?void 0:l.qrCode)||(l==null?void 0:l.qr)||(l==null?void 0:l.factusPdfUrl)||"";!r&&g?r=`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${g}`:r||(r=`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=Simulated_${n}`);const c=`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(r)}&bgcolor=ffffff&color=000000&margin=0`,C=(l==null?void 0:l.profesional)||(l==null?void 0:l.doctor)||(l==null?void 0:l.elaboradoPor)||(l==null?void 0:l.usuarioNombre)||(o==null?void 0:o.nombreComercial)||"—",D=Q((l==null?void 0:l.medioPago)||(l==null?void 0:l.medio_pago)||"10"),x=(l==null?void 0:l.items)||[];let h=0;const E=x.length>0?x.map(i=>{const _=parseFloat(i.cantidad||i.quantity||1)||1,B=parseFloat(i.precioUnitario||i.precio||i.valor||i.unit_price||0)||0,ll=parseFloat(i.descuento||i.discount||0)||0,V=i.total!==void 0?parseFloat(i.total):B*_*(1-ll/100);return h+=V,`
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${i.descripcion||i.nombre||i.concepto||i.name||"Servicio Odontológico"}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${s(B)}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">${_}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${s(V)}</td>
        </tr>`}).join(""):`
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">Servicio Odontológico</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${s((l==null?void 0:l.total)||0)}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">1</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle; white-space: nowrap;">${s((l==null?void 0:l.total)||0)}</td>
        </tr>`,a=(l==null?void 0:l.total)!==void 0?parseFloat(l.total):h,T=(l==null?void 0:l.subtotal)!==void 0?parseFloat(l.subtotal):a,A=(o==null?void 0:o.nombreComercial)||(o==null?void 0:o.razonSocial)||(o==null?void 0:o.nombre)||"ATM Centro del Dolor Orofacial",z=o!=null&&o.nit?`NIT ${o.nit}`:"",t=(o==null?void 0:o.direccion)||"",p=o!=null&&o.ciudad?` - ${o.ciudad}`:"",b=(o==null?void 0:o.telefono)||(o==null?void 0:o.celular)||"",v=(o==null?void 0:o.email)||"",Z=o!=null&&o.logoUrl?`<img src="${o.logoUrl}" style="max-height: 80px; max-width: 170px; object-fit: contain; display: block;" alt="Logo" />`:`<div style="font-size: 18px; font-weight: bold; color: #333; line-height: 1.1; text-transform: uppercase;">${A}</div>`,j=(o==null?void 0:o.dianResolucion)||(l==null?void 0:l.dianResolucion)||"",X=o!=null&&o.dianFechaResolucion?w(o.dianFechaResolucion):"",O=(o==null?void 0:o.dianPrefijo)||(l==null?void 0:l.dianPrefijo)||"FCEV",J=(o==null?void 0:o.dianRangoDesde)||(l==null?void 0:l.dianRangoDesde)||"1",f=(o==null?void 0:o.dianRangoHasta)||(l==null?void 0:l.dianRangoHasta)||"5000",u=(o==null?void 0:o.dianVigenciaHasta)||(o==null?void 0:o.dianVigencia)||(o!=null&&o.dianFechaResolucion?w(new Date(new Date(o.dianFechaResolucion).setFullYear(new Date(o.dianFechaResolucion).getFullYear()+2))):"");let M="";j?M=`Autorización de numeración de facturación de número ${j} de ${X} Modalidad Factura Electrónica desde ${O}${J} hasta ${O}${f}${u?` con vigencia hasta ${u}`:""}`:M=`Autorización de numeración de facturación de número 18764103302433 de 18/12/2025 Modalidad Factura Electrónica desde ${O}1201 hasta ${O}2500 con vigencia hasta 18/12/2027`;const K=(e==null?void 0:e.providerText)||(o==null?void 0:o.tecnologicalProvider)||"Proveedor Tecnológico: Factus S.A.S. Nit:901.403.490-1 / www.factus.com.co",W=(l==null?void 0:l.observaciones)||"";return`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura Electrónica ${n}</title>
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
        ${Z}
      </td>
      <td class="header-company">
        <div class="company-title">${A}</div>
        ${z?`<div>${z}</div>`:""}
        ${t||p?`<div>${t}${p}</div>`:""}
        ${b?`<div>${b}</div>`:""}
        ${v?`<div>${v}</div>`:""}
      </td>
      <td class="header-meta">
        <div class="meta-container">
          <div class="meta-text-block">
            <div class="doc-type">Factura electronica de<br/>venta</div>
            <div class="doc-number">No. ${n}</div>
            <div class="doc-sub">Factura de venta original</div>
            <div class="doc-sub">Los servicios de salud<br/>están</div>
            <div class="doc-sub" style="font-weight: bold;">excluidos de IVA</div>
          </div>
          <div class="qr-container">
            <img id="qrImg" src="${c}" alt="QR DIAN" onload="markQrLoaded();" onerror="markQrLoaded();" />
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- INFO GRID -->
  <table class="info-table">
    <tr>
      <td class="lbl" style="width: 16%;">SEÑOR(A)</td>
      <td style="width: 38%; font-weight: 500;">${m}</td>
      <td class="lbl" style="width: 26%;">FECHA DE EXPEDICIÓN (DD/MM/AA)</td>
      <td style="width: 20%; text-align: center;">${$}</td>
    </tr>
    <tr>
      <td class="lbl">DIRECCIÓN</td>
      <td>${P}</td>
      <td class="lbl">FECHA DE VENCIMIENTO(DD/MM/AA)</td>
      <td style="text-align: center;">${U}</td>
    </tr>
    <tr>
      <td class="lbl">CIUDAD</td>
      <td>${R}</td>
      <td class="lbl">${S}</td>
      <td style="text-align: center; font-weight: 500;">${L}</td>
    </tr>
    <tr>
      <td class="lbl">ELABORADO POR</td>
      <td>${C}</td>
      <td class="lbl">MEDIO DE PAGO</td>
      <td style="text-align: center;">${D}</td>
    </tr>
    <tr>
      <td class="lbl">CUFE</td>
      <td colspan="3" class="cufe-cell">${g||"9000e53ee1a46ed90f9c58004b903b75ebc1bc3ce1d1003e9c07a8722f36d759115d64b37996c97673635c0232b2feb"}</td>
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
      ${E}
    </tbody>
  </table>

  <!-- OBSERVACIONES & TOTALS -->
  <table class="summary-table">
    <tr>
      <td class="obs-cell">
        <div class="obs-title">Observaciones:</div>
        <div class="obs-content">${W}</div>
      </td>
      <td class="totals-cell">
        <table class="totals-inner-table">
          <tr>
            <td class="tot-label">Subtotal</td>
            <td class="tot-val">${s(T)}</td>
          </tr>
          <tr>
            <td class="tot-label">Total</td>
            <td class="tot-val">${s(a)}</td>
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
    ${M}
  </div>

  <!-- FOOTER -->
  <table class="footer-table">
    <tr>
      <td class="left" style="width: 20%;">1 de 1</td>
      <td class="right" style="width: 80%;">${K}</td>
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
</html>`},ol=({recibo:l={},patient:d={},tenant:o={},planInfo:e={}})=>{const m=(d==null?void 0:d.nombreCompleto)||[(d==null?void 0:d.nombres)||(d==null?void 0:d.nombre),(d==null?void 0:d.apellidos)||(d==null?void 0:d.apellido)].filter(Boolean).join(" ").trim()||(l==null?void 0:l.pacienteNombre)||"Consumidor Final",P=(d==null?void 0:d.lugarResidencia)||(d==null?void 0:d.direccion)||(l==null?void 0:l.pacienteDireccion)||"—",R=(d==null?void 0:d.ciudadDomicilio)||(d==null?void 0:d.ciudad)||(d==null?void 0:d.municipio)||(d==null?void 0:d.lugarResidencia)||(d==null?void 0:d.ciudad_domicilio)||(l==null?void 0:l.pacienteCiudad)||(l==null?void 0:l.ciudad)||(o==null?void 0:o.ciudad)||"Sincelejo",F=(d==null?void 0:d.tipoDocumento)||(d==null?void 0:d.tipo_documento)||(l==null?void 0:l.pacienteTipoDocumento)||"CC",N=(d==null?void 0:d.nroDocumento)||(d==null?void 0:d.documento)||(d==null?void 0:d.cedula)||(l==null?void 0:l.pacienteDocumento)||"—",S=G(F),L=Y(N),y=(l==null?void 0:l.fecha)||(l==null?void 0:l.fecha_emision)||(l==null?void 0:l.created_at)||new Date,k=w(y),$=(l==null?void 0:l.nroConsecutivo)||(l==null?void 0:l.consecutivo)||(l==null?void 0:l.numero)||(l!=null&&l.id?l.id.slice(-4).toUpperCase():"2026"),U=(l==null?void 0:l.profesionalNombre)||(l==null?void 0:l.profesional)||(l==null?void 0:l.creadoPor)||(o==null?void 0:o.nombreComercial)||"—",n=Q((l==null?void 0:l.medioPago)||(l==null?void 0:l.metodo)||(l==null?void 0:l.medio_pago)||"10"),g=(l==null?void 0:l.conceptos)||[];let r="",c=0;g.length>0?r=g.map(t=>{const p=parseFloat(t.cantidad||1)||1,b=parseFloat(t.precioUnitario||t.precio||t.valor||0)||0,v=t.total!==void 0?parseFloat(t.total):b*p;return c+=v,`
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${t.concepto||t.descripcion||"Servicio Odontológico"}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${s(b)}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">${p}</td>
          <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${s(v)}</td>
        </tr>`}).join(""):(c=parseFloat((l==null?void 0:l.total)||(l==null?void 0:l.monto)||0),r=`
      <tr>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; vertical-align: middle;">${(l==null?void 0:l.concepto)||"Abono a tratamiento"}</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${s(c)}</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: center; vertical-align: middle;">1</td>
        <td style="padding: 5px 8px; border: 1px solid #111; font-size: 11px; text-align: right; vertical-align: middle;">${s(c)}</td>
      </tr>`);const C=(l==null?void 0:l.total)!==void 0?parseFloat(l.total):(l==null?void 0:l.monto)!==void 0?parseFloat(l.monto):c,D=(o==null?void 0:o.nombreComercial)||(o==null?void 0:o.razonSocial)||(o==null?void 0:o.nombre)||"ATM Centro del Dolor Orofacial",x=o!=null&&o.nit?`NIT ${o.nit}`:"",h=(o==null?void 0:o.direccion)||"",E=o!=null&&o.ciudad?` - ${o.ciudad}`:"",a=(o==null?void 0:o.telefono)||(o==null?void 0:o.celular)||"",T=(o==null?void 0:o.email)||"",A=o!=null&&o.logoUrl?`<img src="${o.logoUrl}" style="max-height: 80px; max-width: 170px; object-fit: contain; display: block;" alt="Logo" />`:`<div style="font-size: 18px; font-weight: bold; color: #333; line-height: 1.1; text-transform: uppercase;">${D}</div>`,z=(l==null?void 0:l.observaciones)||(l==null?void 0:l.notas)||"";return`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Caja No.${$}</title>
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
        <div class="company-title">${D}</div>
        ${x?`<div>${x}</div>`:""}
        ${h||E?`<div>${h}${E}</div>`:""}
        ${a?`<div>${a}</div>`:""}
        ${T?`<div>${T}</div>`:""}
      </td>
      <td class="header-meta">
        <div style="text-align: right;">
          <div style="font-size: 12px; font-weight: normal;">Recibo de caja</div>
          <div style="font-size: 15px; font-weight: bold; margin-top: 2px;">No.${$}</div>
        </div>
      </td>
    </tr>
  </table>

  <table class="info-table">
    <tr>
      <td class="lbl" style="width: 16%;">SEÑOR(A)</td>
      <td style="width: 38%; font-weight: 500;">${m}</td>
      <td class="lbl" style="width: 26%;">FECHA DE EXPEDICIÓN (DD/MM/AA)</td>
      <td style="width: 20%; text-align: center;">${k}</td>
    </tr>
    <tr>
      <td class="lbl">DIRECCIÓN</td>
      <td>${P}</td>
      <td class="lbl"></td>
      <td></td>
    </tr>
    <tr>
      <td class="lbl">CIUDAD</td>
      <td>${R}</td>
      <td class="lbl">${S}</td>
      <td style="text-align: center; font-weight: 500;">${L}</td>
    </tr>
    <tr>
      <td class="lbl">TELÉFONO</td>
      <td>${(d==null?void 0:d.telefono)||(d==null?void 0:d.celular)||"—"}</td>
      <td class="lbl"></td>
      <td></td>
    </tr>
    <tr>
      <td class="lbl">ELABORADO POR</td>
      <td>${U}</td>
      <td class="lbl">MEDIO DE PAGO</td>
      <td style="text-align: center;">${n}</td>
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
      ${r}
    </tbody>
  </table>

  <table class="summary-table">
    <tr>
      <td class="obs-cell">
        <div style="font-weight: bold; margin-bottom: 4px;">Observaciones:</div>
        <div>${z}</div>
      </td>
      <td class="totals-cell">
        <table class="totals-inner-table">
          <tr>
            <td class="tot-label">Subtotal</td>
            <td class="tot-val">${s(C)}</td>
          </tr>
          <tr>
            <td class="tot-label">Total</td>
            <td class="tot-val">${s(C)}</td>
          </tr>
          ${e!=null&&e.planTitle?`
          <tr>
            <td class="tot-label">P. de trat.</td>
            <td class="tot-val">${e.planTitle}</td>
          </tr>`:""}
          ${(e==null?void 0:e.totalPlan)!==void 0?`
          <tr>
            <td class="tot-label">Total plan</td>
            <td class="tot-val">${s(e.totalPlan)}</td>
          </tr>`:""}
          ${(e==null?void 0:e.totalPagado)!==void 0?`
          <tr>
            <td class="tot-label">Total pagado</td>
            <td class="tot-val">${s(e.totalPagado)}</td>
          </tr>`:""}
          ${(e==null?void 0:e.saldo)!==void 0?`
          <tr>
            <td class="tot-label">Saldo total</td>
            <td class="tot-val">${s(e.saldo)}</td>
          </tr>`:""}
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
</html>`},sl=l=>{const d=ol(l),o=window.open("","_blank","width=800,height=900");if(!o){alert("Por favor permite las ventanas emergentes para imprimir el recibo.");return}o.document.open(),o.document.write(d),o.document.close()},il=l=>{const d=dl(l),o=window.open("","_blank","width=800,height=900");if(!o){alert("Por favor permite las ventanas emergentes (popups) para imprimir la factura.");return}o.document.open(),o.document.write(d),o.document.close()};export{sl as a,il as p};
