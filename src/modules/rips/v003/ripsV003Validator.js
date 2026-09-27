import { validateCatalogValue, getCupsClassification } from "./ripsV003Catalogs.js";
import { CUPS_DENTAL_CODES } from "../../../data/cupsCodes.js";
import cie10List from "../../../data/cie10.json" with { type: "json" };

/**
 * Validador de RIPS conforme a:
 * - Documento Técnico 1 Versión 003 (15 de julio de 2026)
 * - Resolución 948 de 2026 (SISPRO / MinSalud)
 * 
 * Regla: CERO heurísticas de texto (como startsWith("89")).
 * La clasificación CONSULTA vs PROCEDIMIENTO proviene de los atributos oficiales del catálogo CUPS.
 */

export const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DATETIME_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
export const CUPS_REGEX = /^[A-Z0-9]{6}$/i;
export const CIE10_REGEX = /^[A-Z][0-9]{2}[0-9A-Z]?$/i;

// Set de códigos oficiales CUPS odontológicos
const VALID_DENTAL_CUPS = new Set(CUPS_DENTAL_CODES.map(c => c.code.toUpperCase()));
// Set de códigos oficiales CIE-10 odontológicos
const VALID_CIE10_CODES = new Set(cie10List.map(c => c.code.toUpperCase()));

// Tipos de documento permitidos para la persona / profesional que atiende u ordena el servicio (DT1 v003)
export const TIPOS_DOC_PROFESIONAL_PERMITIDOS = ["CC", "CE", "CD", "PA", "SC", "PE", "DE", "PT"];

/**
 * Valida formato estricto YYYY-MM-DD HH:mm, coherencia real de calendario
 * (días por mes, años bisiestos) y no fecha futura en zona horaria America/Bogota (UTC-5).
 *
 * PERIOD_BOUNDARY_VALIDATION = DEFERRED_TO_ORCHESTRATION_LAYER
 *
 * @param {string} dtStr
 * @param {object} [options]
 * @param {boolean} [options.allowFuture=false]
 * @returns {{ valid: boolean, error?: string }}
 */
