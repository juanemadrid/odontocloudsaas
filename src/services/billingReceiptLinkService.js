// src/services/billingReceiptLinkService.js
/**
 * Servicio Autorativo de Asociación Persistente Recibo de Caja ↔ Factura Electrónica (FEV)
 * y Prevención de Doble Contabilización (Fase P1-FEV1).
 *
 * Responsabilidades:
 * 1. Validar integridad de tenant (bloqueo cross-tenant).
 * 2. Validar integridad de paciente (bloqueo cross-patient).
 * 3. Prevenir doble vinculación (anti-duplicidad).
 * 4. Gestionar pagos parciales / abonos múltiples (cálculo de saldo y estado de pago).
 * 5. Separar estrictamente el estado de pago (PAGADO/PARCIAL/PENDIENTE) del estado DIAN.
 * 6. Garantizar que la emisión de FEV vinculada a un pago existente NO duplique movimientos de caja.
 */

import supabase from "../lib/supabaseClient.js";

/**
 * Normaliza identificadores UUID / strings para comparaciones seguras.
 */
export const normalizeId = (id) => String(id || "").trim().toLowerCase();

/**
 * Calcula el estado de pago financiero de una factura a partir de sus recibos vinculados.
 * Es completamente INDEPENDIENTE del estado DIAN (ACEPTADA / RECHAZADA / PENDIENTE).
 *
 * @param {number} totalFactura - Total facturado
 * @param {Array} recibosAsociados - Lista de recibos asociados
 * @returns {{ totalPagado: number, saldoPendiente: number, estadoPago: 'PAGADO'|'PARCIAL'|'PENDIENTE' }}
 */
export const computePaymentStatus = (totalFactura = 0, recibosAsociados = []) => {
  const totFact = Math.max(0, Number(totalFactura || 0));
  const totPagado = (Array.isArray(recibosAsociados) ? recibosAsociados : [])
    .filter((r) => String(r.estado || "").toLowerCase() !== "anulado")
    .reduce((sum, r) => sum + Number(r.monto || r.total || r.valor || 0), 0);

  const saldoPendiente = Math.max(0, totFact - totPagado);

  let estadoPago = "PENDIENTE";
  if (totPagado >= totFact && totFact > 0) {
    estadoPago = "PAGADO";
  } else if (totPagado > 0) {
    estadoPago = "PARCIAL";
  }

  return {
    totalFactura: totFact,
    totalPagado: totPagado,
    saldoPendiente: saldoPendiente,
    estadoPago: estadoPago,
  };
};

/**
 * Valida las reglas críticas de negocio y seguridad antes de asociar un recibo a una FEV:
 * - Mismo tenant
 * - Mismo paciente
 * - Recibo no asociado previamente a la misma factura
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {Object} params.factura
 * @param {Object} params.recibo
 */
export const validateReceiptInvoiceLink = ({ tenantId, factura, recibo }) => {
  if (!tenantId) {
    throw new Error("VALIDATION_ERROR: tenantId es obligatorio.");
  }
  if (!factura || !recibo) {
    throw new Error("VALIDATION_ERROR: Se requiere tanto la factura como el recibo.");
  }

  const factTenant = normalizeId(factura.tenant_id || factura.inquilino);
  const recTenant = normalizeId(recibo.tenant_id || recibo.inquilino);
  const authTenant = normalizeId(tenantId);

  // 1. Bloqueo Cross-Tenant
  if (factTenant && authTenant && factTenant !== authTenant) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: La factura pertenece a un tenant diferente (${factTenant} vs ${authTenant}).`
    );
  }
  if (recTenant && authTenant && recTenant !== authTenant) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: El recibo pertenece a un tenant diferente (${recTenant} vs ${authTenant}).`
    );
  }
  if (factTenant && recTenant && factTenant !== recTenant) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: Factura y recibo pertenecen a tenants diferentes.`
    );
  }

  // 2. Bloqueo Cross-Patient
  const factPacId = normalizeId(factura.paciente_id || factura.pacienteId);
  const recPacId = normalizeId(recibo.paciente_id || recibo.pacienteId);

  if (factPacId && recPacId && factPacId !== recPacId) {
    throw new Error(
      `CROSS_PATIENT_VIOLATION: El recibo pertenece al paciente ${recPacId}, diferente al de la factura (${factPacId}).`
    );
  }

  // 3. Anti-duplicidad: Mismo recibo en la misma factura
  const existingLinks = extractLinkedReceipts(factura);
  const recId = normalizeId(recibo.id || recibo.rawId);
  const alreadyLinked = existingLinks.some((l) => normalizeId(l.id || l.recibo_id) === recId);
  if (alreadyLinked) {
    throw new Error(
      `DUPLICATE_LINK_VIOLATION: El recibo #${recibo.numero || recibo.nroConsecutivo || recId} ya está asociado a esta factura.`
    );
  }

  return { valid: true };
};

