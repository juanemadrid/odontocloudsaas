import { isFevRips0948Enabled } from "./ripsFeatureFlagService.js";
import { validateCatalogValue, getCupsClassification } from "./ripsV003Catalogs.js";
import { isServiceHabilitadoEnSede } from "./ripsV003RepsService.js";
import { validateRipsV003, isValidCalendarDateTime, CUPS_REGEX } from "./ripsV003Validator.js";

/**
 * NUEVO GENERADOR RIPS V003 (Documento Técnico 1 Versión 003 – 15 de julio de 2026)
 * Marco normativo: Resolución 948 de 2026 / MinSalud / SISPRO.
 */

function cleanOptionalString(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  return str === "" ? null : str;
}

// Tipos de documento permitidos para la persona / profesional que atiende u ordena el servicio (DT1 v003)
export const TIPOS_DOC_PROFESIONAL_PERMITIDOS = ["CC", "CE", "CD", "PA", "SC", "PE", "DE", "PT"];

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

    if (!pac.tipoDocumentoIdentificacion || String(pac.tipoDocumentoIdentificacion).trim() === "") {
      throw new Error("tipoDocumentoIdentificacion del paciente es obligatorio.");
    }
    if (!pac.numDocumentoIdentificacion || String(pac.numDocumentoIdentificacion).trim() === "") {
      throw new Error("numDocumentoIdentificacion del paciente es obligatorio.");
    }

    const pacIdKey = `${String(pac.tipoDocumentoIdentificacion).trim().toUpperCase()}_${String(pac.numDocumentoIdentificacion).trim()}`;

    if (!usuariosMap.has(pacIdKey)) {
      if (!pac.tipoUsuario || String(pac.tipoUsuario).trim() === "") {
        throw new Error("tipoUsuario del paciente es obligatorio.");
      }
      const tipoUsuario = String(pac.tipoUsuario).trim().padStart(2, "0");
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

      if (!pac.fechaNacimiento || String(pac.fechaNacimiento).trim() === "") {
        throw new Error("fechaNacimiento del paciente es obligatoria.");
      }
      if (!pac.codPaisResidencia || String(pac.codPaisResidencia).trim() === "") {
        throw new Error("codPaisResidencia del paciente es obligatorio.");
      }
      if (!pac.codMunicipioResidencia || String(pac.codMunicipioResidencia).trim() === "") {
        throw new Error("codMunicipioResidencia del paciente es obligatorio.");
      }
      if (!pac.codZonaTerritorialResidencia || String(pac.codZonaTerritorialResidencia).trim() === "") {
        throw new Error("codZonaTerritorialResidencia del paciente es obligatorio.");
      }

      usuariosMap.set(pacIdKey, {
        tipoDocumentoIdentificacion: String(pac.tipoDocumentoIdentificacion).trim().toUpperCase(),
        numDocumentoIdentificacion: String(pac.numDocumentoIdentificacion).trim(),
        tipoUsuario,
        fechaNacimiento: String(pac.fechaNacimiento).trim(),
        codSexo: pac.codSexo !== undefined && pac.codSexo !== null ? String(pac.codSexo).trim().toUpperCase() : "",
        codPaisResidencia: String(pac.codPaisResidencia).trim(),
        codMunicipioResidencia: String(pac.codMunicipioResidencia).trim(),
        codZonaTerritorialResidencia: String(pac.codZonaTerritorialResidencia).trim().padStart(2, "0"),
        incapacidad: incCode, // "01" (SI) o "02" (NO)
        codPaisOrigen: pac.codPaisOrigen !== undefined && pac.codPaisOrigen !== null && String(pac.codPaisOrigen).trim() !== "" ? String(pac.codPaisOrigen).trim() : null,
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

    // F-07: Defensa anticipada e independiente ante tipoAtencion desconocido
    if (!["consulta", "procedimiento", "otrosServicios"].includes(atencion.tipoAtencion)) {
      throw new Error(`tipoAtencion desconocido o no soportado: '${atencion.tipoAtencion}'. Permitidos: 'consulta', 'procedimiento', 'otrosServicios'.`);
    }

    if (atencion.tipoAtencion === "otrosServicios") {
      // 1. tipoOS (01..05)
      if (!atencion.tipoOS || String(atencion.tipoOS).trim() === "") {
        throw new Error("tipoOS de otrosServicios es obligatorio.");
      }
      const tipoOS = String(atencion.tipoOS).trim().padStart(2, "0");
      if (!["01", "02", "03", "04", "05"].includes(tipoOS)) {
        throw new Error(`tipoOS '${tipoOS}' no es válido según DT1 v003 (permitidos: 01, 02, 03, 04, 05). Código '06' deshabilitado.`);
      }

      // 2. codTecnologiaSalud (1-20)
      if (!atencion.codTecnologiaSalud || String(atencion.codTecnologiaSalud).trim() === "") {
        throw new Error("codTecnologiaSalud es obligatorio en otrosServicios.");
      }
      const codTecnologiaSalud = String(atencion.codTecnologiaSalud).trim();
      if (codTecnologiaSalud.length < 1 || codTecnologiaSalud.length > 20) {
        throw new Error("codTecnologiaSalud debe tener entre 1 y 20 caracteres.");
      }
      // F-03: Fortalecimiento para tipoOS 02, 03 y 05 (estructura CUPS)
      if (["02", "03", "05"].includes(tipoOS)) {
        if (!CUPS_REGEX.test(codTecnologiaSalud)) {
          throw new Error(`codTecnologiaSalud '${codTecnologiaSalud}' para tipoOS '${tipoOS}' debe cumplir estándar CUPS de 6 caracteres.`);
        }
      }

      // 3. fechaSuministroTecnologia (YYYY-MM-DD HH:mm con validación de calendario y no fecha futura)
      if (!atencion.fechaSuministroTecnologia || String(atencion.fechaSuministroTecnologia).trim() === "") {
        throw new Error("fechaSuministroTecnologia es obligatoria en otrosServicios.");
      }
      const fechaSuministroTecnologia = String(atencion.fechaSuministroTecnologia).trim();
      const dateCheck = isValidCalendarDateTime(fechaSuministroTecnologia);
      if (!dateCheck.valid) {
        throw new Error(`fechaSuministroTecnologia '${fechaSuministroTecnologia}': ${dateCheck.error}`);
      }

      // 4. nomTecnologiaSalud (0, 1-200)
      let nomTecnologiaSalud = null;
      if (tipoOS === "01") {
        if (!atencion.nomTecnologiaSalud || String(atencion.nomTecnologiaSalud).trim() === "") {
          throw new Error("nomTecnologiaSalud es obligatorio para tipoOS '01' (Dispositivos médicos e insumos).");
        }
        nomTecnologiaSalud = String(atencion.nomTecnologiaSalud).trim();
        if (nomTecnologiaSalud.length > 200) {
          throw new Error("nomTecnologiaSalud excede los 200 caracteres permitidos.");
        }
      } else {
        if (atencion.nomTecnologiaSalud !== undefined && atencion.nomTecnologiaSalud !== null && String(atencion.nomTecnologiaSalud).trim() !== "") {
          const strNom = String(atencion.nomTecnologiaSalud).trim();
          if (strNom.length > 200) {
            throw new Error("nomTecnologiaSalud no puede exceder 200 caracteres.");
          }
          nomTecnologiaSalud = strNom;
        }
      }

      // 5. cantidadOS (N 5, 1..99999, integer estricto sin coerción)
      if (atencion.cantidadOS === undefined || atencion.cantidadOS === null) {
        throw new Error("cantidadOS es obligatoria en otrosServicios.");
      }
      if (typeof atencion.cantidadOS !== "number" || !Number.isInteger(atencion.cantidadOS) || !Number.isFinite(atencion.cantidadOS)) {
        throw new Error("cantidadOS debe ser un número entero sin decimales.");
      }
      const cantidadOS = atencion.cantidadOS;
      if (cantidadOS < 1 || cantidadOS > 99999) {
        throw new Error("cantidadOS debe ser un entero entre 1 y 99999.");
      }
      if (tipoOS === "05" && cantidadOS !== 1) {
        throw new Error("cantidadOS para tipoOS '05' (Honorarios) debe ser estrictamente 1.");
      }

      // 6. Profesional S09 / S10
      let tipoDocProfOS = null;
      let numDocProfOS = null;
      if (["01", "04", "05"].includes(tipoOS)) {
        if (!atencion.profesional || typeof atencion.profesional !== "object") {
          throw new Error(`profesional es obligatorio para tipoOS '${tipoOS}'.`);
        }
        tipoDocProfOS = String(atencion.profesional.tipoDocumentoIdentificacion || "").trim().toUpperCase();
        if (!tipoDocProfOS) {
          throw new Error(`tipoDocumentoIdentificacion del profesional es obligatorio para tipoOS '${tipoOS}'.`);
        }
        if (!TIPOS_DOC_PROFESIONAL_PERMITIDOS.includes(tipoDocProfOS)) {
          throw new Error(`tipoDocumentoIdentificacion '${tipoDocProfOS}' del profesional no es válido según DT1 v003.`);
        }
        numDocProfOS = String(atencion.profesional.numDocumentoIdentificacion || "").trim();
        if (!numDocProfOS || numDocProfOS.length < 4 || numDocProfOS.length > 20) {
          throw new Error("numDocumentoIdentificacion del profesional debe tener entre 4 y 20 caracteres.");
        }
        if (tipoDocProfOS === usuarioObj.tipoDocumentoIdentificacion && numDocProfOS === usuarioObj.numDocumentoIdentificacion) {
          throw new Error("Prohibido copiar la identificación del paciente en el profesional de otrosServicios.");
        }
      } else {
        tipoDocProfOS = null;
        numDocProfOS = null;
      }

      // 7. vrUnitOS (S11) - F-05: Coerción cero
      if (atencion.vrUnitOS === undefined || atencion.vrUnitOS === null) {
        throw new Error("vrUnitOS es obligatorio en otrosServicios.");
      }
      if (typeof atencion.vrUnitOS !== "number" || !Number.isFinite(atencion.vrUnitOS) || atencion.vrUnitOS < 0) {
        throw new Error("vrUnitOS debe ser un número finito mayor o igual a 0.");
      }
      const vrUnitOS = atencion.vrUnitOS;
      if (atencion.modalidadPago === "01" && vrUnitOS <= 0) {
        throw new Error("vrUnitOS debe ser mayor a 0 en modalidad Pago por Evento.");
      }
      if (atencion.modalidadPago && atencion.modalidadPago !== "01" && vrUnitOS !== 0) {
        throw new Error("vrUnitOS debe ser estrictamente 0 en modalidades distintas de Pago por Evento.");
      }

      // 8. vrDispensacion (S18) - F-06: Obligatorio explícito en el input
      if (atencion.vrDispensacion === undefined || atencion.vrDispensacion === null) {
        throw new Error("vrDispensacion es obligatorio en otrosServicios. Debe ser 0 si no aplica.");
      }
      if (typeof atencion.vrDispensacion !== "number" || !Number.isFinite(atencion.vrDispensacion) || atencion.vrDispensacion < 0) {
        throw new Error("vrDispensacion debe ser un número finito mayor o igual a 0.");
      }
      const vrDispensacion = atencion.vrDispensacion;

      // 9. vrServicio (S12) - F-05: Coerción cero
      if (atencion.vrServicio === undefined || atencion.vrServicio === null) {
        throw new Error("vrServicio es obligatorio en otrosServicios.");
      }
      if (typeof atencion.vrServicio !== "number" || !Number.isFinite(atencion.vrServicio) || atencion.vrServicio < 0) {
        throw new Error("vrServicio debe ser un número finito mayor o igual a 0.");
      }
      const vrServicio = atencion.vrServicio;
      if (atencion.modalidadPago === "01" && vrServicio <= 0) {
        throw new Error("vrServicio debe ser mayor a 0 en modalidad Pago por Evento.");
      }
      if (atencion.modalidadPago && atencion.modalidadPago !== "01" && vrServicio !== 0) {
        throw new Error("vrServicio debe ser 0 en modalidades distintas de Pago por Evento cuando aplica acuerdo global.");
      }

      // 10. conceptoRecaudo (S13)
      if (!atencion.conceptoRecaudo || String(atencion.conceptoRecaudo).trim() === "") {
        throw new Error("conceptoRecaudo es obligatorio en otrosServicios.");
      }
      const conceptoRecaudo = String(atencion.conceptoRecaudo).trim().padStart(2, "0");
      if (conceptoRecaudo === "04") {
        throw new Error("conceptoRecaudo '04' (Anticipo) corresponde a FEV y está prohibido en RIPS soporte según DT1 v003 / RVC092.");
      }
      if (!["01", "02", "03", "05"].includes(conceptoRecaudo)) {
        throw new Error(`conceptoRecaudo '${conceptoRecaudo}' es inválido en RIPS soporte (válidos: 01, 02, 03, 05).`);
      }

      // 11. valorPagoModerador (S14) - F-05: Coerción cero
      let valorPagoModerador = 0;
      if (conceptoRecaudo === "05") {
        valorPagoModerador = 0;
      } else {
        if (atencion.valorPagoModerador === undefined || atencion.valorPagoModerador === null) {
          valorPagoModerador = 0;
        } else {
          if (typeof atencion.valorPagoModerador !== "number" || !Number.isFinite(atencion.valorPagoModerador) || atencion.valorPagoModerador < 0) {
            throw new Error("valorPagoModerador debe ser un número finito mayor o igual a 0.");
          }
          valorPagoModerador = atencion.valorPagoModerador;
        }
      }

      // 12. numAutorizacion (S02)
      const numAutorizacion = cleanOptionalString(atencion.numAutorizacion);
      if (numAutorizacion && numAutorizacion.length > 30) {
        throw new Error("numAutorizacion no puede exceder 30 caracteres.");
      }

      // 13. idMIPRES (S03)
      const idMIPRES = cleanOptionalString(atencion.idMIPRES);
      if (idMIPRES && idMIPRES.length > 19) {
        throw new Error("idMIPRES no puede exceder 19 caracteres.");
      }

      // 14. numFEVPagoModerador (S15)
      const numFEVPagoModerador = conceptoRecaudo === "05" ? null : cleanOptionalString(atencion.numFEVPagoModerador);

      // 15. codigoVIDA (S17)
      const codigoVIDA = cleanOptionalString(atencion.codigoVIDA);
      if (codigoVIDA && codigoVIDA.length > 256) {
        throw new Error("codigoVIDA no puede exceder 256 caracteres.");
      }

      // 16. codPrestador (S01) - F-01: Preservar null normativo para proveedores no-REPS
      let codPrestadorOS = null;
      if (atencion.codPrestador === null) {
        codPrestadorOS = null; // No-REPS explícito
      } else if (atencion.codPrestador !== undefined) {
        const strPrestador = String(atencion.codPrestador).trim();
        if (strPrestador.length < 10 || strPrestador.length > 12) {
          throw new Error("codPrestador debe tener entre 10 y 12 dígitos REPS, o null si no aplica.");
        }
        codPrestadorOS = strPrestador;
      } else {
        codPrestadorOS = codPrestadorGeneral;
      }

      // 17. consecutivo (S16)
      const consecutivoOS = usuarioObj.servicios.otrosServicios.length + 1;

      usuarioObj.servicios.otrosServicios.push({
        codPrestador: codPrestadorOS,
        numAutorizacion,
        idMIPRES,
        fechaSuministroTecnologia,
        tipoOS,
        codTecnologiaSalud,
        nomTecnologiaSalud,
        cantidadOS,
        tipoDocumentoIdentificacion: tipoDocProfOS,
        numDocumentoIdentificacion: numDocProfOS,
        vrUnitOS,
        vrDispensacion,
        vrServicio,
        conceptoRecaudo,
        valorPagoModerador,
        numFEVPagoModerador,
        codigoVIDA,
        consecutivo: consecutivoOS,
      });

      continue;
    }

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

    // 6. VALIDACIÓN PRESTADOR (REPS Sede)
    const codPrestadorAtencion = cleanOptionalString(atencion.codPrestador) || codPrestadorGeneral;
    if (!codPrestadorAtencion || codPrestadorAtencion.length < 10) {
      throw new Error("Falta la identificación del prestador/profesional que atendió la consulta o procedimiento.");
    }

    // 7. VALIDACIÓN PROFESIONAL QUE ATENDIÓ / ORDENÓ EL SERVICIO (DT1 v003)
    if (!atencion.profesional || typeof atencion.profesional !== "object") {
      throw new Error("Cada atención debe incluir el objeto 'profesional'.");
    }
    const tipoDocProf = String(atencion.profesional.tipoDocumentoIdentificacion || "").trim().toUpperCase();
    if (!tipoDocProf) {
      throw new Error("tipoDocumentoIdentificacion del profesional es obligatorio.");
    }
    if (!TIPOS_DOC_PROFESIONAL_PERMITIDOS.includes(tipoDocProf)) {
      throw new Error(
        `INVALID_PROFESSIONAL_DOCUMENT_TYPE: tipoDocumentoIdentificacion '${tipoDocProf}' del profesional no es válido según DT1 v003 (permitidos: ${TIPOS_DOC_PROFESIONAL_PERMITIDOS.join(", ")}).`
      );
    }
    const numDocProf = String(atencion.profesional.numDocumentoIdentificacion || "").trim();
    if (!numDocProf) {
      throw new Error("numDocumentoIdentificacion del profesional es obligatorio.");
    }

    if (!atencion.fechaInicioAtencion || String(atencion.fechaInicioAtencion).trim() === "") {
      throw new Error("fechaInicioAtencion de la atención es obligatoria.");
    }
    const fechaInicioAtencion = String(atencion.fechaInicioAtencion).trim();

    // Tratamiento de CIE-11: Sin mapper artificial.
    // Si viene informado desde catálogo, se registra; si no, permanece null según Documento Técnico 1 v003.
    const codCie11 = cleanOptionalString(atencion.codDiagnosticoPrincipalCIE11);
    const nomCie11 = cleanOptionalString(atencion.nomCodDiagnosticoPrincipalCIE11);

    if (atencion.vrServicio === undefined || atencion.vrServicio === null || atencion.vrServicio === "") {
      throw new Error("vrServicio de la atención es obligatorio.");
    }
    const vrServicio = Number(atencion.vrServicio);
    if (isNaN(vrServicio) || vrServicio < 0) {
      throw new Error("vrServicio debe ser un número mayor o igual a 0.");
    }

    if (!atencion.conceptoRecaudo || String(atencion.conceptoRecaudo).trim() === "") {
      throw new Error("conceptoRecaudo de la atención es obligatorio.");
    }
    const conceptoRecaudo = String(atencion.conceptoRecaudo).trim().padStart(2, "0");

    const valorPagoModerador = atencion.valorPagoModerador !== undefined && atencion.valorPagoModerador !== null && atencion.valorPagoModerador !== ""
      ? Number(atencion.valorPagoModerador)
      : 0;

    if (atencion.tipoAtencion === "consulta") {
      // REGLA: Bloquear CUPS de procedimiento en consultas según catálogo oficial
      if (!cupsInfo.correspondeBloqueConsultas) {
        throw new Error(
          `El código CUPS '${explicitCups}' (${descripcionOficialCups}) está clasificado oficialmente como '${cupsInfo.tipoRips}' y no puede reportarse en el bloque de consultas.`
        );
      }

      if (!atencion.modalidad || String(atencion.modalidad).trim() === "") {
        throw new Error("modalidad de la consulta es obligatoria.");
      }
      if (!atencion.grupoServicios || String(atencion.grupoServicios).trim() === "") {
        throw new Error("grupoServicios de la consulta es obligatorio.");
      }
      if (!atencion.finalidad || String(atencion.finalidad).trim() === "") {
        throw new Error("finalidad de la consulta es obligatoria.");
      }
      if (!atencion.causaMotivoAtencion || String(atencion.causaMotivoAtencion).trim() === "") {
        throw new Error("causaMotivoAtencion de la consulta es obligatoria.");
      }
      if (!atencion.tipoDiagnosticoPrincipal || String(atencion.tipoDiagnosticoPrincipal).trim() === "") {
        throw new Error("tipoDiagnosticoPrincipal de la consulta es obligatorio.");
      }

      const consecutivoConsulta = usuarioObj.servicios.consultas.length + 1;
      usuarioObj.servicios.consultas.push({
        codPrestador: codPrestadorAtencion,
        fechaInicioAtencion,
        numAutorizacion: cleanOptionalString(atencion.numAutorizacion),
        codConsulta: explicitCups,
        modalidadGrupoServicioTecSal: String(atencion.modalidad).trim().padStart(2, "0"),
        grupoServicios: String(atencion.grupoServicios).trim().padStart(2, "0"),
        codServicio: codServicioNum,
        finalidadTecnologiaSalud: String(atencion.finalidad).trim().padStart(2, "0"),
        causaMotivoAtencion: String(atencion.causaMotivoAtencion).trim().padStart(2, "0"),
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
        tipoDiagnosticoPrincipal: String(atencion.tipoDiagnosticoPrincipal).trim().padStart(2, "0"),
        tipoDocumentoIdentificacion: tipoDocProf,
        numDocumentoIdentificacion: numDocProf,
        vrServicio,
        conceptoRecaudo,
        valorPagoModerador,
        numFEVPagoModerador: cleanOptionalString(atencion.numFEVPagoModerador),
        codigoVIDA: cleanOptionalString(atencion.codigoVIDA),
        consecutivo: consecutivoConsulta,
      });
    } else if (atencion.tipoAtencion === "procedimiento") {
      // Procedimiento
      // REGLA: Bloquear CUPS de consulta en procedimientos según catálogo oficial
      if (!cupsInfo.correspondeBloqueProcedimientos) {
        throw new Error(
          `El código CUPS '${explicitCups}' (${descripcionOficialCups}) está clasificado oficialmente como '${cupsInfo.tipoRips}' y no puede reportarse en el bloque de procedimientos.`
        );
      }

      if (!atencion.viaIngresoServicioSalud || String(atencion.viaIngresoServicioSalud).trim() === "") {
        throw new Error("viaIngresoServicioSalud del procedimiento es obligatoria.");
      }
      if (!atencion.modalidad || String(atencion.modalidad).trim() === "") {
        throw new Error("modalidad del procedimiento es obligatoria.");
      }
      if (!atencion.grupoServicios || String(atencion.grupoServicios).trim() === "") {
        throw new Error("grupoServicios del procedimiento es obligatorio.");
      }
      if (!atencion.finalidad || String(atencion.finalidad).trim() === "") {
        throw new Error("finalidad del procedimiento es obligatoria.");
      }

      const consecutivoProc = usuarioObj.servicios.procedimientos.length + 1;
      usuarioObj.servicios.procedimientos.push({
        codPrestador: codPrestadorAtencion,
        fechaInicioAtencion,
        idMIPRES: atencion.idMIPRES !== undefined && atencion.idMIPRES !== null ? Number(atencion.idMIPRES) : null,
        numAutorizacion: cleanOptionalString(atencion.numAutorizacion),
        codProcedimiento: explicitCups,
        viaIngresoServicioSalud: String(atencion.viaIngresoServicioSalud).trim().padStart(2, "0"),
        modalidadGrupoServicioTecSal: String(atencion.modalidad).trim().padStart(2, "0"),
        grupoServicios: String(atencion.grupoServicios).trim().padStart(2, "0"),
        codServicio: codServicioNum,
        finalidadTecnologiaSalud: String(atencion.finalidad).trim().padStart(2, "0"),
        codDiagnosticoPrincipal: codDxPrincipal,
        codDiagnosticoPrincipalCIE11: codCie11,
        nomCodDiagnosticoPrincipalCIE11: nomCie11,
        codDiagnosticoRelacionado: cleanOptionalString(atencion.codDiagnosticoRelacionado),
        codDiagnosticoRelacionadoCIE11: cleanOptionalString(atencion.codDiagnosticoRelacionadoCIE11),
        nomCodDiagnosticoRelacionadoCIE11: cleanOptionalString(atencion.nomCodDiagnosticoRelacionadoCIE11),
        codComplicacion: cleanOptionalString(atencion.codComplicacion || atencion.codDiagnosticoComplicacion),
        codComplicacionCIE11: cleanOptionalString(atencion.codComplicacionCIE11 || atencion.codDiagnosticoComplicacionCIE11),
        nomCodComplicacionCIE11: cleanOptionalString(atencion.nomCodComplicacionCIE11 || atencion.nomCodDiagnosticoComplicacionCIE11),
        tipoDocumentoIdentificacion: tipoDocProf,
        numDocumentoIdentificacion: numDocProf,
        vrServicio,
        conceptoRecaudo,
        valorPagoModerador,
        numFEVPagoModerador: cleanOptionalString(atencion.numFEVPagoModerador),
        codigoVIDA: cleanOptionalString(atencion.codigoVIDA),
        consecutivo: consecutivoProc,
      });
    } else {
      throw new Error(`tipoAtencion desconocido o no soportado: '${atencion.tipoAtencion}'. Permitidos: 'consulta', 'procedimiento', 'otrosServicios'.`);
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
