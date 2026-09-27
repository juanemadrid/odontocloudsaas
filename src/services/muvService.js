/**
 * ============================================================================
 * ODONTOCLOUD — MUV CLIENT SERVICE
 * Archivo: src/services/muvService.js
 * Fase: P0-A2B2
 * ============================================================================
 * Conecta el frontend con la Edge Function segura 'muv-proxy'.
 * 
 * REGLAS DE SEGURIDAD ESTRICTAS:
 * - NO envía contraseñas SISPRO desde React.
 * - NO maneja tokens SISPRO/MUV en el cliente.
 * - NO maneja secretos compartidos de infraestructura.
 * - NO maneja credenciales de Factus ni certificados.
 * - NO se conecta directamente a puertos internos.
 * - Las validaciones de idempotencia atómica residen en PostgreSQL.
 * ============================================================================
 */

import supabase from "../lib/supabaseClient.js";

/**
 * Estados visuales normativos para la UI
 */
export const MUV_UI_STATES = {
  DRAFT: "BORRADOR",
  READY: "LISTO PARA ENVIAR",
  VALIDATING: "VALIDANDO MUV",
  ACCEPTED: "ACEPTADO",
  REJECTED: "RECHAZADO",
  ERROR: "ERROR",
};

/**
 * Diccionario de códigos oficiales MUV / MinSalud con explicaciones amigables.
 */
export const MUV_ERROR_CATALOG = {
  RVC001: {
    code: "RVC001",
    titulo: "Discordancia de NIT de emisor",
    explicacion: "El NIT de la factura electrónica no coincide con el NIT del prestador autenticado ante SISPRO/MinSalud.",
    campo: "numDocumentoIdObligado / AccountingSupplierParty",
  },
  RVC011: {
    code: "RVC011",
    titulo: "Código de prestador no habilitado",
    explicacion: "El código de habilitación REPS en la factura no coincide con la sede autorizada en MinSalud.",
    campo: "codPrestador / REPS",
  },
  RVC034: {
    code: "RVC034",
    titulo: "Inconsistencia de modalidad o valores",
    explicacion: "La modalidad de pago no concuerda con el valor del servicio facturado vs RIPS.",
    campo: "modalidadPago / vrServicio",
  },
  RVG06: {
    code: "RVG06",
    titulo: "NIT en RIPS no coincide con prestador",
    explicacion: "El NIT reportado en el JSON de RIPS no coincide con el prestador autenticado.",
    campo: "numDocumentoIdObligado",
  },
  S08: {
    code: "S08",
    titulo: "Estructura de Otros Servicios",
    explicacion: "Error en la especificación de tecnologías o servicios clasificados como Otros Servicios (S08).",
    campo: "servicios.otrosServicios",
  },
  FEV_RIPS_CROSSCHECK_FAILED: {
    code: "FEV_RIPS_CROSSCHECK_FAILED",
    titulo: "Fallo en validación cruzada FEV ↔ RIPS",
    explicacion: "Los datos de la factura electrónica (NIT, CUFE o prestador) no concuerdan con el JSON RIPS.",
    campo: "CrossCheck FEV/RIPS",
  },
  VALIDATION_ALREADY_IN_PROGRESS: {
    code: "VALIDATION_ALREADY_IN_PROGRESS",
    titulo: "Transmisión en curso",
    explicacion: "Este RIPS ya está siendo validado. Espera el resultado.",
    campo: "idempotency_key",
  },
  ALREADY_VALIDATED_WITH_CUV: {
    code: "ALREADY_VALIDATED_WITH_CUV",
    titulo: "Factura ya validada",
    explicacion: "Esta factura ya fue validada formalmente por MinSalud con CUV emitido.",
    campo: "cuv",
  },
  ATTACHED_DOCUMENT_UNAVAILABLE: {
    code: "ATTACHED_DOCUMENT_UNAVAILABLE",
    titulo: "AttachedDocument no disponible",
    explicacion: "No fue posible descargar el contenedor electrónico XML de la factura desde Factus.",
    campo: "Factus API",
  },
  SISPRO_AUTH_FAILED: {
    code: "SISPRO_AUTH_FAILED",
    titulo: "Autenticación SISPRO fallida",
    explicacion: "Las credenciales o el tipo de usuario (PIN/RE) configurados no son válidos para SISPRO.",
    campo: "sispro_config",
  },
  MUV_GATEWAY_UNAVAILABLE: {
    code: "MUV_GATEWAY_UNAVAILABLE",
    titulo: "Gateway MUV fuera de línea",
    explicacion: "El servicio intermediario de validación MUV no respondió o se agotó el tiempo de espera.",
    campo: "muv-gateway",
  },
};

