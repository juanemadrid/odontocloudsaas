import { HELP_GUIDES } from './helpKnowledge.mjs';

export const HELP_LIBRARY_GUIDES = HELP_GUIDES.filter(g => !['facturacion-dian-rips', 'historia-odontograma-public', 'agenda-whatsapp-public', 'seguridad-migracion'].includes(g.id));
export const HELP_LIBRARY_CATALOG = HELP_LIBRARY_GUIDES.map(g => `${g.id}: ${g.title}`).join('\n');
export const HELP_LIBRARY_TOOL = {
  functionDeclarations: [{
    name: 'read_system_guides',
    description: 'Lee hasta tres guías públicas verificadas de OdontoCloud, en orden de relevancia, cuando la referencia no basta. Solo documentación; no consulta datos de clínicas ni ejecuta operaciones.',
    parameters: { type: 'OBJECT', properties: { ids: { type: 'ARRAY', items: { type: 'STRING', enum: HELP_LIBRARY_GUIDES.map(g => g.id) } } }, required: ['ids'] },
  }],
};
export function readSystemGuides(call) {
  if (call?.name !== 'read_system_guides' || !call.args || Object.keys(call.args).some(k => k !== 'ids') ||
    !Array.isArray(call.args.ids) || call.args.ids.length < 1 || call.args.ids.length > 3 ||
    call.args.ids.some(id => !HELP_LIBRARY_GUIDES.some(g => g.id === id))) throw new Error('Invalid documentation request');
  const guides = [...new Set(call.args.ids)].map(id => HELP_LIBRARY_GUIDES.find(g => g.id === id));
  return { guides, response: { guides: guides.map(g => ({ id: g.id, title: g.title,
    prerequisites: g.prereq, steps: g.steps, notes: g.note })) } };
}
