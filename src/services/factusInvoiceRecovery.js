import supabase from '../lib/supabaseClient.js';
import { checkFactusBill } from './factusProxyService.js';

export function recoveredInvoiceDate(raw) {
  if (!raw) throw new Error('Factus no devolvió la fecha de emisión.');
  const value = String(raw).trim();
  const match = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}):(\d{2}) (AM|PM))?$/.exec(value);
  if (match) {
    const [,day,month,year,hour='12',minute='00',second='00',period='AM'] = match;
    const h = Number(hour);
    const calendar = new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
    if (h < 1 || h > 12 || Number(minute)>59 || Number(second)>59 || calendar.getUTCDate()!==Number(day) || calendar.getUTCMonth()+1!==Number(month)) {
      throw new Error('La fecha de emisión de Factus no es válida.');
    }
    return `${year}-${month}-${day}T${String(h % 12 + (period==='PM' ? 12 : 0)).padStart(2,'0')}:${minute}:${second}-05:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))) return value;
  throw new Error('El formato de fecha de emisión de Factus no es válido.');
}

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
  const totals = detail?.totals || bill?.totals || {};
  const total = Number(totals.total ?? bill.total);
  if (!Number.isFinite(total) || total <= 0) throw new Error('El total de Factus no es válido.');
  const subtotal = Number(totals.gross_amount ?? bill.gross_value ?? total);
  const tax = Number(totals.tax_amount ?? bill.tax_amount ?? 0);
  if (![subtotal,tax].every(Number.isFinite)) throw new Error('Los subtotales de Factus no son válidos.');
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
  const rawHealth = detail.health || bill.health;
  const health = rawHealth ? { ...rawHealth,
    payment_method_code: rawHealth.payment_method_code || rawHealth.payment_method?.code,
    coverage_code: rawHealth.coverage_code || rawHealth.coverage?.code,
    without_contract_code: rawHealth.without_contract_code || rawHealth.without_contract?.code,
  } : null;
  const isHealth = Boolean(detail.health || bill.health || rawOperation === 'SS-CUFE' || rawOperation?.code === 'SS-CUFE' ||
    items.some(item => /^\d{6}$/.test(String(item.code || ''))));
  return {
    tenant_id: tenantId, numero: bill.number, total, subtotal,
    impuestos: tax, estado: 'Emitido',
    fecha_emision: recoveredInvoiceDate(bill.created_at || bill.validated_at || bill.validated),
    detalles: {
      dianStatus: 'ACEPTADA', cufe: bill.cufe, factusInvoiceNumber: bill.number,
      factusReferenceCode: bill.reference_code || null, factusBillId: bill.id,
      factusIsValidated: true, technicalError: false, lastError: null,
      pacienteNombre: customer.names || customer.company || customer.trade_name || customer.name,
      pacienteDocumento: String(customer.identification), pacienteDireccion: customer.address,
      pacienteEmail: customer.email, pacienteTelefono: customer.phone,
      pacienteCiudad: customer.municipality?.name,
      pacienteTipoDocumento: ({13:'CC',22:'CE',31:'NIT',12:'TI',41:'PASAPORTE',48:'PPT',11:'RC'})[customer.identification_document?.code || customer.identification_document_id],
      paciente: { nombre: customer.names || customer.company || customer.trade_name || customer.name,
        documento: String(customer.identification), email: customer.email, telefono: customer.phone,
        direccion: customer.address, ciudad: customer.municipality?.name, municipality_code: customer.municipality?.code,
        tipoDocumento: ({13:'CC',22:'CE',31:'NIT',12:'TI',41:'PASAPORTE',48:'PPT',11:'RC'})[customer.identification_document?.code || customer.identification_document_id] },
      healthData: health, health,
      qrCode: bill.links?.qr || detail.links?.qr || null,
      billing_period: detail.billing_period || bill.billing_period || null,
      factusRelatedNotes: detail.related_notes || bill.related_notes || null,
      factusWarnings: bill.errors || detail.errors || null,
      observaciones: bill.observation || detail.observation || '',
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