/**
 * Parsea y formatea cualquier error retornado por MUV o el Gateway
 * a una estructura estandarizada para la UI.
 */
export function formatMuvError(rawError) {
  if (!rawError) return null;

  let code = "ERROR_DESCONOCIDO";
  let rawMsg = "";
  let field = null;

  if (typeof rawError === "string") {
    rawMsg = rawError;
    const match = rawError.match(/(RVC\d+|RVG\d+|FEV_RIPS_[A-Z_]+|VALIDATION_[A-Z_]+|ALREADY_[A-Z_]+|S\d+)/i);
    if (match) {
      code = match[1].toUpperCase();
    }
  } else if (typeof rawError === "object") {
    code = String(rawError.codigo || rawError.code || rawError.tipo || "").trim() || "ERROR_MUV";
    rawMsg = String(rawError.descripcion || rawError.mensaje || rawError.message || rawError.error || JSON.stringify(rawError)).trim();
    field = rawError.campo || rawError.path || null;
  }

  const catalogEntry = MUV_ERROR_CATALOG[code] || null;

  return {
    code,
    message: rawMsg,
    friendlyTitle: catalogEntry?.titulo || `Error Normativo ${code}`,
    friendlyDescription: catalogEntry?.explicacion || rawMsg,
    field: field || catalogEntry?.campo || null,
  };
}

/**
 * Envía la factura y el JSON RIPS a validación y transmisión oficial ante el MUV.
 * 
 * Reutiliza estrictamente la Edge Function 'muv-proxy'.
 * En caso de colisión de idempotencia (código PostgreSQL 23505),
 * maneja el estado sin corromper la transacción.
 * 
 * @param {Object} params
 * @param {string} params.facturaId - ID interno o consecutivo de la factura
 * @param {Object} params.ripsJson - JSON normativo estructurado bajo estándar v003
 * @param {string} [params.doctorIdOverride] - ID opcional de profesional para SISPRO PIN
 * @param {string} [params.xmlFevBase64] - Solo si se dispone de XML para testing sin Factus
 * @returns {Promise<Object>} Resultado saneado con estado MUV
 */