/**
 * Extrae los recibos actualmente vinculados de una fila de factura (manejando detalles JSONB).
 */
export const extractLinkedReceipts = (factura) => {
  if (!factura) return [];
  let detalles = factura.detalles;
  if (typeof detalles === "string") {
    try {
      detalles = JSON.parse(detalles);
    } catch {
      detalles = {};
    }
  }
  if (Array.isArray(detalles?.recibos_asociados)) {
    return detalles.recibos_asociados;
  }
  if (detalles?.recibo_asociado) {
    return [detalles.recibo_asociado];
  }
  if (factura.recibo_asociado) {
    return [factura.recibo_asociado];
  }
  if (factura.recibo_id) {
    return [{ id: factura.recibo_id, numero: factura.recibo_numero || "REC-N/A" }];
  }
  return [];
};

/**
 * Asocia un recibo de caja a una factura existente de forma persistente.
 * Actualiza:
 * 1. facturas.detalles (JSONB) con trazabilidad completa.
 * 2. recibos_caja.factura_id o pagos.factura_id.
 * 3. NO genera ningún movimiento en movimientos_caja.
 */
export const linkReceiptToInvoice = async ({
  tenantId,
  facturaId,
  reciboId,
  userProfile = {},
  isPago = false,
}) => {
  if (!facturaId || !reciboId || !tenantId) {
    throw new Error("Parámetros obligatorios faltantes para asociar recibo a factura.");
  }

  const userIdentifier = userProfile?.nombreCompleto || userProfile?.email || "Usuario";

  // 1. Intento prioritario: RPC transaccional PostgreSQL (ACID atómico)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("associate_receipt_to_invoice", {
      p_tenant_id: tenantId,
      p_factura_id: facturaId,
      p_recibo_id: reciboId,
      p_user_identifier: userIdentifier,
      p_is_pago: Boolean(isPago),
    });

    if (!rpcErr && rpcData?.success) {
      const { data: refreshedFactura } = await supabase
        .from("facturas")
        .select("*")
        .eq("id", facturaId)
        .single();

      return {
        success: true,
        factura: refreshedFactura || { id: facturaId },
        link: rpcData.link,
        paymentCalc: {
          totalPagado: rpcData.monto_pagado,
          saldoPendiente: rpcData.saldo_pendiente,
          estadoPago: rpcData.estado_pago,
        },
        atomic: true,
      };
    } else if (rpcErr) {
      const msg = rpcErr.message || "";
      if (
        msg.includes("CROSS_TENANT_VIOLATION") ||
        msg.includes("CROSS_PATIENT_VIOLATION") ||
        msg.includes("DUPLICATE_LINK_VIOLATION") ||
        msg.includes("FACTURA_NOT_FOUND") ||
        msg.includes("RECIBO_NOT_FOUND")
      ) {
        throw new Error(msg);
      }
    }
  } catch (rpcEx) {
    if (
      rpcEx.message?.includes("CROSS_TENANT_VIOLATION") ||
      rpcEx.message?.includes("CROSS_PATIENT_VIOLATION") ||
      rpcEx.message?.includes("DUPLICATE_LINK_VIOLATION")
    ) {
      throw rpcEx;
    }
    // Continuar a fallback cliente si el RPC no está disponible en este entorno
  }

  // 2. Fallback cliente / simulado (entornos sin RPC instalado)
  const { data: facturaRow, error: factErr } = await supabase
    .from("facturas")
    .select("*")
    .eq("id", facturaId)
    .single();

  if (factErr || !facturaRow) {
    throw new Error(`No se encontró la factura con ID ${facturaId}: ${factErr?.message || "Not found"}`);
  }

  const targetTable = isPago ? "pagos" : "recibos_caja";
  const { data: reciboRow, error: recErr } = await supabase
    .from(targetTable)
    .select("*")
    .eq("id", reciboId)
    .single();

  if (recErr || !reciboRow) {
    throw new Error(`No se encontró el recibo en ${targetTable} con ID ${reciboId}: ${recErr?.message || "Not found"}`);
  }

  validateReceiptInvoiceLink({
    tenantId,
    factura: facturaRow,
    recibo: reciboRow,
  });

  let currentDetalles = facturaRow.detalles;
  if (typeof currentDetalles === "string") {
    try {
      currentDetalles = JSON.parse(currentDetalles);
    } catch {
      currentDetalles = {};
    }
  } else if (!currentDetalles || typeof currentDetalles !== "object") {
    currentDetalles = {};
  }

  const existingRecibos = Array.isArray(currentDetalles.recibos_asociados)
    ? [...currentDetalles.recibos_asociados]
    : currentDetalles.recibo_asociado
    ? [currentDetalles.recibo_asociado]
    : [];

  const newReceiptLink = {
    id: reciboRow.id,
    recibo_id: reciboRow.id,
    numero: reciboRow.numero || reciboRow.nro_consecutivo || reciboRow.consecutivo || `REC-${reciboRow.id.slice(0, 6)}`,
    monto: Number(reciboRow.monto || reciboRow.total || 0),
    fecha: reciboRow.fecha || reciboRow.created_at || new Date().toISOString(),
    metodo: reciboRow.metodo || reciboRow.metodo_pago || "Efectivo",
    paciente_id: reciboRow.paciente_id,
    tenant_id: tenantId,
    asociado_at: new Date().toISOString(),
    asociado_por: userIdentifier,
    tabla_origen: targetTable,
  };

  const updatedRecibos = [...existingRecibos, newReceiptLink];
  const paymentCalc = computePaymentStatus(facturaRow.total, updatedRecibos);

  const updatedDetalles = {
    ...currentDetalles,
    recibos_asociados: updatedRecibos,
    recibo_asociado: newReceiptLink,
    monto_pagado: paymentCalc.totalPagado,
    saldo_pendiente: paymentCalc.saldoPendiente,
    estado_pago: paymentCalc.estadoPago,
  };

  // Vínculo relacional autoritativo primero
  try {
    await supabase
      .from(targetTable)
      .update({
        factura_id: facturaId,
      })
      .eq("id", reciboId);
  } catch (errCol) {
    console.warn(`[P1-FEV1] Columna factura_id en ${targetTable} pendiente de migración DDL:`, errCol.message);
  }

  // Resumen desnormalizado / UI metadata en facturas
  const { data: updatedFactura, error: updateFactErr } = await supabase
    .from("facturas")
    .update({
      detalles: updatedDetalles,
    })
    .eq("id", facturaId)
    .select()
    .single();

  if (updateFactErr) {
    throw new Error(`Error al actualizar factura con recibo asociado: ${updateFactErr.message}`);
  }

  return {
    success: true,
    factura: updatedFactura,
    link: newReceiptLink,
    paymentCalc,
  };
};

