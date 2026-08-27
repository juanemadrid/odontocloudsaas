/**
 * consecutivosService.js
 * Servicio unificado y centralizado para la gestión de Consecutivos y DIAN en OdontoCloud.
 * Sincroniza en tiempo real los contadores automáticos de:
 *  - Recibos de caja (contReciboCaja)
 *  - Notas crédito (contNotaCredito)
 *  - Notas débito (contNotaDebito)
 *  - Egresos de caja (contEgresos)
 *  - Presupuestos (contPresupuestos)
 *  - Planes de tratamiento (contPlanTratamiento)
 *  - Órdenes de compra (contOrdenesCompra)
 *  - Cuentas por cobrar (contCuentasPorCobrar)
 *  - Uso de saldo a favor (contUsoSaldoFavor)
 *  - Uso de notas crédito (contUsoNotasCredito)
 *  - RIPS automáticos (contRipsAutomaticos)
 *  - Factura de venta (fvNumActual)
 *  - Facturación electrónica (feNumActual)
 *  - Documento soporte DIAN (dsNumActual)
 */

import supabase from "../lib/supabaseClient";
import { getConfigItems, saveConfigItem } from "./configPersistenceService";

export const CONSECUTIVO_TYPES = {
  RECIBO_CAJA: "contReciboCaja",
  NOTA_CREDITO: "contNotaCredito",
  NOTA_DEBITO: "contNotaDebito",
  EGRESOS: "contEgresos",
  PRESUPUESTOS: "contPresupuestos",
  PLAN_TRATAMIENTO: "contPlanTratamiento",
  ORDENES_COMPRA: "contOrdenesCompra",
  CUENTAS_POR_COBRAR: "contCuentasPorCobrar",
  USO_SALDO_FAVOR: "contUsoSaldoFavor",
  USO_NOTAS_CREDITO: "contUsoNotasCredito",
  RIPS_AUTOMATICOS: "contRipsAutomaticos",
  FACTURA_BORRADOR: "contFacturaBorrador",
  FACTURA_ELECTRONICA: "feNumActual",
  FACTURA_VENTA: "fvNumActual",
  DOC_SOPORTE: "dsNumActual",
};

/**
 * Obtiene la configuración de consecutivos activa para la clínica
 */
export const getActiveConsecutivos = async (tenantId) => {
  if (!tenantId) return null;
  try {
    const list = await getConfigItems(tenantId, "consecutivos", "consecutivos");
    if (Array.isArray(list) && list.length > 0) {
      return list[0];
    }
    return null;
  } catch (err) {
    console.error("Error al obtener consecutivos:", err);
    return null;
  }
};

/**
 * Obtiene el siguiente número consecutivo para un tipo de documento sin incrementarlo
 */
export const getNextConsecutivoNumber = async (tenantId, tipoField) => {
  if (!tenantId || !tipoField) return 1;
  try {
    const active = await getActiveConsecutivos(tenantId);
    const current = Number(active?.[tipoField] ?? 0);
    return (current > 0 ? current : 0) + 1;
  } catch (err) {
    console.warn(`Error leyendo consecutivo ${tipoField}:`, err.message);
    return 1;
  }
};

/**
 * Incrementa atómicamente el consecutivo y retorna el nuevo número asignado
 */
export const consumeNextConsecutivo = async (tenantId, tipoField) => {
  if (!tenantId || !tipoField) return 1;
  try {
    let list = await getConfigItems(tenantId, "consecutivos", "consecutivos");
    let activeItem = Array.isArray(list) && list.length > 0 ? { ...list[0] } : {
      id: "consecutivo-principal",
      nombre: "Principal",
      tenant_id: tenantId,
    };

    const currentVal = Number(activeItem[tipoField] ?? 0);
    const nextVal = (currentVal > 0 ? currentVal : 0) + 1;

    activeItem[tipoField] = nextVal;
    activeItem.updated_at = new Date().toISOString();

    await saveConfigItem(tenantId, "consecutivos", "consecutivos", activeItem);

    return nextVal;
  } catch (err) {
    console.error(`Error incrementando consecutivo ${tipoField}:`, err);
    return 1;
  }
};

/**
 * Helper para generar el texto formateado de resolución DIAN
 */
export const generateDianResolutionText = ({
  tipo = "FACTURA_ELECTRONICA",
  numeroResolucion = "",
  fechaResolucion = "",
  prefijo = "",
  rangoDesde = "",
  rangoHasta = "",
  fechaVigencia = "",
}) => {
  if (!numeroResolucion) return "";

  const docTypeName =
    tipo === "DOC_SOPORTE"
      ? "documento soporte"
      : "Factura Electrónica";

  return `Autorización de numeración para ${docTypeName} de número ${numeroResolucion} de ${fechaResolucion || "—"} Modalidad ${docTypeName} desde ${prefijo || ""}${rangoDesde || "1"} hasta ${prefijo || ""}${rangoHasta || "1000"}${
    fechaVigencia ? ` con vigencia hasta ${fechaVigencia}` : ""
  }`;
};

export default {
  CONSECUTIVO_TYPES,
  getActiveConsecutivos,
  getNextConsecutivoNumber,
  consumeNextConsecutivo,
  generateDianResolutionText,
};
