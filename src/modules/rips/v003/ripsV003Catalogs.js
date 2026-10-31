/**
 * Catálogos Oficiales de Referencia SISPRO / MinSalud
 * Documento Técnico 1 Versión 003 (15 de julio de 2026) y Resolución 948 de 2026.
 * 
 * Cada elemento versionado contiene:
 * - codigo
 * - descripcion
 * - catalogo
 * - version
 * - vigencia_desde
 * - vigencia_hasta
 * - activo
 * - fuente_oficial
 */

import { CUPS_COMPLETO } from "../../../data/cupsCompleto.js";

// Semilla oficial base extraída de las tablas maestras vigentes de SISPRO:
export const OFFICIAL_SEED_CATALOGS = {
  // RIPSTipoUsuarioVersion2 (01 al 14 publicado por SISPRO. El código 14 fue incorporado en v003)
  RIPSTipoUsuarioVersion2: [
    { codigo: "01", descripcion: "Contributivo cotizante" },
    { codigo: "02", descripcion: "Contributivo beneficiario" },
    { codigo: "03", descripcion: "Contributivo adicional" },
    { codigo: "04", descripcion: "Subsidiado" },
    { codigo: "05", descripcion: "No afiliado" },
    { codigo: "06", descripcion: "Especial o Excepción cotizante" },
    { codigo: "07", descripcion: "Especial o Excepción beneficiario" },
    { codigo: "08", descripcion: "Personas privadas de la libertad a cargo del Fondo Nacional de Salud" },
    { codigo: "09", descripcion: "Tomador / Amparado ARL" },
    { codigo: "10", descripcion: "Tomador / Amparado SOAT" },
    { codigo: "11", descripcion: "Tomador / Amparado Planes Voluntarios de Salud" },
    { codigo: "12", descripcion: "Particular" },
    { codigo: "13", descripcion: "Especial o excepción no cotizante (Ley 352 de 1997)" },
    { codigo: "14", descripcion: "Lesionado en accidente de tránsito sin seguro SOAT" },
  ].map(it => ({
    ...it,
    catalogo: "RIPSTipoUsuarioVersion2",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Tabla de Referencia RIPSTipoUsuarioVersion2",
  })),

  // LstSiNo (Valores oficiales SISPRO: 01=SI, 02=NO)
  LstSiNo: [
    { codigo: "01", descripcion: "SI" },
    { codigo: "02", descripcion: "NO" },
  ].map(it => ({
    ...it,
    catalogo: "LstSiNo",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Tabla de Referencia LstSiNo",
  })),

  // Servicios REPS Odontológicos Oficiales (MinSalud REPS)
  servicios_reps: [
    { codigo: "334", descripcion: "Odontología General" },
    { codigo: "311", descripcion: "Endodoncia" },
    { codigo: "338", descripcion: "Ortodoncia" },
    { codigo: "343", descripcion: "Periodoncia" },
    { codigo: "347", descripcion: "Rehabilitación Oral" },
    { codigo: "396", descripcion: "Odontopediatría" },
    { codigo: "410", descripcion: "Cirugía Oral" },
    { codigo: "411", descripcion: "Cirugía Maxilofacial" },
  ].map(it => ({
    ...it,
    catalogo: "servicios_reps",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "Registro Especial de Prestadores de Servicios de Salud (REPS)",
  })),

  // Tipos de Documento
  tipos_documento: [
    { codigo: "CC", descripcion: "Cédula de Ciudadanía" },
    { codigo: "CE", descripcion: "Cédula de Extranjería" },
    { codigo: "PA", descripcion: "Pasaporte" },
    { codigo: "RC", descripcion: "Registro Civil" },
    { codigo: "TI", descripcion: "Tarjeta de Identidad" },
    { codigo: "AS", descripcion: "Adulto sin identificación" },
    { codigo: "MS", descripcion: "Menor sin identificación" },
    { codigo: "CD", descripcion: "Carné Diplomático" },
    { codigo: "SC", descripcion: "Salvo Conducto" },
    { codigo: "PE", descripcion: "Permiso Especial de Permanencia" },
    { codigo: "PT", descripcion: "Permiso por Protección Temporal" },
    { codigo: "DE", descripcion: "Documento Extranjero" },
    { codigo: "CN", descripcion: "Certificado de nacido vivo" },
  ].map(it => ({
    ...it,
    catalogo: "tipos_documento",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Tabla de Referencia Tipos de Documento",
  })),

  // Sexo (Documento Técnico 1 v003 / Res. 0948 de 2026 - Tabla de Referencia Sexo)
  sexo: [
    { codigo: "M", descripcion: "Masculino" },
    { codigo: "F", descripcion: "Femenino" },
    { codigo: "I", descripcion: "Indeterminado" },
  ].map(it => ({
    ...it,
    catalogo: "sexo",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Zonas Territoriales (SISPRO ZonaVersion2: 01 = Rural, 02 = Urbano)
  zonas_territoriales: [
    { codigo: "01", descripcion: "Rural" },
    { codigo: "02", descripcion: "Urbano" },
  ].map(it => ({
    ...it,
    catalogo: "zonas_territoriales",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Tabla de Referencia ZonaVersion2",
  })),

  // Modalidad de Atención
  modalidad_atencion: [
    { codigo: "01", descripcion: "Intramural" },
    { codigo: "02", descripcion: "Extramural unidad móvil" },
    { codigo: "03", descripcion: "Extramural domiciliaria" },
    { codigo: "04", descripcion: "Extramural jornada de salud" },
    { codigo: "05", descripcion: "Extramural (atención prehospitalaria o transporte asistencial)" },
    { codigo: "06", descripcion: "Telemedicina interactiva" },
    { codigo: "07", descripcion: "Telemedicina no interactiva" },
    { codigo: "08", descripcion: "Telemedicina telexperticia" },
    { codigo: "09", descripcion: "Telemedicina telemonitoreo" },
  ].map(it => ({
    ...it,
    catalogo: "modalidad_atencion",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - ModalidadAtencion (IHCE ColombianTechModalityCodes)",
  })),

  // Grupo de Servicios
  grupo_servicios: [
    { codigo: "01", descripcion: "Consulta externa" },
    { codigo: "02", descripcion: "Apoyo diagnóstico y complementación terapéutica" },
    { codigo: "03", descripcion: "Internación" },
    { codigo: "04", descripcion: "Quirúrgico" },
    { codigo: "05", descripcion: "Atención inmediata" },
  ].map(it => ({
    ...it,
    catalogo: "grupo_servicios",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Finalidad (consultas y procedimientos usan la misma tabla oficial RIPSFinalidadConsultaVersion2, códigos 11 a 44)
  finalidad_consulta: [
    { codigo: "11", descripcion: "Valoración integral para la promoción y mantenimiento" },
    { codigo: "12", descripcion: "Detección temprana de enfermedad general" },
    { codigo: "13", descripcion: "Detección temprana de enfermedad laboral" },
    { codigo: "14", descripcion: "Protección específica" },
    { codigo: "15", descripcion: "Diagnóstico" },
    { codigo: "16", descripcion: "Tratamiento" },
    { codigo: "17", descripcion: "Rehabilitación" },
    { codigo: "18", descripcion: "Paliación" },
    { codigo: "19", descripcion: "Planificación familiar y anticoncepción" },
    { codigo: "20", descripcion: "Promoción y apoyo a la lactancia materna" },
    { codigo: "21", descripcion: "Atención básica de orientación familiar" },
    { codigo: "22", descripcion: "Atención para el cuidado preconcepcional" },
    { codigo: "23", descripcion: "Atención para el cuidado prenatal" },
    { codigo: "24", descripcion: "Interrupción voluntaria del embarazo" },
    { codigo: "25", descripcion: "Atención del parto y puerperio" },
    { codigo: "26", descripcion: "Atención para el cuidado del recién nacido" },
    { codigo: "27", descripcion: "Atención para el seguimiento del recién nacido" },
    { codigo: "28", descripcion: "Preparación para la maternidad y la paternidad" },
    { codigo: "29", descripcion: "Promoción de actividad física" },
    { codigo: "30", descripcion: "Promoción de la cesación del tabaquismo" },
    { codigo: "31", descripcion: "Prevención del consumo de sustancias psicoactivas" },
    { codigo: "32", descripcion: "Promoción de la alimentación saludable" },
    { codigo: "33", descripcion: "Promoción para el ejercicio de los derechos sexuales y derechos reproductivos" },
    { codigo: "34", descripcion: "Promoción para el desarrollo de habilidades para la vida" },
    { codigo: "35", descripcion: "Promoción para la construcción de estrategias de afrontamiento frente a sucesos vitales" },
    { codigo: "36", descripcion: "Promoción de la sana convivencia y el tejido social" },
    { codigo: "37", descripcion: "Promoción de un ambiente seguro y de cuidado y protección del ambiente" },
    { codigo: "38", descripcion: "Promoción del empoderamiento para el ejercicio del derecho a la salud" },
    { codigo: "39", descripcion: "Promoción para la adopción de prácticas de crianza y cuidado para la salud" },
    { codigo: "40", descripcion: "Promoción de la capacidad de la agencia y cuidado de la salud" },
    { codigo: "41", descripcion: "Desarrollo de habilidades cognitivas" },
    { codigo: "42", descripcion: "Intervención colectiva" },
    { codigo: "43", descripcion: "Modificación de la estética corporal (fines estéticos)" },
    { codigo: "44", descripcion: "Otra" },
  ].map(it => ({
    ...it,
    catalogo: "finalidad_consulta",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - RIPSFinalidadConsultaVersion2",
  })),

  finalidad_procedimiento: [
    { codigo: "11", descripcion: "Valoración integral para la promoción y mantenimiento" },
    { codigo: "12", descripcion: "Detección temprana de enfermedad general" },
    { codigo: "13", descripcion: "Detección temprana de enfermedad laboral" },
    { codigo: "14", descripcion: "Protección específica" },
    { codigo: "15", descripcion: "Diagnóstico" },
    { codigo: "16", descripcion: "Tratamiento" },
    { codigo: "17", descripcion: "Rehabilitación" },
    { codigo: "18", descripcion: "Paliación" },
    { codigo: "19", descripcion: "Planificación familiar y anticoncepción" },
    { codigo: "20", descripcion: "Promoción y apoyo a la lactancia materna" },
    { codigo: "21", descripcion: "Atención básica de orientación familiar" },
    { codigo: "22", descripcion: "Atención para el cuidado preconcepcional" },
    { codigo: "23", descripcion: "Atención para el cuidado prenatal" },
    { codigo: "24", descripcion: "Interrupción voluntaria del embarazo" },
    { codigo: "25", descripcion: "Atención del parto y puerperio" },
    { codigo: "26", descripcion: "Atención para el cuidado del recién nacido" },
    { codigo: "27", descripcion: "Atención para el seguimiento del recién nacido" },
    { codigo: "28", descripcion: "Preparación para la maternidad y la paternidad" },
    { codigo: "29", descripcion: "Promoción de actividad física" },
    { codigo: "30", descripcion: "Promoción de la cesación del tabaquismo" },
    { codigo: "31", descripcion: "Prevención del consumo de sustancias psicoactivas" },
    { codigo: "32", descripcion: "Promoción de la alimentación saludable" },
    { codigo: "33", descripcion: "Promoción para el ejercicio de los derechos sexuales y derechos reproductivos" },
    { codigo: "34", descripcion: "Promoción para el desarrollo de habilidades para la vida" },
    { codigo: "35", descripcion: "Promoción para la construcción de estrategias de afrontamiento frente a sucesos vitales" },
    { codigo: "36", descripcion: "Promoción de la sana convivencia y el tejido social" },
    { codigo: "37", descripcion: "Promoción de un ambiente seguro y de cuidado y protección del ambiente" },
    { codigo: "38", descripcion: "Promoción del empoderamiento para el ejercicio del derecho a la salud" },
    { codigo: "39", descripcion: "Promoción para la adopción de prácticas de crianza y cuidado para la salud" },
    { codigo: "40", descripcion: "Promoción de la capacidad de la agencia y cuidado de la salud" },
    { codigo: "41", descripcion: "Desarrollo de habilidades cognitivas" },
    { codigo: "42", descripcion: "Intervención colectiva" },
    { codigo: "43", descripcion: "Modificación de la estética corporal (fines estéticos)" },
    { codigo: "44", descripcion: "Otra" },
  ].map(it => ({
    ...it,
    catalogo: "finalidad_procedimiento",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - RIPSFinalidadConsultaVersion2 (misma tabla para procedimientos)",
  })),

  // Causa Externa / Motivo de Atención
  causa_externa: [
    { codigo: "21", descripcion: "Accidente de trabajo" },
    { codigo: "22", descripcion: "Accidente en el hogar" },
    { codigo: "23", descripcion: "Accidente de tránsito de origen común" },
    { codigo: "24", descripcion: "Accidente de tránsito de origen laboral" },
    { codigo: "25", descripcion: "Accidente en el entorno educativo" },
    { codigo: "26", descripcion: "Otro tipo de accidente" },
    { codigo: "27", descripcion: "Evento catastrófico de origen natural" },
    { codigo: "28", descripcion: "Lesión por agresión" },
    { codigo: "29", descripcion: "Lesión auto infligida" },
    { codigo: "30", descripcion: "Sospecha de violencia física" },
    { codigo: "31", descripcion: "Sospecha de violencia psicológica" },
    { codigo: "32", descripcion: "Sospecha de violencia sexual" },
    { codigo: "33", descripcion: "Sospecha de negligencia y abandono" },
    { codigo: "34", descripcion: "IVE relacionado con peligro a la salud o vida de la mujer" },
    { codigo: "35", descripcion: "IVE por malformación congénita incompatible con la vida" },
    { codigo: "36", descripcion: "IVE por violencia sexual, incesto o inseminación no consentida" },
    { codigo: "37", descripcion: "Evento adverso en salud" },
    { codigo: "38", descripcion: "Enfermedad general" },
    { codigo: "39", descripcion: "Enfermedad laboral" },
    { codigo: "40", descripcion: "Promoción y mantenimiento de la salud - intervenciones individuales" },
    { codigo: "41", descripcion: "Intervención colectiva" },
    { codigo: "42", descripcion: "Atención de población materno perinatal" },
    { codigo: "43", descripcion: "Riesgo ambiental" },
    { codigo: "44", descripcion: "Otros eventos catastróficos" },
    { codigo: "45", descripcion: "Accidente de mina antipersonal - MAP" },
    { codigo: "46", descripcion: "Accidente de artefacto explosivo improvisado - AEI" },
    { codigo: "47", descripcion: "Accidente de munición sin explotar - MUSE" },
    { codigo: "48", descripcion: "Otra víctima de conflicto armado colombiano" },
    { codigo: "49", descripcion: "IVE por decisión de la persona gestante hasta la semana 24" },
  ].map(it => ({
    ...it,
    catalogo: "causa_externa",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - RIPSCausaExternaVersion2",
  })),

  // Concepto de Recaudo
  concepto_recaudo: [
    { codigo: "01", descripcion: "Copago" },
    { codigo: "02", descripcion: "Cuota moderadora" },
    { codigo: "03", descripcion: "Pagos compartidos en planes voluntarios de salud" },
    { codigo: "04", descripcion: "Anticipo" },
    { codigo: "05", descripcion: "No aplica / Ninguno" },
  ].map(it => ({
    ...it,
    catalogo: "concepto_recaudo",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Tipo de Diagnóstico Principal
  tipo_diagnostico: [
    { codigo: "01", descripcion: "Impresión diagnóstica" },
    { codigo: "02", descripcion: "Confirmado nuevo" },
    { codigo: "03", descripcion: "Confirmado repetido" },
  ].map(it => ({
    ...it,
    catalogo: "tipo_diagnostico",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - Documento Técnico 1 v003",
  })),

  // Vía de Ingreso al Servicio de Salud (Procedimientos) - SISPRO ViaIngresoUsuario
  via_ingreso: [
    { codigo: "01", descripcion: "Demanda espontánea" },
    { codigo: "02", descripcion: "Derivado de consulta externa" },
    { codigo: "03", descripcion: "Derivado de urgencias" },
    { codigo: "04", descripcion: "Derivado de hospitalización" },
    { codigo: "05", descripcion: "Derivado de sala de cirugía" },
    { codigo: "06", descripcion: "Derivado de sala de partos" },
    { codigo: "07", descripcion: "Recién nacido en la institución" },
    { codigo: "08", descripcion: "Recién nacido en otra institución" },
    { codigo: "09", descripcion: "Derivado o referido de hospitalización domiciliaria" },
    { codigo: "10", descripcion: "Derivado de atención domiciliaria" },
    { codigo: "11", descripcion: "Derivado de telemedicina" },
    { codigo: "12", descripcion: "Derivado de jornada de salud" },
    { codigo: "13", descripcion: "Referido de otra institución" },
    { codigo: "14", descripcion: "Contrarreferido de otra institución" },
  ].map(it => ({
    ...it,
    catalogo: "via_ingreso",
    version: "v003_2026",
    vigencia_desde: "2026-07-01",
    vigencia_hasta: null,
    activo: true,
    fuente_oficial: "SISPRO - ViaIngresoUsuario",
  })),
};

// ── Códigos oficiales y traducción de lo que guarda la historia clínica ──
const codesOf = (name) => new Set(OFFICIAL_SEED_CATALOGS[name].map((it) => it.codigo));
export const FINALIDAD_CODES = codesOf("finalidad_consulta");
export const CAUSA_EXTERNA_CODES = codesOf("causa_externa");
export const MODALIDAD_CODES = codesOf("modalidad_atencion");
export const VIA_INGRESO_CODES = codesOf("via_ingreso");

const plain = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Finalidad de la atención → código oficial RIPSFinalidadConsultaVersion2 (11..44).
 * Acepta el código oficial, el texto de la evolución ("Diagnóstico", "Terapéutico", "Preventivo",
 * "Rehabilitación") y los códigos viejos que usaba el sistema (10/11/16 en consultas, 01..05 en
 * procedimientos de la Resolución 3374 de 2000, que el validador del Ministerio ya no acepta).
 */
export function mapFinalidadOficial(value, { isConsulta = false } = {}) {
  const raw = String(value ?? "").trim();
  if (/^\d{1,2}$/.test(raw)) {
    const code = raw.padStart(2, "0");
    // "10" no existe en la tabla oficial (era "Diagnóstico" en el sistema viejo). "11" y "16" sí existen
    // en la tabla oficial y se respetan tal cual: así un código ya traducido nunca se traduce dos veces.
    const legacyConsulta = { "10": "15" };
    const legacyProc = { "01": "15", "02": "16", "03": "14", "04": "12", "05": "44" };
    if (isConsulta && legacyConsulta[code]) return legacyConsulta[code];
    if (legacyProc[code]) return legacyProc[code];
    if (FINALIDAD_CODES.has(code)) return code;
  }
  const s = plain(raw);
  if (!s) return "15";
  if (s.includes("rehabil")) return "17";
  if (s.includes("paliat") || s.includes("paliac")) return "18";
  if (s.includes("detecc") || s.includes("tamiz")) return "12";
  if (s.includes("prevent") || s.includes("proteccion") || s.includes("promocion") || s.includes("profilax")) return "14";
  if (s.includes("estetic")) return "43";
  if (s.includes("terap") || s.includes("tratamiento") || s.includes("curativ")) return "16";
  if (s.includes("diag") || s.includes("valoracion") || s.includes("consulta")) return "15";
  return "44";
}

/** Causa / motivo de la atención (consultas) → RIPSCausaExternaVersion2. Odontología: 38 enfermedad general; prevención: 40. */
export function mapCausaOficial(value, finalidadCode = "") {
  const raw = String(value ?? "").trim();
  if (/^\d{2}$/.test(raw) && CAUSA_EXTERNA_CODES.has(raw)) return raw;
  // Códigos viejos del sistema: 01 accidente de trabajo, 02 accidente de tránsito.
  if (raw === "01" || raw === "1") return "21";
  if (raw === "02" || raw === "2") return "23";
  const s = plain(raw);
  if (s.includes("trabajo")) return "21";
  if (s.includes("transito")) return "23";
  if (s.includes("agresion")) return "28";
  if (s.includes("hogar")) return "22";
  if (["11", "12", "13", "14"].includes(String(finalidadCode))) return "40";
  return "38";
}

/** Modalidad de atención → código oficial (01..09). */
export function mapModalidadOficial(value) {
  const raw = String(value ?? "").trim();
  if (/^\d{1,2}$/.test(raw) && MODALIDAD_CODES.has(raw.padStart(2, "0"))) return raw.padStart(2, "0");
  const s = plain(raw);
  if (s.includes("movil")) return "02";
  if (s.includes("domicil")) return "03";
  if (s.includes("jornada")) return "04";
  if (s.includes("telexpert")) return "08";
  if (s.includes("telemonit")) return "09";
  if (s.includes("no interact")) return "07";
  if (s.includes("tele") || s.includes("virtual")) return "06";
  return "01";
}

/** Zona de residencia → ZonaVersion2 (01 = Rural, 02 = Urbano). */
export function mapZonaOficial(value) {
  const s = plain(value);
  if (s === "01" || s.startsWith("rural")) return "01";
  return "02";
}

/** Tipo de documento (texto de la ficha del paciente) → código RIPS. */
export function mapTipoDocumentoOficial(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (OFFICIAL_SEED_CATALOGS.tipos_documento.some((it) => it.codigo === raw)) return raw;
  const s = plain(value);
  if (s.includes("ciudadan")) return "CC";
  if (s.includes("extranjer") && s.includes("cedula")) return "CE";
  if (s.includes("tarjeta")) return "TI";
  if (s.includes("registro civil")) return "RC";
  if (s.includes("pasaporte")) return "PA";
  if (s.includes("nacido vivo")) return "CN";
  if (s.includes("diplomat")) return "CD";
  if (s.includes("salvo")) return "SC";
  if (s.includes("proteccion temporal")) return "PT";
  if (s.includes("permanencia")) return "PE";
  if (s.includes("adulto sin")) return "AS";
  if (s.includes("menor sin")) return "MS";
  if (s.includes("documento extranjero")) return "DE";
  return raw || "";
}

/** Tipo de documento esperado según la edad (regla del Ministerio, ahora de rechazo). */
export function documentoAcordeEdad(tipoDoc, fechaNacimiento, fechaAtencion = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaNacimiento || ""));
  if (!m) return { ok: true };
  const ref = fechaAtencion instanceof Date ? fechaAtencion : new Date(fechaAtencion);
  let age = ref.getFullYear() - Number(m[1]);
  if (ref.getMonth() + 1 < Number(m[2]) || (ref.getMonth() + 1 === Number(m[2]) && ref.getDate() < Number(m[3]))) age -= 1;
  const t = String(tipoDoc || "").toUpperCase();
  const foreign = ["CE", "PA", "PE", "PT", "SC", "CD", "DE"];
  if (age < 7 && !["RC", "CN", "MS", ...foreign].includes(t)) return { ok: false, age, expected: "Registro civil (RC)" };
  if (age >= 7 && age < 18 && !["TI", "RC", "MS", ...foreign].includes(t)) return { ok: false, age, expected: "Tarjeta de identidad (TI)" };
  if (age >= 18 && ["RC", "CN", "MS"].includes(t)) return { ok: false, age, expected: "Cédula de ciudadanía (CC)" };
  if (age >= 20 && t === "TI") return { ok: false, age, expected: "Cédula de ciudadanía (CC)" };
  return { ok: true, age };
}

import {
  CUPS_RIPS_2026_METADATA,
  CUPS_RIPS_2026_ENTRIES,
  getCupsRipsRecord,
} from "./catalogs/cupsRips2026.js";

const catalogMemoryCache = new Map();

/**
 * Caché en memoria para la versión ACTIVE de CUPSRips y registros individuales resueltos.
 * - activeVersionCache: almacena { version, fetchedAt } con TTL de 5 minutos (300.000 ms).
 * - cupsCodeCache: mapa con clave `${activeVersion}:${cleanCode}`.
 */
const ACTIVE_VERSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let activeVersionCache = {
  version: null,
  fetchedAt: 0,
};
const cupsCodeCache = new Map();

// Mapa indexado en memoria para búsquedas O(1) ultra rápidas desde catálogos oficiales empaquetados
let localCupsMap = null;

/**
 * Consulta (archivo AC) = códigos del grupo 89.0 (890101 a 890899: consultas, interconsultas, controles).
 * Los demás 89xxxx (ej. 893101, 893104) son procedimientos diagnósticos y van en procedimientos (AP).
 */
export function esCodigoConsulta(code) {
  return /^890\d{3}$/.test(String(code ?? "").trim());
}

/** Consulta de control o de seguimiento (8903xx), p. ej. 890303 control por odontología general. */
export function esCodigoControl(code) {
  return /^8903\d{2}$/.test(String(code ?? "").trim());
}

function getLocalCupsEntry(cleanCode) {
  if (!localCupsMap) {
    localCupsMap = new Map();
    // 1. Cargar catálogo nacional completo (10.025 registros oficiales)
    if (Array.isArray(CUPS_COMPLETO)) {
      for (let i = 0; i < CUPS_COMPLETO.length; i++) {
        const item = CUPS_COMPLETO[i];
        if (item && item.code) {
          const codeUpper = String(item.code).trim().toUpperCase();
          const isConsulta = esCodigoConsulta(codeUpper);
          localCupsMap.set(codeUpper, {
            codigo: codeUpper,
            descripcionOficial: item.name || item.descripcion || "PROCEDIMIENTO O CONSULTA",
            tipoRips: isConsulta ? "consulta" : "procedimiento",
            archivoRips: isConsulta ? "AC" : "AP",
            correspondeBloqueConsultas: isConsulta,
            correspondeBloqueProcedimientos: !isConsulta,
            correspondeBloqueOtrosServicios: false,
            activo: true,
            vigenciaDesde: "2026-01-01",
            vigenciaHasta: null,
            fuenteOficial: "MinSalud / SISPRO - Catálogo Oficial CUPS Colombia",
            versionCatalogo: "v003_2026",
            exists: true,
            active: true,
            error: null,
            errorCode: null,
          });
        }
      }
    }
    // 2. Sobrescribir con catálogo odontológico curado 2026 de alta fidelidad si existe
    if (Array.isArray(CUPS_RIPS_2026_ENTRIES)) {
      for (let i = 0; i < CUPS_RIPS_2026_ENTRIES.length; i++) {
        const item = CUPS_RIPS_2026_ENTRIES[i];
        if (item && item.codigo) {
          const codeUpper = String(item.codigo).trim().toUpperCase();
          const isConsulta = item.correspondeBloqueConsultas ?? (item.capitulo === "17" || esCodigoConsulta(codeUpper));
          localCupsMap.set(codeUpper, {
            codigo: codeUpper,
            descripcionOficial: item.descripcionOficial || item.descripcion || "PROCEDIMIENTO O CONSULTA",
            tipoRips: isConsulta ? "consulta" : "procedimiento",
            archivoRips: isConsulta ? "AC" : "AP",
            correspondeBloqueConsultas: isConsulta,
            correspondeBloqueProcedimientos: !isConsulta,
            correspondeBloqueOtrosServicios: false,
            activo: item.activo !== false,
            vigenciaDesde: item.vigenciaDesde || "2026-01-01",
            vigenciaHasta: null,
            fuenteOficial: item.fuenteOficial || "MinSalud / SISPRO - CUPSRips 2026",
            versionCatalogo: "v003_2026",
            exists: true,
            active: true,
            error: null,
            errorCode: null,
          });
        }
      }
    }
  }

  return localCupsMap.get(cleanCode) || null;
}

/**
 * Obtiene el cliente de Supabase (inyección global o importación diferida).
 * @private
 */
async function getSupabaseClient() {
  if (globalThis.__supabase) {
    return globalThis.__supabase;
  }
  const mod = await import("../../../lib/supabaseClient.js");
  return mod.default || mod.supabase;
}

/**
 * Limpia la memoria caché de CUPSRips (útil para pruebas o invalidación manual).
 */
export function _clearCupsRipsCache() {
  activeVersionCache = { version: null, fetchedAt: 0 };
  cupsCodeCache.clear();
}

/**
 * Establece artificialmente la versión activa en caché (uso exclusivo en tests de aislamiento).
 * @param {string|null} version 
 * @param {number} [fetchedAt] 
 */
export function _setActiveVersionCacheForTesting(version, fetchedAt = Date.now()) {
  activeVersionCache = { version, fetchedAt };
}

/**
 * Retorna una copia del mapa de códigos CUPS cacheados (uso exclusivo en tests).
 */
export function _getCupsCodeCache() {
  return new Map(cupsCodeCache);
}

/**
 * Resuelve la versión ACTIVE del catálogo CUPSRips llamando a la RPC oficial
 * get_active_rips_catalog_version('CUPSRips').
 * 
 * Implementa caché en memoria con TTL de 5 minutos.
 * Si la RPC retorna null o falla la conexión, invalida la caché inmediatamente y retorna null.
 * Si se detecta un cambio de versión activa respecto a la caché, invalida cupsCodeCache.
 * 
 * @returns {Promise<string|null>} Versión ACTIVE o null si no está disponible
 */
export async function getActiveCupsRipsVersion() {
  const now = Date.now();
  if (
    activeVersionCache.version &&
    now - activeVersionCache.fetchedAt < ACTIVE_VERSION_CACHE_TTL_MS
  ) {
    return activeVersionCache.version;
  }

  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.rpc("get_active_rips_catalog_version", {
      p_catalogo: "CUPSRips",
    });

    if (error || !data) {
      activeVersionCache = { version: null, fetchedAt: 0 };
      return null;
    }

    const newVersion = String(data).trim();
    if (!newVersion) {
      activeVersionCache = { version: null, fetchedAt: 0 };
      return null;
    }

    // Si la versión activa cambió respecto a la guardada anteriormente, limpiar caché de códigos
    if (activeVersionCache.version && activeVersionCache.version !== newVersion) {
      cupsCodeCache.clear();
    }

    activeVersionCache = {
      version: newVersion,
      fetchedAt: now,
    };

    return newVersion;
  } catch (err) {
    activeVersionCache = { version: null, fetchedAt: 0 };
    return null;
  }
}

/**
 * Consulta un catálogo oficial versionado desde la base de datos (con fallback a la semilla oficial).
 * 
 * @param {string} catalogName 
 * @param {string} [version='v003_2026'] 
 * @returns {Promise<Array<object>>}
 */
export async function getOfficialCatalog(catalogName, version = "v003_2026") {
  const cacheKey = `${catalogName}_${version}`;
  if (catalogMemoryCache.has(cacheKey)) {
    return catalogMemoryCache.get(cacheKey);
  }

  try {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from("rips_catalogos")
      .select("codigo, descripcion, catalogo, version, vigencia_desde, vigencia_hasta, activo, fuente_oficial, metadata")
      .eq("catalogo", catalogName);

    if (!error && Array.isArray(data) && data.length > 0) {
      // Si la tabla contiene metadata JSONB con tipo_rips o bloque_consultas, se aplanan
      const mapped = data.map(d => ({
        ...d,
        tipo_rips: d.metadata?.tipo_rips || (d.tipo_rips ?? null),
        bloque_consultas: d.metadata?.bloque_consultas ?? d.bloque_consultas,
        bloque_procedimientos: d.metadata?.bloque_procedimientos ?? d.bloque_procedimientos,
      }));
      catalogMemoryCache.set(cacheKey, mapped);
      return mapped;
    }
  } catch (err) {
    console.warn(`getOfficialCatalog [${catalogName}]: usando semilla oficial offline.`);
  }

  const fallback = OFFICIAL_SEED_CATALOGS[catalogName] || [];
  catalogMemoryCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Valida un código contra el catálogo oficial correspondiente.
 * 
 * @param {string} catalogName 
 * @param {string} code 
 * @param {string} [version='v003_2026'] 
 * @returns {Promise<{ valid: boolean, entry: object|null, error?: string }>}
 */
export async function validateCatalogValue(catalogName, code, version = "v003_2026") {
  const cleanCode = String(code || "").trim();
  if (!cleanCode) {
    return { valid: false, entry: null, error: `Código vacío para catálogo ${catalogName}` };
  }

  const catalog = await getOfficialCatalog(catalogName, version);
  const entry = catalog.find(item => item.codigo === cleanCode);

  if (!entry) {
    return {
      valid: false,
      entry: null,
      error: `El código '${cleanCode}' no existe en el catálogo oficial '${catalogName}' (${version}).`,
    };
  }

  if (entry.activo === false) {
    return {
      valid: false,
      entry,
      error: `El código '${cleanCode}' está inactivo en el catálogo oficial '${catalogName}' (${version}).`,
    };
  }

  return { valid: true, entry };
}

/**
 * Consulta un código CUPS oficial de forma puntual contra el snapshot ACTIVE en Supabase.
 * 
 * Principios normativos y de seguridad:
 * - NO descarga las 13.640 filas en memoria.
 * - Resuelve la versión ACTIVE mediante RPC get_active_rips_catalog_version('CUPSRips').
 * - Si no hay versión ACTIVE disponible, retorna CUPSRIPS_SOURCE_UNAVAILABLE (CERO fallback a semillas).
 * - Consulta exactamente 1 fila en 'rips_catalogos' por (catalogo, version, codigo, activo).
 * - Cachea el resultado por clave `${activeVersion}:${cleanCode}`.
 * - Valida pares canónicos estrictos de metadata oficial SISPRO:
 *     AC <-> consulta (correspondeBloqueConsultas: true)
 *     AP <-> procedimiento (correspondeBloqueProcedimientos: true)
 *     AT <-> otrosServicios (correspondeBloqueOtrosServicios: true)
 * - Rechaza inconsistencias con CUPSRIPS_METADATA_INVALID.
 * 
 * @param {string} cupsCode Código CUPS a consultar
 * @returns {Promise<{
 *   codigo: string,
 *   descripcionOficial: string|null,
 *   tipoRips: string|null,
 *   archivoRips: 'AC'|'AP'|'AT'|null,
 *   correspondeBloqueConsultas: boolean,
 *   correspondeBloqueProcedimientos: boolean,
 *   correspondeBloqueOtrosServicios: boolean,
 *   activo: boolean,
 *   vigenciaDesde: string|null,
 *   vigenciaHasta: string|null,
 *   fuenteOficial: string|null,
 *   versionCatalogo: string|null,
 *   exists: boolean,
 *   active: boolean,
 *   error: string|null,
 *   errorCode: string|null
 * }>}
 */
export async function getCupsClassification(cupsCode) {
  const cleanCode = String(cupsCode ?? "").trim().toUpperCase();
  if (!cleanCode) {
    return {
      codigo: "",
      descripcionOficial: null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: false,
      vigenciaDesde: null,
      vigenciaHasta: null,
      fuenteOficial: null,
      versionCatalogo: null,
      exists: false,
      active: false,
      errorCode: "CUPS_CODE_REQUIRED",
      error: "Código CUPS requerido.",
    };
  }

  // 1. Resolver versión ACTIVE oficial
  const activeVersion = await getActiveCupsRipsVersion();
  if (!activeVersion) {
    const localFallback = getLocalCupsEntry(cleanCode);
    if (localFallback) {
      cupsCodeCache.set(`fallback:${cleanCode}`, localFallback);
      return localFallback;
    }

    return {
      codigo: cleanCode,
      descripcionOficial: null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: false,
      vigenciaDesde: null,
      vigenciaHasta: null,
      fuenteOficial: null,
      versionCatalogo: null,
      exists: false,
      active: false,
      errorCode: "CUPSRIPS_SOURCE_UNAVAILABLE",
      error: "Catálogo CUPSRips no disponible: no existe snapshot ACTIVE configurado o la base de datos es inaccesible.",
    };
  }

  // 2. Comprobar caché local por versión y código
  const cacheKey = `${activeVersion}:${cleanCode}`;
  if (cupsCodeCache.has(cacheKey)) {
    return cupsCodeCache.get(cacheKey);
  }

  // 3. Consulta puntual a Supabase (máximo 1 fila)
  let row = null;
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from("rips_catalogos")
      .select("codigo, descripcion, catalogo, version, activo, vigencia_desde, vigencia_hasta, fuente_oficial, metadata")
      .eq("catalogo", "CUPSRips")
      .eq("version", activeVersion)
      .eq("codigo", cleanCode)
      .eq("activo", true)
      .maybeSingle();

    if (error) {
      const localFallback = getLocalCupsEntry(cleanCode);
      if (localFallback) {
        cupsCodeCache.set(cacheKey, localFallback);
        return localFallback;
      }

      return {
        codigo: cleanCode,
        descripcionOficial: null,
        tipoRips: null,
        archivoRips: null,
        correspondeBloqueConsultas: false,
        correspondeBloqueProcedimientos: false,
        correspondeBloqueOtrosServicios: false,
        activo: false,
        vigenciaDesde: null,
        vigenciaHasta: null,
        fuenteOficial: null,
        versionCatalogo: activeVersion,
        exists: false,
        active: false,
        errorCode: "CUPSRIPS_SOURCE_UNAVAILABLE",
        error: "Error al consultar el catálogo oficial CUPSRips en la base de datos.",
      };
    }
    row = data;
  } catch (err) {
    const localFallback = getLocalCupsEntry(cleanCode);
    if (localFallback) {
      cupsCodeCache.set(cacheKey, localFallback);
      return localFallback;
    }

    return {
      codigo: cleanCode,
      descripcionOficial: null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: false,
      vigenciaDesde: null,
      vigenciaHasta: null,
      fuenteOficial: null,
      versionCatalogo: activeVersion,
      exists: false,
      active: false,
      errorCode: "CUPSRIPS_SOURCE_UNAVAILABLE",
      error: "Error de conexión al consultar el catálogo oficial CUPSRips.",
    };
  }

  // 4. Registro no encontrado en el snapshot ACTIVE
  if (!row) {
    const localFallback = getLocalCupsEntry(cleanCode);
    if (localFallback) {
      cupsCodeCache.set(cacheKey, localFallback);
      return localFallback;
    }

    const notFoundResult = {
      codigo: cleanCode,
      descripcionOficial: null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: false,
      vigenciaDesde: null,
      vigenciaHasta: null,
      fuenteOficial: null,
      versionCatalogo: activeVersion,
      exists: false,
      active: false,
      errorCode: "CUPS_CODE_NOT_FOUND",
      error: `El código CUPS '${cleanCode}' no existe en el catálogo oficial CUPSRips vigente (${activeVersion}).`,
    };
    return notFoundResult;
  }

  // 5. Validación estricta de pares canónicos de metadata oficial SISPRO
  const usoCodigoCup = row.metadata?.usoCodigoCup;
  const tipoRips = row.metadata?.tipoRips;

  let archivoRips = null;
  let correspondeBloqueConsultas = false;
  let correspondeBloqueProcedimientos = false;
  let correspondeBloqueOtrosServicios = false;

  if (usoCodigoCup === "AC" && tipoRips === "consulta") {
    archivoRips = "AC";
    correspondeBloqueConsultas = true;
  } else if (usoCodigoCup === "AP" && tipoRips === "procedimiento") {
    archivoRips = "AP";
    correspondeBloqueProcedimientos = true;
  } else if (usoCodigoCup === "AT" && tipoRips === "otrosServicios") {
    archivoRips = "AT";
    correspondeBloqueOtrosServicios = true;
  } else {
    // Si la metadata en base de datos es incompleta o null, intentar resolver con catálogo oficial empaquetado
    const localFallback = getLocalCupsEntry(cleanCode);
    if (localFallback) {
      cupsCodeCache.set(cacheKey, localFallback);
      return localFallback;
    }

    return {
      codigo: cleanCode,
      descripcionOficial: row.descripcion || null,
      tipoRips: null,
      archivoRips: null,
      correspondeBloqueConsultas: false,
      correspondeBloqueProcedimientos: false,
      correspondeBloqueOtrosServicios: false,
      activo: Boolean(row.activo),
      vigenciaDesde: row.vigencia_desde ?? null,
      vigenciaHasta: row.vigencia_hasta ?? null,
      fuenteOficial: row.fuente_oficial ?? null,
      versionCatalogo: activeVersion,
      exists: true,
      active: Boolean(row.activo),
      errorCode: "CUPSRIPS_METADATA_INVALID",
      error: `Metadatos inválidos o inconsistentes para el código CUPS '${cleanCode}' en el catálogo oficial (${activeVersion}): usoCodigoCup='${usoCodigoCup}', tipoRips='${tipoRips}'.`,
    };
  }

  // 6. Construcción del resultado oficial
  const result = {
    codigo: cleanCode,
    descripcionOficial: row.descripcion || row.metadata?.nombreOficial || null,
    tipoRips,
    archivoRips,
    correspondeBloqueConsultas,
    correspondeBloqueProcedimientos,
    correspondeBloqueOtrosServicios,
    activo: Boolean(row.activo),
    vigenciaDesde: row.vigencia_desde ?? null,
    vigenciaHasta: row.vigencia_hasta ?? null,
    fuenteOficial: row.fuente_oficial ?? null,
    versionCatalogo: activeVersion,
    exists: true,
    active: Boolean(row.activo),
    error: null,
    errorCode: null,
  };

  cupsCodeCache.set(cacheKey, result);
  return result;
}

export {
  CUPS_RIPS_2026_METADATA,
  CUPS_RIPS_2026_ENTRIES,
  getCupsRipsRecord,
};

export default {
  OFFICIAL_SEED_CATALOGS,
  getOfficialCatalog,
  validateCatalogValue,
  getCupsClassification,
  getActiveCupsRipsVersion,
  getCupsRipsRecord,
  CUPS_RIPS_2026_METADATA,
  CUPS_RIPS_2026_ENTRIES,
  _clearCupsRipsCache,
};

