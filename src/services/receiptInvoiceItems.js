// A receipt total belongs to the receipt, never to each of its concepts.
export function receiptConceptAmounts(concept, receipt) {
  const cantidad = Number(concept.cantidad ?? 1);
  // Receipts discount each unit; the invoice form discounts the entire line.
  const descuento = Number(concept.descuento ?? 0) * cantidad;
  const rawPrice = concept.precioUnitario ?? concept.precio_unitario ?? concept.precio ?? concept.price;
  const rawTotal = concept.total ?? concept.valor ?? concept.monto;
  const total = Number(rawTotal ?? (rawPrice != null ? Number(rawPrice) * cantidad - descuento :
    receipt.conceptos.length === 1 ? receipt.total : NaN));
  const precioUnitario = rawPrice != null ? Number(rawPrice) : (total + descuento) / cantidad;
  if (![cantidad, descuento, total, precioUnitario].every(Number.isFinite) || cantidad <= 0 ||
      descuento < 0 || total <= 0 || precioUnitario <= 0 ||
      Math.abs(precioUnitario * cantidad - descuento - total) > 0.01) {
    throw new Error(`El recibo #${receipt.consecutivoNumero} tiene un concepto con importes inconsistentes. Revíselo antes de facturar.`);
  }
  return { cantidad, descuento, total, precioUnitario };
}

// ── Códigos de los ítems de la factura ──────────────────────────────────────
// Un pago hecho desde "Paciente → Realizar pago" guarda qué procedimiento del presupuesto se
// pagó (itemPayments[].itemId). Ese procedimiento tiene su código CUPS: la factura debe
// llevar ese código, no uno armado con el número de renglón.

const GENERATED_CODE = /^(ITEM-[a-z0-9]+|SERV-\d{4}|\d{3})$/i;
const cleanCode = (value) => {
  const code = String(value ?? "").trim();
  return code && !GENERATED_CODE.test(code) ? code : "";
};

/** Procedimientos de un presupuesto (treatment_plans.detalles.items, o detalles como lista). */
export function planItemsOf(plan) {
  if (!plan) return [];
  let d = plan.detalles;
  if (typeof d === "string") {
    try { d = JSON.parse(d); } catch { d = null; }
  }
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  return Array.isArray(plan.items) ? plan.items : [];
}

/** Código CUPS de un procedimiento del presupuesto ("" si no tiene). */
export const planItemCode = (item) => cleanCode(item?.codigo_cups || item?.cups || item?.code || item?.codigo);

/**
 * Conceptos de un recibo hecho desde el paciente: nombre, valor abonado y el CUPS del
 * procedimiento exacto que se pagó (por su identificador, nunca adivinando por nombre).
 */
export function paymentConcepts(itemPayments, plan) {
  const items = planItemsOf(plan);
  return (Array.isArray(itemPayments) ? itemPayments : []).map((it) => {
    const source = it?.itemId != null ? items.find((p) => String(p?.id) === String(it.itemId)) : null;
    const cups = cleanCode(it?.codigo_cups) || planItemCode(source);
    return {
      concepto: it?.desc || it?.concepto || "",
      precioUnitario: Number(it?.monto || 0),
      cantidad: 1,
      total: Number(it?.monto || 0),
      ...(it?.itemId != null ? { planItemRef: String(it.itemId) } : {}),
      ...(cups ? { cups } : {}),
    };
  });
}

/** Código interno para un concepto sin CUPS: 001, 002… según el renglón de la factura. */
export const internalLineCode = (lineNumber) => String(lineNumber).padStart(3, "0");

/** Código del renglón: el CUPS si el concepto lo trae; si no, el interno del renglón. */
export const invoiceLineCode = (concept, lineNumber) =>
  cleanCode(concept?.cups) || cleanCode(concept?.codigo_cups) || cleanCode(concept?.code) || internalLineCode(lineNumber);
