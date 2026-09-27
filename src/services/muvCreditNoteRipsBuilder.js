/**
 * src/services/muvCreditNoteRipsBuilder.js
 * 
 * Generador y validador de RIPS v003 AJUSTADO para Nota Crédito Parcial ante el MUV (MinSalud).
 * Cumple estrictamente con las Fases P1-FEV4 y P1-FEV4-R:
 * 
 * 1. Trazabilidad clínica canónica inequívoca:
 *    - Exige invoiceLineId, clinicalSourceId, clinicalSourceType
 *    - Recupera la fuente clínica real
 *    - Valida tenant y paciente
 *    - Valida correspondencia con línea original FEV
 *    - Sin fallback heurístico por CUPS, descripción ni precio
 * 2. numFactura = Factura Electrónica ORIGINAL
 * 3. tipoNota = "NC"
 * 4. numNota = Número oficial de Nota Crédito Factus / DIAN
 * 5. Alcance: Solo usuarios y servicios clínicos acreditados
 * 6. NO inferir CUPS, CIE10, profesional, fechas ni valores
 * 7. NC_RIPS_CROSSCHECK: Validación estricta de valores y cabeceras
 */

import { generateRipsV003 } from "../modules/rips/v003/ripsV003Generator.js";
import { validateRipsV003 } from "../modules/rips/v003/ripsV003Validator.js";

export const ERROR_CODES = {
  PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING: "PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING",
  PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND: "PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND",
  PARTIAL_NC_CROSS_TENANT_SOURCE: "PARTIAL_NC_CROSS_TENANT_SOURCE",
  PARTIAL_NC_CROSS_PATIENT_SOURCE: "PARTIAL_NC_CROSS_PATIENT_SOURCE",
  PARTIAL_NC_INVOICE_LINE_MISMATCH: "PARTIAL_NC_INVOICE_LINE_MISMATCH",
  NC_RIPS_VALUE_MISMATCH: "NC_RIPS_VALUE_MISMATCH",
  NC_NOT_ACCEPTED_DIAN: "NC_NOT_ACCEPTED_DIAN",
  NC_MISSING_CUDE: "NC_MISSING_CUDE",
  NC_NOT_PARCIAL: "NC_NOT_PARCIAL",
  ORIGINAL_INVOICE_MISSING: "ORIGINAL_INVOICE_MISSING",
  PARTIAL_HEALTH_CREDIT_NOTE_MUV_INELIGIBLE: "PARTIAL_HEALTH_CREDIT_NOTE_MUV_INELIGIBLE",
};

/**
 * Determina si una factura es del sector salud (SS-CUFE / FEV Salud).
 */
export function isHealthInvoice(factura) {
  if (!factura || typeof factura !== "object") return false;
  const det = factura.detalles && typeof factura.detalles === "object" ? factura.detalles : {};
  return Boolean(
    factura.esSectorSalud === true ||
    det.esSectorSalud === true ||
    factura.tipoOperacion === "SS-CUFE" ||
    det.tipoOperacion === "SS-CUFE" ||
    det.healthData ||
    det.health
  );
}

/**
 * Verifica si un ítem posee los identificadores canónicos de línea completos.
 * Requiere: invoiceLineId, clinicalSourceId, clinicalSourceType.
 */
export function verifyCanonicalLineItem(item) {
  if (!item || typeof item !== "object") return false;
  const hasLineId = Boolean(item.invoiceLineId || item.invoice_line_id);
  const hasSourceId = Boolean(item.clinicalSourceId || item.clinical_source_id);
  const hasSourceType = Boolean(item.clinicalSourceType || item.clinical_source_type);
  return hasLineId && hasSourceId && hasSourceType;
}

/**
 * Verifica si un ítem posee identificador clínico persistido.
 */
export function verifyItemClinicalTraceability(item) {
  if (!item || typeof item !== "object") return false;

  const stableId =
    item.clinicalSourceId ||
    item.clinical_source_id ||
    item.planItemId ||
    item.plan_item_id ||
    item.evolucionId ||
    item.evolucion_id ||
    item.atencionId ||
    item.atencion_id ||
    item.documentoClinicoId ||
    item.documento_clinico_id ||
    (item.planId && item.id && item.id !== item.planId ? item.id : null);

  return Boolean(stableId);
}

/**
 * Obtiene el identificador clínico de un ítem.
 */