export function isValidCalendarDateTime(dtStr, { allowFuture = false } = {}) {
  if (typeof dtStr !== "string" || dtStr.trim() === "") {
    return { valid: false, error: "fecha/hora debe ser un string no vacío." };
  }
  const clean = dtStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(clean);
  if (!match) {
    return { valid: false, error: `Formato inválido '${clean}'. Debe ser estrictamente YYYY-MM-DD HH:mm.` };
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);

  if (month < 1 || month > 12) {
    return { valid: false, error: `Mes '${match[2]}' fuera de rango (01-12).` };
  }
  if (hour < 0 || hour > 23) {
    return { valid: false, error: `Hora '${match[4]}' fuera de rango (00-23).` };
  }
  if (minute < 0 || minute > 59) {
    return { valid: false, error: `Minutos '${match[5]}' fuera de rango (00-59).` };
  }

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month]) {
    return {
      valid: false,
      error: `Día '${match[3]}' inválido para el mes ${month} del año ${year} (máximo ${daysInMonth[month]} días${month === 2 && !isLeap ? ", el año no es bisiesto" : ""}).`
    };
  }

  if (!allowFuture) {
    // Offset explícito de Colombia America/Bogota (-05:00)
    const isoString = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00-05:00`;
    const dtMillis = Date.parse(isoString);
    if (isNaN(dtMillis)) {
      return { valid: false, error: `Fecha no interpretable: '${clean}'.` };
    }
    const nowMillis = Date.now();
    if (dtMillis > nowMillis + 60000) {
      return { valid: false, error: `fecha '${clean}' no puede ser futura respecto a la fecha actual (zona horaria America/Bogota UTC-5).` };
    }
  }

  return { valid: true };
}

/**
 * Valida un JSON de RIPS v003 completo según Documento Técnico 1 v003.
 * 
 * @param {object} ripsJson 
 * @param {object} [options] - Opciones de validación { context: 'FEV' | 'RIPS_WITHOUT_FEV' }
 * @returns {Promise<{ isValid: boolean, errors: Array<string>, warnings: Array<string> }>}
 */
export async function validateRipsV003(ripsJson, options = {}) {
  const errors = [];
  const warnings = [];

  if (!ripsJson || typeof ripsJson !== "object") {
    return { isValid: false, errors: ["El archivo RIPS debe ser un objeto JSON válido."], warnings };
  }

  // 1. Encabezado / Raíz
  const numDocumentoObligado = String(ripsJson.numDocumentoIdObligado || "").trim();
  if (!numDocumentoObligado || numDocumentoObligado.length < 5 || numDocumentoObligado.length > 20) {
    errors.push("numDocumentoIdObligado es requerido y debe tener entre 5 y 20 caracteres.");
  }

  const context = options.context || (ripsJson.numFactura === null ? "RIPS_WITHOUT_FEV" : "FEV");

  if (context === "RIPS_WITHOUT_FEV") {
    if (ripsJson.numFactura !== null) {
      errors.push("Para modalidad RIPS sin FEV, numFactura debe ser estrictamente null.");
    }
  } else {
    const numFactura = String(ripsJson.numFactura || "").trim();
    if (!numFactura || numFactura.length > 20) {
      errors.push("numFactura es requerido y no puede exceder 20 caracteres.");
    }
  }

  if (ripsJson.tipoNota !== null && typeof ripsJson.tipoNota !== "string") {
    errors.push("tipoNota debe ser null o cadena de caracteres permitida.");
  }
  if (ripsJson.numNota !== null && typeof ripsJson.numNota !== "string") {
    errors.push("numNota debe ser null o cadena de caracteres.");
  }

  if (!Array.isArray(ripsJson.usuarios) || ripsJson.usuarios.length === 0) {
    errors.push("El campo 'usuarios' debe ser un arreglo con al menos un usuario.");
    return { isValid: errors.length === 0, errors, warnings };
  }

  // 2. Validación de Cada Usuario
  for (let uIdx = 0; uIdx < ripsJson.usuarios.length; uIdx++) {
    const u = ripsJson.usuarios[uIdx];
    const uPrefix = `Usuario [${uIdx + 1}]`;

    if (!u || typeof u !== "object") {
      errors.push(`${uPrefix}: formato de usuario no válido.`);
      continue;
    }

    // Tipo de documento
    const tDocVal = await validateCatalogValue("tipos_documento", u.tipoDocumentoIdentificacion);
    if (!tDocVal.valid) {
      errors.push(`${uPrefix}: tipoDocumentoIdentificacion '${u.tipoDocumentoIdentificacion}' inválido.`);
    }

    const nDoc = String(u.numDocumentoIdentificacion || "").trim();
    if (!nDoc || nDoc.length > 20) {
      errors.push(`${uPrefix}: numDocumentoIdentificacion es obligatorio y máximo 20 caracteres.`);
    }

    // RIPSTipoUsuarioVersion2 (01 al 14 oficial de SISPRO)
    const tUser = String(u.tipoUsuario || "").trim();
    const tUserVal = await validateCatalogValue("RIPSTipoUsuarioVersion2", tUser);
    if (!tUserVal.valid) {
      errors.push(`${uPrefix}: tipoUsuario '${tUser}' es inválido contra RIPSTipoUsuarioVersion2 oficial (solo se admiten códigos del 01 al 14).`);
    }

    // Regla v003: para tipos 10 (SOAT) o 14 (accidente sin SOAT), registroSIRAS es requerido
    if ((tUser === "10" || tUser === "14") && (!u.registroSIRAS || typeof u.registroSIRAS !== "string")) {
      warnings.push(`${uPrefix}: tipoUsuario '${tUser}' requiere habitualmente registroSIRAS según v003.`);
    } else if (tUser !== "10" && tUser !== "14" && u.registroSIRAS !== null && u.registroSIRAS !== undefined) {
      warnings.push(`${uPrefix}: registroSIRAS solo aplica a víctimas de accidentes de tránsito (debería ser null).`);
    }

    // Fecha de nacimiento YYYY-MM-DD
    if (!DATE_FORMAT_REGEX.test(String(u.fechaNacimiento || ""))) {
      errors.push(`${uPrefix}: fechaNacimiento debe tener formato YYYY-MM-DD.`);
    }

    // codSexo (Documento Técnico 1 v003: M = Masculino, F = Femenino, I = Indeterminado)
    if (!["M", "F", "I"].includes(String(u.codSexo || ""))) {
      errors.push(`${uPrefix}: codSexo debe ser 'M' (Masculino), 'F' (Femenino) o 'I' (Indeterminado).`);
    }

    // Países y Municipios
    if (!/^\d{3}$/.test(String(u.codPaisResidencia || ""))) {
      errors.push(`${uPrefix}: codPaisResidencia debe tener 3 dígitos (ej: 170).`);
    }
    if (!/^\d{5}$/.test(String(u.codMunicipioResidencia || ""))) {
      errors.push(`${uPrefix}: codMunicipioResidencia debe tener 5 dígitos DIVIPOLA.`);
    }
    if (!["01", "02"].includes(String(u.codZonaTerritorialResidencia || ""))) {
      errors.push(`${uPrefix}: codZonaTerritorialResidencia debe ser '01' o '02'.`);
    }

    // REGLA OFICIAL INCAPACIDAD: Catálogo LstSiNo exige "01" (SI) o "02" (NO)
    const incVal = String(u.incapacidad || "").trim();
    if (!["01", "02"].includes(incVal)) {
      errors.push(`${uPrefix}: incapacidad '${incVal}' es inválido. Debe ser '01' (SI) o '02' (NO) según la tabla oficial LstSiNo de SISPRO.`);
    }

    if (u.codPaisOrigen !== null && u.codPaisOrigen !== undefined) {
      if (!/^\d{3}$/.test(String(u.codPaisOrigen).trim())) {
        errors.push(`${uPrefix}: codPaisOrigen debe tener 3 dígitos.`);
      }
    }
    if (typeof u.consecutivo !== "number" || u.consecutivo < 1) {
      errors.push(`${uPrefix}: consecutivo de usuario debe ser un número entero mayor o igual a 1.`);
    }

    // 3. Bloque Servicios
    const serv = u.servicios;
    if (!serv || typeof serv !== "object") {
      errors.push(`${uPrefix}: bloque 'servicios' es requerido.`);
      continue;
    }

    // Consultas
    if (Array.isArray(serv.consultas)) {
      for (let cIdx = 0; cIdx < serv.consultas.length; cIdx++) {
        const c = serv.consultas[cIdx];
        const cPrefix = `${uPrefix} Consulta [${cIdx + 1}]`;

        if (!c.codPrestador || String(c.codPrestador).trim().length < 10) {
          errors.push(`${cPrefix}: codPrestador REPS es obligatorio (10 o 12 dígitos) y no puede estar vacío.`);
        }
        if (!DATETIME_FORMAT_REGEX.test(String(c.fechaInicioAtencion || ""))) {
          errors.push(`${cPrefix}: fechaInicioAtencion debe tener formato YYYY-MM-DD HH:mm.`);
        }

        // VALIDACIÓN CUPS BASADA EN CATÁLOGO OFICIAL (Cero heurística startsWith)
        const codConsulta = String(c.codConsulta || "").trim().toUpperCase();
        if (!CUPS_REGEX.test(codConsulta)) {
          errors.push(`${cPrefix}: codConsulta '${codConsulta}' no cumple estándar CUPS de 6 caracteres.`);
        } else if (!options.skipCupsCheck) {
          const cupsInfo = await getCupsClassification(codConsulta);
          if (!cupsInfo.exists) {
            errors.push(`${cPrefix}: ${cupsInfo.error}`);
          } else if (!cupsInfo.active) {
            errors.push(`${cPrefix}: ${cupsInfo.error}`);
          } else if (!cupsInfo.correspondeBloqueConsultas) {
            errors.push(
              `${cPrefix}: El código CUPS '${codConsulta}' (${cupsInfo.descripcionOficial}) está clasificado oficialmente como '${cupsInfo.tipoRips}' y no corresponde al bloque de consultas.`
            );
          }
        }

        if (typeof c.codServicio !== "number" || c.codServicio <= 0) {
          errors.push(`${cPrefix}: codServicio debe ser un número entero válido (REPS, ej: 334).`);
        }

        if (!c.causaMotivoAtencion || String(c.causaMotivoAtencion).trim() === "") {
          errors.push(`${cPrefix}: causaMotivoAtencion es obligatoria en consultas.`);
        }
        if (!c.conceptoRecaudo || String(c.conceptoRecaudo).trim() === "") {
          errors.push(`${cPrefix}: conceptoRecaudo es obligatorio en consultas.`);
        }

        // Identificación del profesional que realizó la consulta (MinSalud DT1 v003)
        const cTipoDocProf = String(c.tipoDocumentoIdentificacion || "").trim().toUpperCase();
        if (!cTipoDocProf) {
          errors.push(`${cPrefix}: tipoDocumentoIdentificacion del profesional es obligatorio.`);
        } else if (!TIPOS_DOC_PROFESIONAL_PERMITIDOS.includes(cTipoDocProf)) {
          errors.push(
            `${cPrefix}: tipoDocumentoIdentificacion '${cTipoDocProf}' del profesional es inválido según DT1 v003 (permitidos: ${TIPOS_DOC_PROFESIONAL_PERMITIDOS.join(", ")}).`
          );
        }
        const cNumDocProf = String(c.numDocumentoIdentificacion || "").trim();
        if (!cNumDocProf || cNumDocProf.length > 20) {
          errors.push(`${cPrefix}: numDocumentoIdentificacion del profesional es obligatorio y de máximo 20 caracteres.`);
        }

        // VALIDACIÓN DIAGNÓSTICO CIE-10
        const dxPrin = String(c.codDiagnosticoPrincipal || "").trim().toUpperCase();
        if (!dxPrin || !CIE10_REGEX.test(dxPrin)) {
          errors.push(`${cPrefix}: codDiagnosticoPrincipal '${dxPrin}' no es un código CIE-10 válido.`);
        }
        if (VALID_CIE10_CODES.size > 0 && !VALID_CIE10_CODES.has(dxPrin)) {
          warnings.push(`${cPrefix}: El código CIE-10 '${dxPrin}' no fue encontrado en el catálogo odontológico local.`);
        }

        if (!["01", "02", "03"].includes(String(c.tipoDiagnosticoPrincipal || ""))) {
          errors.push(`${cPrefix}: tipoDiagnosticoPrincipal debe ser '01', '02' o '03'.`);
        }
        if (typeof c.vrServicio !== "number" || c.vrServicio < 0) {
          errors.push(`${cPrefix}: vrServicio debe ser un valor numérico mayor o igual a 0.`);
        }
        if (typeof c.valorPagoModerador !== "number" || c.valorPagoModerador < 0) {
          errors.push(`${cPrefix}: valorPagoModerador debe ser numérico mayor o igual a 0.`);
        }
        if (typeof c.consecutivo !== "number" || c.consecutivo < 1) {
          errors.push(`${cPrefix}: consecutivo de consulta debe ser un entero >= 1.`);
        }

        // VALIDACIÓN CAMPOS V003 (CIE-11 y codigoVIDA)
        if (c.codDiagnosticoPrincipalCIE11 !== null) {
          if (typeof c.codDiagnosticoPrincipalCIE11 !== "string" || c.codDiagnosticoPrincipalCIE11.trim() === "") {
            errors.push(`${cPrefix}: codDiagnosticoPrincipalCIE11 debe ser string no vacío o null.`);
          }
          if (typeof c.nomCodDiagnosticoPrincipalCIE11 !== "string" || c.nomCodDiagnosticoPrincipalCIE11.trim() === "") {
            errors.push(`${cPrefix}: nomCodDiagnosticoPrincipalCIE11 es requerido cuando se informa codDiagnosticoPrincipalCIE11.`);
          }
        }
        if (c.codigoVIDA !== null && typeof c.codigoVIDA !== "string") {
          errors.push(`${cPrefix}: codigoVIDA debe ser string o null.`);
        }
      }
    }

    // Procedimientos
    if (Array.isArray(serv.procedimientos)) {
      for (let pIdx = 0; pIdx < serv.procedimientos.length; pIdx++) {
        const p = serv.procedimientos[pIdx];
        const pPrefix = `${uPrefix} Procedimiento [${pIdx + 1}]`;

        // Regla: causaMotivoAtencion NO pertenece al contrato oficial de procedimientos
        if (Object.hasOwn(p, "causaMotivoAtencion") && p.causaMotivoAtencion !== undefined) {
          errors.push(`${pPrefix}: causaMotivoAtencion no pertenece al contrato oficial del nodo procedimientos.`);
        }

        // Regla: nombre oficial es codComplicacion, NO codDiagnosticoComplicacion
        if (Object.hasOwn(p, "codDiagnosticoComplicacion") && p.codDiagnosticoComplicacion !== undefined) {
          errors.push(`${pPrefix}: El campo 'codDiagnosticoComplicacion' es inválido en v003; el nombre oficial es 'codComplicacion'.`);
        }

        if (!p.codPrestador || String(p.codPrestador).trim().length < 10) {
          errors.push(`${pPrefix}: codPrestador REPS es obligatorio y no puede estar vacío.`);
        }
        if (!DATETIME_FORMAT_REGEX.test(String(p.fechaInicioAtencion || ""))) {
          errors.push(`${pPrefix}: fechaInicioAtencion debe tener formato YYYY-MM-DD HH:mm.`);
        }

        // VALIDACIÓN CUPS BASADA EN CATÁLOGO OFICIAL (Cero heurística startsWith)
        const codProcedimiento = String(p.codProcedimiento || "").trim().toUpperCase();
        if (!CUPS_REGEX.test(codProcedimiento)) {
          errors.push(`${pPrefix}: codProcedimiento '${codProcedimiento}' no cumple estándar CUPS de 6 caracteres.`);
        } else if (!options.skipCupsCheck) {
          const cupsInfo = await getCupsClassification(codProcedimiento);
          if (!cupsInfo.exists) {
            errors.push(`${pPrefix}: ${cupsInfo.error}`);
          } else if (!cupsInfo.active) {
            errors.push(`${pPrefix}: ${cupsInfo.error}`);
          } else if (!cupsInfo.correspondeBloqueProcedimientos) {
            errors.push(
              `${pPrefix}: El código CUPS '${codProcedimiento}' (${cupsInfo.descripcionOficial}) está clasificado oficialmente como '${cupsInfo.tipoRips}' y no corresponde al bloque de procedimientos.`
            );
          }
        }

        if (!["01", "02", "03"].includes(String(p.viaIngresoServicioSalud || ""))) {
          errors.push(`${pPrefix}: viaIngresoServicioSalud debe ser '01', '02' o '03'.`);
        }
        if (typeof p.codServicio !== "number" || p.codServicio <= 0) {
          errors.push(`${pPrefix}: codServicio debe ser un número entero válido (REPS, ej: 334).`);
        }
        if (!["01", "02", "03", "04", "05"].includes(String(p.finalidadTecnologiaSalud || ""))) {
          errors.push(`${pPrefix}: finalidadTecnologiaSalud para procedimiento debe ser '01'..'05'.`);
        }
        if (!p.conceptoRecaudo || String(p.conceptoRecaudo).trim() === "") {
          errors.push(`${pPrefix}: conceptoRecaudo es obligatorio en procedimientos.`);
        }

        // Identificación del profesional que ordenó o realizó el procedimiento (MinSalud DT1 v003)
        const pTipoDocProf = String(p.tipoDocumentoIdentificacion || "").trim().toUpperCase();
        if (!pTipoDocProf) {
          errors.push(`${pPrefix}: tipoDocumentoIdentificacion del profesional es obligatorio.`);
        } else if (!TIPOS_DOC_PROFESIONAL_PERMITIDOS.includes(pTipoDocProf)) {
          errors.push(
            `${pPrefix}: tipoDocumentoIdentificacion '${pTipoDocProf}' del profesional es inválido según DT1 v003 (permitidos: ${TIPOS_DOC_PROFESIONAL_PERMITIDOS.join(", ")}).`
          );
        }
        const pNumDocProf = String(p.numDocumentoIdentificacion || "").trim();
        if (!pNumDocProf || pNumDocProf.length > 20) {
          errors.push(`${pPrefix}: numDocumentoIdentificacion del profesional es obligatorio y de máximo 20 caracteres.`);
        }

        // VALIDACIÓN DIAGNÓSTICO CIE-10
        const pDxPrin = String(p.codDiagnosticoPrincipal || "").trim().toUpperCase();
        if (!pDxPrin || !CIE10_REGEX.test(pDxPrin)) {
          errors.push(`${pPrefix}: codDiagnosticoPrincipal '${pDxPrin}' no es un código CIE-10 válido.`);
        }
        if (VALID_CIE10_CODES.size > 0 && !VALID_CIE10_CODES.has(pDxPrin)) {
          warnings.push(`${pPrefix}: El código CIE-10 '${pDxPrin}' no fue encontrado en el catálogo odontológico local.`);
        }

        if (typeof p.vrServicio !== "number" || p.vrServicio < 0) {
          errors.push(`${pPrefix}: vrServicio debe ser un valor numérico mayor o igual a 0.`);
        }
        if (typeof p.valorPagoModerador !== "number" || p.valorPagoModerador < 0) {
          errors.push(`${pPrefix}: valorPagoModerador debe ser numérico mayor o igual a 0.`);
        }
        if (typeof p.consecutivo !== "number" || p.consecutivo < 1) {
          errors.push(`${pPrefix}: consecutivo de procedimiento debe ser un entero >= 1.`);
        }

        // VALIDACIÓN CAMPOS V003 (CIE-11 y codigoVIDA)
        if (p.codDiagnosticoPrincipalCIE11 !== null) {
          if (typeof p.codDiagnosticoPrincipalCIE11 !== "string" || p.codDiagnosticoPrincipalCIE11.trim() === "") {
            errors.push(`${pPrefix}: codDiagnosticoPrincipalCIE11 debe ser string no vacío o null.`);
          }
          if (typeof p.nomCodDiagnosticoPrincipalCIE11 !== "string" || p.nomCodDiagnosticoPrincipalCIE11.trim() === "") {
            errors.push(`${pPrefix}: nomCodDiagnosticoPrincipalCIE11 es requerido cuando se informa codDiagnosticoPrincipalCIE11.`);
          }
        }
        if (p.codDiagnosticoRelacionado !== null && p.codDiagnosticoRelacionado !== undefined) {
          if (typeof p.codDiagnosticoRelacionado !== "string" || !CIE10_REGEX.test(p.codDiagnosticoRelacionado.trim().toUpperCase())) {
            errors.push(`${pPrefix}: codDiagnosticoRelacionado '${p.codDiagnosticoRelacionado}' no es un código CIE-10 válido o null.`);
          }
        }
        if (p.codComplicacion !== null && p.codComplicacion !== undefined) {
          if (typeof p.codComplicacion !== "string" || !CIE10_REGEX.test(p.codComplicacion.trim().toUpperCase())) {
            errors.push(`${pPrefix}: codComplicacion '${p.codComplicacion}' no es un código CIE-10 válido o null.`);
          }
        }
        if (p.codigoVIDA !== null && typeof p.codigoVIDA !== "string") {
          errors.push(`${pPrefix}: codigoVIDA debe ser string o null.`);
        }
      }
    }

    // OTROS SERVICIOS (Numeral 4.3.7 DT1 v003)
    if (Array.isArray(serv.otrosServicios)) {
      for (let oIdx = 0; oIdx < serv.otrosServicios.length; oIdx++) {
        const os = serv.otrosServicios[oIdx];
        const osPrefix = `${uPrefix} OtrosServicios [${oIdx + 1}]`;

        // S01 codPrestador (C 0, 12)
        if (os.codPrestador !== null && os.codPrestador !== undefined) {
          if (typeof os.codPrestador !== "string" || os.codPrestador.trim().length === 0) {
            errors.push(`${osPrefix}: codPrestador no puede ser una cadena vacía; debe ser REPS de 10-12 dígitos o null.`);
          } else {
            const strCod = os.codPrestador.trim();
            if (strCod.length < 10 || strCod.length > 12) {
              errors.push(`${osPrefix}: codPrestador debe tener 10 o 12 dígitos REPS, o null si no aplica.`);
            }
          }
        }

        // S02 numAutorizacion (C 0-30)
        if (os.numAutorizacion !== null && os.numAutorizacion !== undefined) {
          const strAut = String(os.numAutorizacion).trim();
          if (strAut.length < 1 || strAut.length > 30) {
            errors.push(`${osPrefix}: numAutorizacion no puede exceder 30 caracteres.`);
          }
        }

        // S03 idMIPRES (C 0, 1-19)
        if (os.idMIPRES !== null && os.idMIPRES !== undefined) {
          const strMipres = String(os.idMIPRES).trim();
          if (strMipres.length < 1 || strMipres.length > 19) {
            errors.push(`${osPrefix}: idMIPRES debe tener entre 1 y 19 caracteres o ser null.`);
          }
        }

        // S04 fechaSuministroTecnologia (C 16) - Validación estricta de calendario y no fecha futura
        const dateCheck = isValidCalendarDateTime(os.fechaSuministroTecnologia);
        if (!dateCheck.valid) {
          errors.push(`${osPrefix}: fechaSuministroTecnologia '${os.fechaSuministroTecnologia}': ${dateCheck.error}`);
        }

        // S05 tipoOS (C 2)
        const tipoOS = String(os.tipoOS || "").trim().padStart(2, "0");
        if (!["01", "02", "03", "04", "05"].includes(tipoOS)) {
          errors.push(`${osPrefix}: tipoOS '${os.tipoOS}' es inválido según DT1 v003 (permitidos: 01, 02, 03, 04, 05). Código '06' deshabilitado.`);
        }

        // S06 codTecnologiaSalud (C 1-20)
        if (!os.codTecnologiaSalud || typeof os.codTecnologiaSalud !== "string" || os.codTecnologiaSalud.trim().length < 1 || os.codTecnologiaSalud.trim().length > 20) {
          errors.push(`${osPrefix}: codTecnologiaSalud es obligatorio y debe tener entre 1 y 20 caracteres.`);
        } else {
          const cleanCodTec = os.codTecnologiaSalud.trim();
          // Fortalecimiento F-03: Para tipoOS 02, 03 y 05, la tecnología corresponde a código CUPS
          if (["02", "03", "05"].includes(tipoOS)) {
            if (!CUPS_REGEX.test(cleanCodTec)) {
              errors.push(`${osPrefix}: codTecnologiaSalud '${cleanCodTec}' para tipoOS '${tipoOS}' debe cumplir con la estructura oficial CUPS de 6 caracteres alfanuméricos.`);
            }
          }
        }

        // S07 nomTecnologiaSalud (C 0, 1-200)
        if (tipoOS === "01") {
          if (!os.nomTecnologiaSalud || String(os.nomTecnologiaSalud).trim() === "") {
            errors.push(`${osPrefix}: nomTecnologiaSalud es obligatorio cuando tipoOS es '01' (Dispositivos médicos e insumos).`);
          } else if (String(os.nomTecnologiaSalud).trim().length > 200) {
            errors.push(`${osPrefix}: nomTecnologiaSalud no puede exceder 200 caracteres.`);
          }
        } else {
          if (os.nomTecnologiaSalud !== null && os.nomTecnologiaSalud !== undefined) {
            if (String(os.nomTecnologiaSalud).trim().length > 200) {
              errors.push(`${osPrefix}: nomTecnologiaSalud no puede exceder 200 caracteres.`);
            }
          }
        }

        // S08 cantidadOS (N 5, 1..99999)
        if (typeof os.cantidadOS !== "number" || !Number.isInteger(os.cantidadOS) || !Number.isFinite(os.cantidadOS)) {
          errors.push(`${osPrefix}: cantidadOS debe ser un número entero sin decimales.`);
        } else {
          if (os.cantidadOS < 1 || os.cantidadOS > 99999) {
            errors.push(`${osPrefix}: cantidadOS debe ser un entero entre 1 y 99999.`);
          }
          if (tipoOS === "05" && os.cantidadOS !== 1) {
            errors.push(`${osPrefix}: cantidadOS para tipoOS '05' (Honorarios) debe ser estrictamente 1.`);
          }
        }

        // S09 y S10 Identidad del Profesional
        if (["01", "04", "05"].includes(tipoOS)) {
          const osTipoDocProf = String(os.tipoDocumentoIdentificacion || "").trim().toUpperCase();
          if (!osTipoDocProf) {
            errors.push(`${osPrefix}: tipoDocumentoIdentificacion del profesional es obligatorio para tipoOS '${tipoOS}'.`);
          } else if (!TIPOS_DOC_PROFESIONAL_PERMITIDOS.includes(osTipoDocProf)) {
            errors.push(`${osPrefix}: tipoDocumentoIdentificacion '${osTipoDocProf}' del profesional es inválido según DT1 v003.`);
          }
          const osNumDocProf = String(os.numDocumentoIdentificacion || "").trim();
          if (!osNumDocProf || osNumDocProf.length < 4 || osNumDocProf.length > 20) {
            errors.push(`${osPrefix}: numDocumentoIdentificacion del profesional debe tener entre 4 y 20 caracteres.`);
          }
          if (osTipoDocProf === String(u.tipoDocumentoIdentificacion).trim().toUpperCase() &&
              osNumDocProf === String(u.numDocumentoIdentificacion).trim()) {
            errors.push(`${osPrefix}: Prohibido copiar la identificación del paciente en el profesional.`);
          }
        } else if (["02", "03"].includes(tipoOS)) {
          if (os.tipoDocumentoIdentificacion !== null && os.tipoDocumentoIdentificacion !== undefined) {
            errors.push(`${osPrefix}: tipoDocumentoIdentificacion debe ser null para tipoOS '${tipoOS}' (traslados/estancias).`);
          }
          if (os.numDocumentoIdentificacion !== null && os.numDocumentoIdentificacion !== undefined) {
            errors.push(`${osPrefix}: numDocumentoIdentificacion debe ser null para tipoOS '${tipoOS}' (traslados/estancias).`);
          }
        }

        // S11 vrUnitOS (N 1-15)
        if (typeof os.vrUnitOS !== "number" || !Number.isFinite(os.vrUnitOS) || os.vrUnitOS < 0) {
          errors.push(`${osPrefix}: vrUnitOS debe ser de tipo number, finito y mayor o igual a 0.`);
        }

        // S18 vrDispensacion (N 0-15) - Debe ser explícito (0 si no aplica)
        if (os.vrDispensacion === undefined || os.vrDispensacion === null || typeof os.vrDispensacion !== "number" || !Number.isFinite(os.vrDispensacion) || os.vrDispensacion < 0) {
          errors.push(`${osPrefix}: vrDispensacion es obligatorio en JSON, debe ser de tipo number finito mayor o igual a 0 (0 si no aplica).`);
        }

        // S12 vrServicio (N 1-15)
        if (typeof os.vrServicio !== "number" || !Number.isFinite(os.vrServicio) || os.vrServicio < 0) {
          errors.push(`${osPrefix}: vrServicio debe ser de tipo number, finito y mayor o igual a 0.`);
        }

        // S13 conceptoRecaudo (C 2)
        const osConcRec = String(os.conceptoRecaudo || "").trim().padStart(2, "0");
        if (!osConcRec) {
          errors.push(`${osPrefix}: conceptoRecaudo es obligatorio.`);
        } else if (osConcRec === "04") {
          errors.push(`${osPrefix}: conceptoRecaudo '04' (Anticipo) corresponde a FEV y está prohibido en RIPS soporte según DT1 v003 / RVC092.`);
        } else if (!["01", "02", "03", "05"].includes(osConcRec)) {
          errors.push(`${osPrefix}: conceptoRecaudo '${osConcRec}' es inválido en RIPS soporte (válidos: 01, 02, 03, 05).`);
        }

        // S14 valorPagoModerador (N 1-15)
        if (typeof os.valorPagoModerador !== "number" || !Number.isFinite(os.valorPagoModerador) || os.valorPagoModerador < 0) {
          errors.push(`${osPrefix}: valorPagoModerador debe ser de tipo number, finito y mayor o igual a 0.`);
        } else if (osConcRec === "05" && os.valorPagoModerador !== 0) {
          errors.push(`${osPrefix}: valorPagoModerador debe ser 0 cuando conceptoRecaudo es '05' (No aplica).`);
        }

        // S15 numFEVPagoModerador
        if (osConcRec === "05" && os.numFEVPagoModerador !== null && os.numFEVPagoModerador !== undefined) {
          errors.push(`${osPrefix}: numFEVPagoModerador debe ser null cuando conceptoRecaudo es '05'.`);
        }

        // S17 codigoVIDA (C 0, 1-256)
        if (os.codigoVIDA !== null && os.codigoVIDA !== undefined) {
          if (typeof os.codigoVIDA !== "string" || os.codigoVIDA.length > 256) {
            errors.push(`${osPrefix}: codigoVIDA debe ser string de máximo 256 caracteres o null.`);
          }
        }

        // S16 consecutivo (N 1-7)
        if (typeof os.consecutivo !== "number" || os.consecutivo !== oIdx + 1) {
          errors.push(`${osPrefix}: consecutivo de otrosServicios debe ser un entero correlativo iniciando en 1 (esperado: ${oIdx + 1}, recibido: ${os.consecutivo}).`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export default {
  validateRipsV003,
  DATE_FORMAT_REGEX,
  DATETIME_FORMAT_REGEX,
  CUPS_REGEX,
  CIE10_REGEX,
};
