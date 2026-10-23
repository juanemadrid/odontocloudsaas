import { getRipsPlanItems } from './ripsSourceService.js';

const code = item => String(item.codigo_cups || item.cups || item.code || item.codigo || '').trim().toUpperCase();
const parse = value => { if (typeof value !== 'string') return value || []; try { return JSON.parse(value); } catch { return []; } };

export async function ripsHistoricalLinkKey(tenantId, planId, itemId, cups) {
  const bytes = new TextEncoder().encode(JSON.stringify([tenantId, String(planId), String(itemId), cups]));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `ripslink_${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function ripsHistoricalLinkOptions(item, lists) {
  return lists.flatMap(list => {
    const products = parse(list.descripcion);
    return (Array.isArray(products) ? products : []).filter(product => product.id && code(product) === code(item))
      .map(product => ({ listId: list.id, listName: list.nombre || list.id, productId: product.id,
        productName: product.nombre || product.id, cups: code(product), generaRips: product.genera_rips,
        esConsulta: product.es_consulta }));
  });
}

// Aplica el vínculo únicamente a la lectura RIPS; no modifica el presupuesto ni la historia.
export async function applyRipsHistoricalLinks(plans, lists, config, tenantId) {
  return Promise.all(plans.map(async plan => {
    if (plan.tenant_id !== tenantId) return plan;
    const items = await Promise.all(getRipsPlanItems(plan).map(async item => {
      const key = await ripsHistoricalLinkKey(tenantId, plan.id, item.id, code(item));
      const link = config?.[key];
      if (!link || link.tenantId !== tenantId || String(link.planId) !== String(plan.id) || String(link.itemId) !== String(item.id) || link.cups !== code(item)) return item;
      const valid = ripsHistoricalLinkOptions(item, lists).some(option => option.listId === link.listId && option.productId === link.productId);
      if (!valid) return item;
      return { ...item, priceListId: link.listId, catalogItemId: link.productId };
    }));
    return { ...plan, items };
  }));
}