/**
 * Desvincula un recibo de caja de una factura.
 */
export const unlinkReceiptFromInvoice = async ({
  tenantId,
  facturaId,
  reciboId,
  isPago = false,
}) => {
  // 1. Intento prioritario: RPC transaccional
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("unlink_receipt_from_invoice", {
      p_tenant_id: tenantId,
      p_factura_id: facturaId,
      p_recibo_id: reciboId,
      p_is_pago: Boolean(isPago),
    });

    if (!rpcErr && rpcData?.success) {
      const { data: refreshedFactura } = await supabase
        .from("facturas")
        .select("*")
        .eq("id", facturaId)
        .single();

      return {
        success: true,
        factura: refreshedFactura || { id: facturaId },
        paymentCalc: {
          totalPagado: rpcData.monto_pagado,
          saldoPendiente: rpcData.saldo_pendiente,
          estadoPago: rpcData.estado_pago,
        },
        atomic: true,
      };
    }
  } catch (rpcEx) {
    // Continuar a fallback cliente si el RPC no está disponible
  }

  // 2. Fallback cliente
  const { data: facturaRow, error: factErr } = await supabase
    .from("facturas")
    .select("*")
    .eq("id", facturaId)
    .single();

  if (factErr || !facturaRow) throw new Error("Factura no encontrada.");

  let detalles = facturaRow.detalles || {};
  if (typeof detalles === "string") {
    try { detalles = JSON.parse(detalles); } catch { detalles = {}; }
  }

  const existingRecibos = Array.isArray(detalles.recibos_asociados) ? detalles.recibos_asociados : [];
  const filteredRecibos = existingRecibos.filter((r) => normalizeId(r.id || r.recibo_id) !== normalizeId(reciboId));
  const paymentCalc = computePaymentStatus(facturaRow.total, filteredRecibos);

  const updatedDetalles = {
    ...detalles,
    recibos_asociados: filteredRecibos,
    recibo_asociado: filteredRecibos.length > 0 ? filteredRecibos[0] : null,
    monto_pagado: paymentCalc.totalPagado,
    saldo_pendiente: paymentCalc.saldoPendiente,
    estado_pago: paymentCalc.estadoPago,
  };

  const { data: updatedFactura, error: upErr } = await supabase
    .from("facturas")
    .update({ detalles: updatedDetalles })
    .eq("id", facturaId)
    .select()
    .single();

  if (upErr) throw upErr;

  // Limpiar referencia relacional en el recibo
  const targetTable = isPago ? "pagos" : "recibos_caja";
  try {
    await supabase.from(targetTable).update({ factura_id: null }).eq("id", reciboId);
  } catch {}

  return {
    success: true,
    factura: updatedFactura,
    remainingRecibos: filteredRecibos,
    paymentCalc,
  };
};
