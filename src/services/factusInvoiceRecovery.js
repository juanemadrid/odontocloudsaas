import supabase from '../lib/supabaseClient.js';
import { checkFactusBill } from './factusProxyService.js';

export function buildRecoveredInvoice(tenantId, expectedNumber, response) {
  const detail = response?.result;
  const bill = detail?.bill;
  const customer = detail?.customer || bill?.customer;
  const lines = detail?.items || bill?.items;
  if (!tenantId || !response?.exists || !bill || bill.number !== expectedNumber) {
    throw new Error('Factus no devolvió la factura solicitada. No se guardó ningún registro.');
  }
  if (![true, 1].includes(bill.is_validated) || !bill.cufe) {
    throw new Error('Solo se pueden recuperar facturas con validación y CUFE confirmados por Factus.');
  }
  if (!customer?.identification || !Array.isArray(lines) || !lines.length) {
    throw new Error('La respuesta no contiene el cliente y los conceptos completos. No se puede recuperar una factura incompleta.');
  }
  const total = Number(bill.total);
  if (!Number.isFinite(total) || total <= 0) throw new Error('El total de Factus no es válido.');
  const items = lines.map((line) => {
    const cantidad = Number(line.quantity);
    const precioUnitario = Number(line.price);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      throw new Error('Factus devolvió un concepto con cantidad o precio inválido.');
    }
    return { ...line, cantidad, precioUnitario, descripcion: line.name, concepto: line.code_reference || line.name,
      code: line.code_reference, total: Number(line.total ?? cantidad * precioUnitario) };
  });
  const rawOperation = detail.operation_type || bill.operation_type;
  const isHealth = Boolean(detail.health || bill.health || rawOperation === 'SS-CUFE' || rawOperation?.code === 'SS-CUFE' ||
    items.some(item => /^\d{6}$/.test(String(item.code || ''))));
  return {
    tenant_id: tenantId, numero: bill.number, total, subtotal: Number(bill.gross_value ?? total),
    impuestos: Number(bill.tax_amount ?? 0), estado: 'Emitido',
    fecha_emision: bill.created_at || bill.validated || null,
    detalles: {
      dianStatus: 'ACEPTADA', cufe: bill.cufe, factusInvoiceNumber: bill.number,
      factusReferenceCode: bill.reference_code || null, factusBillId: bill.id,
      factusIsValidated: true, technicalError: false, lastError: null,
      pacienteNombre: customer.names || customer.company || customer.trade_name || customer.name,
      pacienteDocumento: String(customer.identification), pacienteDireccion: customer.address,
      pacienteEmail: customer.email, pacienteTelefono: customer.phone,
      paciente: { nombre: customer.names || customer.company || customer.trade_name || customer.name,
        documento: String(customer.identification), email: customer.email, telefono: customer.phone,
        direccion: customer.address, ciudad: customer.municipality?.name,
        tipoDocumento: ({13:'CC',22:'CE',31:'NIT',12:'TI',41:'PASAPORTE',48:'PPT',11:'RC'})[customer.identification_document_id] },
      healthData: detail.health || bill.health || null,
      esSectorSalud: isHealth,
      tipoOperacion: isHealth ? 'SS-CUFE' : null,
      tercero: customer, items, factusResponse: { data: detail },
      recoveredFromFactus: true, recoveredAt: new Date().toISOString(),
      // Recovering a fiscal document does not assert that money was received.
      recibos_asociados: [], monto_pagado: 0, saldo_pendiente: total, estado_pago: 'PENDIENTE',
    },
  };
}

export async function previewFactusInvoiceRecovery(tenantId, rawNumber) {
  const number = String(rawNumber || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,80}$/.test(number)) throw new Error('Ingrese un número de factura válido.');
  const response = await checkFactusBill({ tenantId, billNumber: number });
  return buildRecoveredInvoice(tenantId, number, response);
}

export async function saveRecoveredInvoice(record, client = supabase) {
  if (!record?.tenant_id || !record.detalles?.recoveredFromFactus || !record.detalles?.cufe) {
    throw new Error('Falta una consulta validada de Factus para recuperar la factura.');
  }
  const { data: existing, error: readError } = await client.from('facturas').select('*')
    .eq('tenant_id', record.tenant_id).eq('numero', record.numero).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;
  // Stable PK also prevents concurrent recoveries from inserting the same invoice.
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${record.tenant_id}:${record.numero}`)));
  digest[6] = (digest[6] & 15) | 80; digest[8] = (digest[8] & 63) | 128;
  const hex = [...digest.slice(0,16)].map(b => b.toString(16).padStart(2,'0')).join('');
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  const { data, error } = await client.from('facturas').upsert({ ...record, id }, { onConflict:'id', ignoreDuplicates:true }).select().maybeSingle();
  if (error) throw error;
  if (data) return data;
  const result = await client.from('facturas').select('*').eq('tenant_id',record.tenant_id).eq('id',id).single();
  if (result.error) throw result.error;
  return result.data;
}
