import supabase from '../lib/supabaseClient';
import { invalidateConfigCache } from './configCacheService';

export async function createSupplierExpense(tenantId, payment, liquidacionId = null) {
  const { data, error } = await supabase.rpc('create_supplier_expense', {
    p_tenant_id: tenantId, p_payment: payment, p_liquidacion_id: liquidacionId,
  });
  if (error) throw error;
  if (!data?.pago?.id) throw new Error('No se pudo confirmar el egreso. Actualice antes de reintentar.');
  invalidateConfigCache(tenantId);
  return data.pago;
}

export async function associateSupplierExpense(tenantId, invoiceId, paymentId, amount, requestId) {
  const { data, error } = await supabase.rpc('associate_supplier_expense', {
    p_tenant_id: tenantId, p_invoice_id: invoiceId, p_payment_id: paymentId, p_amount: amount, p_request_id: requestId,
  });
  if (error) throw error;
  if (!data?.factura?.id || !data?.pago?.id) throw new Error('No se pudo confirmar la asociación.');
  invalidateConfigCache(tenantId);
  return data;
}
