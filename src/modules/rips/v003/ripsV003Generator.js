import { isFevRips0948Enabled } from "./ripsFeatureFlagService.js";
import { validateCatalogValue, getCupsClassification } from "./ripsV003Catalogs.js";
import { isServiceHabilitadoEnSede } from "./ripsV003RepsService.js";
import { validateRipsV003 } from "./ripsV003Validator.js";

/**
 * NUEVO GENERADOR RIPS V003 (Documento Técnico 1 Versión 003 – 15 de julio de 2026)
 * Marco normativo: Resolución 948 de 2026 / MinSalud / SISPRO.
 */

function cleanOptionalString(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  return str === "" ? null : str;
}

/**
 * Normaliza y valida estrictamente el valor de incapacidad según la tabla oficial LstSiNo (01=SI, 02=NO).
 * Diferencia claramente afirmativo (01), negativo (02) y valores inválidos/inexistentes (Lanza Error).
 * No asume '02' sobre valores desconocidos ni inventa datos clínicos.
 */
export function normalizeIncapacidad(val) {
  if (val === undefined || val === null) {
    throw new Error(
      "El valor de incapacidad es obligatorio y no puede ser nulo ni omitido. Debe indicar explícitamente '01' (SI) o '02' (NO)."
    );
  }

  if (typeof val === "boolean") {
    return val ? "01" : "02";
  }

  if (typeof val === "number") {
    if (val === 1) return "01";
    if (val === 2 || val === 0) return "02";
    throw new Error(`Valor numérico de incapacidad '${val}' inválido. Use 1 para SI, o 2 / 0 para NO.`);
  }

  const str = String(val).trim().toUpperCase();
  if (str === "") {
    throw new Error("El valor de incapacidad no puede estar vacío. Debe indicar explícitamente '01' (SI) o '02' (NO).");
  }

  const afirmativos = new Set(["01", "1", "SI", "SÍ", "S", "TRUE"]);
  if (afirmativos.has(str)) return "01";

  const negativos = new Set(["02", "2", "NO", "N", "FALSE"]);
  if (negativos.has(str)) return "02";

  throw new Error(
    `Valor de incapacidad '${val}' es inválido o no reconocido. Solo se admiten valores afirmativos ('01', 'SI', true) o negativos ('02', 'NO', false) según la tabla oficial LstSiNo de SISPRO.`
  );
}

/**
 * Genera la estructura JSON de RIPS v003 para atenciones clínicas con validaciones estrictas.
 * 
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.sucursalId
 * @param {object} params.prestadorConfig
 * @param {object} params.facturaInfo
 * @param {Array<object>} params.atenciones
 * @param {object} [params.options]
 * @returns {Promise<{ success: boolean, ripsJson: object, validation: object }>}
 */
