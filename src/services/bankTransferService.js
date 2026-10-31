// Traslados de dinero entre cajas y bancos.
// Se guardan en la configuración de la clínica (sección "traslados"), que es lo que leen el
// módulo Traslados, Caja → Bancos y el Reporte de facturación (Traslado+ / Traslado−).
// Antes el cierre de caja intentaba guardarlos en tablas que no los aceptaban y el error se
// ignoraba: el traslado no quedaba en ninguna parte.
import supabase from "../lib/supabaseClient.js";
import { getConfigSection, saveConfigSection, getConfigItems } from "./configPersistenceService.js";
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
  const cajaNombre = String(caja?.nombre || caja?.usuarioNombre || "Caja").trim();
  const createdAt = now.toISOString();
  const base = String(caja?.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "CAJA";
  return rows.map((d, i) => ({
    id: makeId(),
    tipo: "cierre_caja",
    caja_id: caja?.id || null,
    fecha: todayBogota(now),
    origen: `Caja: ${cajaNombre}`,
    destino: d.banco,
    monto: d.monto,
    medio: d.medio,
    descripcion: `Traslado por cierre de caja - ${cajaNombre} (${d.medio})`,
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
  const getSection = deps.getSection || getConfigSection;
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
        concepto: t.descripcion || `Traslado desde ${t.origen || "caja"}`, documento: t.referencia || "", tercero: t.origen || "Caja", monto });
    }
    if (sameAccount(t.origen || t.banco_origen, bankName)) {
      movements.push({ id: `tr_out_${t.id || t.referencia}`, fecha: t.fecha || t.created_at, tipo: "egreso", clase: "Traslado −",
        concepto: t.descripcion || `Traslado hacia ${t.destino || "caja"}`, documento: t.referencia || "", tercero: t.destino || "Caja", monto });
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
