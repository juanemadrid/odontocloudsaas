import { resolveRipsServiceSettings } from './ripsTariffService.js';
// Todas las lecturas conservan el aislamiento del tenant y recorren el límite REST.
export async function readRipsSource(client, table, tenantId, { optional = false } = {}) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await client.from(table).select('*').eq('tenant_id', tenantId)
      .order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (result.error) {
      if (optional && ['42P01', 'PGRST205'].includes(result.error.code)) return [];
      throw new Error(`No se pudo consultar ${table}: ${result.error.message}`);
    }
    const page = result.data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function ripsDocumentInRange(doc, filterType, range, normalizeDate) {
  if (!range.start || !range.end) return true;
  const billingDate = doc.fecha_emision || doc.fecha || doc.fechaFactura || doc.created_at || doc.createdAt;
  const items = Array.isArray(doc.items) ? doc.items : [];
  const serviceDates = items.map(item => item.fechaAtencion || item.fechaRealizado || item.fechaServicio).filter(Boolean);
  const dates = filterType === 'facturacion' ? [billingDate]
    : (serviceDates.length ? serviceDates : [doc.fechaRealizado || doc.fechaServicio || billingDate]);
  return dates.some(raw => {
    const date = normalizeDate(raw);
    return date && date >= range.start && date <= range.end;
  });
}

