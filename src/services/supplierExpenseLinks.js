// Internal IDs identify records; they never supply a financial document number.
export const getExpenseNumber = payment => String(
  payment?.consecutivo || payment?.numero || payment?.nroConsecutivo || payment?.nroPago || payment?.nro_consecutivo || ''
).trim().replace(/^EGR-?/i, "").replace(/^Egreso\s*#?\s*/i, "").trim();

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
  const inverse = [
    invoice.egresoAsociadoId,
    invoice.egresoAsociadoDoc,
    invoice.egreso_asociado,
    invoice.pago_asociado,
    invoice.egresos_asociados,
    (invoice.egresosAplicados || []).map(entry => entry?.egresoId || entry?.numero || entry)
  ].flatMap(refs);
  if (inverse.some(ref => paymentRefs.includes(ref))) return true;
  const invoiceId = text(invoice.id);
  const invoicePrefix = text(invoice.prefijo || invoice.prefix);
  const invoiceSeq = text(invoice.numero || invoice.consecutivo);
  // Un número de factura debe tener número: el prefijo solo (p. ej. "FEMT") no identifica ninguna factura
  const allInvoiceNumbers = [
    invoice.nroFactura,
    invoice.documentoNumero,
    invoice.numero,
    invoice.consecutivo,
    invoicePrefix && invoiceSeq ? `${invoicePrefix}${invoiceSeq}` : null,
    invoicePrefix && invoiceSeq ? `${invoicePrefix}-${invoiceSeq}` : null
  ].map(text).filter(num => num && /\d/.test(num));

  const direct = [payment.facturaId, payment.factura_id, payment.factura_asociada, payment.facturasSeleccionadas].flatMap(refs);
  if (direct.some(ref => ref === invoiceId || allInvoiceNumbers.some(num => normalized(ref) === normalized(num)))) return true;
  if ((Array.isArray(payment.items) ? payment.items : []).some(item => item.isFactura && (
    (invoiceId && text(item.facturaId) === invoiceId) || allInvoiceNumbers.some(num => normalized(item.numeroFactura || item.concepto) === normalized(num))
  ))) return true;

  // Matching por mención en notas / observaciones
  const notes = normalized([payment.observaciones, payment.notas, payment.descripcion, payment.concepto].filter(Boolean).join(' '));
  for (const num of allInvoiceNumbers) {
    const doc = normalized(num);
    if (doc.length >= 4 && /[a-z]/.test(doc) && notes.includes(doc)) return true;
    const digits = num.replace(/\D/g, '');
    if (digits.length >= 3 && notes.includes(digits)) return true;
  }
  return false;
}
