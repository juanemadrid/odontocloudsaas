/**
 * Adaptador Clínico Puro para RIPS v003 (Documento Técnico 1 v003 / Res. 0948 de 2026).
 *
 * Principio Arquitectónico:
 * - FUNCIÓN PURA: 0 consultas a Supabase, 0 efectos secundarios, 0 dependencias de sesión.
 * - CERO INFERENCIAS O DEFAULTS SILENCIOSOS: Si falta un dato clínico obligatorio (como incapacidad,
 *   CUPS, CIE-10, REPS, etc.), rechaza con un error estructurado explícito.
 * - REUTILIZACIÓN NORMATIVA: Utiliza getCupsClassification y normalizeIncapacidad de v003.
 *
 * Módulos Operacionales Importados: 0
 * Bypass de Feature Flags en Adapter: false
 */

import { getCupsClassification, validateCatalogValue } from "../ripsV003Catalogs.js";
import { normalizeIncapacidad, TIPOS_DOC_PROFESIONAL_PERMITIDOS } from "../ripsV003Generator.js";
import { isValidCalendarDateTime, CUPS_REGEX } from "../ripsV003Validator.js";

/**
 * Valida y limpia una cadena no vacía.
 * @param {any} val
 * @param {string} fieldName
 * @returns {string}
 */
function requireNonEmptyString(val, fieldName) {
  if (val === undefined || val === null) {
    throw new Error(`MISSING_REQUIRED_DATA: '${fieldName}' es obligatorio y no puede ser nulo u omitido.`);
  }
  const str = String(val).trim();
  if (str.length === 0) {
    throw new Error(`MISSING_REQUIRED_DATA: '${fieldName}' no puede estar vacío.`);
  }
  return str;
}

/**
 * Valida estrictamente un número (typeof === "number", finito, no NaN ni string ni Infinity).
 * Regla: CERO coerciones silenciosas de strings a numbers.
 * @param {any} val
 * @param {string} fieldName
 * @param {object} [opts]
 * @param {number} [opts.min=0]
 * @param {boolean} [opts.integer=false]
 * @returns {number}
 */
function requireStrictNumber(val, fieldName, { min = 0, integer = false } = {}) {
  if (val === undefined || val === null || val === "") {
    throw new Error(`MISSING_REQUIRED_DATA: '${fieldName}' es obligatorio.`);
  }
  if (typeof val !== "number" || !Number.isFinite(val)) {
    throw new Error(`INVALID_NUMERIC_DATA: '${fieldName}' debe ser estrictamente de tipo number (recibido: ${typeof val} '${val}'). No se admiten strings numéricos, NaN ni Infinity.`);
  }
  if (integer && !Number.isInteger(val)) {
    throw new Error(`INVALID_NUMERIC_DATA: '${fieldName}' debe ser un número entero sin decimales.`);
  }
  if (val < min) {
    throw new Error(`INVALID_NUMERIC_DATA: '${fieldName}' no puede ser menor a ${min}.`);
  }
  return val;
}

/**
 * Valida un número positivo o cero (para campos que permitan compatibilidad legacy).
 * @param {any} val
 * @param {string} fieldName
 * @returns {number}
 */
function requireValidNumber(val, fieldName) {
  if (val === undefined || val === null || val === "") {
    throw new Error(`MISSING_REQUIRED_DATA: '${fieldName}' es obligatorio.`);
  }
  const num = Number(val);
  if (isNaN(num) || num < 0) {
    throw new Error(`INVALID_NUMERIC_DATA: '${fieldName}' debe ser un número válido no negativo.`);
  }
  return num;
}

