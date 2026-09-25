/**
 * factusHealthPayloadBuilder.js
 * 
 * Constructor desacoplado para facturación electrónica sector salud (SS-CUFE) Factus V2.
 * Marco normativo:
 * - Resolución 2275 de 2023 / Resolución 0948 de 2026 (MinSalud - FEV-RIPS)
 * - Factus API V2: operation_type = "SS-CUFE", objeto `health`
 * 
 * Reglas de oro:
 * 1. NO modifica el constructor de facturación estándar.
 * 2. Valida estrictamente los campos requeridos antes de enviar cualquier request.
 * 3. Fuente canónica para activar flujo salud: `factura.esSectorSalud === true`.
 * 4. Beneficiary y billing_period son opcionales en el contrato SS-CUFE.
 */

/**
 * Determina de forma explícita y canónica si una factura califica para el flujo FEV-RIPS sector salud.
 * 
 * Requiere OBLIGATORIAMENTE:
 * 1. Feature flag ENABLE_FEV_RIPS_0948 activo en el tenant (verificado server-side).
 * 2. Propiedad canónica de dominio: `factura.esSectorSalud === true` o `factura.tipoOperacion === "SS-CUFE"`.
 */
export const isFacturaSectorSalud = ({ factura, fevRipsFlagEnabled }) => {
  if (fevRipsFlagEnabled !== true) {
    return false;
  }
  if (!factura || typeof factura !== "object") {
    return false;
  }
  return Boolean(
    factura.esSectorSalud === true ||
    factura.tipoOperacion === "SS-CUFE"
  );
};

/**
 * Valida los datos de salud según el contrato Factus V2 y MinSalud.
 * Lanza errores explícitos antes de disparar el request si falta algún dato requerido.
 */
export const validateHealthData = (healthData) => {
  if (!healthData || typeof healthData !== "object") {
    throw new Error("Los datos del sector salud (healthData) son obligatorios para SS-CUFE.");
  }

  // 1. Código de prestador (REPS) — Requerido, string, trim, no vacío (sin límite arbitrario inventado)
  const providerCode = String(healthData.provider_code || healthData.codigoPrestador || "").trim();
  if (!providerCode) {
    throw new Error("El código de prestador de salud (provider_code) es obligatorio.");
  }

  // 2. Modalidad de pago MinSalud (01 Capitado, 02 Evento, etc.)
  const paymentMethodCode = String(healthData.payment_method_code || healthData.modalidadPago || "").trim();
  if (!paymentMethodCode) {
    throw new Error("El código de modalidad de pago en salud (payment_method_code) es obligatorio.");
  }

  // 3. Cobertura en salud (01 UPC, 02 Complementario, 03 Voluntario, 04 Particular, etc.)
  const coverageCode = String(healthData.coverage_code || healthData.cobertura || "").trim();
  if (!coverageCode) {
    throw new Error("El código de cobertura en salud (coverage_code) es obligatorio.");
  }

  // 4. Contrato vs Sin Contrato
  const contractNumber = healthData.contract_number !== undefined && healthData.contract_number !== null
    ? String(healthData.contract_number).trim()
    : null;
  const policyNumber = healthData.policy_number !== undefined && healthData.policy_number !== null
    ? String(healthData.policy_number).trim()
    : null;
  const withoutContractCode = healthData.without_contract_code !== undefined && healthData.without_contract_code !== null
    ? String(healthData.without_contract_code).trim()
    : null;

  if (!contractNumber && !withoutContractCode) {
    throw new Error("Debe suministrar contract_number o without_contract_code (ej. '1' para sin contrato).");
  }

  const healthObj = {
    provider_code: providerCode,
    payment_method_code: paymentMethodCode,
    coverage_code: coverageCode,
  };

  if (contractNumber) {
    healthObj.contract_number = contractNumber;
  }
  if (policyNumber) {
    healthObj.policy_number = policyNumber;
  }
  if (withoutContractCode) {
    healthObj.without_contract_code = withoutContractCode;
  }

  return healthObj;
};

/**
 * Valida el periodo de facturación si es suministrado (opcional en SS-CUFE).
 */
export const validateBillingPeriod = (period, referenceDate = new Date()) => {
  if (!period || typeof period !== "object") {
    return null;
  }
  const refIso = referenceDate.toISOString();
  const defaultDate = refIso.slice(0, 10);

  const startDate = period.start_date || period.fechaInicio || defaultDate;
  const endDate = period.end_date || period.fechaFin || defaultDate;
  const startTime = period.start_time || period.horaInicio || "00:00:00";
  const endTime = period.end_time || period.horaFin || "23:59:59";

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}:\d{2}$/;

  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new Error("El periodo de facturación requiere fechas válidas en formato YYYY-MM-DD.");
  }
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    throw new Error("El periodo de facturación requiere horas válidas en formato HH:mm:ss.");
  }

  return {
    start_date: startDate,
    start_time: startTime,
    end_date: endDate,
    end_time: endTime,
  };
};

/**
 * Construye el payload SS-CUFE a partir de un payload estándar ya preparado.
 * 
 * Contrato Factus V2:
 * - operation_type = "SS-CUFE"
 * - health: { provider_code, payment_method_code, coverage_code, contract_number, policy_number, without_contract_code }
 * - beneficiary: { identification_document_code, identification_number, names, surnames } (OPCIONAL)
 * - billing_period: { start_date, start_time, end_date, end_time } (OPCIONAL)
 * 
 * @param {Object} standardPayload - Payload estándar Factus V2
 * @param {Object} healthData      - Datos de salud
 * @param {Object} [options]       - Opciones adicionales (billing_period, beneficiary)
 * @returns {Object} Payload listo para POST /v2/bills/validate
 */
export const buildFactusHealthInvoicePayload = (standardPayload, healthData, options = {}) => {
  if (!standardPayload || typeof standardPayload !== "object") {
    throw new Error("El payload base estándar es obligatorio.");
  }

  // 1. Validar datos del sector salud (estricto)
  const validatedHealth = validateHealthData(healthData);

  // 2. Periodo de facturación: OPCIONAL (SS_CUFE_BILLING_PERIOD_REQUIRED = false)
  const rawPeriod = options.billing_period || options.periodoFacturacion;
  const billingPeriod = rawPeriod ? validateBillingPeriod(rawPeriod) : null;

  // 3. Beneficiary: OPCIONAL — Contrato oficial Factus V2:
  // identification_document_code, identification_number, names, surnames
  let beneficiary = null;
  if (options.beneficiary && typeof options.beneficiary === "object") {
    const ben = options.beneficiary;
    const doc = String(ben.identification_number || ben.identification || ben.documento || "").replace(/\D/g, "");
    if (doc) {
      beneficiary = {
        identification_document_code: String(ben.identification_document_code || ben.tipoDocumento || "13"),
        identification_number: doc,
        names: String(ben.names || ben.nombre || "").trim(),
        surnames: String(ben.surnames || ben.last_names || ben.apellido || "").trim(),
      };
    }
  }

  // 4. Retornar payload inmutable extendido con campos de salud
  return {
    ...standardPayload,
    operation_type: "SS-CUFE",
    health: validatedHealth,
    ...(billingPeriod ? { billing_period: billingPeriod } : {}),
    ...(beneficiary ? { beneficiary } : {}),
  };
};
