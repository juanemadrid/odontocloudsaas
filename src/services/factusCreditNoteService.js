/**
 * src/services/factusCreditNoteService.js
 * Servicio de ciclo de vida, concurrencia, idempotencia y auditoría de Nota Crédito Factus / DIAN.
 * 
 * Cumple Fase P1-FEV3B:
 * - Tabla autoritativa: public.notas_credito
 * - Código de referencia estable generado localmente tras creación de fila DRAFT (NC-OC-{UUID})
 * - Concurrencia atómica con locks backend (acquire_fev_operation_lock / release_fev_operation_lock)
 * - Recálculo atómico de techo fiscal con get_factura_credited_balance
 * - Preservación intacta del dianStatus de la factura original ('ACEPTADA')
 * - Separación de tesorería: CERO movimientos automáticos de caja
 * - Trazabilidad con historial ncAttempts en notas_credito.detalles
 */

import supabase from "../lib/supabaseClient.js";
import {
  sendFactusCreditNote,
  checkFactusCreditNote,
  deleteUnvalidatedFactusCreditNote,
} from "./factusProxyService.js";
import {
  buildFactusCreditNotePayload,
  validateInvoiceCreditEligibility,
} from "./factusCreditNotePayloadBuilder.js";
import {
  isTotalCreditNoteConcept,
  isPartialCreditNoteConcept,
} from "../utils/dian/creditNoteCatalogs.js";
import {
  isHealthInvoice,
  validatePartialCreditNoteClinicalTraceability,
} from "./muvCreditNoteRipsBuilder.js";

/**
 * Adquiere el lock de operación concurrente para una factura.
 */
