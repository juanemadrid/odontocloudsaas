/**
 * ripsProviderProfileService.js
 * 
 * Reconciliación Normativa 2026:
 * Perfil de Cumplimiento Tributario y Modalidades RIPS:
 * - OFFICIAL_FEV: Facturador electrónico en salud (IPS o Profesional con obligación FEV).
 * - OFFICIAL_RIPS_WITHOUT_FEV: Profesional independiente legalmente no obligado a facturar (< 3.500 UVT u otros requisitos DIAN).
 * - LOCAL_PREVIEW: Recibos de caja o pagos locales preliminares (No aptos para MUV).
 * 
 * Marco normativo: Res. 0948 de 2026 / Res. 2275 de 2023 / Documento Técnico 1 MinSalud / Estatuto Tributario Art. 616-2.
 */

export const PROVIDER_TYPES = {
  IPS: "IPS",
  PROFESIONAL_INDEPENDIENTE: "PROFESIONAL_INDEPENDIENTE",
  EOSD: "EOSD", // Entidad con Objeto Social Diferente
  OTRO: "OTRO",
  UNCONFIRMED: "UNCONFIRMED",
};

export const BILLING_OBLIGATIONS = {
  ELECTRONIC_INVOICE_REQUIRED: "ELECTRONIC_INVOICE_REQUIRED",
  NOT_REQUIRED: "NOT_REQUIRED",
  VOLUNTARY: "VOLUNTARY",
  UNCONFIRMED: "UNCONFIRMED",
};

export const RIPS_MODES = {
  OFFICIAL_FEV: "OFFICIAL_FEV",
  OFFICIAL_RIPS_WITHOUT_FEV: "OFFICIAL_RIPS_WITHOUT_FEV",
  LOCAL_PREVIEW: "LOCAL_PREVIEW",
};

export const RIPS_RESPONSIBILITY = {
  INSTITUTION: "INSTITUTION",
  PROFESSIONAL: "PROFESSIONAL",
  UNCONFIRMED: "UNCONFIRMED",
};

export const PROVIDER_CODE_MODES = {
  UNIQUE: "UNIQUE",
  BY_BRANCH: "BY_BRANCH",
};

export const UVT_REFERENCE_NOTICE = 
  "Referencia normativa: El umbral de 3.500 UVT es uno de los criterios del Estatuto Tributario, pero no el único. La determinación de la obligación tributaria debe ser configurada y confirmada administrativamente por el prestador según su situación fiscal.";

/**
 * Resuelve el perfil tributario y normativo del prestador.
 * 
 * @param {object} tenantData - Registro de la tabla 'tenants'
 * @param {object} configData - Configuración de 'website_config' (empresa_datos / providerProfile)
 * @returns {object} Perfil normalizado
 */
export function resolveProviderProfile(tenantData = {}, configData = {}) {
  const profileCfg = configData.providerProfile || configData.perfil_tributario || configData.empresa_datos || {};

  // 1. Tipo de prestador
  let providerType = PROVIDER_TYPES.UNCONFIRMED;
  if (profileCfg.providerType && Object.values(PROVIDER_TYPES).includes(profileCfg.providerType)) {
    providerType = profileCfg.providerType;
  } else if (tenantData.tipoPrestador && Object.values(PROVIDER_TYPES).includes(tenantData.tipoPrestador)) {
    providerType = tenantData.tipoPrestador;
  } else if (profileCfg.esIps === true || tenantData.esIps === true) {
    providerType = PROVIDER_TYPES.IPS;
  } else if (profileCfg.esIps === false || tenantData.esIps === false) {
    providerType = PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE;
  } else {
    providerType = PROVIDER_TYPES.UNCONFIRMED;
  }

  // 2. Obligación de facturación
  let billingObligation = BILLING_OBLIGATIONS.UNCONFIRMED;
  if (profileCfg.billingObligation && Object.values(BILLING_OBLIGATIONS).includes(profileCfg.billingObligation)) {
    billingObligation = profileCfg.billingObligation;
  } else if (tenantData.billingObligation && Object.values(BILLING_OBLIGATIONS).includes(tenantData.billingObligation)) {
    billingObligation = tenantData.billingObligation;
  } else if (providerType === PROVIDER_TYPES.IPS && (profileCfg.esIps === true || tenantData.esIps === true)) {
    billingObligation = BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED;
  } else {
    billingObligation = BILLING_OBLIGATIONS.UNCONFIRMED;
  }

  const administrativeConfirmation = Boolean(
    profileCfg.administrativeConfirmation ?? tenantData.administrativeConfirmation ?? false
  );

  return {
    providerType,
    billingObligation,
    administrativeConfirmation,
    uvtReferenceNotice: UVT_REFERENCE_NOTICE,
  };
}

