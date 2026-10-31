// Traslados de dinero entre cajas y bancos.
// Se guardan en la configuración de la clínica (sección "traslados"), que es lo que leen el
// módulo Traslados, Caja → Bancos y el Reporte de facturación (Traslado+ / Traslado−).
// Antes el cierre de caja intentaba guardarlos en tablas que no los aceptaban y el error se
// ignoraba: el traslado no quedaba en ninguna parte.
import supabase from "../lib/supabaseClient.js";
import { getConfigSection, saveConfigSection, getConfigItems } from "./configPersistenceService.js";
import { loadConfigSection } from "./configCacheService.js";
import { todayBogota } from "../utils/bogotaDate.js";

export const normalizeAccountName = (value) =>
  String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const sameAccount = (a, b) => {
  const x = normalizeAccountName(a);
  return Boolean(x) && x === normalizeAccountName(b);
};

/** Nombre visible de un banco configurado (texto u objeto). */
export const bankLabel = (bank) =>
  String(typeof bank === "string" ? bank : (bank?.nombre || bank?.nombreBanco || bank?.banco || "")).trim();

/** Lista de nombres de bancos sin repetidos. */
export const bankNames = (banks) => {
  const out = [];
  for (const b of Array.isArray(banks) ? banks : []) {
    const name = bankLabel(b);
    if (name && !out.some((n) => sameAccount(n, name))) out.push(name);
  }
  return out;
};

// Nombre en mayúsculas o minúsculas parejas → "Juan Madrid". Si ya viene mezclado, se respeta.
const SMALL_WORDS = new Set(["de", "del", "la", "las", "los", "y", "e"]);
const niceName = (name) => {
  const n = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!n || (n !== n.toLowerCase() && n !== n.toUpperCase())) return n;
  return n.toLowerCase().split(" ").map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
};

/** "juan madrid" / "Caja - juan madrid" / "Caja: Caja - juan madrid" → "Caja Juan Madrid". */
export const cajaLabel = (name) => {
  const rest = String(name ?? "").trim().replace(/^(?:caja\b\s*[:\-–]?\s*)+/i, "").trim();
  return rest ? `Caja ${niceName(rest)}` : "Caja";
};

/**
 * Arregla textos ya guardados con la palabra repetida o con separadores:
 * "Caja: Caja - juan madrid" → "Caja Juan Madrid";
 * "Traslado por cierre de caja - Caja - juan madrid (Efectivo)" → "Traslado por cierre de Caja Juan Madrid (Efectivo)".
 */
