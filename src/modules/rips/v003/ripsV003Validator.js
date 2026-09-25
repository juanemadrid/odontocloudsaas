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

/**
 * Valida un JSON de RIPS v003 completo según Documento Técnico 1 v003.
 * 
 * @param {object} ripsJson 
 * @returns {Promise<{ isValid: boolean, errors: Array<string>, warnings: Array<string> }>}
 */
export async function validateRipsV003(ripsJson) {
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

  const numFactura = String(ripsJson.numFactura || "").trim();
  if (!numFactura || numFactura.length > 20) {
    errors.push("numFactura es requerido y no puede exceder 20 caracteres.");
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

    // codSexo
    if (!["H", "M"].includes(String(u.codSexo || ""))) {
      errors.push(`${uPrefix}: codSexo debe ser 'H' o 'M'.`);
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

    if (!/^\d{3}$/.test(String(u.codPaisOrigen || ""))) {
      errors.push(`${uPrefix}: codPaisOrigen debe tener 3 dígitos.`);
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
        } else {
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
        } else {
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
        if (p.codDiagnosticoRelacionado !== null && typeof p.codDiagnosticoRelacionado !== "string") {
          errors.push(`${pPrefix}: codDiagnosticoRelacionado debe ser string o null.`);
        }
        if (p.codDiagnosticoComplicacion !== null && typeof p.codDiagnosticoComplicacion !== "string") {
          errors.push(`${pPrefix}: codDiagnosticoComplicacion debe ser string o null.`);
        }
        if (p.codigoVIDA !== null && typeof p.codigoVIDA !== "string") {
          errors.push(`${pPrefix}: codigoVIDA debe ser string o null.`);
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
