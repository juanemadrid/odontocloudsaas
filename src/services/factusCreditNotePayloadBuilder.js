/**
 * src/services/factusCreditNotePayloadBuilder.js
 * Builder dedicado y riguroso para Nota Crédito Electrónica Factus / DIAN.
 * 
 * Soporta:
 * - Facturas comerciales estándar (customization_id = 20)
 * - FEV Salud SS-CUFE (customization_id = 20 + bloque health MinSalud)
 * - Anulación total (correction_concept_code = 2)
 * - Ajuste/corrección parcial (conceptos 1, 3, 4, 5, 6)
 * - Idempotencia con reference_code estable
 */

import {
  getCreditNoteConcept,
  isTotalCreditNoteConcept,
  isPartialCreditNoteConcept,
} from "../utils/dian/creditNoteCatalogs.js";
import {
  validateHealthData,
  isFacturaSectorSalud,
} from "./factusHealthPayloadBuilder.js";

// Top Colombian municipality DANE codes
const MUNICIPALITY_CODES = {
  "bogotá": "11001",
  "bogota": "11001",
  "bogotá d.c.": "11001",
  "bogota d.c.": "11001",
  "medellín": "05001",
  "medellin": "05001",
  "cali": "76001",
  "barranquilla": "08001",
  "cartagena": "13001",
  "cúcuta": "54001",
  "cucuta": "54001",
  "bucaramanga": "68001",
  "pereira": "66001",
  "manizales": "17001",
  "ibagué": "73001",
  "ibague": "73001",
  "santa marta": "47001",
  "villavicencio": "50001",
};

const getMunicipalityCode = (city) => {
  if (!city) return "11001";
  const clean = city.toLowerCase().trim();
  return MUNICIPALITY_CODES[clean] || "11001";
};

const getDocTypeCode = (type) => {
  const map = {
    CC: "13",
    CE: "22",
    NIT: "31",
    TI: "12",
    PASAPORTE: "41",
    PAS: "41",
    PEP: "47",
    PPT: "48",
    RC: "11",
  };
  return map[(type || "").toUpperCase()] || "13";
};

/**
 * Valida la elegibilidad de una factura original para emisión de Nota Crédito.
 * 
 * Reglas DIAN / Factus:
 * - Factura debe existir
 * - Debe tener número de factura Factus (factusInvoiceNumber o nro_consecutivo emitido)
 * - Debe tener CUFE fiscal emitido
 * - dianStatus debe ser ACEPTADA (o SIMULADA en entorno sandbox controlado)
 * - Factura no debe estar INDETERMINATE ni REJECTED ni DRAFT ni PENDING
 * - Saldo fiscal acreditable debe ser > 0
 */
