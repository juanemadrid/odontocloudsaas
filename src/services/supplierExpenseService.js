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

  // Sincronización complementaria en tablas SQL (si existen) para mantener coherencia con website_config
  try {
    await supabase
      .from('facturas_compra')
      .update({
        saldoPendiente: data.factura.saldoPendiente,
        saldo_pendiente: data.factura.saldo_pendiente,
        valorPagado: data.factura.valorPagado,
        estado: data.factura.estado,
        egresoAsociadoId: data.factura.egresoAsociadoId,
        egresoAsociadoDoc: data.factura.egresoAsociadoDoc,
        egresosAplicados: data.factura.egresosAplicados,
        egresos_asociados: data.factura.egresos_asociados,
      })
      .eq('id', invoiceId);
  } catch (e) {}

  try {
    await supabase
      .from('pagos_proveedor')
      .update({
        facturasSeleccionadas: data.pago.facturasSeleccionadas,
        valorAplicado: data.pago.valorAplicado,
        facturaId: data.pago.facturaId,
        factura_asociada: data.pago.factura_asociada,
      })
      .eq('id', paymentId);
  } catch (e) {}

  invalidateConfigCache(tenantId);
  return data;
}
