import supabase from "../lib/supabaseClient";

const MAX_REPORT_ROWS = 2000;

const asRange = (from, to) => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("El rango de fechas no es válido.");
  }
  return { start: start.toISOString(), end: end.toISOString() };
};

const countRows = async ({ table, tenantId, dateColumn, start, end, mutate }) => {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte(dateColumn, start)
    .lt(dateColumn, end);
  if (mutate) query = mutate(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

export const getPlatformUsageMetrics = async (tenantId, from, to) => {
  if (!tenantId) throw new Error("La clínica es obligatoria.");
  const { start, end } = asRange(from, to);

  const [
    pacientes,
    citas,
    presupuestosPlanes,
    recibosCaja,
    egresos,
    notasCreditoElectronicas,
    terceros,
    facturasResult,
  ] = await Promise.all([
    countRows({ table: "pacientes", tenantId, dateColumn: "created_at", start, end }),
    countRows({ table: "citas", tenantId, dateColumn: "fecha_inicio", start, end }),
    countRows({ table: "treatment_plans", tenantId, dateColumn: "created_at", start, end }),
    countRows({ table: "recibos_caja", tenantId, dateColumn: "fecha", start, end }),
    countRows({
      table: "movimientos_caja",
      tenantId,
      dateColumn: "created_at",
      start,
      end,
      mutate: (query) => query.ilike("tipo", "egreso"),
    }),
    countRows({ table: "notas_credito", tenantId, dateColumn: "fecha", start, end }),
    countRows({ table: "entidades", tenantId, dateColumn: "created_at", start, end }),
    supabase
      .from("facturas")
      .select("id, detalles")
      .eq("tenant_id", tenantId)
      .gte("fecha_emision", start)
      .lt("fecha_emision", end)
      .limit(MAX_REPORT_ROWS),
  ]);

  if (facturasResult.error) throw facturasResult.error;
  const facturas = facturasResult.data || [];
  const facturasElectronicas = facturas.filter((factura) =>
    /cufe|factus|electr[oó]nic/i.test(JSON.stringify(factura.detalles || {}))
  ).length;

  return {
    pacientes,
    citas,
    presupuestosPlanes,
    facturasVenta: Math.max(0, facturas.length - facturasElectronicas),
    facturasElectronicas,
    notasCreditoElectronicas,
    recibosCaja,
    egresos,
    facturasCompra: 0,
    documentosSoporte: 0,
    terceros,
    notasAjusteDocumentoSoporte: 0,
  };
};

export const getAuditEvents = async ({ tenantId, actions, from, to, limit = 500 }) => {
  if (!tenantId) return [];
  const { start, end } = asRange(from, to);
  let query = supabase
    .from("audit_logs")
    .select("id, action, details, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 500, 1), MAX_REPORT_ROWS));
  if (actions?.length) query = query.in("action", actions);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export default { getPlatformUsageMetrics, getAuditEvents };
