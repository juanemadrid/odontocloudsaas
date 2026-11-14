// Fechas de calendario en hora de Colombia.
// new Date().toISOString() da la fecha en UTC: después de las 7:00 p. m. en Colombia ya es
// "mañana", y las facturas quedaban con fecha y periodo facturado del día siguiente.

const BOGOTA = "America/Bogota";

/** Fecha YYYY-MM-DD de un instante, en hora de Colombia. */
export function todayBogota(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return todayBogota(new Date());
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BOGOTA, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * Fecha de calendario de una factura guardada.
 * - "2026-10-30" → igual.
 * - "2026-10-30T00:00:00.000Z" (fecha sin hora guardada por el formulario) → "2026-10-30".
 * - Un instante real ("2026-10-31T01:49:12.000Z") → el día en Colombia ("2026-10-30").
 */
export function invoiceCalendarDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?(Z|\+00:00)?$/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s.slice(0, 10) : todayBogota(d);
}

/**
 * Fecha para mostrar en pantalla (DD/MM/AAAA) en hora de Colombia.
 * «2026-11-13» (fecha sin hora) se muestra 13/11/2026; un instante se muestra con el día de Colombia.
 */
export function formatDateCO(value) {
  if (value === null || value === undefined || value === "") return "—";
  let v = value;
  if (v && typeof v.toDate === "function") v = v.toDate();
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "—";
    v = todayBogota(v);
  }
  const s = invoiceCalendarDate(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || "—");
}