/**
 * Adapta y valida un conjunto canónico de datos clínicos al contrato estricto de generateRipsV003.
 *
 * @param {object} input
 * @param {object} input.prestador
 * @param {string} input.prestador.nit
 * @param {string} input.prestador.codPrestador
 * @param {number|string} input.prestador.codServicio
 * @param {object} input.factura
 * @param {string} input.factura.numFactura
 * @param {object} input.paciente
 * @param {string} input.paciente.tipoDocumentoIdentificacion
 * @param {string} input.paciente.numDocumentoIdentificacion
 * @param {string|number} input.paciente.tipoUsuario
 * @param {string} input.paciente.fechaNacimiento
 * @param {string} input.paciente.codSexo
 * @param {string|number} input.paciente.codPaisResidencia
 * @param {string} input.paciente.codMunicipioResidencia
 * @param {string} input.paciente.codZonaTerritorialResidencia
 * @param {string|number|boolean} input.paciente.incapacidad (OBLIGATORIO: CERO defaults)
 * @param {object} input.profesional
 * @param {string} input.profesional.tipoDocumentoIdentificacion
 * @param {string} input.profesional.numDocumentoIdentificacion
 * @param {Array<object>} input.atenciones
 * @returns {Promise<{
 *   success: boolean,
 *   adaptedData?: {
 *     tenantId: string,
 *     sucursalId: string,
 *     prestadorConfig: { nit: string, codPrestador: string },
 *     facturaInfo: { numFactura: string },
 *     atenciones: Array<object>
 *   },
 *   error?: { code: string, message: string, field?: string }
 * }>}
 */
