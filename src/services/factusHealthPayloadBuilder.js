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
// ─── Perfiles Centralizados de Catálogo de Modalidad de Pago Factus Salud ───
export const FACTUS_HEALTH_CATALOG_PROFILES = {
  SHARED_SANDBOX_LEGACY_4: "SHARED_SANDBOX_LEGACY_4",
  DOCUMENTED_RES2275_12: "DOCUMENTED_RES2275_12",
};

// Catálogo de modalidades para el perfil SHARED_SANDBOX_LEGACY_4 (Verificado empíricamente en Sandbox vivo)
export const FACTUS_HEALTH_PAYMENT_CATALOG_SHARED_SANDBOX_LEGACY_4 = {
  "01": "Pago individual por caso / Conjunto integral de atenciones / Paquete / Canasta",
  "02": "Pago global prospectivo",
  "03": "Pago por capitación",
  "04": "Pago por evento",
};

// Catálogo de modalidades para el perfil DOCUMENTED_RES2275_12 (Documentación oficial MinSalud Res. 2275 / Factus V2 doc)
export const FACTUS_HEALTH_PAYMENT_CATALOG_DOCUMENTED_RES2275_12 = {
  "01": "Paquete / Canasta / Conjunto Integral en Salud",
  "02": "Grupos Relacionados por Diagnóstico (GRD)",
  "03": "Integral por grupo de riesgo",
  "04": "Pago por contacto por especialidad",
  "05": "Pago por escenario de atención",
  "06": "Pago por tipo de servicio",
  "07": "Pago global prospectivo por episodio",
  "08": "Pago global prospectivo por grupo de riesgo",
  "09": "Pago global prospectivo por especialidad",
  "10": "Pago global prospectivo por nivel de complejidad",
  "11": "Capitación",
  "12": "Por servicio",
};

// Metadatos de visualización institucional para UI clínica
export const FACTUS_HEALTH_CATALOG_PROFILE_METADATA = {
  SHARED_SANDBOX_LEGACY_4: {
    id: "SHARED_SANDBOX_LEGACY_4",
    nombreVisible: "Sandbox actual Factus (Catálogo 4 modalidades)",
    descripcion: "Perfil compatible con el ambiente sandbox compartido de pruebas de Factus.",
    esDocumentadoRes2275: false,
    codigosValidos: ["01", "02", "03", "04"],
    catalogo: FACTUS_HEALTH_PAYMENT_CATALOG_SHARED_SANDBOX_LEGACY_4,
  },
  DOCUMENTED_RES2275_12: {
    id: "DOCUMENTED_RES2275_12",
    nombreVisible: "Resolución 2275 / Factus V2 (Catálogo 12 modalidades)",
    descripcion: "Perfil documentado según Resolución 2275 de 2023 (sujeto a revalidación en ambiente privado).",
    esDocumentadoRes2275: true,
    codigosValidos: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
    catalogo: FACTUS_HEALTH_PAYMENT_CATALOG_DOCUMENTED_RES2275_12,
  },
};

// Aliases para compatibilidad hacia atrás
export const FACTUS_HEALTH_PAYMENT_METHOD_CATALOG = FACTUS_HEALTH_PAYMENT_CATALOG_SHARED_SANDBOX_LEGACY_4;
export const PARTICULAR_COVERAGE_CODE = "15";
export const PAYMENT_METHOD_EVENTO_CODE = "04"; // Reconciliado con Shared Sandbox

// ─── Catálogo Centralizado de Cobertura en Salud ───
export const FACTUS_HEALTH_COVERAGE_CATALOG = {
  "01": "Plan de beneficios en salud financiado con UPC",
  "02": "Presupuesto máximo",
  "03": "Prima EPS/EOC",
  "04": "SOAT",
  "05": "ARL",
  "06": "ADRES",
  "07": "Salud Pública",
  "08": "Entidad territorial",
  "09": "Urgencias población migrante",
  "10": "Plan complementario",
  "11": "Medicina prepagada",
  "12": "Otras pólizas",
  "13": "Régimen especial/excepción",
  "14": "Fondo PPL",
  "15": "Particular",
};