export async function transmitFevRips({ facturaId, ripsJson, doctorIdOverride, xmlFevBase64 }) {
  if (!facturaId) {
    throw new Error("El identificador de la factura es obligatorio para transmitir al MUV.");
  }
  if (!ripsJson) {
    throw new Error("El archivo JSON de RIPS es obligatorio.");
  }

  try {
    const { data, error } = await supabase.functions.invoke("muv-proxy", {
      body: {
        facturaId,
        ripsJson,
        doctorIdOverride,
        xmlFevBase64,
      },
    });

    if (error) {
      let errorDetails = null;
      try {
        errorDetails = await error.context?.json();
      } catch {
        // Puede no ser JSON
      }

      const status = error.context?.status || 500;
      const errorCode = errorDetails?.error || errorDetails?.estado || "MUV_COMMUNICATION_ERROR";
      const errorMessage = errorDetails?.message || error.message || "Error al conectar con el servicio MUV.";

      // 1. Manejo explícito de Idempotencia: VALIDATION_ALREADY_IN_PROGRESS
      if (status === 409 || errorCode === "VALIDATION_ALREADY_IN_PROGRESS") {
        return {
          success: false,
          estado: "VALIDATION_ALREADY_IN_PROGRESS",
          isIdempotency: true,
          message: "Este RIPS ya está siendo validado. Espera el resultado.",
          errores: [formatMuvError("VALIDATION_ALREADY_IN_PROGRESS")],
        };
      }

      // 2. Manejo de Rechazo por validación cruzada FEV ↔ RIPS (status 422)
      if (status === 422 || errorCode === "FEV_RIPS_CROSSCHECK_FAILED") {
        const rawErrors = Array.isArray(errorDetails?.errors) ? errorDetails.errors : [errorMessage];
        return {
          success: false,
          estado: "REJECTED",
          isCrosscheck: true,
          message: "La factura electrónica y el RIPS no superaron la validación de identidad cruzada.",
          errores: rawErrors.map(formatMuvError),
          advertencias: [],
        };
      }

      // 3. Error técnico de comunicación / Gateway
      return {
        success: false,
        estado: "ERROR",
        isTechnicalError: true,
        errorCode,
        message: errorMessage,
        errores: [formatMuvError(errorMessage)],
      };
    }

    // Respuesta exitosa del Proxy
    if (data?.estado === "ALREADY_VALIDATED_WITH_CUV") {
      return {
        success: true,
        estado: "ALREADY_VALIDATED_WITH_CUV",
        cuv: data.cuv,
        message: data.message || "Esta factura ya fue validada formalmente por MinSalud con CUV emitido.",
        isAlreadyValidated: true,
      };
    }

    if (data?.success && data?.cuv) {
      return {
        success: true,
        estado: "ACCEPTED",
        cuv: data.cuv,
        fechaRadicacion: data.fechaRadicacion,
        advertencias: data.advertencias || [],
        errores: [],
      };
    }

    if (data?.estado === "REJECTED") {
      const rawErrors = Array.isArray(data.errores) ? data.errores : [];
      return {
        success: false,
        estado: "REJECTED",
        cuv: null,
        fechaRadicacion: null,
        errores: rawErrors.map(formatMuvError),
        advertencias: data.advertencias || [],
      };
    }

    // Estado inesperado pero retornado por el proxy
    return {
      success: false,
      estado: data?.estado || "ERROR",
      isTechnicalError: true,
      message: data?.message || "Respuesta incompleta del validador MUV.",
      errores: (data?.errores || []).map(formatMuvError),
    };

  } catch (clientErr) {
    return {
      success: false,
      estado: "ERROR",
      isTechnicalError: true,
      message: clientErr.message || "Error al emitir solicitud de validación MUV.",
      errores: [formatMuvError(clientErr.message)],
    };
  }
}

/**
 * Consulta el historial de validación MUV registrado para una factura dada.
 * Solo recupera metadatos no sensibles.
 * 
 * @param {string} tenantId - Identificador del inquilino
 * @param {string} facturaId - ID o consecutivo de la factura
 * @returns {Promise<Object|null>} Último registro de validación
 */
