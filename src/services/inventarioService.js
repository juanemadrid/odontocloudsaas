// Inventario: productos (tabla inventario, los mismos de Configuración → Lista de precios → Productos)
// y kardex (tabla inventario_movimientos). El stock solo se mueve con la función
// inventario_registrar_movimiento del servidor, que valida y registra todo en una transacción.
import supabase from "../lib/supabaseClient";
import { queryOptionalBillingTable } from "./optionalBillingTables";
import { formatTerceroNombre } from "../utils/dian/dianHelpers";

export const MOTIVOS = {
  entrada: ["Compra a proveedor", "Donación / muestra", "Devolución de consultorio", "Otro"],
  salida: ["Consumo en consultorio", "Vencido", "Dañado", "Entrega a paciente", "Otro"],
  ajuste: ["Conteo físico", "Corrección de error", "Otro"],
};

export function estadoStock(producto) {
  const stock = Number(producto?.cantidad || 0);
  const minimo = Number(producto?.minimo_stock || 0);
  if (stock <= 0) return "agotado";
  if (minimo > 0 && stock <= minimo) return "bajo";
  return "ok";
}

export async function listarProductos(tenantId) {
  const { data, error } = await supabase
    .from("inventario")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data || [])
    .filter((p) => !p.es_servicio && p.activo !== false)
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
}

export async function actualizarStockMinimo(tenantId, productoId, minimo) {
  const value = Math.max(0, Math.floor(Number(minimo) || 0));
  const { error } = await supabase
    .from("inventario")
    .update({ minimo_stock: value })
    .eq("id", productoId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return value;
}

/** desde / hasta: fechas YYYY-MM-DD en hora de Colombia (incluye el día completo de "hasta"). */
export async function listarMovimientos(tenantId, { desde, hasta, productoId, tipo } = {}) {
  let q = supabase
    .from("inventario_movimientos")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("fecha", { ascending: false })
    .limit(2000);
  if (desde) q = q.gte("fecha", `${desde}T00:00:00-05:00`);
  if (hasta) q = q.lte("fecha", `${hasta}T23:59:59.999-05:00`);
  if (productoId) q = q.eq("producto_id", productoId);
  if (tipo) q = q.eq("tipo", tipo);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function registrarMovimiento({
  productoId, tipo, cantidad, motivo, costoUnitario, lote, fechaVencimiento,
  terceroId, terceroNombre, documento, observaciones,
}) {
  const { data, error } = await supabase.rpc("inventario_registrar_movimiento", {
    p_producto_id: productoId,
    p_tipo: tipo,
    p_cantidad: Math.floor(Number(cantidad)),
    p_motivo: motivo || null,
    p_costo_unitario: costoUnitario === "" || costoUnitario == null ? null : Number(costoUnitario),
    p_lote: lote || null,
    p_fecha_vencimiento: fechaVencimiento || null,
    p_tercero_id: terceroId || null,
    p_tercero_nombre: terceroNombre || null,
    p_documento: documento || null,
    p_observaciones: observaciones || null,
  });
  if (error) throw new Error(error.message || "No se pudo registrar el movimiento.");
  return data;
}

// Igual que Administración → Terceros: tabla terceros y, si no hay, los guardados en la configuración de la clínica.
export async function listarProveedores(tenantId) {
  let list = [];
  try {
    const { data } = await queryOptionalBillingTable("terceros", (t) => t.select("*").eq("tenant_id", tenantId));
    list = data || [];
  } catch { list = []; }
  if (list.length === 0) {
    const { data: cfgRow } = await supabase.from("website_config").select("config").eq("tenant_id", tenantId).maybeSingle();
    list = Array.isArray(cfgRow?.config?.terceros) ? cfgRow.config.terceros : [];
  }
  return list
    .filter((t) => t && t.id != null && t.activo !== false)
    .map((t) => ({ id: String(t.id), nombre: formatTerceroNombre(t), documento: t.nro_documento || t.numero_documento || t.documento || "" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