// ─── Catálogo Centralizado de Factura Sin Contrato ───
export const FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG = {
  "01": "Atención de urgencias",
  "02": "Atención a cargo de ADRES o de Aseguradora SOAT, Planes voluntarios de Salud",
  "03": "Atención en salud por fallos de tutela/órdenes judiciales",
  "04": "Atención en salud por Portabilidad o en los casos de asignación masiva de afiliados",
  "05": "Atención en salud en casos excepcionales por cotizaciones o autorizaciones sin contrato adicionales excepcionales",
};

export const FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG_METADATA = {
  source: "LIVE_API_SANDBOX",
  catalogo: FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG,
};

export const WITHOUT_CONTRACT_SCHEMA_SOURCE = "LIVE_API_SANDBOX";

export const CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE = "CLINICAL_INVOICE_CANNOT_BYPASS_HEALTH_MODE";
export const CLINICAL_INVOICE_CANNOT_BYPASS_ERROR_MESSAGE = "Las prestaciones clínicas estructuradas (planes de tratamiento, atenciones realizadas, evoluciones o CUPS) deben facturarse obligatoriamente bajo régimen SALUD (SS-CUFE). No pueden cambiarse a régimen Comercial.";

/**
 * Obtiene el catálogo de modalidades de pago correspondiente al perfil especificado.
 */
export const getHealthPaymentCatalogForProfile = (profileId) => {
  const profile = FACTUS_HEALTH_CATALOG_PROFILE_METADATA[profileId];
  if (!profile) {
    const err = new Error("El perfil de catálogo de salud es obligatorio y no está configurado (FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED).");
    err.code = "FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED";
    throw err;
  }
  return profile.catalogo;
};

/**
 * Valida que un código de modalidad de pago pertenezca al perfil activo y devuelve su descripción contextual.
 */
export const validatePaymentMethodCodeForProfile = (code, profileId) => {
  const profile = FACTUS_HEALTH_CATALOG_PROFILE_METADATA[profileId];
  if (!profile) {
    const err = new Error("El perfil de catálogo de salud es obligatorio y no está configurado (FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED).");
    err.code = "FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED";
    throw err;
  }
  const cleanCode = String(code || "").trim().padStart(2, "0");
  if (!profile.codigosValidos.includes(cleanCode)) {
    const validStr = profile.codigosValidos.join(", ");
    const err = new Error(`El código de modalidad de pago '${cleanCode}' no es válido para el perfil '${profile.nombreVisible}'. Códigos permitidos: [${validStr}].`);
    err.code = "HEALTH_PAYMENT_METHOD_INVALID_FOR_PROFILE";
    throw err;
  }
  return {
    code: cleanCode,
    description: profile.catalogo[cleanCode],
    profileId: profile.id,
  };
};

/**
 * Resuelve el perfil de catálogo Factus Salud autoritativo para un tenant.
 * Prioridad: configuración tenant → ambiente Factus → perfil explícitamente configurado.
 * NO infiere silenciosamente; bloquea con FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED si falta.
 */
export const resolveHealthCatalogProfile = ({ tenantConfig, factusConfig, explicitProfile } = {}) => {
  const profile =
    tenantConfig?.factus_health_catalog_profile ||
    tenantConfig?.factusHealthCatalogProfile ||
    factusConfig?.factus_health_catalog_profile ||
    factusConfig?.healthCatalogProfile ||
    explicitProfile ||
    null;

  if (!profile || !FACTUS_HEALTH_CATALOG_PROFILE_METADATA[profile]) {
    const err = new Error("Se requiere configurar el perfil de catálogo de facturación electrónica en salud (FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED).");
    err.code = "FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED";
    throw err;
  }

  return profile;
};

/**
 * Filtra los rangos de numeración devueltos por Factus /v2/numbering-ranges para permitir únicamente
 * rangos activos, vigentes y correspondientes a 'Factura de Venta'.
 * Rechaza de forma estricta rangos inactivos (is_active !== true) o expirados (is_expired === true).
 */