export function parseRipsObject(value, fallback = {}) {
  if (typeof value !== 'string') return value || fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

// planService guarda los presupuestos en detalles.items y devuelve items al leerlos.
// RIPS consulta la tabla directamente, por lo que debe aceptar ambas representaciones.
export function getRipsPlanItems(plan) {
  const direct = parseRipsObject(plan.items, null);
  if (Array.isArray(direct)) return direct;
  const details = parseRipsObject(plan.detalles);
  if (Array.isArray(details)) return details;
  const nested = parseRipsObject(details.items, []);
  return Array.isArray(nested) ? nested : [];
}

// Cada prestación sin FEV conserva una identidad propia para enviar/reintentar
// desde su fila sin incluir otras prestaciones del presupuesto.
export function splitRipsClinicalSources(sources) {
  return sources.flatMap(source => source.items.map(item => ({ ...source,
    id: `${source.id}-${String(item.id)}`, items: [item], fecha: item.fechaRealizado || source.fecha,
  })));
}

export function matchesRipsProfessional(record, professional) {
  if (!record || !professional) return false;
  const meta = parseRipsObject(record.metadata || record.tratamiento || record._tData);
  const ids = [record.profesional_id, record.profesionalId, record.doctorId, record.doctor_id,
    meta.profesional_id, meta.profesionalId, meta.doctorId];
  // La autoría clínica explícita prevalece sobre nombres o el profesional del presupuesto.
  const assignedIds = ids.filter(Boolean).map(String);
  if (assignedIds.length) return assignedIds[0] === String(professional.id);
  const name = String(professional.nombreCompleto || professional.full_name || professional.nombre || '').trim().toLowerCase();
  return Boolean(name && [record.profesional, record.profesionalNombre, meta.profesional,
    meta.profesionalNombre, meta.doctor].some(value => String(value || '').trim().toLowerCase() === name));
}

export function collectRipsConsultations(records, patients, tenantId) {
  const result = records.map(dc => ({ ...dc, metadata: parseRipsObject(dc.metadata) }));
  for (const patient of patients) {
    if (patient.tenant_id !== tenantId) continue;
    const history = parseRipsObject(patient.historial_medico);
    for (const doc of history.documentosClinicos || []) {
      if (result.some(dc => dc.id === doc.id || dc.legacy_id === doc.id)) continue;
      result.push({ ...doc, tenant_id: tenantId, paciente_id: patient.id,
        metadata: { ...doc, ...parseRipsObject(doc.metadata) } });
    }
  }
  return result;
}

// Un lote es un soporte interno de atenciones realizadas; nunca una factura ni un recibo.
export function buildRipsClinicalSources({ plans, evolutions, consultations, professional, tenantId, range, normalizeDate,
  branchId = '', patientFilter = '', patients = [], priceLists = [] }) {
  if (!professional?.generaRips) return [];
  const result = [];
  const seen = new Set();
  for (const plan of plans) {
    if (plan.tenant_id !== tenantId) continue;
    const patientId = plan.paciente_id || plan.patientId || plan.pacienteId;
    const patient = patients.find(p => p.id === patientId);
    const patientName = patient?.nombreCompleto || `${patient?.nombres || patient?.nombre || ''} ${patient?.apellidos || ''}`.trim();
    const patientDoc = String(patient?.nroDocumento || patient?.documento || patient?.cedula || '');
    const filter = patientFilter.trim().toUpperCase();
    if (filter && ![patientName, patientDoc].some(value => value && (filter.includes(value.toUpperCase()) || value.toUpperCase().includes(filter)))) continue;
    const planBranch = plan.sucursal_id || plan.sede_id || plan.sucursalId || plan.sucursal;
    if (branchId && planBranch && planBranch !== branchId) continue;
    const items = getRipsPlanItems(plan);
    const selectedItems = [];
    for (const rawItem of items) {
      const item = resolveRipsServiceSettings(rawItem, plan, priceLists);
      const cups = String(item.codigo_cups || item.cups || item.code || item.codigo || '').trim();
      const isConsulta = item.es_consulta;
      const consultation = isConsulta ? consultations.find(dc => dc.tenant_id === tenantId &&
        (dc.paciente_id || dc.pacienteId) === patientId && (dc.id === item.asocConsultaId || dc.legacy_id === item.asocConsultaId)) : null;
      const evolution = !isConsulta ? evolutions.find(e => {
        if (e.tenant_id !== tenantId || e.paciente_id !== patientId) return false;
        const data = parseRipsObject(e.tratamiento);
        if (item.evolutionId) return e.id === item.evolutionId;
        return data.planId === plan.id && (data.procedimientoId === item.id ||
          data.plantillaItems?.[item.id]?.realizado === true ||
          (data.plantillaItems?.[item.id]?.realizado === undefined && data.plantillaItems?.[item.id]?.checked === true));
      }) : null;
      const clinical = consultation || evolution;
      const realized = item.realizado === true || item.status === 'completed' || Boolean(evolution);
      if (!realized) continue;
      // Mostrar también el vínculo faltante como error si el ítem identifica al profesional.
      if (!matchesRipsProfessional(clinical || item, professional)) continue;
      const meta = parseRipsObject(clinical?.metadata || clinical?.tratamiento);
      const date = item.fechaRealizado || clinical?.fecha || meta.fechaIso || meta.date || item.asocConsultaFecha;
      const day = normalizeDate(date);
      if (!day || day < range.start || day > range.end) continue;
      const key = `${plan.id}::${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const value = Number(item.amount ?? item.precioUnitario ?? item.precio ?? item.valor ?? 0) * Number(item.qty ?? item.cantidad ?? 1) - Number(item.descuento || 0);
      selectedItems.push({ ...item, planId: plan.id, planItemId: item.id,
        clinicalSourceId: item.id, clinicalSourceType: 'PLAN_ITEM',
        evolutionId: evolution?.id || null, asocConsultaId: item.asocConsultaId || null,
        profesionalId: professional.id, descripcion: item.desc || item.nombre || item.descripcion || '',
        cups, total: value, fechaRealizado: date, es_consulta: isConsulta });
    }
    if (selectedItems.length) result.push({
      id: `RIPS-${plan.id}-${professional.id}`, _coleccion: 'atenciones_clinicas',
      tenant_id: tenantId, paciente_id: patientId, pacienteNombre: patientName, pacienteDocumento: patientDoc,
      profesionalId: professional.id, planId: plan.id, items: selectedItems,
      pagador: plan.pagador || plan.tipoPagador || (plan.convenioId || plan.convenio_id ? 'CONVENIO' : null),
      fecha: selectedItems[0].fechaRealizado, sucursal_id: planBranch || null,
    });
  }
  return result;
}