export const tidyTransferText = (text) => {
  if (text == null) return text;
  return String(text).replace(/\bcaja\b(?:\s*[:\-–]\s*caja\b)*(?:\s*[:\-–]\s*|\s+)([^()]+?)(?=\s*\(|\s+a\s|$)/gi,
    (m, rest) => (/^(principal|general)\b/i.test(rest.trim()) && !/[:\-–]/.test(m) ? m : cajaLabel(rest)));
};

/** "2026-10-31" es un día en Colombia (no la medianoche de Londres, que en Colombia cae el día anterior). */
export const localDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
const isVoid = (row) => String(row?.estado || "").toLowerCase() === "anulado" || row?.anulado === true;

/**
 * Traslados del cierre de una caja hacia bancos. Valida que cada destino tenga banco y valor,
 * y que el total no supere lo contado en la caja.
 */
export function buildClosingTransfers({ caja, destinos, contado, usuario, now = new Date(), makeId = newId }) {
  const rows = (Array.isArray(destinos) ? destinos : [])
    .map((d) => ({ banco: String(d?.banco || "").trim(), monto: Number(d?.valor || 0), medio: d?.medio || "Efectivo" }))
    .filter((d) => d.monto > 0 || d.banco);
  for (const d of rows) {
    if (!d.banco) throw new Error("Seleccione el banco de cada traslado.");
    if (!(d.monto > 0)) throw new Error(`Escriba el valor a trasladar a ${d.banco}.`);
  }
  const total = rows.reduce((s, d) => s + d.monto, 0);
  if (total > Number(contado || 0) + 0.01) {
    throw new Error("El total a trasladar a bancos no puede ser mayor que el dinero contado en la caja.");
  }
  const cajaNombre = cajaLabel(caja?.nombre || caja?.usuarioNombre || "");
  const createdAt = now.toISOString();
  const base = String(caja?.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "CAJA";
  return rows.map((d, i) => ({
    id: makeId(),
    tipo: "cierre_caja",
    caja_id: caja?.id || null,
    fecha: todayBogota(now),
    origen: cajaNombre,
    destino: d.banco,
    monto: d.monto,
    medio: d.medio,
    descripcion: `Traslado por cierre de ${cajaNombre} (${d.medio})`,
    referencia: `TR-CIERRE-${base}${rows.length > 1 ? `-${i + 1}` : ""}`,
    estado: "Activo",
    usuario: usuario || "",
    created_at: createdAt,
  }));
}

/** Agrega traslados a la sección "traslados" de la clínica (sin duplicar por id). */
export async function saveTransfers(tenantId, transfers, deps = {}) {
  const getSection = deps.getSection || getConfigSection;
  const saveSection = deps.saveSection || saveConfigSection;
  if (!transfers?.length) return [];
  const current = await getSection(tenantId, "traslados", []);
  const list = Array.isArray(current) ? current : [];
  const ids = new Set(transfers.map((t) => t.id));
  await saveSection(tenantId, "traslados", [...transfers, ...list.filter((t) => !ids.has(t?.id))]);
  return transfers;
}

/** Todos los traslados: tabla "traslados" (si existe) + configuración, sin duplicados. */
export async function loadAllTransfers(tenantId, deps = {}) {
  const client = deps.client || supabase;
  // Siempre lectura fresca: una copia guardada de hace unos minutos escondía el traslado más reciente.
  const getSection = deps.getSection || ((t, k, f) => loadConfigSection(t, k, f, true));
  let tableRows = [];
  try {
    const { data, error } = await client.from("traslados").select("*").eq("tenant_id", tenantId);
    if (!error && Array.isArray(data)) tableRows = data;
  } catch { /* la tabla puede no existir */ }
  let cfgRows = [];
  try {
    const cfg = await getSection(tenantId, "traslados", []);
    if (Array.isArray(cfg)) cfgRows = cfg;
  } catch { /* sin configuración */ }
  const seen = new Set();
  const out = [];
  for (const t of [...cfgRows, ...tableRows]) {
    if (!t) continue;
    const key = t.referencia ? `ref:${t.referencia}:${t.monto}` : `id:${t.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

// ── Traslados que entran o salen de una caja abierta ──

const ts = (v) => { const d = localDate(v); return d ? d.getTime() : NaN; };
const cajaOpenedAt = (c) => ts(c?.fechaApertura || c?.fecha_apertura || c?.created_at);
const cajaClosedAt = (c) => {
  const closed = /cerrad/i.test(String(c?.estado || "")) || c?.fechaCierre || c?.fecha_cierre;
  if (!closed) return Infinity;
  const t = ts(c?.fechaCierre || c?.fecha_cierre || c?.updated_at);
  // Cerrada sin hora de cierre registrada: no se le asigna nada posterior a su apertura.
  return Number.isNaN(t) ? cajaOpenedAt(c) : t;
};
const isOpenCaja = (c) => !/cerrad/i.test(String(c?.estado || "")) && !c?.fechaCierre && !c?.fecha_cierre;

/** Cajas abiertas (configuración + tabla), con un nombre claro para escoger en un traslado. */
export async function loadOpenCajas(tenantId, deps = {}) {
  const client = deps.client || supabase;
  const getSection = deps.getSection || ((t, k, f) => loadConfigSection(t, k, f, true));
  let cfg = [];
  try { const v = await getSection(tenantId, "cajas", []); if (Array.isArray(v)) cfg = v; } catch { /* sin configuración */ }
  let rows = [];
  try {
    const { data, error } = await client.from("cajas").select("*").eq("tenant_id", tenantId);
    if (!error && Array.isArray(data)) rows = data;
  } catch { /* sin tabla */ }
  const byId = new Map();
  for (const c of [...cfg, ...rows]) {
    if (!c?.id) continue;
    byId.set(c.id, { ...(byId.get(c.id) || {}), ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== undefined && v !== "")) });
  }
  const open = [...byId.values()].filter(isOpenCaja)
    .sort((a, b) => cajaOpenedAt(b) - cajaOpenedAt(a))
    .map((c) => ({ id: c.id, label: cajaLabel(c.nombre || c.usuarioNombre || c.usuario_nombre || ""), raw: c }));
  // Dos cajas con el mismo nombre: se distinguen por la hora de apertura.
  const repeated = new Set(open.map((c) => c.label).filter((l, i, all) => all.indexOf(l) !== i));
  for (const c of open) {
    if (repeated.has(c.label)) {
      const d = localDate(c.raw.fechaApertura || c.raw.fecha_apertura || c.raw.created_at);
      if (d) c.label = `${c.label} (abierta ${d.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })})`;
    }
  }
  return open.map(({ id, label }) => ({ id, label }));
}

/**
 * Traslados de banco ↔ caja como movimientos de esa caja, para que sumen o resten en su saldo.
 * Se reconocen por caja_destino_id / caja_origen_id. Los traslados viejos sin esos datos
 * (ej. destino "Caja Principal (Efectivo)") se asignan a la caja que estaba abierta a esa hora,
 * solo si había UNA sola abierta (si no, no se adivina). Los traslados del cierre no cuentan aquí:
 * ocurren al cerrar y se muestran aparte.
 */
export function cajaTransferMovements(transfers, caja, { allCajas = [], banks = [] } = {}) {
  if (!caja?.id) return [];
  // Una entrada por caja (la configuración y la tabla pueden traer la misma caja dos veces).
  const merged = new Map();
  for (const c of [caja, ...(Array.isArray(allCajas) ? allCajas : [])]) {
    if (!c?.id) continue;
    merged.set(c.id, { ...(merged.get(c.id) || {}), ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== undefined && v !== "")) });
  }
  const cajas = [...merged.values()];
  const self = merged.get(caja.id);
  const bankList = bankNames(banks);
  const isBankName = (n) => bankList.some((b) => sameAccount(b, n));
  const genericCaja = (n) => /\bcaja\b/i.test(String(n || "")) && !isBankName(n);
  const onlyOpenAt = (time) => {
    if (Number.isNaN(time)) return false;
    const openNow = cajas.filter((c) => cajaOpenedAt(c) <= time && time <= cajaClosedAt(c));
    return openNow.length === 1 && openNow[0].id === self.id;
  };
  const out = [];
  for (const t of Array.isArray(transfers) ? transfers : []) {
    if (!t || isVoid(t) || t.tipo === "cierre_caja") continue;
    const monto = Number(t.monto || t.valor || 0);
    if (!(monto > 0)) continue;
    const linked = t.caja_destino_id || t.caja_origen_id;
    const when = ts(t.created_at || t.fecha);
    let tipo = null;
    if (t.caja_destino_id === caja.id) tipo = "ingreso";
    else if (t.caja_origen_id === caja.id) tipo = "egreso";
    else if (!linked && onlyOpenAt(when)) {
      if (genericCaja(t.destino) && !genericCaja(t.origen)) tipo = "ingreso";
      else if (genericCaja(t.origen) && !genericCaja(t.destino)) tipo = "egreso";
    }
    if (!tipo) continue;
    const otro = tidyTransferText(tipo === "ingreso" ? t.origen : t.destino) || "";
    out.push({
      id: `tr_${t.id || t.referencia}`,
      caja_id: caja.id,
      tipo,
      monto,
      metodo_pago: "Efectivo",
      metodoPago: "Efectivo",
      concepto: tipo === "ingreso" ? `Traslado desde ${otro}` : `Traslado hacia ${otro}`,
      descripcion: tidyTransferText(t.descripcion) || "",
      referencia: t.referencia || "",
      nroConsecutivo: t.referencia || "",
      consecutivo: t.referencia || "",
      created_at: t.created_at || t.fecha,
      fecha: t.created_at || t.fecha,
      estado: t.estado || "Activo",
      tercero: otro,
      pacienteNombre: otro,
      esTraslado: true,
    });
  }
  return out;
}

/** Lo necesario para calcular los traslados de las cajas: traslados, bancos y cajas (lectura fresca). */
export async function loadCajaTransferContext(tenantId, deps = {}) {
  const getSection = deps.getSection || ((t, k, f) => loadConfigSection(t, k, f, true));
  const [transfers, bk, cajas] = await Promise.all([
    loadAllTransfers(tenantId, deps).catch(() => []),
    loadBanksAndExpenses(tenantId, deps).catch(() => ({ banks: [] })),
    Promise.resolve().then(() => getSection(tenantId, "cajas", [])).catch(() => []),
  ]);
  return { transfers: transfers || [], banks: bk?.banks || [], cajas: Array.isArray(cajas) ? cajas : [] };
}

/** Egresos (pagos a proveedores) que salieron de un banco y no de una caja. */
export const expensesFromBank = (expenses, bankName) =>
  (Array.isArray(expenses) ? expenses : []).filter((p) => !isVoid(p) && sameAccount(p?.bancoCaja, bankName));

/**
 * Movimientos de un banco: entradas por traslado, salidas por traslado y egresos pagados
 * desde ese banco. Devuelve también totales.
 */
export function bankMovements(bankName, transfers, expenses = []) {
  const movements = [];
  for (const t of Array.isArray(transfers) ? transfers : []) {
    if (!t || isVoid(t)) continue;
    const monto = Number(t.monto || t.valor || 0);
    if (!(monto > 0)) continue;
    if (sameAccount(t.destino || t.banco_destino, bankName)) {
      movements.push({ id: `tr_in_${t.id || t.referencia}`, fecha: t.fecha || t.created_at, tipo: "ingreso", clase: "Traslado +",
        concepto: tidyTransferText(t.descripcion) || `Traslado desde ${tidyTransferText(t.origen) || "caja"}`, documento: t.referencia || "", tercero: tidyTransferText(t.origen) || "Caja", monto });
    }
    if (sameAccount(t.origen || t.banco_origen, bankName)) {
      movements.push({ id: `tr_out_${t.id || t.referencia}`, fecha: t.fecha || t.created_at, tipo: "egreso", clase: "Traslado −",
        concepto: tidyTransferText(t.descripcion) || `Traslado hacia ${tidyTransferText(t.destino) || "caja"}`, documento: t.referencia || "", tercero: tidyTransferText(t.destino) || "Caja", monto });
    }
  }
  for (const p of expensesFromBank(expenses, bankName)) {
    const monto = Number(p.monto ?? p.total ?? 0);
    if (!(monto > 0)) continue;
    movements.push({ id: `eg_${p.id}`, fecha: p.fecha || p.created_at, tipo: "egreso", clase: "Egreso desde banco",
      concepto: p.concepto || "Egreso", documento: p.consecutivo || p.numero || p.nroConsecutivo || "", tercero: p.tercero || p.proveedor || "", monto });
  }
  const entradas = movements.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const salidas = movements.filter((m) => m.tipo === "egreso").reduce((s, m) => s + m.monto, 0);
  return { movements, entradas, salidas };
}

/** Bancos configurados (Configuración → Bancos) y egresos de la clínica. */
export async function loadBanksAndExpenses(tenantId, deps = {}) {
  const getItems = deps.getItems || getConfigItems;
  const getSection = deps.getSection || getConfigSection;
  const [banks, expenses] = await Promise.all([
    getItems(tenantId, "bancos", "bancos").catch(() => []),
    getSection(tenantId, "pagos_proveedor", []).catch(() => []),
  ]);
  return { banks: Array.isArray(banks) ? banks : [], expenses: Array.isArray(expenses) ? expenses : [] };
}