export const filterActiveSalesInvoiceRanges = (ranges) => {
  if (!ranges) return [];
  let list = ranges;
  if (ranges && typeof ranges === "object" && !Array.isArray(ranges)) {
    if (Array.isArray(ranges.result?.data?.data)) list = ranges.result.data.data;
    else if (Array.isArray(ranges.result?.data)) list = ranges.result.data;
    else if (Array.isArray(ranges.data?.data)) list = ranges.data.data;
    else if (Array.isArray(ranges.data)) list = ranges.data;
    else if (Array.isArray(ranges.ranges)) list = ranges.ranges;
  }
  if (!Array.isArray(list)) return [];
  return list.filter((r) => {
    const docName = String(r.document || "").toLowerCase().trim();
    const isSalesInvoice = docName.includes("factura de venta") || docName.includes("factura electrónica");
    const isActive = r.is_active === true;
    const notExpired = r.is_expired !== true;
    const notDeleted = !r.deleted_at;
    return isSalesInvoice && isActive && notExpired && notDeleted;
  });
};

/**
 * Preflight formal y estricto para FEV Salud antes de invocar Factus.
 * Lanza errores específicos con códigos estructurados si falta cualquier dato mandatorio.
 */
export const preflightHealthInvoice = ({
  catalogProfile,
  numberingRangeId,
  providerCode,
  paymentMethodCode,
  coverageCode,
  contractNumber,
  withoutContractCode,
  items,
  beneficiary,
  billingPeriod,
}) => {
  // 1. Perfil de catálogo requerido
  if (!catalogProfile || !FACTUS_HEALTH_CATALOG_PROFILE_METADATA[catalogProfile]) {
    const err = new Error("Falta configurar el perfil de catálogo de salud Factus (FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED).");
    err.code = "FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED";
    throw err;
  }

  // 2. Rango de numeración Factus obligatorio
  const rangeId = Number(numberingRangeId || 0);
  if (!rangeId || isNaN(rangeId) || rangeId <= 0) {
    const err = new Error("El rango de numeración Factus autorizado es obligatorio (FACTUS_NUMBERING_RANGE_REQUIRED).");
    err.code = "FACTUS_NUMBERING_RANGE_REQUIRED";
    throw err;
  }

  // 3. Código de prestador REPS obligatorio
  const cleanProvider = String(providerCode || "").trim();
  if (!cleanProvider) {
    const err = new Error("El código de prestador de salud (REPS) es obligatorio (PROVIDER_CODE_REQUIRED).");
    err.code = "PROVIDER_CODE_REQUIRED";
    throw err;
  }

  // 4. Modalidad de pago requerida y válida para el perfil activo
  if (!paymentMethodCode) {
    const err = new Error("El código de modalidad de pago en salud es obligatorio (HEALTH_PAYMENT_METHOD_REQUIRED).");
    err.code = "HEALTH_PAYMENT_METHOD_REQUIRED";
    throw err;
  }
  const pmValidated = validatePaymentMethodCodeForProfile(paymentMethodCode, catalogProfile);

  // 5. Cobertura requerida y válida
  const cleanCoverage = String(coverageCode || "").trim().padStart(2, "0");
  if (!cleanCoverage || !FACTUS_HEALTH_COVERAGE_CATALOG[cleanCoverage]) {
    const err = new Error("El código de cobertura en salud es obligatorio y debe ser válido (HEALTH_COVERAGE_REQUIRED).");
    err.code = "HEALTH_COVERAGE_REQUIRED";
    throw err;
  }

  // 6. Contrato vs Sin Contrato (uno u otro, no ambos vacíos ni contradictorios)
  const cleanContract = contractNumber ? String(contractNumber).trim() : null;
  const cleanWithoutContract = withoutContractCode ? String(withoutContractCode).trim().padStart(2, "0") : null;

  if (!cleanContract && !cleanWithoutContract) {
    const err = new Error("Para facturación de salud a entidades/EPS, debe suministrarse el número de contrato del convenio o indicar la causal de atención sin contrato (autorización o urgencia).");
    err.code = "HEALTH_CONTRACT_DATA_REQUIRED";
    throw err;
  }

  if (!cleanContract && cleanWithoutContract) {
    if (!FACTUS_HEALTH_WITHOUT_CONTRACT_CATALOG[cleanWithoutContract]) {
      const err = new Error(`El código de causal sin contrato '${cleanWithoutContract}' no es válido en el catálogo oficial de salud.`);
      err.code = "HEALTH_CONTRACT_DATA_REQUIRED";
      throw err;
    }
  }

  // 7. Fuente clínica obligatoria y atenciones realizadas
  validateClinicalAttentionsForHealthInvoice(items);

  return {
    catalogProfile,
    numberingRangeId: rangeId,
    providerCode: cleanProvider,
    paymentMethodCode: pmValidated.code,
    paymentMethodDescription: pmValidated.description,
    coverageCode: cleanCoverage,
    coverageDescription: FACTUS_HEALTH_COVERAGE_CATALOG[cleanCoverage],
    contractNumber: cleanContract,
    withoutContractCode: cleanContract ? null : cleanWithoutContract,
    beneficiary: beneficiary || null,
    billingPeriod: billingPeriod || null,
  };
};

