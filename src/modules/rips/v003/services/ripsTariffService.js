const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
const parse = value => { if (typeof value !== 'string') return value || {}; try { return JSON.parse(value); } catch { return {}; } };
const code = item => key(item.codigo_cups || item.cups || item.code || item.codigo);
const name = item => key(item.nombre || item.desc || item.descripcion || item.concepto);
const historicalName = item => name(item).replace(/^CONSULTA(?: DE)?\s+/, '').replace(/\bSEGUIMIENTOS\b/g, 'SEGUIMIENTO');
const settingsKey = item => typeof item.genera_rips === 'boolean' && typeof item.es_consulta === 'boolean'
  ? JSON.stringify([item.genera_rips, item.es_consulta, Boolean(item.es_otro_servicio), item.tipo_servicio || '', item.tipoOS || '']) : null;

// Un mismo CUPS puede aparecer en varios productos/listas con opciones diferentes.
export function resolveRipsTariffItem(item, plan = {}, lists = []) {
  const details = parse(plan.detalles);
  const listId = item.priceListId || item.baseListId || plan.baseListId || details.baseListId;
  const scope = listId ? lists.filter(list => String(list.id) === String(listId)) : lists;
  const candidates = scope.flatMap(list => {
    const data = parse(list.descripcion);
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
    return items.map(product => ({ ...product, _listId: list.id, _listName: list.nombre || list.name || list.id }));
  });
  const sourceId = item.catalogItemId || item.tariffItemId || item.productoId;
  let matches = sourceId ? candidates.filter(candidate => String(candidate.id) === String(sourceId)) : [];
  if (!matches.length && name(item)) matches = candidates.filter(candidate => name(candidate) === name(item) && (!code(item) || !code(candidate) || code(candidate) === code(item)));
  if (!matches.length && code(item) && historicalName(item)) matches = candidates.filter(candidate =>
    code(candidate) === code(item) && historicalName(candidate) === historicalName(item));
  if (!matches.length && code(item)) matches = candidates.filter(candidate => code(candidate) === code(item));
  if (matches.length === 1) return { item: matches[0], error: null, candidates: matches, status: 'MATCHED' };
  // Productos distintos pueden tener el mismo CUPS y exactamente las mismas reglas.
  // Se resuelven solo las opciones RIPS; no se sustituye el producto ni su precio.
  if (matches.length > 1 && settingsKey(matches[0]) && matches.every(candidate => settingsKey(candidate) === settingsKey(matches[0]))) {
    return { item: { codigo: code(item), genera_rips: matches[0].genera_rips, es_consulta: matches[0].es_consulta,
      es_otro_servicio: matches[0].es_otro_servicio, tipo_servicio: matches[0].tipo_servicio },
      error: null, candidates: matches, status: 'EQUIVALENT_SETTINGS' };
  }
  if (matches.length > 1) return { item: null, candidates: matches, status: 'AMBIGUOUS',
    error: `El servicio «${name(item)}» (CUPS ${code(item)}) coincide con productos con opciones RIPS diferentes: ${matches.map(candidate =>
      `${candidate._listName} / ${candidate.nombre || candidate.id} [Genera RIPS: ${candidate.genera_rips === true ? 'Sí' : candidate.genera_rips === false ? 'No' : 'sin configurar'}; Es consulta: ${candidate.es_consulta === true ? 'Sí' : candidate.es_consulta === false ? 'No' : 'sin configurar'}]`).join('; ')}. Vincule el producto de origen para RIPS.` };
  const missingSource = Boolean(listId || sourceId);
  return { item: null, candidates: [], status: missingSource ? 'MISSING_SOURCE' : 'LEGACY_SNAPSHOT',
    error: missingSource ? `No se encontró el producto de origen del servicio «${name(item)}» en su lista de precios. El estado histórico no confirma la configuración actual de Genera RIPS.` : null };
}

export function isRipsConsultation(item, tariff = null) {
  if (typeof tariff?.es_consulta === 'boolean') return tariff.es_consulta;
  if (typeof item.es_consulta === 'boolean') return item.es_consulta;
  if (typeof item.is_consulta === 'boolean') return item.is_consulta;
  // Compatibilidad solo para registros antiguos sin una opción explícita.
  return Boolean(item.asocConsultaId || code(item).startsWith('890'));
}

export function resolveRipsServiceSettings(item, plan, lists) {
  const resolved = resolveRipsTariffItem(item, plan, lists);
  const tariff = resolved.item;
  return { ...item,
    genera_rips: typeof tariff?.genera_rips === 'boolean' ? tariff.genera_rips : item.genera_rips,
    es_consulta: isRipsConsultation(item, tariff),
    _ripsConfigError: resolved.error,
    _ripsTariffStatus: resolved.status,
    _ripsTariffSource: tariff?._listName ? `${tariff._listName} / ${tariff.nombre || tariff.id}`
      : resolved.status === 'EQUIVALENT_SETTINGS' ? 'los productos coincidentes con opciones RIPS equivalentes' : null,
  };
}