export async function generateRipsV003({
  tenantId,
  sucursalId,
  prestadorConfig,
  facturaInfo,
  atenciones = [],
  options = {},
}) {
  if (!tenantId) throw new Error("tenantId es obligatorio.");

  // 1. Verificación de Feature Flag por Tenant
  if (!options.skipFlagCheck) {
    const isEnabled = await isFevRips0948Enabled(tenantId);
    if (!isEnabled) {
      throw new Error(
        `El módulo FEV-RIPS v003 (Res. 948 de 2026) no está habilitado para la clínica con tenant_id: ${tenantId}. Debe activarse administrativamente.`
      );
    }
  }

  if (!prestadorConfig?.nit) {
    throw new Error("El NIT del prestador obligado es obligatorio.");
  }
  if (!prestadorConfig?.codPrestador || String(prestadorConfig.codPrestador).trim().length < 10) {
    throw new Error("El Código REPS de Habilitación del prestador es obligatorio (10 o 12 dígitos) y no puede estar vacío.");
  }
  if (!facturaInfo?.numFactura) {
    throw new Error("El número de factura (numFactura) es obligatorio.");
  }
  if (!Array.isArray(atenciones) || atenciones.length === 0) {
    throw new Error("Debe suministrar al menos una atención clínica estructurada.");
  }

  const codPrestadorGeneral = String(prestadorConfig.codPrestador).trim();

  // 2. Agrupar atenciones por paciente / usuario
  const usuariosMap = new Map();
  let userCounter = 1;

  for (const atencion of atenciones) {
    const pac = atencion.paciente;
    if (!pac) throw new Error("Cada atención debe incluir el objeto 'paciente'.");

    const pacIdKey = `${pac.tipoDocumentoIdentificacion || "CC"}_${pac.numDocumentoIdentificacion}`;

    if (!usuariosMap.has(pacIdKey)) {
      // Validar tipo de usuario contra RIPSTipoUsuarioVersion2 (01-14)
      const tipoUsuario = String(pac.tipoUsuario || "12").padStart(2, "0");
      const tipoUsuarioVal = await validateCatalogValue("RIPSTipoUsuarioVersion2", tipoUsuario);
      if (!tipoUsuarioVal.valid) {
        throw new Error(
          `tipoUsuario '${tipoUsuario}' es inválido. Debe pertenecer a RIPSTipoUsuarioVersion2 oficial (01 a 14).`
        );
      }

      // Validar incapacidad contra LstSiNo (01 / 02)
      const incCode = normalizeIncapacidad(pac.incapacidad);
      const incVal = await validateCatalogValue("LstSiNo", incCode);
      if (!incVal.valid) {
        throw new Error(`incapacidad '${incCode}' es inválido contra catálogo LstSiNo oficial.`);
      }

      usuariosMap.set(pacIdKey, {
        tipoDocumentoIdentificacion: String(pac.tipoDocumentoIdentificacion || "CC").trim().toUpperCase(),
        numDocumentoIdentificacion: String(pac.numDocumentoIdentificacion || "").trim(),
        tipoUsuario,
        fechaNacimiento: String(pac.fechaNacimiento || "2000-01-01").trim(),
        codSexo: String(pac.codSexo || "M").trim().toUpperCase(),
        codPaisResidencia: String(pac.codPaisResidencia || "170").trim(),
        codMunicipioResidencia: String(pac.codMunicipioResidencia || "70001").trim(),
        codZonaTerritorialResidencia: String(pac.codZonaTerritorialResidencia || "01").trim(),
        incapacidad: incCode, // "01" (SI) o "02" (NO)
        codPaisOrigen: String(pac.codPaisOrigen || "170").trim(),
        consecutivo: userCounter++,
        registroSIRAS: cleanOptionalString(pac.registroSIRAS),
        servicios: {
          consultas: [],
          procedimientos: [],
          urgencias: [],
          hospitalizacion: [],
          recienNacidos: [],
          medicamentos: [],
          otrosServicios: [],
        },
      });
    }

    const usuarioObj = usuariosMap.get(pacIdKey);

    // 3. VALIDACIÓN CUPS EXPLÍCITO Y OFICIAL (Cero inferencia por texto, catálogo como fuente de verdad)
    if (!atencion.cupsCode || typeof atencion.cupsCode !== "string" || atencion.cupsCode.trim().length !== 6) {
      throw new Error(
        `Procedimiento/consulta sin código CUPS válido: '${atencion.cupsCode}'. Está prohibido inferir CUPS por texto. Debe seleccionarse explícitamente.`
      );
    }
    const explicitCups = atencion.cupsCode.trim().toUpperCase();

    const cupsInfo = await getCupsClassification(explicitCups);
    if (!cupsInfo.exists) {
      throw new Error(`El código CUPS '${explicitCups}' no existe en el catálogo oficial vigente.`);
    }
    if (!cupsInfo.active) {
      throw new Error(
        `El código CUPS '${explicitCups}' (${cupsInfo.descripcionOficial}) está inactivo o no vigente en el catálogo oficial (${cupsInfo.versionCatalogo}).`
      );
    }

    // Regla de Fuente de Verdad: La descripción oficial inmutable proviene del catálogo
    const descripcionOficialCups = cupsInfo.descripcionOficial;
    if (atencion.cupsDescripcion && atencion.cupsDescripcion.trim().toUpperCase() !== descripcionOficialCups.toUpperCase()) {
      console.warn(`[CUPS] Descripción manual ignorada. Se toma la oficial del catálogo: '${descripcionOficialCups}'`);
    }

    // 4. VALIDACIÓN REPS HABILITADO EN SEDE (Cero inferencia por texto)
    if (!atencion.codServicio) {
      throw new Error("codServicio REPS es obligatorio y no puede inferirse por descripción.");
    }
    const codServicioNum = Number(atencion.codServicio);
    if (isNaN(codServicioNum) || codServicioNum <= 0) {
      throw new Error(`codServicio '${atencion.codServicio}' debe ser un número entero válido.`);
    }

    if (!options.skipRepsCheck) {
      const isHabilitado = await isServiceHabilitadoEnSede(tenantId, sucursalId, codServicioNum);
      if (!isHabilitado) {
        throw new Error(
          `El servicio REPS '${codServicioNum}' NO está habilitado para la sede seleccionada (${sucursalId}).`
        );
      }
    }

    // 5. VALIDACIÓN DIAGNÓSTICO CIE-10 (Obligatorio)
    const codDxPrincipal = cleanOptionalString(atencion.codDiagnosticoPrincipal);
    if (!codDxPrincipal) {
      throw new Error("El diagnóstico principal (CIE-10) es obligatorio.");
    }

    // 6. VALIDACIÓN PRESTADOR / PROFESIONAL
    const codPrestadorAtencion = cleanOptionalString(atencion.codPrestador) || codPrestadorGeneral;
    if (!codPrestadorAtencion || codPrestadorAtencion.length < 10) {
      throw new Error("Falta la identificación del prestador/profesional que atendió la consulta o procedimiento.");
    }

    const fechaInicioAtencion = atencion.fechaInicioAtencion || new Date().toISOString().slice(0, 16).replace("T", " ");

    // Tratamiento de CIE-11: Sin mapper artificial.
    // Si viene informado desde catálogo, se registra; si no, permanece null según Documento Técnico 1 v003.
    const codCie11 = cleanOptionalString(atencion.codDiagnosticoPrincipalCIE11);
    const nomCie11 = cleanOptionalString(atencion.nomCodDiagnosticoPrincipalCIE11);

    if (atencion.tipoAtencion === "consulta") {
      // REGLA: Bloquear CUPS de procedimiento en consultas según catálogo oficial
      if (!cupsInfo.correspondeBloqueConsultas) {
        throw new Error(
          `El código CUPS '${explicitCups}' (${descripcionOficialCups}) está clasificado oficialmente como '${cupsInfo.tipoRips}' y no puede reportarse en el bloque de consultas.`
        );
      }

      const consecutivoConsulta = usuarioObj.servicios.consultas.length + 1;
      usuarioObj.servicios.consultas.push({
        codPrestador: codPrestadorAtencion,
        fechaInicioAtencion,
        numAutorizacion: cleanOptionalString(atencion.numAutorizacion),
        codConsulta: explicitCups,
        modalidadGrupoServicioTecSal: String(atencion.modalidad || "01").padStart(2, "0"),
        grupoServicios: String(atencion.grupoServicios || "01").padStart(2, "0"),
        codServicio: codServicioNum,
        finalidadTecnologiaSalud: String(atencion.finalidad || "10").padStart(2, "0"),
        causaMotivoAtencion: String(atencion.causaMotivoAtencion || "38").padStart(2, "0"),
        codDiagnosticoPrincipal: codDxPrincipal,
        codDiagnosticoPrincipalCIE11: codCie11,
        nomCodDiagnosticoPrincipalCIE11: nomCie11,
        codDiagnosticoRelacionado1: cleanOptionalString(atencion.codDiagnosticoRelacionado1),
        codDiagnosticoRelacionado1CIE11: cleanOptionalString(atencion.codDiagnosticoRelacionado1CIE11),
        nomCodDiagnosticoRelacionado1CIE11: cleanOptionalString(atencion.nomCodDiagnosticoRelacionado1CIE11),
        codDiagnosticoRelacionado2: cleanOptionalString(atencion.codDiagnosticoRelacionado2),
        codDiagnosticoRelacionado2CIE11: cleanOptionalString(atencion.codDiagnosticoRelacionado2CIE11),
        nomCodDiagnosticoRelacionado2CIE11: cleanOptionalString(atencion.nomCodDiagnosticoRelacionado2CIE11),
        codDiagnosticoRelacionado3: cleanOptionalString(atencion.codDiagnosticoRelacionado3),
        codDiagnosticoRelacionado3CIE11: cleanOptionalString(atencion.codDiagnosticoRelacionado3CIE11),
        nomCodDiagnosticoRelacionado3CIE11: cleanOptionalString(atencion.nomCodDiagnosticoRelacionado3CIE11),
        tipoDiagnosticoPrincipal: String(atencion.tipoDiagnosticoPrincipal || "01").padStart(2, "0"),
        tipoDocumentoIdentificacion: usuarioObj.tipoDocumentoIdentificacion,
        numDocumentoIdentificacion: usuarioObj.numDocumentoIdentificacion,
        vrServicio: Number(atencion.vrServicio || 0),
        conceptoRecaudo: String(atencion.conceptoRecaudo || "05").padStart(2, "0"),
        valorPagoModerador: Number(atencion.valorPagoModerador || 0),
        numFEVPagoModerador: cleanOptionalString(atencion.numFEVPagoModerador),
        codigoVIDA: cleanOptionalString(atencion.codigoVIDA),
        consecutivo: consecutivoConsulta,
      });
    } else {
      // Procedimiento
      // REGLA: Bloquear CUPS de consulta en procedimientos según catálogo oficial
      if (!cupsInfo.correspondeBloqueProcedimientos) {
        throw new Error(
          `El código CUPS '${explicitCups}' (${descripcionOficialCups}) está clasificado oficialmente como '${cupsInfo.tipoRips}' y no puede reportarse en el bloque de procedimientos.`
        );
      }

      const consecutivoProc = usuarioObj.servicios.procedimientos.length + 1;
      usuarioObj.servicios.procedimientos.push({
        codPrestador: codPrestadorAtencion,
        fechaInicioAtencion,
        idMIPRES: atencion.idMIPRES !== undefined && atencion.idMIPRES !== null ? Number(atencion.idMIPRES) : null,
        numAutorizacion: cleanOptionalString(atencion.numAutorizacion),
        codProcedimiento: explicitCups,
        viaIngresoServicioSalud: String(atencion.viaIngresoServicioSalud || "01").padStart(2, "0"),
        modalidadGrupoServicioTecSal: String(atencion.modalidad || "01").padStart(2, "0"),
        grupoServicios: String(atencion.grupoServicios || "01").padStart(2, "0"),
        codServicio: codServicioNum,
        finalidadTecnologiaSalud: String(atencion.finalidad || "02").padStart(2, "0"),
        causaMotivoAtencion: String(atencion.causaMotivoAtencion || "38").padStart(2, "0"),
        codDiagnosticoPrincipal: codDxPrincipal,
        codDiagnosticoPrincipalCIE11: codCie11,
        nomCodDiagnosticoPrincipalCIE11: nomCie11,
        codDiagnosticoRelacionado: cleanOptionalString(atencion.codDiagnosticoRelacionado),
        codDiagnosticoRelacionadoCIE11: cleanOptionalString(atencion.codDiagnosticoRelacionadoCIE11),
        nomCodDiagnosticoRelacionadoCIE11: cleanOptionalString(atencion.nomCodDiagnosticoRelacionadoCIE11),
        codDiagnosticoComplicacion: cleanOptionalString(atencion.codDiagnosticoComplicacion),
        codDiagnosticoComplicacionCIE11: cleanOptionalString(atencion.codDiagnosticoComplicacionCIE11),
        nomCodDiagnosticoComplicacionCIE11: cleanOptionalString(atencion.nomCodDiagnosticoComplicacionCIE11),
        tipoDocumentoIdentificacion: usuarioObj.tipoDocumentoIdentificacion,
        numDocumentoIdentificacion: usuarioObj.numDocumentoIdentificacion,
        vrServicio: Number(atencion.vrServicio || 0),
        conceptoRecaudo: String(atencion.conceptoRecaudo || "05").padStart(2, "0"),
        valorPagoModerador: Number(atencion.valorPagoModerador || 0),
        numFEVPagoModerador: cleanOptionalString(atencion.numFEVPagoModerador),
        codigoVIDA: cleanOptionalString(atencion.codigoVIDA),
        consecutivo: consecutivoProc,
      });
    }
  }

  // 7. Estructurar Objeto Raíz
  const ripsJson = {
    numDocumentoIdObligado: String(prestadorConfig.nit).trim().replace(/[^0-9]/g, ""),
    numFactura: String(facturaInfo.numFactura).trim(),
    tipoNota: cleanOptionalString(facturaInfo.tipoNota),
    numNota: cleanOptionalString(facturaInfo.numNota),
    usuarios: Array.from(usuariosMap.values()),
  };

  // 8. Validar contra Reglas y Catálogos Oficiales Documento Técnico 1 v003
  const validation = await validateRipsV003(ripsJson);

  // 9. Registro opcional de auditoría en rips_validaciones si el tenant está conectado
  if (options.persistValidation) {
    try {
      const client = globalThis.__supabase || (await import("../../../lib/supabaseClient.js")).default;
      await client.from("rips_validaciones").insert({
        tenant_id: tenantId,
        tipo_documento: "rips_v003_lote",
        documento_id: ripsJson.numFactura,
        esquema_version: "v003",
        estado: validation.isValid ? "valido" : "con_errores",
        errores: validation.errors,
        advertencias: validation.warnings,
        payload_resumen: {
          totalUsuarios: ripsJson.usuarios.length,
          factura: ripsJson.numFactura,
          generadoEn: new Date().toISOString(),
        },
      });
    } catch (saveErr) {
      console.warn("No fue posible guardar trazabilidad en rips_validaciones:", saveErr);
    }
  }

  return {
    success: validation.isValid,
    ripsJson,
    validation,
  };
}

export default {
  generateRipsV003,
  normalizeIncapacidad,
};