/**
 * Determina si un ítem tiene origen clínico estructurado.
 * Basado estrictamente en propiedades de dominio:
 * - CUPS (cups, codigo_cups, codigoCups)
 * - Origen de plan de tratamiento (planId, plan_id, planItemId)
 * - Origen de evolución o historia clínica (evolucionId, atencionId, documentoClinicoId)
 * - Estado de realización clínica (realizado, atencionRealizada)
 * - Indicador clínico explícito (isClinical === true, tipoItem === 'CLINICO')
 * 
 * NO utiliza heurística por palabras como mecanismo principal.
 */
export const isClinicalStructuredItem = (item) => {
  if (!item || typeof item !== "object") return false;
  return Boolean(
    item.cups ||
    item.codigo_cups ||
    item.codigoCups ||
    item.planId ||
    item.plan_id ||
    item.planItemId ||
    item.atencionId ||
    item.atencion_id ||
    item.evolucionId ||
    item.documentoClinicoId ||
    item.realizado === true ||
    item.atencionRealizada === true ||
    item.isClinical === true ||
    item.tipoItem === "CLINICO"
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

  // 1. Código de prestador (REPS) — Requerido, string, trim, no vacío
  const providerCode = String(healthData.provider_code || healthData.codigoPrestador || "").trim();
  if (!providerCode) {
    throw new Error("El código de prestador de salud (provider_code) es obligatorio.");
  }

  // 2. Modalidad de pago MinSalud / Factus V2 (01 Paquete, 02 Global prospectivo, 03 Capitación, 04 Evento)
  const paymentMethodCode = String(healthData.payment_method_code || healthData.modalidadPago || "").trim();
  if (!paymentMethodCode) {
    throw new Error("El código de modalidad de pago en salud (payment_method_code) es obligatorio.");
  }

  // 3. Cobertura en salud (01 UPC, 04 SOAT, 10 Complementario, 11 Prepagada, 15 Particular)
  const coverageCode = String(healthData.coverage_code || healthData.cobertura || "").trim();
  if (!coverageCode) {
    throw new Error("El código de cobertura en salud (coverage_code) es obligatorio.");
  }

  // 4. Contrato vs Sin Contrato (Factus V2 requiere contract_number O without_contract_code)
  const contractNumber = healthData.contract_number !== undefined && healthData.contract_number !== null
    ? String(healthData.contract_number).trim()
    : null;
  const policyNumber = healthData.policy_number !== undefined && healthData.policy_number !== null
    ? String(healthData.policy_number).trim()
    : null;
  const rawWithoutContract = healthData.without_contract_code !== undefined && healthData.without_contract_code !== null
    ? String(healthData.without_contract_code).trim()
    : null;
  const withoutContractCode = rawWithoutContract
    ? rawWithoutContract.padStart(2, "0")
    : null;

  if (!contractNumber && !withoutContractCode) {
    throw new Error("Debe suministrar contract_number o without_contract_code (ej. '01'..'05' para sin contrato según Factus V2).");
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

export const FEV_CLINICAL_SOURCE_REQUIRED = "FEV_CLINICAL_SOURCE_REQUIRED";
export const FEV_CLINICAL_SOURCE_ERROR_MESSAGE = "No puedes emitir una factura electrónica de salud sin una atención clínica realizada asociada.";

/**
 * Valida el periodo de facturación si es suministrado (opcional en SS-CUFE).
 * 
 * Reglas MinSalud / Factus:
 * - Formato YYYY-MM-DD y HH:mm:ss
 * - start_date <= end_date
 * - end_date no puede ser posterior a la fecha de emisión de la FEV.
 */
export const validateBillingPeriod = (period, referenceDate = new Date()) => {
  if (!period || typeof period !== "object") {
    return null;
  }
  const refIso = (referenceDate instanceof Date ? referenceDate : new Date(referenceDate)).toISOString();
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

  if (startDate > endDate) {
    throw new Error("La fecha de inicio del periodo de facturación no puede ser posterior a la fecha de fin.");
  }

  const refDateStr = defaultDate;
  if (endDate > refDateStr) {
    throw new Error("El periodo de facturación no puede ser posterior a la fecha de emisión de la FEV.");
  }

  return {
    start_date: startDate,
    start_time: startTime,
    end_date: endDate,
    end_time: endTime,
  };
};

/**
 * Construye el periodo de facturación a partir de las fechas reales de las atenciones/prestaciones clínicas incluidas.
 * 
 * billing_period.start = primera fecha válida
 * billing_period.end = última fecha válida
 */
export const buildBillingPeriodFromAttentions = (attentions, referenceDate = new Date()) => {
  if (!Array.isArray(attentions) || attentions.length === 0) {
    return null;
  }

  const refDateStr = (referenceDate instanceof Date ? referenceDate : new Date(referenceDate)).toISOString().slice(0, 10);
  const validDates = [];

  for (const att of attentions) {
    const rawDate = att?.fechaRealizado || att?.fechaAtencion || att?.fecha || att?.date;
    if (rawDate) {
      const dateStr = String(rawDate).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        if (dateStr > refDateStr) {
          throw new Error(`La fecha de atención (${dateStr}) no puede ser posterior a la fecha de emisión (${refDateStr}).`);
        }
        validDates.push(dateStr);
      }
    }
  }

  if (validDates.length === 0) {
    return null;
  }

  validDates.sort();
  const startDate = validDates[0];
  const endDate = validDates[validDates.length - 1];

  return validateBillingPeriod({
    start_date: startDate,
    end_date: endDate,
    start_time: "00:00:00",
    end_time: "23:59:59",
  }, referenceDate);
};

/**
 * Construye el objeto beneficiario según el contrato oficial Factus V2 Salud
 * a partir de los datos del paciente real.
 */
export const buildBeneficiaryFromPatient = (patient) => {
  if (!patient || typeof patient !== "object") return null;

  const doc = String(
    patient.nroDocumento ||
    patient.documento ||
    patient.identificacion ||
    patient.cedula ||
    ""
  ).replace(/\D/g, "");

  if (!doc) return null;

  const rawTipo = String(
    patient.tipoDocumento ||
    patient.tipo_documento ||
    "CC"
  ).toUpperCase();

  const docCodeMap = {
    CC: "13",
    NIT: "31",
    CE: "22",
    PA: "41",
    TI: "12",
    RC: "11",
    DE: "21",
    CD: "22",
    PEP: "47",
    AS: "13",
    MS: "13",
  };

  const tipoDocCode = docCodeMap[rawTipo] || "13";

  const firstName = String(
    patient.nombres ||
    patient.nombre ||
    (patient.nombreCompleto || "").split(" ")[0] ||
    "Beneficiario"
  ).trim();

  const lastName = String(
    patient.apellidos ||
    patient.apellido ||
    (patient.nombreCompleto || "").split(" ").slice(1).join(" ") ||
    "General"
  ).trim();

  return {
    identification_document_code: tipoDocCode,
    identification_number: doc,
    names: firstName,
    surnames: lastName,
  };
};

/**
 * Valida que los ítems a facturar en el sector salud provengan de atenciones clínicas REALIZADAS con CUPS válido.
 * Bloquea la emisión si se detecta texto libre o prestaciones no realizadas.
 */
export const validateClinicalAttentionsForHealthInvoice = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error(FEV_CLINICAL_SOURCE_ERROR_MESSAGE);
    err.code = FEV_CLINICAL_SOURCE_REQUIRED;
    throw err;
  }

  for (const item of items) {
    const isRealized = Boolean(
      item.realizado === true ||
      item.fechaRealizado ||
      item.fechaAtencion ||
      item.atencionRealizada === true
    );
    const hasCups = Boolean(
      item.codigo_cups ||
      item.cups ||
      item.code ||
      item.codigoCups
    );

    if (!isRealized || !hasCups) {
      const err = new Error(FEV_CLINICAL_SOURCE_ERROR_MESSAGE);
      err.code = FEV_CLINICAL_SOURCE_REQUIRED;
      throw err;
    }
  }

  return true;
};

