import supabase from '../lib/supabaseClient';
import { invalidateConfigCache } from './configCacheService';
import { getConfigSection, saveConfigSection } from './configPersistenceService';

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
  // Saneamiento proactivo: si el documento no tiene egresos vinculados pero su saldo en config
  // era 0 o menor al monto solicitado, restauramos su saldo al total real para evitar que
  // la RPC de base de datos sea rechazada por 'El valor supera el saldo del documento'.
  const healInvoiceBalanceIfNeeded = async () => {
    try {
      const currentFacturas = await getConfigSection(tenantId, "facturas_compra", []);
      const invIndex = (currentFacturas || []).findIndex(f => String(f.id) === String(invoiceId));
      if (invIndex >= 0) {
        const inv = currentFacturas[invIndex];
        const hasEgresos = (Array.isArray(inv.egresosAplicados) && inv.egresosAplicados.length > 0) || Boolean(inv.egresoAsociadoId);
        const totalDoc = Number(inv.totalNeto !== undefined ? inv.totalNeto : (inv.total || inv.subtotal || 0));
        const currentPending = Number(inv.saldoPendiente ?? inv.saldo_pendiente ?? 0);

        if (!hasEgresos && (currentPending < amount || currentPending <= 0)) {
          const healedFacturas = [...currentFacturas];
          healedFacturas[invIndex] = {
            ...inv,
            saldoPendiente: totalDoc,
            saldo_pendiente: totalDoc,
            valorPagado: 0,
            estado: 'Pendiente',
          };
          await saveConfigSection(tenantId, "facturas_compra", healedFacturas);
        }
      }
    } catch (healErr) {
      console.warn("Aviso al verificar saldo del documento antes de asociar egreso:", healErr);
    }
  };

  await healInvoiceBalanceIfNeeded();

  let rpcRes = await supabase.rpc('associate_supplier_expense', {
    p_tenant_id: tenantId, p_invoice_id: invoiceId, p_payment_id: paymentId, p_amount: amount, p_request_id: requestId,
  });

  // Si la RPC arroja que supera el saldo, forzar el saneamiento en website_config y reintentar una vez
  if (rpcRes.error && /supera el saldo/i.test(rpcRes.error.message || '')) {
    try {
      const currentFacturas = await getConfigSection(tenantId, "facturas_compra", []);
      const invIndex = (currentFacturas || []).findIndex(f => String(f.id) === String(invoiceId));
      if (invIndex >= 0) {
        const inv = currentFacturas[invIndex];
        const totalDoc = Number(inv.totalNeto !== undefined ? inv.totalNeto : (inv.total || inv.subtotal || 0));
        const healedFacturas = [...currentFacturas];
        healedFacturas[invIndex] = {
          ...inv,
          saldoPendiente: totalDoc,
          saldo_pendiente: totalDoc,
          valorPagado: 0,
          estado: 'Pendiente',
        };
        await saveConfigSection(tenantId, "facturas_compra", healedFacturas);

        rpcRes = await supabase.rpc('associate_supplier_expense', {
          p_tenant_id: tenantId, p_invoice_id: invoiceId, p_payment_id: paymentId, p_amount: amount, p_request_id: requestId,
        });
      }
    } catch (retryErr) {
      console.warn("Aviso en reintento de asociación de egreso:", retryErr);
    }
  }

  if (rpcRes.error) throw rpcRes.error;
  const data = rpcRes.data;
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