export function validateInvoiceCreditEligibility(invoice, saldoFiscalDisponible = null) {
  if (!invoice) {
    const err = new Error("Factura original no proporcionada.");
    err.code = "CREDIT_NOTE_INVOICE_REQUIRED";
    throw err;
  }

  const detalles = invoice.detalles || {};
  const billNumber =
    detalles.factusInvoiceNumber ||
    detalles.bill_number ||
    detalles.numeroFacturaFactus ||
    invoice.nro_consecutivo ||
    null;

  if (!billNumber) {
    const err = new Error(
      "La factura original no posee número fiscal asignado por Factus (CREDIT_NOTE_INVOICE_NOT_VALIDATED)."
    );
    err.code = "CREDIT_NOTE_INVOICE_NOT_VALIDATED";
    throw err;
  }

  const cufe =
    detalles.cufe ||
    detalles.factusCufe ||
    detalles.factusResponse?.data?.bill?.cufe ||
    detalles.factusResponse?.data?.cufe ||
    null;

  if (!cufe) {
    const err = new Error(
      "La factura original no posee CUFE fiscal registrado (CREDIT_NOTE_CUFE_REQUIRED)."
    );
    err.code = "CREDIT_NOTE_CUFE_REQUIRED";
    throw err;
  }

  const dianStatus = String(detalles.dianStatus || invoice.dian_status || "").toUpperCase();
  const validDianStatuses = ["ACEPTADA", "ACCEPTED", "SIMULADA"];

  if (!validDianStatuses.includes(dianStatus)) {
    const err = new Error(
      `La factura no está en estado ACEPTADA ante la DIAN (estado actual: ${dianStatus || "SIN_ESTADO"}). (CREDIT_NOTE_INVOICE_NOT_VALIDATED)`
    );
    err.code = "CREDIT_NOTE_INVOICE_NOT_VALIDATED";
    throw err;
  }

  if (dianStatus === "INDETERMINATE" || detalles.estadoRevision === "INDETERMINATE") {
    const err = new Error(
      "La factura original está en estado indeterminado; debe verificarse su estado ante la DIAN antes de emitir Nota Crédito."
    );
    err.code = "CREDIT_NOTE_INVOICE_NOT_VALIDATED";
    throw err;
  }

  if (saldoFiscalDisponible !== null && Number(saldoFiscalDisponible) <= 0) {
    const err = new Error(
      "La factura ya no tiene saldo fiscal acreditable disponible (CREDIT_NOTE_NO_CREDITABLE_BALANCE)."
    );
    err.code = "CREDIT_NOTE_NO_CREDITABLE_BALANCE";
    throw err;
  }

  return {
    billNumber,
    cufe,
    dianStatus,
  };
}

/**
 * Construye el payload Factus V2 para validación y emisión de Nota Crédito (/v2/credit-notes/validate).
 * 
 * @param {object} params
 * @param {object} params.invoice - Factura original
 * @param {object} params.patient - Datos del paciente / cliente
 * @param {number|string} params.numberingRangeId - Rango de numeración activo con document = 22
 * @param {string} params.referenceCode - Código de referencia estable (ej: NC-OC-...)
 * @param {string|number} params.correctionConceptCode - Concepto de corrección DIAN (1..6)
 * @param {string} [params.observation] - Observación o justificación
 * @param {number} [params.montoAcreditado] - Monto a acreditar (requerido para parcial o total)
 * @param {Array} [params.items] - Ítems seleccionados o ajustados
 * @param {object} [params.healthConfig] - Configuración de salud si aplica
 * @param {number} [params.saldoDisponible] - Techo fiscal disponible actual
 * @returns {object} Payload estructurado listo para /v2/credit-notes/validate
 */