/**
 * Determina si en la configuración del Doctor se debe mostrar u ocultar la opción "¿Genera RIPS?".
 * Si la organización es IPS, la responsabilidad recae en la institución clínica y los doctores no eligen individualmente.
 * 
 * @param {string} providerType - PROVIDER_TYPES
 * @param {object} doctor - Objeto de usuario doctor
 * @returns {boolean}
 */
export function shouldDoctorShowGeneraRips(providerTypeOrTenant, doctor = {}) {
  const pType = typeof providerTypeOrTenant === "string"
    ? providerTypeOrTenant
    : (providerTypeOrTenant?.providerType || (providerTypeOrTenant?.esIps ? PROVIDER_TYPES.IPS : null));

  if (pType === PROVIDER_TYPES.IPS) {
    return false;
  }
  if (!doctor || Object.keys(doctor).length === 0) {
    return true;
  }
  if (doctor.rol && doctor.rol !== "Doctor" && !doctor.esDoctor) {
    return false;
  }
  return true;
}

/**
 * Evalúa si el prestador es elegible legalmente para emitir RIPS SIN FACTURA.
 * 
 * REGLAS NORMATIVAS ESTRICTAS:
 * 1. Una IPS NUNCA puede emitir RIPS sin factura (Art. 616-1 E.T. y Res. MinSalud).
 * 2. Si billingObligation es UNCONFIRMED, se bloquea la emisión oficial.
 * 3. Si billingObligation es ELECTRONIC_INVOICE_REQUIRED, se exige FEV oficial.
 * 4. Requiere providerType = PROFESIONAL_INDEPENDIENTE (o EOSD) + billingObligation = NOT_REQUIRED + confirmación expresa.
 * 
 * @param {object} profile - Perfil retornado por resolveProviderProfile
 * @returns {{ eligible: boolean, reason?: string, errorCode?: string }}
 */
export function validateRipsWithoutFevEligibility(profile) {
  if (!profile) {
    return {
      eligible: false,
      errorCode: "PROFILE_REQUIRED",
      reason: "No se proporcionó un perfil normativo del prestador.",
    };
  }

  if (profile.providerType === PROVIDER_TYPES.IPS) {
    return {
      eligible: false,
      errorCode: "IPS_CANNOT_USE_RIPS_WITHOUT_FEV",
      reason: "Las Instituciones Prestadoras de Salud (IPS) están obligadas por ley a facturar electrónicamente y no pueden emitir RIPS sin factura.",
    };
  }

  if (profile.billingObligation === BILLING_OBLIGATIONS.UNCONFIRMED) {
    return {
      eligible: false,
      errorCode: "BILLING_OBLIGATION_UNCONFIRMED",
      reason: "La obligación tributaria del prestador no ha sido confirmada administrativamente.",
    };
  }

  if (profile.billingObligation === BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED) {
    return {
      eligible: false,
      errorCode: "OFFICIAL_FEV_REQUIRED",
      reason: "El prestador está configurado como obligado a emitir Factura Electrónica de Venta (FEV).",
    };
  }

  if (
    profile.providerType !== PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE &&
    profile.providerType !== PROVIDER_TYPES.EOSD
  ) {
    return {
      eligible: false,
      errorCode: "INVALID_PROVIDER_TYPE_FOR_RIPS_WITHOUT_FEV",
      reason: "Solo Profesionales Independientes o Entidades con Objeto Social Diferente legalmente no obligadas pueden emitir RIPS sin factura.",
    };
  }

  if (profile.billingObligation !== BILLING_OBLIGATIONS.NOT_REQUIRED) {
    return {
      eligible: false,
      errorCode: "BILLING_OBLIGATION_MUST_BE_NOT_REQUIRED",
      reason: "Para habilitar RIPS sin factura, la obligación debe ser expresamente 'NOT_REQUIRED'.",
    };
  }

  if (!profile.administrativeConfirmation) {
    return {
      eligible: false,
      errorCode: "ADMINISTRATIVE_CONFIRMATION_REQUIRED",
      reason: "Se requiere confirmación administrativa expresa de la situación tributaria del profesional.",
    };
  }

  return { eligible: true };
}