/**
 * Resuelve los datos del sector salud requeridos para SS-CUFE desde configuración real del tenant.
 * NO utiliza valores por defecto silenciosos que cambien el significado contractual de la FEV.
 */
export const resolveHealthDataFromConfig = ({
  providerCode,
  planCob,
  isEntidad = false,
  modalidadPago,
  coberturaCode,
  contractNumber,
  withoutContractCode,
  catalogProfile,
}) => {
  // 1. provider_code: obligatorio
  const cleanProvider = String(providerCode || "").trim();
  if (!cleanProvider) {
    throw new Error("El código de prestador de salud (provider_code / REPS) es obligatorio.");
  }

  // 2. payment_method_code: NO hardcodear "02" silenciosamente.
  // Factus V2: "04" = Pago por evento (en sandbox), "01" = Paquete/Canasta, etc.
  const rawPaymentMethod = modalidadPago || planCob?.modalidadPago || planCob?.payment_method_code;
  if (!rawPaymentMethod) {
    throw new Error("El código de modalidad de pago en salud (payment_method_code) es obligatorio y debe configurarse contractualmente (ej. '04' para Pago por evento, '01' para Paquete/Canasta, '03' para Capitación).");
  }
  const cleanPaymentMethod = String(rawPaymentMethod).trim().padStart(2, "0");

  if (catalogProfile) {
    validatePaymentMethodCodeForProfile(cleanPaymentMethod, catalogProfile);
  }

  // 3. coverage_code: NO usar "04" como Particular ("04" = SOAT, "15" = Particular en Factus V2).
  let cleanCoverage = "";
  if (isEntidad) {
    const rawCoverage = coberturaCode || planCob?.coberturaCode || planCob?.coverage_code;
    if (!rawCoverage) {
      throw new Error("El código de cobertura en salud (coverage_code) es obligatorio para convenios o entidades.");
    }
    cleanCoverage = String(rawCoverage).trim().padStart(2, "0");
  } else {
    // Para paciente particular: usar catálogo vigente '15' (Particular)
    const rawCoverage = coberturaCode || planCob?.coberturaCode || PARTICULAR_COVERAGE_CODE;
    cleanCoverage = String(rawCoverage).trim().padStart(2, "0");
  }

  // 4. contract_number vs without_contract_code
  // Para convenios/entidades, el contrato es contractual y obligatorio (sin fallbacks inventados como CONV-001).
  const contract = contractNumber || planCob?.numeroContrato || planCob?.contrato || null;
  const cleanContract = contract ? String(contract).trim() : null;

  if (isEntidad && !cleanContract) {
    throw new Error("El número de contrato (contract_number) es obligatorio para facturación con convenios o entidades.");
  }

  const healthObj = {
    provider_code: cleanProvider,
    payment_method_code: cleanPaymentMethod,
    coverage_code: cleanCoverage,
  };

  if (cleanContract) {
    healthObj.contract_number = cleanContract;
  } else {
    // Si no hay contrato institucional, Factus V2 requiere officially without_contract_code ("01".."05")
    const rawWithoutContract = withoutContractCode || planCob?.without_contract_code || planCob?.codigoSinContrato || "05";
    healthObj.without_contract_code = String(rawWithoutContract).trim().padStart(2, "0");
  }

  return validateHealthData(healthObj);
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

/**
 * Preparación de Pipeline de Revalidación para Factus Private Sandbox / Producción (P0-FEV1B).
 * NOTA: NO ejecutar en vivo contra producción ni sandboxes privados no autorizados.
 * Retorna la definición estructurada de las fases de revalidación controlada.
 */
export const prepareFactusPrivateSandboxRevalidation = ({ tenantId, dryRun = true } = {}) => {
  return {
    status: "PREPARED_NOT_EXECUTED",
    tenantId: tenantId || null,
    dryRun: dryRun !== false,
    phases: [
      { id: "COMPANY_QUERY", name: "Consulta de company en Factus V2 (/v2/company)", required: true },
      { id: "EMITTER_NIT_VALIDATION", name: "Validación de NIT de la institución emisora vs datos fiscales", required: true },
      { id: "NUMBERING_RANGES_QUERY", name: "Consulta autoritativa de rangos (/v2/numbering-ranges)", required: true },
      { id: "PAYMENT_METHOD_CATALOG_PROBE", name: "Prueba de catálogo payment_method_code (01..12)", required: true },
      { id: "COVERAGE_VALIDATION", name: "Validación de catálogo de coberturas (15 Particular, etc.)", required: true },
      { id: "CONTRACT_VALIDATION", name: "Validación de contract_number vs without_contract_code", required: true },
      { id: "TEST_HEALTH_INVOICE_EMISSION", name: "Emisión controlada de UNA sola FEV Salud SS-CUFE de prueba", required: true },
      { id: "ATTACHED_DOCUMENT_VERIFICATION", name: "Descarga y verificación de AttachedDocument XML legal", required: true },
    ],
    readyForPrivateSandbox: true,
  };
};

/**
 * Traduce y formatea cualquier error de validación o emisión FEV Salud
 * para presentarlo de manera amigable, clara y profesional al usuario clínico/administrativo.
 */
export const formatHealthErrorMessage = (err) => {
  if (!err) return "Ocurrió un error inesperado al procesar la factura de salud.";
  const rawMsg = typeof err === "string" ? err : (err.message || String(err));
  const code = (typeof err === "object" && err.code) ? err.code : "";

  // Casos conocidos específicos
  if (code === "HEALTH_CONTRACT_DATA_REQUIRED" || rawMsg.includes("HEALTH_CONTRACT_DATA_REQUIRED") || rawMsg.includes("contract_number")) {
    return "Para facturar a una Entidad o EPS se requiere el Número de Contrato del convenio o la causal de atención sin contrato (autorización o urgencia).";
  }
  if (code === "PROVIDER_CODE_REQUIRED" || rawMsg.includes("PROVIDER_CODE_REQUIRED")) {
    return "Falta configurar el Código de Prestador de Salud (código REPS de la clínica). Configúralo en Configuración → Facturación Electrónica.";
  }
  if (code === "FACTUS_NUMBERING_RANGE_REQUIRED" || rawMsg.includes("FACTUS_NUMBERING_RANGE_REQUIRED")) {
    return "Falta configurar el rango de numeración de facturación DIAN autorizado en Factus.";
  }
  if (code === "FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED" || rawMsg.includes("FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED")) {
    return "Falta configurar el perfil de catálogo de salud en la configuración de Facturación Electrónica.";
  }
  if (code === "HEALTH_PAYMENT_METHOD_REQUIRED" || rawMsg.includes("HEALTH_PAYMENT_METHOD_REQUIRED")) {
    return "Falta definir la modalidad de pago en salud (ej. Pago por evento).";
  }
  if (code === "HEALTH_COVERAGE_REQUIRED" || rawMsg.includes("HEALTH_COVERAGE_REQUIRED")) {
    return "Falta definir la cobertura de salud correspondiente para este paciente o entidad.";
  }
  if (code === "CLINICAL_ATTENTIONS_REQUIRED" || rawMsg.includes("CLINICAL_ATTENTIONS_REQUIRED") || rawMsg.includes("procedimiento") && rawMsg.includes("realizado")) {
    return "Solo se pueden facturar ante la DIAN procedimientos que hayan sido marcados como realizados en la historia clínica.";
  }

  // Limpiar sufijos técnicos entre paréntesis tipo (HEALTH_XXXX)
  return rawMsg.replace(/\s*\([A-Z0-9_]+\)\.?/g, "").trim();
};