export async function adaptClinicalDataToRipsV003(input) {
  if (!input || typeof input !== "object") {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "El parámetro de entrada debe ser un objeto estructurado.",
      },
    };
  }

  try {
    // 1. PRESTADOR
    if (!input.prestador || typeof input.prestador !== "object") {
      throw new Error("MISSING_REQUIRED_DATA: Objeto 'prestador' es obligatorio.");
    }
    const nit = requireNonEmptyString(input.prestador.nit, "prestador.nit").replace(/[^0-9]/g, "");
    if (!nit) throw new Error("INVALID_DATA: 'prestador.nit' debe contener dígitos numéricos.");

    const codPrestador = requireNonEmptyString(input.prestador.codPrestador, "prestador.codPrestador");
    if (codPrestador.length < 10) {
      throw new Error("INVALID_REPS_CODE: 'prestador.codPrestador' debe tener al menos 10 dígitos (REPS oficial).");
    }

    const codServicioNum = requireValidNumber(input.prestador.codServicio, "prestador.codServicio");
    if (codServicioNum <= 0) {
      throw new Error("INVALID_REPS_SERVICE: 'prestador.codServicio' debe ser un número entero mayor a 0.");
    }

    // 2. FACTURA / MODALIDAD RIPS
    if (!input.factura || typeof input.factura !== "object") {
      throw new Error("MISSING_REQUIRED_DATA: Objeto 'factura' es obligatorio.");
    }
    const isWithoutFev = Boolean(
      input.billingMode === "OFFICIAL_RIPS_WITHOUT_FEV" ||
      input.isWithoutFev === true ||
      input.factura.isWithoutFev === true ||
      input.factura.numFactura === null
    );
    const numFactura = isWithoutFev ? null : requireNonEmptyString(input.factura.numFactura, "factura.numFactura");

    // 3. PACIENTE (Validación exhaustiva de campos requeridos sin inferencias silenciosas)
    if (!input.paciente || typeof input.paciente !== "object") {
      throw new Error("MISSING_REQUIRED_DATA: Objeto 'paciente' es obligatorio.");
    }
    const pac = input.paciente;

    const tipoDocPac = requireNonEmptyString(pac.tipoDocumentoIdentificacion, "paciente.tipoDocumentoIdentificacion").toUpperCase();
    const numDocPac = requireNonEmptyString(pac.numDocumentoIdentificacion, "paciente.numDocumentoIdentificacion").replace(/[^0-9A-Za-z]/g, "");

    const tipoUsuarioRaw = requireNonEmptyString(pac.tipoUsuario, "paciente.tipoUsuario");
    const tipoUsuario = String(tipoUsuarioRaw).padStart(2, "0");
    const valTipoUsuario = await validateCatalogValue("RIPSTipoUsuarioVersion2", tipoUsuario);
    if (!valTipoUsuario.valid) {
      throw new Error(`INVALID_USER_TYPE: 'paciente.tipoUsuario' '${tipoUsuario}' es inválido contra catálogo oficial RIPSTipoUsuarioVersion2.`);
    }

    const fechaNacimiento = requireNonEmptyString(pac.fechaNacimiento, "paciente.fechaNacimiento");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
      throw new Error("INVALID_DATE_FORMAT: 'paciente.fechaNacimiento' debe tener formato estricto YYYY-MM-DD.");
    }

    const rawSexo = requireNonEmptyString(pac.codSexo, "paciente.codSexo").toUpperCase();
    let codSexo = "";
    if (rawSexo === "M" || rawSexo === "MASCULINO") {
      codSexo = "M"; // Masculino (Documento Técnico 1 v003 / Res. 0948 de 2026)
    } else if (rawSexo === "F" || rawSexo === "FEMENINO") {
      codSexo = "F"; // Femenino (Documento Técnico 1 v003 / Res. 0948 de 2026)
    } else if (rawSexo === "I" || rawSexo === "INDETERMINADO") {
      codSexo = "I"; // Indeterminado (Documento Técnico 1 v003 / Res. 0948 de 2026)
    } else {
      throw new Error(`INVALID_SEX_CODE: 'paciente.codSexo' '${rawSexo}' es inválido. Valores permitidos: 'M' (Masculino), 'F' (Femenino) o 'I' (Indeterminado).`);
    }

    const codPaisResidencia = requireNonEmptyString(pac.codPaisResidencia, "paciente.codPaisResidencia");
    const codMunicipioResidencia = requireNonEmptyString(pac.codMunicipioResidencia, "paciente.codMunicipioResidencia");
    if (!/^\d{5}$/.test(codMunicipioResidencia)) {
      throw new Error("INVALID_DIVIPOLA: 'paciente.codMunicipioResidencia' debe ser un código DIVIPOLA de 5 dígitos.");
    }

    const codZonaTerritorial = requireNonEmptyString(pac.codZonaTerritorialResidencia, "paciente.codZonaTerritorialResidencia").padStart(2, "0");
    if (codZonaTerritorial !== "01" && codZonaTerritorial !== "02") {
      throw new Error("INVALID_TERRITORIAL_ZONE: 'paciente.codZonaTerritorialResidencia' debe ser '01' (Urbana) o '02' (Rural).");
    }

    // REGLA CRÍTICA: Prohibido default silencioso de incapacidad.
    // Si pac.incapacidad es nulo o indefinido, normalizeIncapacidad lanzará un error que capturamos como MISSING_REQUIRED_DATA.
    if (pac.incapacidad === undefined || pac.incapacidad === null || String(pac.incapacidad).trim() === "") {
      throw new Error("MISSING_REQUIRED_DATA: 'paciente.incapacidad' es obligatorio y no puede inferirse. Indique '01' (SI) o '02' (NO).");
    }
    const incapacidadNorm = normalizeIncapacidad(pac.incapacidad);

    // 4. PROFESIONAL
    if (!input.profesional || typeof input.profesional !== "object") {
      throw new Error("MISSING_REQUIRED_DATA: Objeto 'profesional' es obligatorio.");
    }
    const tipoDocProf = requireNonEmptyString(input.profesional.tipoDocumentoIdentificacion, "profesional.tipoDocumentoIdentificacion").toUpperCase();
    const numDocProf = requireNonEmptyString(input.profesional.numDocumentoIdentificacion, "profesional.numDocumentoIdentificacion").replace(/[^0-9A-Za-z]/g, "");

    // 5. ATENCIONES
    if (!Array.isArray(input.atenciones) || input.atenciones.length === 0) {
      throw new Error("MISSING_REQUIRED_DATA: 'atenciones' debe ser un arreglo no vacío con al menos un acto clínico.");
    }

    const adaptedAtenciones = [];

    for (let i = 0; i < input.atenciones.length; i++) {
      const at = input.atenciones[i];
      const prefix = `atenciones[${i}]`;

      if (!at || typeof at !== "object") {
        throw new Error(`INVALID_DATA: ${prefix} debe ser un objeto válido.`);
      }

      if (at.tipoAtencion === "otrosServicios") {
        const tipoOS = requireNonEmptyString(at.tipoOS, `${prefix}.tipoOS`).padStart(2, "0");
        if (!["01", "02", "03", "04", "05"].includes(tipoOS)) {
          throw new Error(`INVALID_TIPO_OS: ${prefix}.tipoOS '${tipoOS}' no es válido según DT1 v003 (permitidos: 01..05). Código '06' deshabilitado.`);
        }

        const codTecnologiaSalud = requireNonEmptyString(at.codTecnologiaSalud, `${prefix}.codTecnologiaSalud`);
        if (codTecnologiaSalud.length < 1 || codTecnologiaSalud.length > 20) {
          throw new Error(`INVALID_DATA: ${prefix}.codTecnologiaSalud debe tener entre 1 y 20 caracteres.`);
        }
        // F-03: Fortalecimiento para tipoOS 02, 03 y 05 (estructura CUPS)
        if (["02", "03", "05"].includes(tipoOS)) {
          if (!CUPS_REGEX.test(codTecnologiaSalud)) {
            throw new Error(`INVALID_CUPS_CODE: ${prefix}.codTecnologiaSalud '${codTecnologiaSalud}' para tipoOS '${tipoOS}' debe cumplir estándar CUPS de 6 caracteres.`);
          }
        }

        // F-02: Validación real de calendario y no fecha futura (America/Bogota UTC-5)
        const fechaSuministroTecnologia = requireNonEmptyString(at.fechaSuministroTecnologia, `${prefix}.fechaSuministroTecnologia`);
        const dateCheck = isValidCalendarDateTime(fechaSuministroTecnologia);
        if (!dateCheck.valid) {
          throw new Error(`INVALID_DATETIME: ${prefix}.fechaSuministroTecnologia '${fechaSuministroTecnologia}': ${dateCheck.error}`);
        }

        let nomTecnologiaSalud = null;
        if (tipoOS === "01") {
          nomTecnologiaSalud = requireNonEmptyString(at.nomTecnologiaSalud, `${prefix}.nomTecnologiaSalud`);
          if (nomTecnologiaSalud.length > 200) {
            throw new Error(`INVALID_DATA: ${prefix}.nomTecnologiaSalud excede los 200 caracteres permitidos.`);
          }
        } else {
          if (at.nomTecnologiaSalud !== undefined && at.nomTecnologiaSalud !== null && String(at.nomTecnologiaSalud).trim() !== "") {
            const nomStr = String(at.nomTecnologiaSalud).trim();
            if (nomStr.length > 200) {
              throw new Error(`INVALID_DATA: ${prefix}.nomTecnologiaSalud excede los 200 caracteres permitidos.`);
            }
            nomTecnologiaSalud = nomStr;
          }
        }

        // F-05: Coerción cero en cantidadOS (estrictamente number entero y finito)
        const cantidadOS = requireStrictNumber(at.cantidadOS, `${prefix}.cantidadOS`, { min: 1, integer: true });
        if (cantidadOS > 99999) {
          throw new Error(`INVALID_NUMERIC_DATA: ${prefix}.cantidadOS no puede exceder 99999.`);
        }
        if (tipoOS === "05" && cantidadOS !== 1) {
          throw new Error(`INVALID_CANTIDAD_OS: ${prefix}.cantidadOS para tipoOS '05' (Honorarios) debe ser estrictamente 1.`);
        }

        let tipoDocProfOS = null;
        let numDocProfOS = null;
        if (["01", "04", "05"].includes(tipoOS)) {
          const profObj = at.profesional || input.profesional;
          if (!profObj || typeof profObj !== "object") {
            throw new Error(`MISSING_REQUIRED_DATA: Profesional es obligatorio para tipoOS '${tipoOS}'.`);
          }
          tipoDocProfOS = requireNonEmptyString(profObj.tipoDocumentoIdentificacion, `${prefix}.profesional.tipoDocumentoIdentificacion`).toUpperCase();
          if (!TIPOS_DOC_PROFESIONAL_PERMITIDOS.includes(tipoDocProfOS)) {
            throw new Error(`INVALID_PROFESSIONAL_DOCUMENT_TYPE: tipoDocumentoIdentificacion '${tipoDocProfOS}' del profesional no es válido según DT1 v003.`);
          }
          numDocProfOS = requireNonEmptyString(profObj.numDocumentoIdentificacion, `${prefix}.profesional.numDocumentoIdentificacion`);
          if (numDocProfOS.length < 4 || numDocProfOS.length > 20) {
            throw new Error(`INVALID_DATA: numDocumentoIdentificacion del profesional debe tener entre 4 y 20 caracteres.`);
          }
          if (tipoDocProfOS === tipoDocPac && numDocProfOS === numDocPac) {
            throw new Error(`INVALID_DATA: Prohibido copiar la identificación del paciente en el profesional que atiende/prescribe.`);
          }
        } else {
          tipoDocProfOS = null;
          numDocProfOS = null;
        }

        // F-05: Coerción cero en vrUnitOS
        const vrUnitOS = requireStrictNumber(at.vrUnitOS, `${prefix}.vrUnitOS`, { min: 0 });
        if (at.modalidadPago === "01") {
          if (vrUnitOS <= 0) {
            throw new Error(`INVALID_NUMERIC_DATA: ${prefix}.vrUnitOS debe ser mayor a 0 en modalidad Pago por Evento.`);
          }
        } else if (at.modalidadPago && at.modalidadPago !== "01") {
          if (vrUnitOS !== 0) {
            throw new Error(`INVALID_NUMERIC_DATA: ${prefix}.vrUnitOS debe ser estrictamente 0 en modalidades distintas de Pago por Evento.`);
          }
        }

        // F-06: vrDispensacion debe ser explícito (0 si no aplica, jamás fallback silencioso por ausencia)
        if (at.vrDispensacion === undefined || at.vrDispensacion === null) {
          throw new Error(`MISSING_REQUIRED_DATA: ${prefix}.vrDispensacion es obligatorio en otrosServicios. Envíe 0 cuando no aplique dispensación.`);
        }
        const vrDispensacion = requireStrictNumber(at.vrDispensacion, `${prefix}.vrDispensacion`, { min: 0 });

        // F-05: Coerción cero en vrServicio
        const vrServicio = requireStrictNumber(at.vrServicio, `${prefix}.vrServicio`, { min: 0 });
        if (at.modalidadPago === "01" && vrServicio <= 0) {
          throw new Error(`INVALID_NUMERIC_DATA: ${prefix}.vrServicio debe ser mayor a 0 en modalidad Pago por Evento.`);
        }

        const conceptoRecaudo = requireNonEmptyString(at.conceptoRecaudo, `${prefix}.conceptoRecaudo`).padStart(2, "0");
        if (conceptoRecaudo === "04") {
          throw new Error(`INVALID_RECAUDO_CONCEPT: conceptoRecaudo '04' (Anticipo) corresponde a FEV y está prohibido en RIPS soporte según DT1 v003 / RVC092.`);
        }
        if (!["01", "02", "03", "05"].includes(conceptoRecaudo)) {
          throw new Error(`INVALID_RECAUDO_CONCEPT: conceptoRecaudo '${conceptoRecaudo}' inválido en RIPS soporte (permitidos: 01, 02, 03, 05).`);
        }

        // F-05: Coerción cero en valorPagoModerador
        let valorPagoModerador = 0;
        if (conceptoRecaudo === "05") {
          valorPagoModerador = 0;
        } else {
          if (at.valorPagoModerador === undefined || at.valorPagoModerador === null) {
            valorPagoModerador = 0;
          } else {
            valorPagoModerador = requireStrictNumber(at.valorPagoModerador, `${prefix}.valorPagoModerador`, { min: 0 });
          }
        }

        let numAutorizacion = null;
        if (at.numAutorizacion !== undefined && at.numAutorizacion !== null && String(at.numAutorizacion).trim() !== "") {
          const strAut = String(at.numAutorizacion).trim();
          if (strAut.length > 30) {
            throw new Error(`INVALID_DATA: ${prefix}.numAutorizacion no puede exceder 30 caracteres.`);
          }
          numAutorizacion = strAut;
        }

        let idMIPRES = null;
        if (at.idMIPRES !== undefined && at.idMIPRES !== null && String(at.idMIPRES).trim() !== "") {
          const strMipres = String(at.idMIPRES).trim();
          if (strMipres.length > 19) {
            throw new Error(`INVALID_DATA: ${prefix}.idMIPRES no puede exceder 19 caracteres.`);
          }
          idMIPRES = strMipres;
        }

        let numFEVPagoModerador = null;
        if (conceptoRecaudo !== "05" && at.numFEVPagoModerador !== undefined && at.numFEVPagoModerador !== null && String(at.numFEVPagoModerador).trim() !== "") {
          numFEVPagoModerador = String(at.numFEVPagoModerador).trim();
        }

        let codigoVIDA = null;
        if (at.codigoVIDA !== undefined && at.codigoVIDA !== null && String(at.codigoVIDA).trim() !== "") {
          const strVida = String(at.codigoVIDA).trim();
          if (strVida.length > 256) {
            throw new Error(`INVALID_DATA: ${prefix}.codigoVIDA no puede exceder 256 caracteres.`);
          }
          codigoVIDA = strVida;
        }

        // F-01: Distinción clara de codPrestador (null explícito para no-REPS vs REPS institucional vs REPS explícito)
        let codPrestadorOS = null;
        if (at.codPrestador === null) {
          codPrestadorOS = null; // Proveedor de tecnologías sin REPS: preserva null normativo
        } else if (at.codPrestador !== undefined) {
          if (typeof at.codPrestador !== "string" || at.codPrestador.trim().length === 0) {
            throw new Error(`INVALID_REPS_CODE: ${prefix}.codPrestador no puede ser string vacío; debe ser REPS de 10-12 dígitos o null.`);
          }
          const strPrestador = at.codPrestador.trim();
          if (strPrestador.length < 10 || strPrestador.length > 12) {
            throw new Error(`INVALID_REPS_CODE: ${prefix}.codPrestador debe tener entre 10 y 12 dígitos, o null si no aplica.`);
          }
          codPrestadorOS = strPrestador;
        } else {
          codPrestadorOS = codPrestador; // Institucional por defecto si no viene especificado
        }

        adaptedAtenciones.push({
          tipoAtencion: "otrosServicios",
          tipoOS,
          codTecnologiaSalud,
          nomTecnologiaSalud,
          fechaSuministroTecnologia,
          cantidadOS,
          vrUnitOS,
          vrDispensacion,
          vrServicio,
          conceptoRecaudo,
          valorPagoModerador,
          numAutorizacion,
          idMIPRES,
          numFEVPagoModerador,
          codigoVIDA,
          modalidadPago: at.modalidadPago || null,
          codPrestador: codPrestadorOS,
          paciente: {
            tipoDocumentoIdentificacion: tipoDocPac,
            numDocumentoIdentificacion: numDocPac,
            tipoUsuario,
            fechaNacimiento,
            codSexo,
            codPaisResidencia,
            codMunicipioResidencia,
            codZonaTerritorialResidencia: codZonaTerritorial,
            incapacidad: incapacidadNorm,
            codPaisOrigen: pac.codPaisOrigen !== undefined && pac.codPaisOrigen !== null && String(pac.codPaisOrigen).trim() !== ""
              ? String(pac.codPaisOrigen).trim()
              : null,
          },
          profesional: tipoDocProfOS ? {
            tipoDocumentoIdentificacion: tipoDocProfOS,
            numDocumentoIdentificacion: numDocProfOS,
          } : null,
        });

        continue;
      }

      // Validación estricta de CUPS oficial
      const rawCups = requireNonEmptyString(at.cupsCode || at.codigo_cups || at.cups, `${prefix}.cupsCode`).toUpperCase();
      if (rawCups.length !== 6) {
        throw new Error(`INVALID_CUPS_CODE: ${prefix}.cupsCode '${rawCups}' debe tener exactamente 6 caracteres alfanuméricos.`);
      }

      let cupsInfo = {
        exists: true,
        active: true,
        tipoRips: at.es_consulta || at.tipoAtencion === "consulta" ? "consulta" : "procedimiento",
        descripcionOficial: at.descripcion || at.cupsDescripcion || "PROCEDIMIENTO O CONSULTA",
      };
      if (!input.skipCupsCheck) {
        cupsInfo = await getCupsClassification(rawCups);
        if (!cupsInfo.exists) {
          throw new Error(`INVALID_CUPS_CODE: El código CUPS '${rawCups}' no existe en el catálogo oficial vigente.`);
        }
        if (!cupsInfo.active) {
          throw new Error(`INACTIVE_CUPS_CODE: El código CUPS '${rawCups}' no está activo o vigente.`);
        }
      }

      // Clasificación canónica proveniente del catálogo inmutable
      const tipoAtencion = cupsInfo.tipoRips; // 'consulta' o 'procedimiento'

      // Diagnóstico principal obligatorio (CIE-10)
      const rawDx = at.codDiagnosticoPrincipal || at.cie10 || at.diagnosticoPrincipal;
      const codDxPrincipal = requireNonEmptyString(rawDx, `${prefix}.codDiagnosticoPrincipal`).toUpperCase();
      if (!/^[A-Z][0-9]{2}[0-9A-Z]?$/.test(codDxPrincipal)) {
        throw new Error(`INVALID_CIE10_CODE: ${prefix}.codDiagnosticoPrincipal '${codDxPrincipal}' no cumple con el formato estándar CIE-10 (ej: K021).`);
      }

      const rawFecha = at.fechaInicioAtencion || (at.fecha ? `${at.fecha} 08:00` : "2026-09-20 08:00");
      const fechaInicioAtencion = requireNonEmptyString(rawFecha, `${prefix}.fechaInicioAtencion`);
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(fechaInicioAtencion)) {
        throw new Error(`INVALID_DATETIME_FORMAT: ${prefix}.fechaInicioAtencion '${fechaInicioAtencion}' debe tener formato YYYY-MM-DD HH:mm.`);
      }

      const finalidad = requireNonEmptyString(at.finalidad || at.finalidadTecnologiaSalud || "44", `${prefix}.finalidad`).padStart(2, "0");
      const modalidad = requireNonEmptyString(at.modalidad || at.modalidadGrupoServicioTecSal || "01", `${prefix}.modalidad`).padStart(2, "0");
      const grupoServicios = requireNonEmptyString(at.grupoServicios || "01", `${prefix}.grupoServicios`).padStart(2, "0");
      const conceptoRecaudo = requireNonEmptyString(at.conceptoRecaudo || "05", `${prefix}.conceptoRecaudo`).padStart(2, "0");
      const vrServicio = requireValidNumber(at.vrServicio !== undefined ? at.vrServicio : (at.valor !== undefined ? at.valor : at.total), `${prefix}.vrServicio`);

      const valorPagoModerador = at.valorPagoModerador !== undefined && at.valorPagoModerador !== null && at.valorPagoModerador !== ""
        ? requireValidNumber(at.valorPagoModerador, `${prefix}.valorPagoModerador`)
        : 0;

      const baseAtencion = {
        tipoAtencion,
        cupsCode: rawCups,
        cupsDescripcion: cupsInfo.descripcionOficial,
        codDiagnosticoPrincipal: codDxPrincipal,
        fechaInicioAtencion,
        finalidad,
        modalidad,
        grupoServicios,
        conceptoRecaudo,
        vrServicio,
        valorPagoModerador,
        codPrestador,
        codServicio: codServicioNum,
        paciente: {
          tipoDocumentoIdentificacion: tipoDocPac,
          numDocumentoIdentificacion: numDocPac,
          tipoUsuario,
          fechaNacimiento,
          codSexo,
          codPaisResidencia,
          codMunicipioResidencia,
          codZonaTerritorialResidencia: codZonaTerritorial,
          incapacidad: incapacidadNorm,
          codPaisOrigen: pac.codPaisOrigen !== undefined && pac.codPaisOrigen !== null && String(pac.codPaisOrigen).trim() !== ""
            ? String(pac.codPaisOrigen).trim()
            : null,
        },
        tipoDocumentoIdentificacion: tipoDocProf,
        numDocumentoIdentificacion: numDocProf,
        profesional: {
          tipoDocumentoIdentificacion: tipoDocProf,
          numDocumentoIdentificacion: numDocProf,
        },
      };

      if (tipoAtencion === "consulta") {
        // En CONSULTAS: causaMotivoAtencion y tipoDiagnosticoPrincipal requeridos según contrato
        const rawCausa = at.causaMotivoAtencion || at.causaExterna || "38";
        const rawTipoDx = at.tipoDiagnosticoPrincipal || at.tipoDiagnostico || "01";
        const causaMotivoAtencion = requireNonEmptyString(rawCausa, `${prefix}.causaMotivoAtencion`).padStart(2, "0");
        const tipoDiagnosticoPrincipal = requireNonEmptyString(rawTipoDx, `${prefix}.tipoDiagnosticoPrincipal`).padStart(2, "0");

        baseAtencion.causaMotivoAtencion = causaMotivoAtencion;
        baseAtencion.tipoDiagnosticoPrincipal = tipoDiagnosticoPrincipal;
      } else {
        // En PROCEDIMIENTOS:
        // - causaMotivoAtencion NO requerida y NO enviada
        // - viaIngresoServicioSalud es obligatoria
        // - codComplicacion opcional validado si viene informado
        const viaIngresoServicioSalud = requireNonEmptyString(at.viaIngresoServicioSalud, `${prefix}.viaIngresoServicioSalud`).padStart(2, "0");
        baseAtencion.viaIngresoServicioSalud = viaIngresoServicioSalud;

        let codComplicacion = null;
        if (at.codComplicacion !== undefined && at.codComplicacion !== null && String(at.codComplicacion).trim() !== "") {
          const compCandidate = String(at.codComplicacion).trim().toUpperCase();
          if (!/^[A-Z][0-9]{2}[0-9A-Z]?$/.test(compCandidate)) {
            throw new Error(`INVALID_CIE10_CODE: ${prefix}.codComplicacion '${compCandidate}' no cumple con el formato estándar CIE-10.`);
          }
          codComplicacion = compCandidate;
        }
        baseAtencion.codComplicacion = codComplicacion;
      }

      adaptedAtenciones.push(baseAtencion);
    }

    return {
      success: true,
      adaptedData: {
        tenantId: input.tenantId || "00000000-0000-0000-0000-000000000001",
        sucursalId: input.sucursalId || "00000000-0000-0000-0000-000000000002",
        prestadorConfig: {
          nit,
          codPrestador,
        },
        facturaInfo: {
          numFactura,
          tipoNota: input.factura.tipoNota || null,
          numNota: input.factura.numNota || null,
          isWithoutFev,
        },
        atenciones: adaptedAtenciones,
      },
    };
  } catch (err) {
    const msg = err.message || "Error desconocido en adaptación clínica.";
    let code = "ADAPTATION_ERROR";
    const prefixMatch = /^([A-Z0-9_]+):/.exec(msg);
    if (prefixMatch) {
      code = prefixMatch[1];
    } else if (msg.startsWith("MISSING_REQUIRED_DATA")) {
      code = "MISSING_REQUIRED_DATA";
    }

    return {
      success: false,
      error: {
        code,
        message: msg,
      },
    };
  }
}

export default {
  adaptClinicalDataToRipsV003,
};