async function acquireLock(tenantId, facturaId, operationType = "CREDIT_NOTE", timeoutSeconds = 60) {
  try {
    const { data, error } = await supabase.rpc("acquire_fev_operation_lock", {
      p_tenant_id: tenantId,
      p_factura_id: facturaId,
      p_operation_type: operationType,
      p_timeout_seconds: timeoutSeconds,
    });

    if (error) {
      console.warn("Error invocando acquire_fev_operation_lock:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.warn("Excepción adquiriendo lock FEV:", err.message);
    return false;
  }
}

/**
 * Libera el lock de operación concurrente.
 */
async function releaseLock(tenantId, facturaId) {
  try {
    await supabase.rpc("release_fev_operation_lock", {
      p_tenant_id: tenantId,
      p_factura_id: facturaId,
    });
  } catch (err) {
    console.warn("Error liberando lock FEV:", err.message);
  }
}

/**
 * Consulta de forma atómica el saldo fiscal acreditable disponible en la BD.
 */
export async function getFacturaCreditedBalance(tenantId, facturaId) {
  const { data, error } = await supabase.rpc("get_factura_credited_balance", {
    p_tenant_id: tenantId,
    p_factura_id: facturaId,
  });

  if (error) {
    throw new Error(`Error calculando saldo fiscal acreditable: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalFactura: parseFloat(row?.total_factura || 0),
    totalAcreditado: parseFloat(row?.total_acreditado || 0),
    saldoDisponible: parseFloat(row?.saldo_disponible || 0),
    ncCount: parseInt(row?.nc_count || 0, 10),
    fiscalStatus: row?.fiscal_status || "NONE",
  };
}

/**
 * Genera un reference_code estable para la Nota Crédito lógica.
 * Formato: NC-OC-{HEX STABLE DE UUID}
 */
export function generateStableCreditNoteReferenceCode(ncId) {
  const cleanId = String(ncId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
  return `NC-OC-${cleanId}`;
}

/**
 * Paso 1: Crea la fila DRAFT de la Nota Crédito localmente en public.notas_credito
 * y genera su reference_code definitivo y estable.
 */
export async function createCreditNoteDraft({
  tenantId,
  facturaId,
  pacienteId,
  correctionConceptCode,
  tipo = null,
  montoAcreditado = null,
  items = null,
  observacion = "",
}) {
  if (!tenantId || !facturaId) {
    throw new Error("tenantId y facturaId son obligatorios para crear borrador de Nota Crédito.");
  }

  // 1. Concurrencia atómica
  const locked = await acquireLock(tenantId, facturaId, "CREDIT_NOTE_DRAFT", 30);
  if (!locked) {
    const err = new Error("Existe una operación fiscal concurrente en progreso para esta factura. Por favor espere.");
    err.code = "CONCURRENT_FEV_OPERATION";
    throw err;
  }

  try {
    // 2. Obtener factura original
    const { data: factura, error: facError } = await supabase
      .from("facturas")
      .select("*")
      .eq("id", facturaId)
      .eq("tenant_id", tenantId)
      .single();

    if (facError || !factura) {
      throw new Error("Factura original no encontrada.");
    }

    // 3. Saldo fiscal disponible
    const balance = await getFacturaCreditedBalance(tenantId, facturaId);
    validateInvoiceCreditEligibility(factura, balance.saldoDisponible);

    // 4. Determinar tipo y monto
    const conceptStr = String(correctionConceptCode || "").trim();
    const isTotal = isTotalCreditNoteConcept(conceptStr);
    const resolvedTipo = isTotal ? "TOTAL" : "PARCIAL";

    let finalMonto = 0;
    if (isTotal) {
      finalMonto = balance.saldoDisponible;
    } else {
      finalMonto = parseFloat(montoAcreditado || 0);
      if (isNaN(finalMonto) || finalMonto <= 0) {
        throw new Error("Para notas parciales el monto a acreditar debe ser mayor a cero.");
      }
      if (finalMonto > balance.saldoDisponible) {
        throw new Error(`El monto acreditado ($${finalMonto}) supera el saldo disponible ($${balance.saldoDisponible}).`);
      }
    }

    // 4.1 Precheck canónico para FEV Salud + NC PARCIAL antes de crear borrador
    const itemsToRecord = items || factura.detalles?.items || factura.items || [];
    if (resolvedTipo === "PARCIAL" && isHealthInvoice(factura)) {
      validatePartialCreditNoteClinicalTraceability({
        factura,
        items: itemsToRecord,
      });
    }

    // 5. Insertar fila DRAFT
    const { data: draftNC, error: insertError } = await supabase
      .from("notas_credito")
      .insert({
        tenant_id: tenantId,
        factura_id: facturaId,
        paciente_id: pacienteId || factura.paciente_id || null,
        dian_status: "DRAFT",
        tipo_nota_credito: resolvedTipo,
        correction_concept_code: conceptStr,
        customization_id: 20,
        monto: finalMonto,
        monto_acreditado: finalMonto,
        concepto: observacion || `Nota Crédito ${resolvedTipo} factura ${factura.nro_consecutivo || ""}`.trim(),
        items: itemsToRecord,
        detalles: {
          observacion,
          ncAttempts: [],
          createdFromDraft: true,
        },
      })
      .select()
      .single();

    if (insertError || !draftNC) {
      throw new Error(`Error persistiendo borrador de Nota Crédito: ${insertError?.message}`);
    }

    // 6. Generar y persistir reference_code estable
    const stableRefCode = generateStableCreditNoteReferenceCode(draftNC.id);
    const { data: updatedNC, error: updateError } = await supabase
      .from("notas_credito")
      .update({
        reference_code: stableRefCode,
      })
      .eq("id", draftNC.id)
      .select()
      .single();

    if (updateError || !updatedNC) {
      throw new Error(`Error asignando reference_code estable: ${updateError?.message}`);
    }

    return updatedNC;
  } finally {
    await releaseLock(tenantId, facturaId);
  }
}

/**
 * Paso 2: Emite la Nota Crédito ante Factus / DIAN de forma atómica e idempotente.
 */
export async function emitCreditNote({
  creditNoteId,
  tenantId,
  numberingRangeId,
  patient = null,
  healthConfig = null,
}) {
  if (!creditNoteId || !tenantId) {
    throw new Error("creditNoteId y tenantId son obligatorios para emitir la Nota Crédito.");
  }

  // 1. Obtener Nota Crédito local
  const { data: nc, error: ncErr } = await supabase
    .from("notas_credito")
    .select("*, facturas(*)")
    .eq("id", creditNoteId)
    .eq("tenant_id", tenantId)
    .single();

  if (ncErr || !nc) {
    throw new Error("Nota Crédito no encontrada.");
  }

  const factura = nc.facturas;
  if (!factura) {
    throw new Error("Factura asociada a la Nota Crédito no encontrada.");
  }

  // Idempotencia: si ya está ACEPTADA, retornar sin volver a llamar Factus
  if (nc.dian_status === "ACCEPTED" && nc.cude && nc.numero) {
    return {
      success: true,
      alreadyAccepted: true,
      creditNote: nc,
      message: "La Nota Crédito ya había sido aceptada previamente.",
    };
  }

  // 2. Lock de concurrencia sobre la factura
  const locked = await acquireLock(tenantId, factura.id, "CREDIT_NOTE_EMIT", 60);
  if (!locked) {
    const err = new Error("Existe una operación concurrente en curso sobre esta factura. Intente en unos segundos.");
    err.code = "CONCURRENT_FEV_OPERATION";
    throw err;
  }

  try {
    // 3. Recalcular saldo fiscal disponible en BD de forma atómica
    const balance = await getFacturaCreditedBalance(tenantId, factura.id);
    const montoObjetivo = parseFloat(nc.monto_acreditado || nc.monto || 0);

    // Si no está aceptada, el monto no debe superar el saldo disponible
    if (montoObjetivo > balance.saldoDisponible) {
      const err = new Error(
        `El monto a acreditar ($${montoObjetivo}) excede el saldo fiscal disponible ($${balance.saldoDisponible}).`
      );
      err.code = "CREDIT_NOTE_AMOUNT_EXCEEDS_BALANCE";
      throw err;
    }

    // 3.1 Precheck canónico para FEV Salud + NC PARCIAL antes de llamar a Factus
    if (nc.tipo_nota_credito === "PARCIAL" && isHealthInvoice(factura)) {
      validatePartialCreditNoteClinicalTraceability({
        factura,
        items: nc.items,
      });
    }

    // 4. Asegurar reference_code estable
    const stableRef = nc.reference_code || generateStableCreditNoteReferenceCode(nc.id);
    if (!nc.reference_code) {
      await supabase
        .from("notas_credito")
        .update({ reference_code: stableRef })
        .eq("id", nc.id);
    }

    // 5. Construir payload Factus
    const payload = buildFactusCreditNotePayload({
      invoice: factura,
      patient: patient || nc.paciente_id || factura.paciente_id,
      numberingRangeId,
      referenceCode: stableRef,
      correctionConceptCode: nc.correction_concept_code || "2",
      observation: nc.detalles?.observacion || nc.concepto || "",
      montoAcreditado: montoObjetivo,
      items: nc.items,
      healthConfig,
      saldoDisponible: balance.saldoDisponible,
    });

    // 6. Preparar historial ncAttempts
    const prevAttempts = Array.isArray(nc.detalles?.ncAttempts) ? nc.detalles.ncAttempts : [];
    const attemptNumber = prevAttempts.length + 1;

    // Actualizar estado a PENDING
    await supabase
      .from("notas_credito")
      .update({
        dian_status: "PENDING",
      })
      .eq("id", nc.id);

    let factusResult = null;
    let emissionError = null;

    try {
      // 7. Enviar a Factus Proxy
      const response = await sendFactusCreditNote(payload);
      factusResult = response?.result?.data?.credit_note ||
                    response?.result?.data?.bill ||
                    response?.result?.data ||
                    response?.result;
    } catch (err) {
      emissionError = err;
    }

    // 8. Manejo de reconciliación en caso de error o conflicto
    if (emissionError) {
      const errMsg = emissionError.message || "";
      console.warn("Error en emisión Factus NC:", errMsg);

      // Si Factus responde que el reference_code ya fue procesado o conflicto:
      const isConflict =
        errMsg.includes("409") ||
        errMsg.includes("ya existe") ||
        errMsg.includes("referencia duplicada") ||
        errMsg.includes("reference_code");

      if (isConflict) {
        // Ejecutar STATUS CHECK para reconciliar
        try {
          const checkRes = await checkFactusCreditNote({ referenceCode: stableRef, tenantId });
          const checkedCN = checkRes?.result?.credit_note;
          if (checkedCN && (checkedCN.is_validated === true || checkedCN.cude)) {
            // Reconciliado con éxito
            factusResult = checkedCN;
            emissionError = null;
          }
        } catch (checkErr) {
          console.warn("Fallo verificando estado de NC en Factus tras 409:", checkErr.message);
        }
      }
    }

    const timestamp = new Date().toISOString();

    if (emissionError) {
      // Registro del intento fallido
      const failedAttempt = {
        attempt_number: attemptNumber,
        timestamp,
        operation: "EMIT",
        reference_code: stableRef,
        status: "REJECTED",
        error_code: emissionError.code || "FACTUS_EMIT_ERROR",
        error_fields: emissionError.message?.slice(0, 500) || "Error desconocido",
        is_validated: false,
      };

      const updatedAttempts = [...prevAttempts, failedAttempt];
      const isIndeterminate =
        emissionError.message?.includes("timeout") ||
        emissionError.message?.includes("contactar el servicio") ||
        emissionError.message?.includes("Network");

      await supabase
        .from("notas_credito")
        .update({
          dian_status: isIndeterminate ? "INDETERMINATE" : "REJECTED",
          detalles: {
            ...nc.detalles,
            ncAttempts: updatedAttempts,
            lastError: emissionError.message,
          },
        })
        .eq("id", nc.id);

      throw emissionError;
    }

    // 9. Emisión Aceptada exitosamente
    const ncNumber = factusResult?.number || factusResult?.numero || null;
    const ncCude = factusResult?.cude || null;
    const validatedAt = factusResult?.validated_at || timestamp;

    const successAttempt = {
      attempt_number: attemptNumber,
      timestamp,
      operation: "EMIT",
      reference_code: stableRef,
      status: "ACCEPTED",
      is_validated: true,
      numero: ncNumber,
      cude: ncCude,
    };

    // Actualizar autoritativamente public.notas_credito
    const { data: acceptedNC, error: updateNcErr } = await supabase
      .from("notas_credito")
      .update({
        dian_status: "ACCEPTED",
        numero: ncNumber,
        cude: ncCude,
        validated_at: validatedAt,
        factus_response: factusResult,
        monto_acreditado: montoObjetivo,
        detalles: {
          ...nc.detalles,
          ncAttempts: [...prevAttempts, successAttempt],
        },
      })
      .eq("id", nc.id)
      .select()
      .single();

    if (updateNcErr) {
      console.error("Error actualizando nota crédito aceptada:", updateNcErr);
    }

    // 10. Actualizar factura original preservando dianStatus intacto
    const newBalance = await getFacturaCreditedBalance(tenantId, factura.id);
    const newFiscalStatus = newBalance.saldoDisponible <= 0 ? "FULLY_CREDITED" : "PARTIALLY_CREDITED";

    const facDetalles = factura.detalles || {};
    const readModelNCs = Array.isArray(facDetalles.notasCredito) ? [...facDetalles.notasCredito] : [];
    readModelNCs.push({
      id: nc.id,
      numero: ncNumber,
      cude: ncCude,
      monto_acreditado: montoObjetivo,
      tipo: nc.tipo_nota_credito,
      concept: nc.correction_concept_code,
      fecha: validatedAt,
    });

    const facturaUpdate = {
      detalles: {
        ...facDetalles,
        fiscal_adjustment_status: newFiscalStatus,
        saldo_fiscal_acreditable: newBalance.saldoDisponible,
        notasCredito: readModelNCs,
      },
    };

    // Si se acreditó por completo la factura, estado = 'Anulado'
    if (newFiscalStatus === "FULLY_CREDITED") {
      facturaUpdate.estado = "Anulado";
    }

    await supabase
      .from("facturas")
      .update(facturaUpdate)
      .eq("id", factura.id);

    return {
      success: true,
      creditNote: acceptedNC || nc,
      facturaActualizada: {
        id: factura.id,
        fiscal_adjustment_status: newFiscalStatus,
        saldoDisponible: newBalance.saldoDisponible,
      },
      numero: ncNumber,
      cude: ncCude,
    };
  } finally {
    await releaseLock(tenantId, factura.id);
  }
}

/**
 * Consulta de estado y reconciliación para una Nota Crédito pendiente o indeterminada.
 */
export async function checkAndReconcileCreditNote({ creditNoteId, tenantId }) {
  const { data: nc, error: ncErr } = await supabase
    .from("notas_credito")
    .select("*, facturas(*)")
    .eq("id", creditNoteId)
    .eq("tenant_id", tenantId)
    .single();

  if (ncErr || !nc) {
    throw new Error("Nota Crédito no encontrada para verificación.");
  }

  const refCode = nc.reference_code;
  if (!refCode) {
    throw new Error("La Nota Crédito no posee reference_code asignado.");
  }

  const checkRes = await checkFactusCreditNote({
    number: nc.numero || null,
    referenceCode: refCode,
    tenantId,
  });

  const remoteCN = checkRes?.result?.credit_note;
  if (!remoteCN) {
    return {
      existsInFactus: false,
      reconciled: false,
      creditNote: nc,
    };
  }

  const isValidated = remoteCN.is_validated === true || Boolean(remoteCN.cude);
  const prevAttempts = Array.isArray(nc.detalles?.ncAttempts) ? nc.detalles.ncAttempts : [];

  if (isValidated) {
    const timestamp = new Date().toISOString();
    const reconcileAttempt = {
      attempt_number: prevAttempts.length + 1,
      timestamp,
      operation: "RECONCILE",
      reference_code: refCode,
      status: "ACCEPTED",
      is_validated: true,
      numero: remoteCN.number,
      cude: remoteCN.cude,
    };

    const { data: updatedNC } = await supabase
      .from("notas_credito")
      .update({
        dian_status: "ACCEPTED",
        numero: remoteCN.number,
        cude: remoteCN.cude,
        validated_at: remoteCN.validated_at || timestamp,
        factus_response: remoteCN,
        detalles: {
          ...nc.detalles,
          ncAttempts: [...prevAttempts, reconcileAttempt],
        },
      })
      .eq("id", nc.id)
      .select()
      .single();

    // Actualizar factura
    if (nc.facturas) {
      const newBalance = await getFacturaCreditedBalance(tenantId, nc.facturas.id);
      const newFiscalStatus = newBalance.saldoDisponible <= 0 ? "FULLY_CREDITED" : "PARTIALLY_CREDITED";
      const facUpdate = {
        detalles: {
          ...(nc.facturas.detalles || {}),
          fiscal_adjustment_status: newFiscalStatus,
          saldo_fiscal_acreditable: newBalance.saldoDisponible,
        },
      };
      if (newFiscalStatus === "FULLY_CREDITED") {
        facUpdate.estado = "Anulado";
      }
      await supabase.from("facturas").update(facUpdate).eq("id", nc.facturas.id);
    }

    return {
      existsInFactus: true,
      reconciled: true,
      creditNote: updatedNC || nc,
    };
  }

  return {
    existsInFactus: true,
    reconciled: false,
    status: remoteCN.status || "UNVALIDATED",
    creditNote: nc,
  };
}

/**
 * Consulta todas las Notas Crédito asociadas a una factura.
 */
export async function getCreditNotesForInvoice(tenantId, facturaId) {
  const { data, error } = await supabase
    .from("notas_credito")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("factura_id", facturaId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error obteniendo notas crédito de la factura: ${error.message}`);
  }

  return data || [];
}
