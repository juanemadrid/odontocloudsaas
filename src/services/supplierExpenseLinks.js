// Internal IDs identify records; they never supply a financial document number.
export const getExpenseNumber = payment => String(
  payment?.consecutivo || payment?.numero || payment?.nroConsecutivo || payment?.nroPago || payment?.nro_consecutivo || ''
).trim();

const text = value => value == null ? '' : String(value).trim();
const normalized = value => text(value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const refs = value => (Array.isArray(value) ? value : [value]).flatMap(item => {
  if (item && typeof item === 'object') return [item.id, item.egresoId, item.numero, item.nroFactura, item.documentoNumero].map(text).filter(Boolean);
  return text(item) ? [text(item)] : [];
});

export function expenseMatchesInvoice(payment, invoice) {
  if (!payment || !invoice) return false;
  if (payment.tenant_id && invoice.tenant_id && payment.tenant_id !== invoice.tenant_id) return false;
  const paymentRefs = [text(payment.id), getExpenseNumber(payment)].filter(Boolean);
  const inverse = [invoice.egresoAsociadoId, !invoice.egresoAsociadoId ? invoice.egresoAsociadoDoc : null, invoice.egreso_asociado,
    invoice.pago_asociado, invoice.egresos_asociados,
    (invoice.egresosAplicados || []).map(entry => entry.egresoId)].flatMap(refs);
  if (inverse.some(ref => paymentRefs.includes(ref))) return true;
  const invoiceId = text(invoice.id);
  const invoiceNumber = text(invoice.nroFactura || invoice.documentoNumero || invoice.numero || invoice.consecutivo);
  const direct = [payment.facturaId, payment.factura_id, payment.factura_asociada, payment.facturasSeleccionadas].flatMap(refs);
  if (direct.some(ref => ref === invoiceId || (invoiceNumber && normalized(ref) === normalized(invoiceNumber)))) return true;
  if ((Array.isArray(payment.items) ? payment.items : []).some(item => item.isFactura && (
    (invoiceId && text(item.facturaId) === invoiceId) || (invoiceNumber && normalized(item.numeroFactura || item.concepto) === normalized(invoiceNumber))
  ))) return true;
  // Keep explicit legacy document mentions; supplier name and equal amounts alone are not a link.
  const document = normalized(invoiceNumber);
  const notes = normalized([payment.observaciones, payment.notas, payment.descripcion, payment.concepto].filter(Boolean).join(' '));
  return document.length >= 4 && /[a-z]/.test(document) && notes.includes(document);
}