export async function getInvoiceMuvValidation(tenantId, facturaId) {
  if (!tenantId || !facturaId) return null;

  try {
    const { data, error } = await supabase
      .from("rips_validaciones")
      .select("id, estado, cuv, errores, advertencias, payload_resumen, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .or(`documento_id.eq.${facturaId},factura_id.eq.${facturaId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    let uiState = MUV_UI_STATES.DRAFT;
    if (data.estado === "VALIDADO" || data.estado === "valido" || data.cuv) {
      uiState = MUV_UI_STATES.ACCEPTED;
    } else if (data.estado === "PENDIENTE") {
      uiState = MUV_UI_STATES.VALIDATING;
    } else if (data.estado === "RECHAZADO" || data.estado === "con_errores") {
      uiState = MUV_UI_STATES.REJECTED;
    } else if (data.estado === "ERROR") {
      uiState = MUV_UI_STATES.ERROR;
    }

    return {
      id: data.id,
      estadoDb: data.estado,
      uiState,
      cuv: data.cuv,
      errores: (data.errores || []).map(formatMuvError),
      advertencias: data.advertencias || [],
      fechaRadicacion: data.payload_resumen?.fechaRadicacion || null,
      updatedAt: data.updated_at || data.created_at,
    };
  } catch (err) {
    console.error("Error al consultar validación MUV de la factura:", err);
    return null;
  }
}

/**
 * Carga el mapa de validaciones MUV para un lote de facturas de un tenant.
 */
export async function loadMuvValidationsMap(tenantId, invoiceIds = []) {
  if (!tenantId || invoiceIds.length === 0) return new Map();

  try {
    const { data, error } = await supabase
      .from("rips_validaciones")
      .select("id, documento_id, factura_id, estado, cuv, errores, advertencias, payload_resumen, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) return new Map();

    const map = new Map();
    // Como ordenamos desc por created_at, la primera vez que vemos un documento_id o factura_id es la más reciente
    for (const row of data) {
      const docKey = row.documento_id;
      const facKey = row.factura_id;

      let uiState = MUV_UI_STATES.DRAFT;
      if (row.estado === "VALIDADO" || row.estado === "valido" || row.cuv) {
        uiState = MUV_UI_STATES.ACCEPTED;
      } else if (row.estado === "PENDIENTE") {
        uiState = MUV_UI_STATES.VALIDATING;
      } else if (row.estado === "RECHAZADO" || row.estado === "con_errores") {
        uiState = MUV_UI_STATES.REJECTED;
      } else if (row.estado === "ERROR") {
        uiState = MUV_UI_STATES.ERROR;
      }

      const record = {
        id: row.id,
        estadoDb: row.estado,
        uiState,
        cuv: row.cuv,
        errores: (row.errores || []).map(formatMuvError),
        advertencias: row.advertencias || [],
        fechaRadicacion: row.payload_resumen?.fechaRadicacion || null,
        updatedAt: row.updated_at || row.created_at,
      };

      if (docKey && !map.has(docKey)) map.set(docKey, record);
      if (facKey && !map.has(facKey)) map.set(facKey, record);
    }

    return map;
  } catch (err) {
    console.error("Error al cargar mapa de validaciones MUV:", err);
    return new Map();
  }
}

/**
 * Transmite una Nota Crédito (Total o Parcial) a validación MUV mediante 'muv-proxy'.
 * 
 * Para NC TOTAL: ripsJson no es requerido (el proxy enviará rips: null al endpoint oficial CargarNCTotal).
 * Para NC PARCIAL: ripsJson es obligatorio (se enviará al endpoint oficial CargarNC).
 */
export async function transmitCreditNoteMuv({
  creditNoteId,
  ripsJson = null,
  doctorIdOverride = null,
  xmlFevBase64 = null,
}) {
  if (!creditNoteId) {
    throw new Error("El creditNoteId es obligatorio para transmitir la Nota Crédito al MUV.");
  }

  try {
    const { data, error } = await supabase.functions.invoke("muv-proxy", {
      body: {
        creditNoteId,
        ripsJson,
        doctorIdOverride,
        xmlFevBase64,
      },
    });

    if (error) {
      let errorDetails = null;
      try {
        errorDetails = await error.context?.json();
      } catch {
        // Puede no ser JSON
      }

      const status = error.context?.status || 500;
      const errorCode = errorDetails?.error || errorDetails?.estado || "MUV_COMMUNICATION_ERROR";
      const errorMessage = errorDetails?.message || error.message || "Error al conectar con el servicio MUV.";

      if (status === 409 || errorCode === "VALIDATION_ALREADY_IN_PROGRESS") {
        return {
          success: false,
          estado: "VALIDATION_ALREADY_IN_PROGRESS",
          isIdempotency: true,
          message: "Esta Nota Crédito ya está siendo validada por MUV. Espera el resultado.",
          errores: [formatMuvError("VALIDATION_ALREADY_IN_PROGRESS")],
        };
      }

      if (status === 422 || errorCode === "NC_RIPS_CROSSCHECK_FAILED") {
        const rawErrors = Array.isArray(errorDetails?.errors) ? errorDetails.errors : [errorMessage];
        return {
          success: false,
          estado: "REJECTED",
          isCrosscheck: true,
          message: "La Nota Crédito y el RIPS no superaron la validación de identidad cruzada.",
          errores: rawErrors.map(formatMuvError),
          advertencias: [],
        };
      }

      return {
        success: false,
        estado: "ERROR",
        isTechnicalError: true,
        errorCode,
        message: errorMessage,
        errores: [formatMuvError(errorMessage)],
      };
    }

    if (data?.estado === "ALREADY_VALIDATED_WITH_CUV") {
      return {
        success: true,
        estado: "ALREADY_VALIDATED_WITH_CUV",
        cuv: data.cuv,
        message: data.message || "Esta Nota Crédito ya fue validada con CUV emitido.",
        isAlreadyValidated: true,
        operation: data.operation,
      };
    }

    if (data?.success) {
      return {
        success: true,
        estado: "ACCEPTED",
        cuv: data.cuv,
        fechaRadicacion: data.fechaRadicacion,
        processId: data.processId,
        operation: data.operation,
        advertencias: data.advertencias || [],
        errores: [],
      };
    }

    if (data?.estado === "REJECTED") {
      const rawErrors = Array.isArray(data.errores) ? data.errores : [];
      return {
        success: false,
        estado: "REJECTED",
        cuv: null,
        fechaRadicacion: null,
        operation: data.operation,
        errores: rawErrors.map(formatMuvError),
        advertencias: data.advertencias || [],
      };
    }

    return {
      success: false,
      estado: data?.estado || "ERROR",
      isTechnicalError: true,
      message: data?.message || "Respuesta incompleta del validador MUV.",
      errores: (data?.errores || []).map(formatMuvError),
    };
  } catch (clientErr) {
    return {
      success: false,
      estado: "ERROR",
      isTechnicalError: true,
      message: clientErr.message || "Error al emitir solicitud de validación MUV para Nota Crédito.",
      errores: [formatMuvError(clientErr.message)],
    };
  }
}

/**
 * Consulta la validación MUV registrada para una Nota Crédito.
 */
export async function getCreditNoteMuvValidation(tenantId, creditNoteId) {
  if (!tenantId || !creditNoteId) return null;

  try {
    const { data: nc } = await supabase
      .from("notas_credito")
      .select("id, numero, detalles, cude, dian_status, tipo_nota_credito")
      .eq("tenant_id", tenantId)
      .eq("id", creditNoteId)
      .maybeSingle();

    if (!nc) return null;

    const detalles = nc.detalles || {};
    let uiState = MUV_UI_STATES.DRAFT;
    if (detalles.muvStatus === "ACCEPTED" || detalles.cuv) {
      uiState = MUV_UI_STATES.ACCEPTED;
    } else if (detalles.muvStatus === "VALIDATING") {
      uiState = MUV_UI_STATES.VALIDATING;
    } else if (detalles.muvStatus === "REJECTED") {
      uiState = MUV_UI_STATES.REJECTED;
    } else if (nc.dian_status === "ACCEPTED" && nc.cude) {
      uiState = MUV_UI_STATES.READY;
    }

    return {
      creditNoteId: nc.id,
      numero: nc.numero,
      tipoNotaCredito: nc.tipo_nota_credito,
      uiState,
      muvStatus: detalles.muvStatus || null,
      cuv: detalles.cuv || null,
      fechaRadicacion: detalles.fechaRadicacionMuv || null,
      cancellationResult:
        detalles.muvStatus === "ACCEPTED" && nc.tipo_nota_credito === "TOTAL"
          ? "Anulación Total Confirmada por MinSalud"
          : null,
    };
  } catch (err) {
    console.error("Error consultando validación MUV de la Nota Crédito:", err);
    return null;
  }
}