/**
 * Valida si el tipo de pagador permite RIPS sin factura.
 * Las atenciones a EPS / ERP (Entidades Responsables de Pago) siempre exigen FEV oficial.
 * 
 * @param {string|null} pagadorType - 'PARTICULAR' | 'ERP' | 'EPS' | 'CONVENIO' | null
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function validatePayerForRipsWithoutFev(pagadorType) {
  const norm = String(pagadorType || "").trim().toUpperCase();
  if (norm === "ERP" || norm === "EPS" || norm === "CONVENIO" || norm.includes("EPS") || norm.includes("COMPENSAR") || norm.includes("SURA") || norm.includes("NUEVA EPS") || norm.includes("SALUD TOTAL")) {
    return {
      allowed: false,
      reason: "PAYER_REQUIRES_FEV: Las atenciones con Entidades Responsables de Pago (EPS/Convenios) exigen obligatoriamente Factura Electrónica en Salud (FEV). RIPS sin factura solo aplica a pagos particulares directos.",
    };
  }
  return { allowed: true };
}

/**
 * Centraliza la resolución del contexto del prestador responsable del RIPS.
 *
 * @param {object} params
 * @param {object} [params.tenant] - Datos del inquilino (tenants / empresa_datos)
 * @param {string|object} [params.branch] - ID de sucursal u objeto sucursal
 * @param {object} [params.professional] - Objeto del profesional / doctor ejecutor
 * @param {object} [params.billingDocument] - Documento de cobro (factura, pago, recibo)
 * @param {object} [params.configData] - Configuración de website_config (empresa_datos / sispro)
 * @param {object} [params.sisproConfig] - Configuración segura SISPRO (hasPassword, etc.)
 * @returns {object} Contexto resuelto del prestador responsable
 */