export function buildFactusCreditNotePayload({
  invoice,
  patient,
  numberingRangeId,
  referenceCode,
  correctionConceptCode,
  observation = "",
  montoAcreditado = null,
  items = null,
  healthConfig = null,
  saldoDisponible = null,
}) {
  // 1. Validar elegibilidad de la factura original
  const { billNumber } = validateInvoiceCreditEligibility(invoice, saldoDisponible);

  // 2. Validar rango de numeración
  const rangeId = Number(numberingRangeId || 0);
  if (!rangeId || isNaN(rangeId) || rangeId <= 0) {
    const err = new Error("El rango de numeración autorizado para Nota Crédito es obligatorio.");
    err.code = "CREDIT_NOTE_NUMBERING_RANGE_REQUIRED";
    throw err;
  }

  // 3. Validar reference_code estable
  const refCode = String(referenceCode || "").trim();
  if (!refCode) {
    const err = new Error("El código de referencia (reference_code) es obligatorio para la Nota Crédito.");
    err.code = "CREDIT_NOTE_REFERENCE_CODE_REQUIRED";
    throw err;
  }

  // 4. Validar concepto de corrección
  const conceptCodeStr = String(correctionConceptCode || "").trim();
  const concept = getCreditNoteConcept(conceptCodeStr);
  if (!concept) {
    const err = new Error(`El concepto de corrección ${conceptCodeStr} no es válido en el catálogo Factus/DIAN.`);
    err.code = "CREDIT_NOTE_INVALID_CONCEPT";
    throw err;
  }

  const isTotal = isTotalCreditNoteConcept(conceptCodeStr);

  // 5. Determinar montos e ítems
  const invoiceTotal = parseFloat(invoice.total || 0);
  const creditableCeiling = saldoDisponible !== null ? parseFloat(saldoDisponible) : invoiceTotal;

  let targetAmount = 0;
  if (isTotal) {
    targetAmount = creditableCeiling;
  } else {
    targetAmount = parseFloat(montoAcreditado || 0);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      const err = new Error("El monto acreditado debe ser mayor a cero.");
      err.code = "CREDIT_NOTE_AMOUNT_INVALID";
      throw err;
    }
  }

  if (targetAmount > creditableCeiling) {
    const err = new Error(
      `El monto a acreditar ($${targetAmount}) supera el saldo fiscal disponible ($${creditableCeiling}).`
    );
    err.code = "CREDIT_NOTE_AMOUNT_EXCEEDS_BALANCE";
    throw err;
  }

  // 6. Construir ítems
  const originalItems = Array.isArray(items) && items.length > 0
    ? items
    : (invoice.items || invoice.detalles?.items || []);

  let factusItems = [];

  if (isTotal && originalItems.length > 0) {
    // Si es anulación total y tenemos los ítems originales, los reutilizamos calculando proporcionalidad si hubo NCs previas
    const itemsSum = originalItems.reduce((acc, it) => {
      const q = parseFloat(it.cantidad || it.quantity || 1) || 1;
      const p = parseFloat(it.precioUnitario || it.precio || it.valor || it.price || 0) || 0;
      return acc + (q * p);
    }, 0);

    const ratio = itemsSum > 0 ? targetAmount / itemsSum : 1;

    factusItems = originalItems.map((item, idx) => {
      const qty = parseFloat(item.cantidad || item.quantity || 1) || 1;
      const basePrice = parseFloat(item.precioUnitario || item.precio || item.valor || item.price || 0) || 0;
      const adjustedPrice = Math.round(basePrice * ratio * 100) / 100;

      return {
        code_reference: item.code || item.code_reference || `SERV-${String(idx + 1).padStart(4, "0")}`,
        name: String(item.descripcion || item.nombre || item.name || "Servicio Odontológico").slice(0, 100),
        quantity: qty,
        discount_rate: 0,
        price: adjustedPrice,
        unit_measure_code: "94",
        standard_code: "0001",
        taxes: [{ code: "01", rate: "0.00" }],
      };
    });
  } else if (!isTotal && Array.isArray(items) && items.length > 0) {
    factusItems = items.map((item, idx) => {
      const qty = parseFloat(item.cantidad || item.quantity || 1) || 1;
      const price = parseFloat(item.precioUnitario || item.precio || item.valor || item.price || 0) || 0;
      return {
        code_reference: item.code || item.code_reference || `SERV-${String(idx + 1).padStart(4, "0")}`,
        name: String(item.descripcion || item.nombre || item.name || "Servicio Odontológico").slice(0, 100),
        quantity: qty,
        discount_rate: 0,
        price: price,
        unit_measure_code: "94",
        standard_code: "0001",
        taxes: [{ code: "01", rate: "0.00" }],
      };
    });
  }

  // Fallback si no hay ítems definidos: generar ítem genérico que represente el ajuste
  if (factusItems.length === 0) {
    factusItems.push({
      code_reference: "AJUSTE-001",
      name: isTotal ? "Anulación total de factura electrónica" : `Ajuste por ${concept.shortName}`,
      quantity: 1,
      discount_rate: 0,
      price: targetAmount,
      unit_measure_code: "94",
      standard_code: "0001",
      taxes: [{ code: "01", rate: "0.00" }],
    });
  }

  // Ajuste fino para que la suma exacta de los ítems coincida con el total acreditado
  const itemsTotal = factusItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  const diff = Math.round((targetAmount - itemsTotal) * 100) / 100;
  if (Math.abs(diff) > 0 && Math.abs(diff) < 1 && factusItems.length > 0) {
    factusItems[0].price = Math.round((factusItems[0].price + diff) * 100) / 100;
  }

  const finalTotalAmount = targetAmount.toFixed(2);

  // 7. Datos del cliente (customer)
  const patientData = patient || invoice.paciente || invoice.detalles?.paciente || {};
  let docNum = String(
    patientData.documento ||
    patientData.identificacion ||
    patientData.cedula ||
    "222222222222"
  ).replace(/\D/g, "");
  if (!docNum || docNum.length < 3) docNum = "222222222222";

  const tipoDoc = getDocTypeCode(patientData.tipoDocumento || patientData.tipo_documento);
  const isNIT = tipoDoc === "31";
  const legalOrgCode = isNIT ? "1" : "2";
  const tributeCode = isNIT ? "O-13" : "ZZ";
  const responsibilities = isNIT ? ["O-13", "O-47"] : ["R-99-PN"];

  const rawEmail = String(patientData.email || patientData.correo || "").trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "facturacion@odontocloud.com";

  let phone = String(patientData.telefono || patientData.celular || "3001234567").replace(/\D/g, "");
  if (phone.length < 10) phone = phone.padEnd(10, "0");

  const address = patientData.direccion || patientData.address || "Dirección no registrada";
  const cityName = patientData.ciudad || patientData.municipio || "Bogotá D.C.";
  const municipalityCode = getMunicipalityCode(cityName);

  const fullName = [patientData.nombre, patientData.apellido]
    .filter(Boolean)
    .join(" ")
    .trim() || "Cliente OdontoCloud";

  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || "Cliente";
  const lastName = nameParts.slice(1).join(" ") || firstName || "General";

  const customerObj = {
    identification_document_code: tipoDoc,
    identification: docNum,
    names: firstName,
    ...(legalOrgCode === "2" ? { last_names: lastName } : {}),
    ...(isNIT ? { company: fullName, trade_name: fullName } : {}),
    address: address,
    email: email,
    phone: phone,
    legal_organization_code: legalOrgCode,
    tribute_code: tributeCode,
    responsibilities: responsibilities,
    municipality_code: municipalityCode,
  };

  // 8. Detalles de pago (payment_details)
  const paymentDetails = [
    {
      payment_form: String(invoice.condicionPago || "1"),
      payment_method_code: String(invoice.medioPago || "10"),
      amount: finalTotalAmount,
    },
  ];

  // 9. Bloque Base del Payload Factus
  const payload = {
    numbering_range_id: rangeId,
    reference_code: refCode,
    customization_id: 20, // 20 = Nota Crédito que referencia una factura electrónica
    bill_number: billNumber,
    correction_concept_code: conceptCodeStr,
    observation: (observation || `Nota Crédito ${concept.shortName} para factura ${billNumber}`).slice(0, 250),
    payment_details: paymentDetails,
    customer: customerObj,
    items: factusItems,
  };

  // 10. Salud SS-CUFE si la factura original es del sector salud
  const isHealth =
    isFacturaSectorSalud(invoice) ||
    invoice.detalles?.tipoOperacion === "SS-CUFE" ||
    invoice.tipo_operacion === "SS-CUFE" ||
    Boolean(invoice.detalles?.health);

  if (isHealth) {
    payload.operation_type = "SS-CUFE";

    // Extraer configuración real de salud previa o de tenantConfig
    const rawHealth =
      invoice.detalles?.health ||
      invoice.health ||
      healthConfig ||
      {};

    const validatedHealth = validateHealthData({
      provider_code: rawHealth.provider_code || rawHealth.codigoPrestador,
      payment_method_code: rawHealth.payment_method_code || rawHealth.modalidadPago,
      coverage_code: rawHealth.coverage_code || rawHealth.cobertura,
      contract_number: rawHealth.contract_number !== undefined ? rawHealth.contract_number : null,
      without_contract_code: rawHealth.without_contract_code !== undefined ? rawHealth.without_contract_code : null,
      policy_number: rawHealth.policy_number !== undefined ? rawHealth.policy_number : null,
    });

    payload.health = validatedHealth;
  }

  return payload;
}
