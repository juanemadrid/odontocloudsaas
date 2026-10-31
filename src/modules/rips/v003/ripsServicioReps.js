/**
 * Servicio REPS (codServicio) de cada atención en el RIPS.
 *
 * Antes el RIPS llevaba siempre 334 (Odontología general). Ahora cada profesional puede tener
 * su servicio habilitado en el REPS (Configuración → Usuarios → "Servicio REPS"); si no lo tiene,
 * se sigue usando 334, así que nada de lo que ya funcionaba cambia.
 *
 * Códigos oficiales de la tabla de servicios del REPS (MinSalud).
 */
export const SERVICIO_REPS_GENERAL = "334";

export const SERVICIOS_REPS_ODONTOLOGIA = [
  { codigo: "334", nombre: "Odontología general" },
  { codigo: "311", nombre: "Endodoncia" },
  { codigo: "313", nombre: "Estomatología" },
  { codigo: "338", nombre: "Ortodoncia" },
  { codigo: "343", nombre: "Periodoncia" },
  { codigo: "347", nombre: "Rehabilitación oral" },
  { codigo: "396", nombre: "Odontopediatría" },
  { codigo: "410", nombre: "Cirugía oral" },
  { codigo: "411", nombre: "Cirugía maxilofacial" },
];

const CODIGOS_VALIDOS = new Set(SERVICIOS_REPS_ODONTOLOGIA.map(s => s.codigo));

/** Devuelve el servicio REPS configurado del profesional, o 334 si no hay uno válido. */
export function resolveCodServicio(profesional) {
  const raw = String(profesional?.ripsCodServicio ?? "").replace(/\D/g, "");
  return Number(CODIGOS_VALIDOS.has(raw) ? raw : SERVICIO_REPS_GENERAL);
}

export function nombreServicioReps(codigo) {
  const c = String(codigo ?? "").trim();
  return SERVICIOS_REPS_ODONTOLOGIA.find(s => s.codigo === c)?.nombre || `Servicio ${c}`;
}

// Consultas CUPS que solo puede hacer un especialista, y las que son de odontología general.
const CONSULTAS_ESPECIALISTA = new Set(["890204", "890304"]);
const CONSULTAS_GENERAL = new Set(["890203", "890303"]);

/**
 * Revisa que el código de la consulta cuadre con el servicio REPS.
 * Devuelve un mensaje de alerta (texto) o null si todo cuadra.
 */
export function alertaConsultaServicio(codConsulta, codServicio) {
  const cups = String(codConsulta ?? "").trim();
  const serv = String(codServicio ?? "").trim();
  if (!cups || !serv) return null;
  if (CONSULTAS_ESPECIALISTA.has(cups) && serv === SERVICIO_REPS_GENERAL) {
    return `SERVICIO_REPS: La consulta ${cups} es de especialista, pero el servicio del profesional es 334 (Odontología general). Si atendió un odontólogo general use 890203/890303; si es especialista, configure su "Servicio REPS" en Configuración → Usuarios.`;
  }
  if (CONSULTAS_GENERAL.has(cups) && serv !== SERVICIO_REPS_GENERAL) {
    return `SERVICIO_REPS: La consulta ${cups} es de odontología general, pero el servicio del profesional es ${serv} (${nombreServicioReps(serv)}). Si fue consulta de especialista use 890204/890304.`;
  }
  return null;
}