export function getItemClinicalSourceId(item) {
  if (!item || typeof item !== "object") return null;
  return (
    item.clinicalSourceId ||
    item.clinical_source_id ||
    item.planItemId ||
    item.plan_item_id ||
    item.evolucionId ||
    item.evolucion_id ||
    item.atencionId ||
    item.atencion_id ||
    item.documentoClinicoId ||
    item.documento_clinico_id ||
    (item.planId && item.id && item.id !== item.planId ? item.id : null)
  );
}

/**
 * Valida trazabilidad clínica previa a emitir una Nota Crédito Parcial de Salud.
 * Se ejecuta antes de llamar a Factus / DIAN para evitar emitir NCs que después no puedan tener RIPS.
 * 
 * Reglas:
 * 1. Si la factura es comercial, no se bloquea.
 * 2. Si la factura es de salud y es NC TOTAL, no se bloquea.
 * 3. Si la factura es de salud y es NC PARCIAL, exige trazabilidad canónica completa
 *    en TODOS los ítems seleccionados.
 */
export function validatePartialCreditNoteClinicalTraceability({
  factura,
  items,
  structuredAttentions = null,
}) {
  if (!isHealthInvoice(factura)) {
    return { eligible: true, isHealth: false };
  }

  const itemsToCheck = Array.isArray(items) && items.length > 0
    ? items
    : (factura?.detalles?.items || factura?.items || []);

  if (!Array.isArray(itemsToCheck) || itemsToCheck.length === 0) {
    const err = new Error("No hay ítems registrados para validar trazabilidad.");
    err.code = ERROR_CODES.PARTIAL_HEALTH_CREDIT_NOTE_MUV_INELIGIBLE;
    throw err;
  }

  for (const it of itemsToCheck) {
    const hasLineId = Boolean(it.invoiceLineId || it.invoice_line_id);
    const hasSourceId = Boolean(it.clinicalSourceId || it.clinical_source_id || it.planItemId || it.evolucionId);
    const hasSourceType = Boolean(it.clinicalSourceType || it.clinical_source_type);

    if (!hasLineId || !hasSourceId || !hasSourceType) {
      const err = new Error(
        "Esta factura fue emitida antes de habilitar la trazabilidad clínica requerida para una Nota Crédito parcial de salud."
      );
      err.code = ERROR_CODES.PARTIAL_HEALTH_CREDIT_NOTE_MUV_INELIGIBLE;
      err.item = it;
      throw err;
    }

    if (Array.isArray(structuredAttentions)) {
      const targetSourceId = it.clinicalSourceId || it.clinical_source_id || it.planItemId;
      const found = structuredAttentions.some(
        (att) => (att.id || att.sourceId || att.planItemId || att.clinicalSourceId) === targetSourceId
      );
      if (!found) {
        const err = new Error(
          `PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND: No se encontró la fuente clínica real para el ítem '${it.descripcion || targetSourceId}'.`
        );
        err.code = ERROR_CODES.PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND;
        err.item = it;
        throw err;
      }
    }
  }

  return { eligible: true, isHealth: true, itemsCount: itemsToCheck.length };
}

/**
 * Ejecuta NC_RIPS_CROSSCHECK.
 * Valida coherencia integral entre la Nota Crédito y el RIPS v003 ajustado.
 */
