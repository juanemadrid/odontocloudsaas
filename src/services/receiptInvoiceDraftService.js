import supabase from '../lib/supabaseClient.js';

// Claim each existing receipt conditionally. Competing sessions cannot overwrite
// its invoice, and an incomplete draft is never eligible for transmission.
export async function createReceiptInvoiceDraft(record, receipts, client = supabase) {
  if (!record.tenant_id || !receipts.length) throw new Error('Faltan clínica o recibos.');
  const details = { ...record.detalles, receiptLinkState: 'PENDING' };
  const { data: draft, error } = await client.from('facturas')
    .insert([{ ...record, detalles: details }]).select().single();
  if (error || !draft) throw new Error(error?.message || 'No se pudo guardar el borrador.');
  const claimed = [];
  try {
    for (const receipt of receipts) {
      const table = receipt.isPago ? 'pagos' : 'recibos_caja';
      const { data, error: claimError } = await client.from(table)
        .update({ factura_id: draft.id }).eq('id', receipt.id)
        .eq('tenant_id', record.tenant_id).is('factura_id', null).select('id').single();
      if (claimError || !data) throw new Error('El recibo ya fue asociado por otra sesión o no pudo vincularse.');
      claimed.push({ table, id: receipt.id });
    }
    const { data: ready, error: readyError } = await client.from('facturas')
      .update({ detalles: { ...details, receiptLinkState: 'COMPLETE' } })
      .eq('id', draft.id).eq('tenant_id', record.tenant_id).select().single();
    if (readyError || !ready) throw new Error('No se pudo confirmar la asociación de los recibos.');
    return ready;
  } catch (failure) {
    // Preserve a non-emittable audit record; never delete a fiscal document.
    for (const receipt of claimed) {
      await client.from(receipt.table).update({ factura_id: null })
        .eq('id', receipt.id).eq('tenant_id', record.tenant_id).eq('factura_id', draft.id)
        .then(() => {}, () => {});
    }
    await client.from('facturas').update({ estado: 'Cancelado', detalles: {
      ...details, receiptLinkState: 'FAILED', dianStatus: 'CANCELADO', lastError: failure.message,
    } }).eq('id', draft.id).eq('tenant_id', record.tenant_id).then(() => {}, () => {});
    throw new Error(`${failure.message} No se emitió ninguna factura. Actualice los recibos antes de continuar.`);
  }
}