export function resolveRipsProviderContext({
  tenant = {},
  branch = null,
  professional = null,
  billingDocument = null,
  configData = {},
  sisproConfig = {},
} = {}) {
  const profile = resolveProviderProfile(tenant, configData);
  const providerType = profile.providerType;
  const billingObligation = profile.billingObligation;
  const administrativeConfirmation = profile.administrativeConfirmation;

  const branchId = typeof branch === "string" ? branch : (branch?.id || branch?.sucursalId || billingDocument?.sucursal_id || null);

  let ripsResponsibility = RIPS_RESPONSIBILITY.UNCONFIRMED;
  let obligatedDocument = null;
  let providerCode = null;
  let professionalId = null;
  let sisproIdentityType = null;
  let sisproConfigured = false;
  let providerCodeMode = PROVIDER_CODE_MODES.UNIQUE;
  let error = null;
  let valid = true;

  if (providerType === PROVIDER_TYPES.IPS) {
    ripsResponsibility = RIPS_RESPONSIBILITY.INSTITUTION;
    obligatedDocument = String(tenant.nit || configData.nit || configData.empresa_datos?.nit || "").trim().replace(/[^0-9]/g, "");
    sisproIdentityType = "INSTITUTIONAL";
    sisproConfigured = Boolean(
      sisproConfig?.hasPassword ||
      sisproConfig?.configured ||
      tenant.sisproConfigured ||
      configData.empresa_datos?.sisproConfigured ||
      configData.empresa_datos?.sisproPassword
    );

    const cfgEmpresa = configData.empresa_datos || configData;
    providerCodeMode = (cfgEmpresa.providerCodeMode === PROVIDER_CODE_MODES.BY_BRANCH || cfgEmpresa.providerCodeMode === "BY_BRANCH" || cfgEmpresa.providerCodeMode === "sucursal")
      ? PROVIDER_CODE_MODES.BY_BRANCH
      : PROVIDER_CODE_MODES.UNIQUE;

    if (providerCodeMode === PROVIDER_CODE_MODES.BY_BRANCH) {
      const branchMap = cfgEmpresa.providerCodesByBranch || cfgEmpresa.ripsSucursales || {};
      const branchCodeEntry = branchId ? (branchMap[branchId]?.codigo || branchMap[branchId] || (typeof branch === "object" ? branch.codigoPrestador : null)) : null;
      if (!branchCodeEntry || String(branchCodeEntry).trim() === "") {
        error = "RIPS_PROVIDER_CODE_MISSING_FOR_BRANCH";
        valid = false;
        providerCode = null;
      } else {
        providerCode = String(branchCodeEntry).trim();
      }
    } else {
      const uCode = cfgEmpresa.codigoPrestador || tenant.codigoPrestador || "";
      if (!uCode || String(uCode).trim() === "") {
        error = "RIPS_PROVIDER_CODE_MISSING";
        valid = false;
        providerCode = null;
      } else {
        providerCode = String(uCode).trim();
      }
    }
  } else if (providerType === PROVIDER_TYPES.PROFESIONAL_INDEPENDIENTE) {
    if (professional && professional.generaRips === true) {
      ripsResponsibility = RIPS_RESPONSIBILITY.PROFESSIONAL;
      obligatedDocument = String(
        professional.numeroDocumento || professional.numDocumentoIdentificacion || professional.nit || ""
      ).trim().replace(/[^0-9A-Za-z]/g, "");
      professionalId = professional.id || professional.uid || null;
      sisproIdentityType = "PIN_PROFESSIONAL";
      sisproConfigured = Boolean(professional.sisproConfigured || professional.hasSisproPassword);

      providerCodeMode = (professional.ripsTipoPrestador === "sucursal" || professional.providerCodeMode === PROVIDER_CODE_MODES.BY_BRANCH)
        ? PROVIDER_CODE_MODES.BY_BRANCH
        : PROVIDER_CODE_MODES.UNIQUE;

      if (providerCodeMode === PROVIDER_CODE_MODES.BY_BRANCH) {
        const branchMap = professional.ripsSucursales || professional.providerCodesByBranch || {};
        const branchCodeEntry = branchId ? (branchMap[branchId]?.codigo || branchMap[branchId]) : null;
        if (!branchCodeEntry || String(branchCodeEntry).trim() === "") {
          error = "RIPS_PROVIDER_CODE_MISSING_FOR_BRANCH";
          valid = false;
          providerCode = null;
        } else {
          providerCode = String(branchCodeEntry).trim();
        }
      } else {
        const uCode = professional.ripsCodigoUnico || professional.providerCode || professional.codigoPrestador || "";
        if (!uCode || String(uCode).trim() === "") {
          error = "RIPS_PROVIDER_CODE_MISSING";
          valid = false;
          providerCode = null;
        } else {
          providerCode = String(uCode).trim();
        }
      }
    } else if (professional && professional.generaRips === false) {
      ripsResponsibility = RIPS_RESPONSIBILITY.UNCONFIRMED;
      providerCode = null;
      sisproIdentityType = null;
      sisproConfigured = false;
      valid = false;
      error = "PROFESSIONAL_GENERA_RIPS_DISABLED";
    } else {
      // Macro-nivel de organización profesional independiente (sin doctor específico en el filtro)
      ripsResponsibility = RIPS_RESPONSIBILITY.PROFESSIONAL;
      obligatedDocument = String(tenant.nit || configData.nit || configData.empresa_datos?.nit || "").trim().replace(/[^0-9]/g, "");
      sisproIdentityType = "PIN_PROFESSIONAL";
      sisproConfigured = Boolean(
        sisproConfig?.hasPassword ||
        sisproConfig?.configured ||
        tenant.sisproConfigured ||
        configData.empresa_datos?.sisproConfigured
      );

      const cfgEmpresa = configData.empresa_datos || configData;
      providerCodeMode = (cfgEmpresa.providerCodeMode === PROVIDER_CODE_MODES.BY_BRANCH || cfgEmpresa.providerCodeMode === "BY_BRANCH")
        ? PROVIDER_CODE_MODES.BY_BRANCH
        : PROVIDER_CODE_MODES.UNIQUE;

      if (providerCodeMode === PROVIDER_CODE_MODES.BY_BRANCH) {
        const branchMap = cfgEmpresa.providerCodesByBranch || cfgEmpresa.ripsSucursales || {};
        const branchCodeEntry = branchId ? (branchMap[branchId]?.codigo || branchMap[branchId]) : null;
        if (!branchCodeEntry || String(branchCodeEntry).trim() === "") {
          error = "RIPS_PROVIDER_CODE_MISSING_FOR_BRANCH";
          valid = false;
          providerCode = null;
        } else {
          providerCode = String(branchCodeEntry).trim();
        }
      } else {
        const uCode = cfgEmpresa.codigoPrestador || tenant.codigoPrestador || "";
        if (!uCode || String(uCode).trim() === "") {
          error = "RIPS_PROVIDER_CODE_MISSING";
          valid = false;
          providerCode = null;
        } else {
          providerCode = String(uCode).trim();
        }
      }
    }
  } else {
    ripsResponsibility = RIPS_RESPONSIBILITY.UNCONFIRMED;
    providerCode = null;
  }

  // Resolución de ripsMode:
  let ripsMode = RIPS_MODES.LOCAL_PREVIEW;

  if (providerType === PROVIDER_TYPES.UNCONFIRMED || billingObligation === BILLING_OBLIGATIONS.UNCONFIRMED) {
    ripsMode = RIPS_MODES.LOCAL_PREVIEW;
  } else if (billingObligation === BILLING_OBLIGATIONS.ELECTRONIC_INVOICE_REQUIRED) {
    const isLocalDoc = Boolean(
      billingDocument?.isWithoutFev === true ||
      billingDocument?.sourceMode === RIPS_MODES.LOCAL_PREVIEW ||
      billingDocument?.isReceipt === true ||
      billingDocument?.receiptNumber ||
      billingDocument?.sourceTable === "pagos" ||
      billingDocument?.sourceTable === "recibos_caja"
    );
    ripsMode = isLocalDoc ? RIPS_MODES.LOCAL_PREVIEW : RIPS_MODES.OFFICIAL_FEV;
  } else if (billingObligation === BILLING_OBLIGATIONS.NOT_REQUIRED) {
    const eligibility = validateRipsWithoutFevEligibility(profile);
    if (eligibility.eligible && ripsResponsibility === RIPS_RESPONSIBILITY.PROFESSIONAL) {
      ripsMode = RIPS_MODES.OFFICIAL_RIPS_WITHOUT_FEV;
    } else {
      ripsMode = RIPS_MODES.LOCAL_PREVIEW;
    }
  } else {
    ripsMode = RIPS_MODES.LOCAL_PREVIEW;
  }

  // Retorno normalizado y seguro (NUNCA exponer credenciales o contraseñas en el objeto)
  return {
    providerType,
    ripsResponsibility,
    obligatedDocument,
    providerCode,
    providerCodeMode,
    branchId,
    professionalId,
    sisproIdentityType,
    sisproConfigured,
    billingObligation,
    ripsMode,
    administrativeConfirmation,
    valid,
    error,
    uvtReferenceNotice: UVT_REFERENCE_NOTICE,
  };
}

export default {
  PROVIDER_TYPES,
  BILLING_OBLIGATIONS,
  RIPS_MODES,
  RIPS_RESPONSIBILITY,
  PROVIDER_CODE_MODES,
  UVT_REFERENCE_NOTICE,
  resolveProviderProfile,
  shouldDoctorShowGeneraRips,
  validateRipsWithoutFevEligibility,
  validatePayerForRipsWithoutFev,
  resolveRipsProviderContext,
};