export function executeNcRipsCrosscheck({
  tenantId,
  prestadorNit,
  creditNote,
  facturaOriginal,
  ripsJson,
  montoAcreditadoObjetivo,
}) {
  const errors = [];

  // 1. NIT emisor NC vs Prestador
  const nitPrestadorClean = String(prestadorNit || "").replace(/\D/g, "");
  const ripsNitClean = String(ripsJson?.numDocumentoIdObligado || "").replace(/\D/g, "");
  if (nitPrestadorClean && ripsNitClean && nitPrestadorClean !== ripsNitClean) {
    errors.push(`NIT_MISMATCH: NIT del prestador (${nitPrestadorClean}) no coincide con RIPS (${ripsNitClean}).`);
  }

  // 2. Número de Factura Original en RIPS
  const facOriginalNum = String(
    facturaOriginal?.detalles?.factusInvoiceNumber ||
    facturaOriginal?.detalles?.bill_number ||
    facturaOriginal?.numero ||
    ""
  ).trim();

  const ripsFacNum = String(ripsJson?.numFactura || "").trim();
  if (!ripsFacNum || ripsFacNum !== facOriginalNum) {
    errors.push(
      `NUM_FACTURA_MISMATCH: RIPS numFactura (${ripsFacNum}) debe ser exactamente el número de factura original (${facOriginalNum}).`
    );
  }

  // 3. tipoNota debe ser estrictamente "NC"
  if (ripsJson?.tipoNota !== "NC") {
    errors.push(`TIPO_NOTA_INVALID: tipoNota en RIPS debe ser 'NC' (actual: '${ripsJson?.tipoNota}').`);
  }

  // 4. numNota debe coincidir con el número oficial de la NC Factus/DIAN
  const ncOfficialNum = String(creditNote?.numero || "").trim();
  const ripsNumNota = String(ripsJson?.numNota || "").trim();
  if (!ripsNumNota || ripsNumNota !== ncOfficialNum) {
    errors.push(
      `NUM_NOTA_MISMATCH: RIPS numNota (${ripsNumNota}) debe coincidir con el número oficial de la Nota Crédito (${ncOfficialNum}).`
    );
  }

  // 5. CUDE presente en Nota Crédito
  if (!creditNote?.cude) {
    errors.push("CUDE_REQUIRED: La Nota Crédito no posee CUDE fiscal emitido.");
  }

  // 6. Validación de Valores Monetarios (NC_RIPS_VALUE_MISMATCH)
  let totalRipsServicios = 0;
  const usuarios = Array.isArray(ripsJson?.usuarios) ? ripsJson.usuarios : [];
  for (const u of usuarios) {
    const servicios = u?.servicios || {};
    const consultas = Array.isArray(servicios.consultas) ? servicios.consultas : [];
    const procedimientos = Array.isArray(servicios.procedimientos) ? servicios.procedimientos : [];
    const otros = Array.isArray(servicios.otrosServicios) ? servicios.otrosServicios : [];

    for (const c of consultas) totalRipsServicios += Number(c.vrServicio || 0);
    for (const p of procedimientos) totalRipsServicios += Number(p.vrServicio || 0);
    for (const o of otros) {
      const q = Number(o.cantidadOS || 1);
      const v = Number(o.vrUnitOS || 0);
      totalRipsServicios += q * v;
    }
  }

  const targetMonto = Number(montoAcreditadoObjetivo || creditNote?.monto_acreditado || creditNote?.monto || 0);
  const diff = Math.abs(Math.round(totalRipsServicios * 100) - Math.round(targetMonto * 100)) / 100;

  if (diff > 0.05) {
    errors.push(
      `NC_RIPS_VALUE_MISMATCH: La suma de servicios del RIPS ajustado ($${totalRipsServicios}) no coincide con el valor acreditado en la NC ($${targetMonto}).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    totalRipsServicios,
    targetMonto,
  };
}

/**
 * Construye el RIPS v003 AJUSTADO para una Nota Crédito Parcial.
 * 
 * Reglas Estrictas Fase P1-FEV4-R:
 * 1. Exigir invoiceLineId
 * 2. Exigir clinicalSourceId
 * 3. Exigir clinicalSourceType
 * 4. Recuperar la fuente clínica real exacta
 * 5. Verificar correspondencia con línea original de la factura
 * 6. Verificar tenant de la fuente
 * 7. Verificar paciente de la fuente
 * 8. Sin fallback por CUPS, descripción ni precio
 */
export async function buildPartialCreditNoteRips({
  tenantId,
  prestadorConfig,
  creditNote,
  facturaOriginal,
  creditedItems = null,
  structuredAttentions = [],
  options = {},
}) {
  if (!creditNote) throw new Error("creditNote es obligatoria.");
  if (!facturaOriginal) throw new Error("facturaOriginal es obligatoria.");

  // 1. Validar DIAN y CUDE
  const dianStatus = String(creditNote.dian_status || "").toUpperCase();
  if (dianStatus !== "ACCEPTED" && dianStatus !== "SIMULADA") {
    const err = new Error("La Nota Crédito debe estar ACEPTADA ante la DIAN antes de generar RIPS MUV.");
    err.code = ERROR_CODES.NC_NOT_ACCEPTED_DIAN;
    throw err;
  }

  if (!creditNote.cude) {
    const err = new Error("La Nota Crédito no posee CUDE fiscal emitido.");
    err.code = ERROR_CODES.NC_MISSING_CUDE;
    throw err;
  }

  const tipoNC = String(creditNote.tipo_nota_credito || "").toUpperCase();
  if (tipoNC !== "PARCIAL") {
    const err = new Error(`buildPartialCreditNoteRips solo aplica para tipo_nota_credito = 'PARCIAL' (actual: ${tipoNC}).`);
    err.code = ERROR_CODES.NC_NOT_PARCIAL;
    throw err;
  }

  // 2. Resolver ítems acreditados
  const itemsToAdjust = Array.isArray(creditedItems) && creditedItems.length > 0
    ? creditedItems
    : (creditNote.items || []);

  if (!Array.isArray(itemsToAdjust) || itemsToAdjust.length === 0) {
    const err = new Error("No existen ítems acreditados registrados en la Nota Crédito Parcial.");
    err.code = "NO_CREDITED_ITEMS";
    throw err;
  }

  // Líneas originales de la factura
  const originalInvoiceLines = Array.isArray(facturaOriginal.detalles?.items)
    ? facturaOriginal.detalles.items
    : (Array.isArray(facturaOriginal.items) ? facturaOriginal.items : []);

  // Contexto de validación de seguridad (tenant y paciente)
  const expectedTenantId = tenantId || creditNote.tenant_id || facturaOriginal.tenant_id;
  const expectedPatientId = creditNote.paciente_id || facturaOriginal.paciente_id || facturaOriginal.detalles?.paciente_id;
  const expectedPatientDoc = String(
    facturaOriginal.detalles?.pacienteDocumento ||
    facturaOriginal.detalles?.beneficiary?.identification_number ||
    creditNote.paciente_documento ||
    ""
  ).replace(/\D/g, "");

  // 3. Trazabilidad clínica unívoca y recuperación de fuentes
  const matchedAttentions = [];

  for (const it of itemsToAdjust) {
    // 1. Exigir invoiceLineId
    const lineId = it.invoiceLineId || it.invoice_line_id;
    if (!lineId) {
      const err = new Error(
        `PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING: El ítem '${it.descripcion || "Servicio"}' no posee invoiceLineId persistido.`
      );
      err.code = ERROR_CODES.PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING;
      err.item = it;
      throw err;
    }

    // 2. Exigir clinicalSourceId
    const sourceId = it.clinicalSourceId || it.clinical_source_id;
    if (!sourceId) {
      const err = new Error(
        `PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING: El ítem '${it.descripcion || "Servicio"}' no posee clinicalSourceId persistido.`
      );
      err.code = ERROR_CODES.PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING;
      err.item = it;
      throw err;
    }

    // 3. Exigir clinicalSourceType
    const sourceType = it.clinicalSourceType || it.clinical_source_type;
    if (!sourceType) {
      const err = new Error(
        `PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING: El ítem '${it.descripcion || "Servicio"}' no posee clinicalSourceType persistido.`
      );
      err.code = ERROR_CODES.PARTIAL_NC_CLINICAL_TRACEABILITY_MISSING;
      err.item = it;
      throw err;
    }

    // 4. Verificar correspondencia con línea original de la factura
    if (originalInvoiceLines.length > 0) {
      const matchingOrigLine = originalInvoiceLines.find(
        (orig) => (orig.invoiceLineId || orig.invoice_line_id) === lineId
      );

      if (!matchingOrigLine) {
        const err = new Error(
          `PARTIAL_NC_INVOICE_LINE_MISMATCH: La línea de factura '${lineId}' no existe en la factura original.`
        );
        err.code = ERROR_CODES.PARTIAL_NC_INVOICE_LINE_MISMATCH;
        err.item = it;
        throw err;
      }

      const origSourceId = matchingOrigLine.clinicalSourceId || matchingOrigLine.clinical_source_id || matchingOrigLine.planItemId;
      if (origSourceId && origSourceId !== sourceId) {
        const err = new Error(
          `PARTIAL_NC_INVOICE_LINE_MISMATCH: La fuente clínica de la línea '${lineId}' (${sourceId}) no coincide con la factura original (${origSourceId}).`
        );
        err.code = ERROR_CODES.PARTIAL_NC_INVOICE_LINE_MISMATCH;
        err.item = it;
        throw err;
      }
    }

    // 5. Recuperar la fuente clínica real exacta
    const foundSource = structuredAttentions.find(
      (att) => (att.id || att.sourceId || att.planItemId || att.clinicalSourceId) === sourceId
    );

    if (!foundSource) {
      const err = new Error(
        `PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND: No se encontró la fuente clínica real para el ID '${sourceId}'.`
      );
      err.code = ERROR_CODES.PARTIAL_NC_CLINICAL_SOURCE_NOT_FOUND;
      err.item = it;
      throw err;
    }

    // 6. Verificar tenant de la fuente
    const sourceTenant = foundSource.tenant_id || foundSource.tenantId;
    if (sourceTenant && expectedTenantId && sourceTenant !== expectedTenantId) {
      const err = new Error(
        `PARTIAL_NC_CROSS_TENANT_SOURCE: La fuente clínica '${sourceId}' pertenece a otro tenant (${sourceTenant}).`
      );
      err.code = ERROR_CODES.PARTIAL_NC_CROSS_TENANT_SOURCE;
      err.item = it;
      throw err;
    }

    // 7. Verificar paciente de la fuente
    const sourcePatientId = foundSource.paciente_id || foundSource.pacienteId || foundSource.paciente?.id;
    if (sourcePatientId && expectedPatientId && sourcePatientId !== expectedPatientId) {
      const err = new Error(
        `PARTIAL_NC_CROSS_PATIENT_SOURCE: La fuente clínica '${sourceId}' pertenece a otro paciente (${sourcePatientId}).`
      );
      err.code = ERROR_CODES.PARTIAL_NC_CROSS_PATIENT_SOURCE;
      err.item = it;
      throw err;
    }

    const sourcePatientDoc = String(
      foundSource.paciente?.documento ||
      foundSource.paciente?.numDocumentoIdentificacion ||
      foundSource.paciente?.cedula ||
      foundSource.pacienteDocumento ||
      ""
    ).replace(/\D/g, "");

    if (sourcePatientDoc && expectedPatientDoc && sourcePatientDoc !== expectedPatientDoc) {
      const err = new Error(
        `PARTIAL_NC_CROSS_PATIENT_SOURCE: El documento del paciente en la fuente clínica (${sourcePatientDoc}) no coincide con la factura (${expectedPatientDoc}).`
      );
      err.code = ERROR_CODES.PARTIAL_NC_CROSS_PATIENT_SOURCE;
      err.item = it;
      throw err;
    }

    matchedAttentions.push(foundSource);
  }

  // 4. Configurar Cabecera FEV Original + NC
  const originalBillNumber = String(
    facturaOriginal.detalles?.factusInvoiceNumber ||
    facturaOriginal.detalles?.bill_number ||
    facturaOriginal.numero ||
    ""
  ).trim();

  const ncOfficialNumber = String(creditNote.numero || "").trim();

  const facturaInfo = {
    numFactura: originalBillNumber,
    tipoNota: "NC",
    numNota: ncOfficialNumber,
  };

  const formattedAttentions = matchedAttentions.map((att) => ({
    ...att,
    cupsCode: String(att.cupsCode || att.cups || att.codigo_cups || "").trim().toUpperCase(),
    profesional: att.profesional || (att.tipoDocProf && att.numDocProf ? {
      tipoDocumentoIdentificacion: att.tipoDocProf,
      numDocumentoIdentificacion: att.numDocProf,
    } : null),
  }));

  // 5. Generar RIPS v003 reutilizando generateRipsV003 oficial
  const { ripsJson, validation } = await generateRipsV003({
    tenantId,
    prestadorConfig,
    facturaInfo,
    atenciones: formattedAttentions,
    options: { skipFlagCheck: true, skipRepsCheck: true, ...options },
  });

  if (!validation.isValid) {
    const err = new Error(`RIPS generado para NC no superó validación técnica v003: ${validation.errors.join("; ")}`);
    err.code = "RIPS_V003_VALIDATION_FAILED";
    err.errors = validation.errors;
    throw err;
  }

  // 6. Ejecutar NC_RIPS_CROSSCHECK
  const crosscheck = executeNcRipsCrosscheck({
    tenantId,
    prestadorNit: prestadorConfig.nit,
    creditNote,
    facturaOriginal,
    ripsJson,
    montoAcreditadoObjetivo: creditNote.monto_acreditado || creditNote.monto,
  });

  if (!crosscheck.valid) {
    const err = new Error(`NC_RIPS_CROSSCHECK falló: ${crosscheck.errors.join("; ")}`);
    err.code = ERROR_CODES.NC_RIPS_VALUE_MISMATCH;
    err.errors = crosscheck.errors;
    throw err;
  }

  return {
    ripsJson,
    validation,
    crosscheck,
    matchedAttentions,
  };
}
