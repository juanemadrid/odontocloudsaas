import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import {
    FiFileText, FiSearch, FiCopy, FiCheckCircle,
    FiMoreHorizontal, FiDownload, FiInbox,
    FiPrinter, FiX, FiInfo, FiLoader, FiMail
} from 'react-icons/fi';
import { formatCurrency } from '../../../utils/formatters';

const fmtDate = (iso) => {
    if (!iso) return '\u2014';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtDateLong = (iso) => {
    if (!iso) return '\u2014';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
};
const PAYMENT_LABELS = {
    '10': 'Efectivo', '42': 'Transferencia D\u00e9bito', '20': 'Cheque',
    '47': 'Tarjeta D\u00e9bito', '48': 'Tarjeta Cr\u00e9dito', '1': 'Contado', '2': 'Cr\u00e9dito',
};
const STATUS_CONFIG = {
    pagada:    { label: 'Pagada',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
    pagado:    { label: 'Pagada',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
    paid:      { label: 'Pagada',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
    emitido:   { label: 'Emitida DIAN', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100',   dot: 'bg-indigo-500'  },
    emitida:   { label: 'Emitida DIAN', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100',   dot: 'bg-indigo-500'  },
    cancelada: { label: 'Anulada',      cls: 'bg-rose-50 text-rose-700 border-rose-100',         dot: 'bg-rose-500'    },
    anulada:   { label: 'Anulada',      cls: 'bg-rose-50 text-rose-700 border-rose-100',         dot: 'bg-rose-500'    },
    void:      { label: 'Anulada',      cls: 'bg-rose-50 text-rose-700 border-rose-100',         dot: 'bg-rose-500'    },
};
const getStatus = (s) => STATUS_CONFIG[(s || '').toLowerCase()] ||
    { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-400' };


/* ------------------------------------------------------------------ */
/*  Print helper                                                        */
/* ------------------------------------------------------------------ */
const printInvoice = (fact, patient, tenant) => {
    const payLabel = PAYMENT_LABELS[String(fact.medioPago)] || fact.medioPago || 'Contado';
    const items    = fact.items || [];
    const currency = (n) => Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

    const fmtDateSlash = (iso) => {
        if (!iso) return '\u2014';
        try {
            const d = new Date(iso);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return '\u2014';
        }
    };

    // Calculate total from items — fact.total may be a partial payment (abono)
    const itemsTotal = items.length > 0
        ? items.reduce((sum, it) => {
            const qty   = parseFloat(it.cantidad || it.quantity || 1);
            const price = parseFloat(it.precioUnitario || it.precio || it.valor || 0);
            const disc  = parseFloat(it.descuento || it.discount || 0);
            return sum + price * qty * (1 - disc / 100);
          }, 0)
        : parseFloat(fact.total || 0);

    const itemRows = items.length > 0
        ? items.map(it => {
            const qty   = parseFloat(it.cantidad || it.quantity || 1);
            const price = parseFloat(it.precioUnitario || it.precio || it.valor || 0);
            const disc  = parseFloat(it.descuento || it.discount || 0);
            const line  = price * qty * (1 - disc / 100);
            const desc  = it.descripcion || it.nombre || it.concepto || 'Servicio Odontol\u00f3gico';
            return `<tr>
              <td style="padding:6px 8px;border:1px solid #000;">${desc}</td>
              <td style="padding:6px 8px;border:1px solid #000;text-align:right;">${currency(price)}</td>
              <td style="padding:6px 8px;border:1px solid #000;text-align:center;">${qty}</td>
              <td style="padding:6px 8px;border:1px solid #000;text-align:right;">${currency(line)}</td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="4" style="padding:8px;color:#888;border:1px solid #000;text-align:center;">Servicio Odontol\u00f3gico &mdash; ${currency(itemsTotal)}</td></tr>`;

    const logoHtml = tenant?.logoUrl ? `<img src="${tenant.logoUrl}" style="max-height:80px;max-width:180px;object-fit:contain;display:block;" />` : '';
    const obsHtml = fact.observaciones ? `<p style="margin-bottom:4px;font-weight:bold;">Observaciones:</p><p>${fact.observaciones}</p>` : '<p style="font-weight:bold;">Observaciones:</p>';

    // QR code — factusQr contains the DIAN validation URL from Factus
    const qrData   = fact.factusQr || fact.factusPdfUrl || '';
    const qrImgUrl = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=000000&margin=4` : '';
    const qrHtml   = qrImgUrl
        ? `<img id="qr" src="${qrImgUrl}" style="width:105px;height:105px;display:block;" alt="QR DIAN" onload="document.getElementById('qrLoaded').textContent='1';tryPrint()" onerror="tryPrint()" />`
        : '';

    const professionalName = fact.profesional || tenant?.nombreComercial || 'Profesional';

    const resDate = tenant?.dianFechaResolucion ? fmtDateSlash(tenant.dianFechaResolucion) : '';
    const resolutionText = tenant?.dianResolucion
        ? `Autorizaci\u00f3n de numeraci\u00f3n de facturaci\u00f3n de n\u00famero ${tenant.dianResolucion} de ${resDate} Modalidad Factura Electr\u00f3nica desde ${tenant.dianPrefijo || ''}${tenant.dianRangoDesde || ''} hasta ${tenant.dianPrefijo || ''}${tenant.dianRangoHasta || ''}`
        : '';

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Factura ${fact.factusNumero || fact.nroFactura || ''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:24px;max-width:750px;margin:auto;line-height:1.3}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:2px solid #000;padding-bottom:12px}
.logo-box{width:25%;display:flex;justify-content:flex-start}
.company-box{width:45%;text-align:center}
.cn{font-size:15px;font-weight:bold;margin-bottom:4px;text-transform:uppercase}
.ci{font-size:11px;color:#333;line-height:1.4}
.meta-box{width:30%;display:flex;justify-content:flex-end;align-items:center;gap:12px}
.meta-text{text-align:right;font-size:10px;line-height:1.4}
.meta-text .tp{font-weight:bold;font-size:11px;text-transform:uppercase}
.meta-text .nm{font-size:15px;font-weight:bold;margin:2px 0}
.meta-text .nt{font-size:10px;color:#222}
.qr-box{width:105px;height:105px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center}
table.info{width:100%;border-collapse:collapse;margin-bottom:16px}
table.info td{padding:6px 8px;border:1px solid #000;font-size:11px;height:26px}
td.lb{background:#f2f2f2;font-weight:bold;width:23%;text-transform:uppercase}
table.items{width:100%;border-collapse:collapse;margin-bottom:16px}
table.items th{background:#f2f2f2;color:#000;border:1px solid #000;padding:6px 8px;text-align:left;font-size:11px;font-weight:bold;text-transform:uppercase}
.summary-section{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;gap:20px}
.obs-box{flex:1;font-size:11px;border:1px solid #000;padding:8px;min-height:55px;height:auto}
.tot-box{width:250px;shrink-0:true}
.tot-box table{width:100%;border-collapse:collapse}
.tot-box td{padding:6px 8px;border:1px solid #000;font-size:11px;text-align:right}
.tot-box td.lb{font-weight:bold;background:#f2f2f2;width:50%;text-align:left;text-transform:uppercase}
.tot-box .gr{font-weight:bold;font-size:13px}
.signatures{display:flex;justify-content:space-between;margin-top:45px;margin-bottom:24px;gap:50px}
.signatures > div{flex:1;text-align:center;font-size:10px;font-weight:bold;color:#111}
.signatures .line{border-top:1px solid #000;margin-bottom:8px;width:75%;margin-left:auto;margin-right:auto}
.resolution-text{text-align:center;font-size:9px;color:#333;margin-top:12px;line-height:1.4}
.ft{display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#777;margin-top:16px}
@media print{body{padding:0}}
</style></head><body>
<div class="hdr">
  <div class="logo-box">${logoHtml}</div>
  <div class="company-box">
    <div class="cn">${tenant?.nombreComercial || tenant?.razonSocial || 'Cl\u00ednica Dental'}</div>
    <div class="ci">
      ${tenant?.nit ? 'NIT ' + tenant.nit : ''}<br/>
      ${tenant?.direccion || ''}${tenant?.ciudad ? ', ' + tenant.ciudad : ''}<br/>
      ${tenant?.telefono ? 'Tel: ' + tenant.telefono : ''}<br/>
      ${tenant?.email || ''}
    </div>
  </div>
  <div class="meta-box">
    <div class="meta-text">
      <div class="tp">Factura electr\u00f3nica de venta</div>
      <div class="nm">No. ${fact.factusNumero || fact.nroFactura || '\u2014'}</div>
      <div class="nt">Factura de venta original</div>
      <div class="nt">Los servicios de salud est\u00e1n</div>
      <div class="nt" style="font-weight:bold;">excluidos de IVA</div>
    </div>
    <div class="qr-box">${qrHtml}</div>
  </div>
</div>
<table class="info">
  <tr>
    <td class="lb">SE\u00d1OR(A)</td>
    <td>${patient?.nombreCompleto || ((patient?.nombres||'')+(patient?.apellidos?' '+patient.apellidos:''))  || '\u2014'}</td>
    <td class="lb">FECHA DE EXPEDICI\u00d3N (DD/MM/AA)</td>
    <td>${fmtDateSlash(fact.fechaISO)}</td>
  </tr>
  <tr>
    <td class="lb">DIRECCI\u00d3N</td>
    <td>${patient?.lugarResidencia||patient?.direccion||'\u2014'}</td>
    <td class="lb">FECHA DE VENCIMIENTO (DD/MM/AA)</td>
    <td>${fmtDateSlash(fact.fechaISO)}</td>
  </tr>
  <tr>
    <td class="lb">CIUDAD</td>
    <td>${patient?.ciudadDomicilio||patient?.ciudad||'\u2014'}</td>
    <td class="lb"></td>
    <td></td>
  </tr>
  <tr>
    <td class="lb">TEL\u00c9FONO</td>
    <td>${patient?.celular||patient?.telefono||'\u2014'}</td>
    <td class="lb">NIT / CC</td>
    <td>${patient?.nroDocumento||patient?.documento||patient?.identificacion||'\u2014'}</td>
  </tr>
  <tr>
    <td class="lb">ELABORADO POR</td>
    <td>${professionalName}</td>
    <td class="lb">MEDIO DE PAGO</td>
    <td>${payLabel}</td>
  </tr>
  ${fact.factusCufe ? `
  <tr>
    <td class="lb">CUFE</td>
    <td colspan="3" style="font-family:monospace;font-size:9px;word-break:break-all;">${fact.factusCufe}</td>
  </tr>` : ''}
</table>
<table class="items">
<thead><tr><th>\u00cdtem</th><th style="text-align:right">Precio</th><th style="text-align:center">Cantidad</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${itemRows}</tbody>
</table>
<div class="summary-section">
  <div class="obs-box">${obsHtml}</div>
  <div class="tot-box">
    <table>
      <tr><td class="lb">Subtotal</td><td>${currency(itemsTotal)}</td></tr>
      <tr class="gr"><td class="lb">Total</td><td>${currency(itemsTotal)}</td></tr>
    </table>
  </div>
</div>
<div class="signatures">
  <div>
    <div class="line"></div>
    <div>ELABORADO POR</div>
  </div>
  <div>
    <div class="line"></div>
    <div>ACEPTADA, FIRMA Y/O SELLO Y FECHA</div>
  </div>
</div>
${resolutionText ? `<div class="resolution-text">${resolutionText}</div>` : ''}
<div class="ft"><span>1 de 1</span><span>Proveedor Tecnol\u00f3gico: Factus &middot; OdontoCloud</span></div>
<span id="qrLoaded" style="display:none"></span>
<script>
function tryPrint() {
  if (!document.getElementById('qr') || document.getElementById('qrLoaded').textContent === '1') {
    window.print();
  }
}
window.onload = function() { if (!document.getElementById('qr')) tryPrint(); };
<\/script>
</body></html>`;

    const win = window.open('', '_blank', 'width=760,height=900');
    win.document.write(html);
    win.document.close();
};

/* ------------------------------------------------------------------ */
/*  Invoice Detail Modal                                               */
/* ------------------------------------------------------------------ */
function InvoiceDetailModal({ fact, patient, tenant, onClose }) {
    if (!fact) return null;
    const items    = fact.items || [];
    const total    = parseFloat(fact.total || 0);
    const payLabel = PAYMENT_LABELS[String(fact.medioPago)] || fact.medioPago || 'Contado';
    const isEmit   = fact.factusEstado === 'Emitido';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Detalle de factura</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            #{fact.nroFactura || fact.id.slice(-6).toUpperCase()} &middot; {fmtDateLong(fact.fechaISO)}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <FiX size={16} />
                    </button>
                </div>
                <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><p className="text-slate-400 mb-0.5">Medio de pago</p><p className="font-medium text-slate-700">{payLabel}</p></div>
                        <div><p className="text-slate-400 mb-0.5">Estado</p><p className="font-medium text-slate-700">{fact.estado || 'Pendiente'}</p></div>
                        {fact.factusNumero && (
                            <div className="col-span-2"><p className="text-slate-400 mb-0.5">N.\u00ba Oficial DIAN</p><p className="font-mono font-semibold text-indigo-600">{fact.factusNumero}</p></div>
                        )}
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Prestaciones</p>
                        {items.length > 0 ? items.map((it, i) => {
                            const qty   = parseFloat(it.cantidad || it.quantity || 1);
                            const price = parseFloat(it.precioUnitario || it.precio || it.valor || 0);
                            const desc  = it.descripcion || it.nombre || it.concepto || 'Servicio';
                            return (
                                <div key={i} className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-slate-700">{desc}</p>
                                        {qty > 1 && <p className="text-[11px] text-slate-400">{qty} uds x ${price.toLocaleString('es-CO')}</p>}
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">${(price * qty).toLocaleString('es-CO')}</p>
                                </div>
                            );
                        }) : (
                            <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                                <p className="text-xs text-slate-600">Servicio Odontol\u00f3gico</p>
                                <p className="text-sm font-semibold text-slate-800">${total.toLocaleString('es-CO')}</p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="text-sm font-bold text-slate-700">Total</span>
                        <span className="text-xl font-black text-slate-900">${total.toLocaleString('es-CO')}</span>
                    </div>
                    {fact.factusCufe && (
                        <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">CUFE</p>
                            <p className="font-mono text-[10px] text-slate-500 break-all">{fact.factusCufe}</p>
                        </div>
                    )}
                    {/* QR DIAN */}
                    {(fact.factusQr || fact.factusPdfUrl) && (
                        <div className="flex items-start gap-4 bg-slate-50 rounded-lg p-3">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(fact.factusQr || fact.factusPdfUrl)}&bgcolor=ffffff&color=000000&margin=4`}
                                alt="QR verificación DIAN"
                                className="w-24 h-24 rounded border border-slate-200 shrink-0"
                            />
                            <div className="flex-1">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Verificación DIAN</p>
                                <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                                    Escanea el código QR para verificar o descargar esta factura en el portal de la DIAN.
                                </p>
                                <a
                                    href={fact.factusQr || fact.factusPdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                                >
                                    Verificar en DIAN →
                                </a>
                            </div>
                        </div>
                    )}

                </div>
                <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 flex-wrap">
                    <button onClick={() => printInvoice(fact, patient, tenant)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white hover:shadow-sm transition-all">
                        <FiPrinter size={14} /> Imprimir
                    </button>
                    {isEmit && fact.factusPdfUrl && (
                        <a href={fact.factusPdfUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white hover:shadow-sm transition-all">
                            <FiDownload size={14} /> PDF Factus
                        </a>
                    )}
                    <div className="flex-1" />
                    {isEmit ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg">
                            <FiCheckCircle size={13} /> Emitida ante DIAN
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                            Pendiente de emisión desde el plan
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function HistoricoFacturasTab({ patientId, patient }) {
    const { userProfile } = useAuth();
    const toast = useToast();
    const [facturas, setFacturas]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [tenant, setTenant]             = useState(null);
    const [search, setSearch]             = useState('');
    const [openMenu, setOpenMenu]         = useState(null);
    const [selectedInvoice, setSelected]  = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!patientId) return;
        const q = query(collection(db, 'facturas'), where('patientId', '==', patientId), orderBy('fechaISO', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setFacturas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });
        return () => unsub();
    }, [patientId]);

    useEffect(() => {
        if (!userProfile?.inquilino) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'tenants', userProfile.inquilino));
                if (snap.exists()) {
                    const d = snap.data();
                    setTenant({
                        nit: d.nit || '',
                        razonSocial: d.razonSocial || '',
                        nombreComercial: d.name || d.nombreComercial || '',
                        direccion: d.address || d.direccion || '',
                        telefono: d.phone || d.telefono || '',
                        email: d.email || '',
                        logoUrl: d.logo || d.logoUrl || '',
                        ciudad: d.ciudad || '',
                        dianResolucion: d.dianResolucion || '',
                        dianPrefijo: d.dianPrefijo || '',
                        dianRangoDesde: d.dianRangoDesde || '',
                        dianRangoHasta: d.dianRangoHasta || '',
                        dianFechaResolucion: d.dianFechaResolucion || ''
                    });
                }
            } catch (e) { console.error(e); }
        })();
    }, [userProfile]);

    const copyTable = () => {
        const text = filtered.map(f =>
            [fmtDate(f.fechaISO), f.nroFactura || f.id.slice(-6).toUpperCase(),
             PAYMENT_LABELS[String(f.medioPago)] || f.medioPago || '\u2014',
             f.factusNumero || '\u2014', f.total || 0, f.estado || 'Pendiente'].join('\t')
        ).join('\n');
        navigator.clipboard.writeText(text).then(() => toast.success('Tabla copiada'));
    };

    const filtered = facturas.filter(f => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (f.nroFactura||'').toLowerCase().includes(q) || (f.factusNumero||'').toLowerCase().includes(q) ||
               (f.estado||'').toLowerCase().includes(q)    || (f.fechaISO||'').includes(q);
    });

    if (loading) return (
        <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
            <FiLoader size={20} className="animate-spin" />
            <span className="text-sm font-medium">Cargando facturas\u2026</span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-white">
            {selectedInvoice && (
                <InvoiceDetailModal fact={selectedInvoice} patient={patient} tenant={tenant}
                    onClose={() => setSelected(null)} />
            )}
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-white sticky top-0 z-10">
                <p className="text-xs text-slate-400 italic select-none">{facturas.length} {facturas.length === 1 ? 'factura registrada' : 'facturas registradas'}</p>
                <div className="flex items-center gap-2">
                    <button onClick={copyTable} title="Copiar tabla" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                        <FiCopy size={14} />
                    </button>
                    <div className="relative">
                        <FiSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                            className="pl-7 pr-3 h-8 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 w-40 transition" />
                    </div>
                </div>
            </div>
            {/* Table */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-300 py-16">
                    <FiInbox size={38} strokeWidth={1} />
                    <p className="text-sm font-medium text-slate-400">{search ? 'Sin resultados' : 'No hay facturas registradas'}</p>
                    {search && <button onClick={() => setSearch('')} className="text-xs text-indigo-500 hover:underline">Limpiar b\u00fasqueda</button>}
                </div>
            ) : (
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70">
                                {['Fecha','N.º Factura','Sucursal','Profesional','Medio de pago','Factura','Valor','Usuario','Acciones'].map((col,i) => (
                                    <th key={i} className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap select-none">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((fact, idx) => {
                                const isEmit    = fact.factusEstado === 'Emitido';
                                const st        = getStatus(isEmit ? 'emitido' : fact.estado);
                                const payLabel  = PAYMENT_LABELS[String(fact.medioPago)] || fact.medioPago || '\u2014';
                                return (
                                    <tr key={fact.id} className={`border-b border-slate-50 hover:bg-indigo-50/20 transition-colors ${idx%2===0?'bg-white':'bg-slate-50/20'}`}>
                                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(fact.fechaISO)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap"><span className="font-semibold text-slate-700 text-xs">#{fact.nroFactura||fact.numero||fact.id.slice(-6).toUpperCase()}</span></td>
                                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{tenant?.nombreComercial || 'Sede Principal'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fact.profesional || userProfile?.nombreCompleto || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{payLabel}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {fact.factusNumero
                                                ? <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{fact.factusNumero}</span>
                                                : <span className="text-xs text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap"><span className="font-semibold text-slate-800 text-sm">${formatCurrency(fact.total||0)}</span></td>
                                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                            {patient?.email || patient?.correo || '—'}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <div className="relative" ref={openMenu===fact.id?menuRef:null}>
                                                <button onClick={() => setOpenMenu(openMenu===fact.id?null:fact.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                                                    <FiMoreHorizontal size={16} />
                                                </button>
                                                {openMenu===fact.id && (
                                                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-50 py-1 min-w-[172px]">
                                                        <button onClick={() => { setSelected(fact); setOpenMenu(null); }}
                                                            className="flex items-center gap-2.5 w-full px-4 py-2 text-xs font-semibold text-[#8CC63F] hover:bg-green-50 transition-colors">
                                                            <FiInfo size={13}/> Información
                                                        </button>
                                                        <div className="border-t border-slate-50 my-1" />
                                                        <button onClick={() => { printInvoice(fact, patient, tenant); setOpenMenu(null); }}
                                                            className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                                            <FiPrinter size={13}/> Imprimir
                                                        </button>
                                                        <button onClick={() => {
                                                            const email = patient?.email || patient?.correo || '';
                                                            if (!email) { toast.error('El paciente no tiene correo registrado.'); return; }
                                                            toast.info(`Enviando factura a ${email}…`);
                                                            setOpenMenu(null);
                                                        }}
                                                            className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                                            <FiMail size={13}/> Enviar correo
                                                        </button>
                                                        {isEmit && fact.factusPdfUrl && (
                                                            <a href={fact.factusPdfUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}
                                                                className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                                                <FiDownload size={13}/> Descargar PDF
                                                            </a>
                                                        )}
                                                        {isEmit && fact.factusCufe && (
                                                            <button onClick={() => { navigator.clipboard.writeText(fact.factusCufe); toast.success('CUFE copiado'); setOpenMenu(null); }}
                                                                className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                                                <FiCopy size={13}/> Copiar CUFE
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {/* Footer */}
            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <p className="text-[11px] text-slate-300 select-none">OdontoCloud &middot; Facturaci\u00f3n Electr\u00f3nica DIAN</p>
                <p className="text-[11px] text-slate-300 select-none">{filtered.length} de {facturas.length} registros</p>
            </div>
        </div>
    );
}