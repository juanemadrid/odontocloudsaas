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
