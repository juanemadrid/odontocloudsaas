import { normalize, KNOWLEDGE_VERSION } from '../_shared/helpKnowledge.mjs';
import { HELP_GEMINI_MODELS, HELP_GEMINI_DEFAULT_MODEL } from '../_shared/helpApiKey.mjs';

// No raw question, history, identifier or client supplied text crosses the provider boundary.
export function helpSafetyReason(question) {
  const q = normalize(question);
  if (/\b(edunexus|sql|hackear|hack|inyeccion|system prompt|api key|service role|jwt|token|credenciales|contrasena)\b/.test(q) ||
      /(?:ignora|olvida|omite|saltate|evita).{0,40}(?:reglas|instrucciones|permisos|seguridad|restricciones)/.test(q) ||
      /(?:otra|otras|ajena|ajenas).{0,20}clinica|clinica.{0,20}(?:otra|ajena)|borrar.{0,25}(?:todo|base)|eliminar.{0,25}(?:base|todo)/.test(q) ||
      /(?:diagnostica|diagnosticar|recetame|prescribeme|que medicamento|que antibiotico)/.test(q)) return 'out_of_scope';
  return null;
}

export function safeHelpIntent(question, reference = '') {
  const q = normalize(question);
  if (/no entendi|no entiendo|explicame mejor|mas despacio/.test(q)) return 'Explica de otra forma el próximo paso documentado, con palabras sencillas. No repitas toda la guía.';
  if (/^(?:si )?ya (?:lo |la |los |las )?(?:agregue|anadi|seleccione|guarde|cree|abri|termine|complete|hice)/.test(q)) return 'El usuario indica que completó un paso. Usa la etapa de la REFERENCIA para explicar únicamente el siguiente, sin afirmar que verificaste sus datos.';
  const labels = [...reference.matchAll(/\[([^\]\n]+)\]/g)].map(m => m[1]);
  const focus = [...new Set(labels.filter(label => normalize(label).split(' ').some(w => w.length > 3 && q.split(' ').includes(w))))].slice(0, 3);
  if (focus.length) return 'Resuelve la duda de funcionamiento sobre estas opciones documentadas: ' + focus.map(l => '[' + l + ']').join(', ') + '. Da solo los pasos relacionados; no repitas toda la guía.';
  if (/donde|no encuentro|no veo|cual boton/.test(q)) return 'Indica la ruta y ubicación del botón para empezar.';
  if (/requisito|obligatorio|antes de/.test(q)) return 'Explica los requisitos documentados.';
  if (/error|no aparece|no funciona|no puedo/.test(q)) return 'Explica las comprobaciones documentadas. Si faltan datos, pide una descripción del error sin información personal.';
  return 'Explica el procedimiento documentado en pasos breves.';
}

// A route assembled from documented labels is valid; invented buttons still fail.
export function hasDocumentedLabels(answer, reference) {
  const labels = [...new Set([...reference.matchAll(/\[([^\]\n]+)\]/g)].map(m => normalize(m[1])))];
  function matches(value) {
    value = normalize(value).replace(/^(?:boton|pestana|opcion) /, '');
    const visit = (remaining, seen = new Set()) => {
      if (!remaining) return true;
      if (seen.has(remaining)) return false;
      seen.add(remaining);
      return labels.some(label => label && (remaining === label || remaining.startsWith(label + ' ') && visit(remaining.slice(label.length + 1), seen)));
    };
    return visit(value);
  }
  return [...answer.matchAll(/\[([^\]\n]+)\]/g)].every(m => matches(m[1]));
}

export async function generateManagedHelp({ guide, reference: selectedReference, question, screenContext, reserve, principal, env, fetchImpl, signal }) {
  const provider = env('ODONTO_HELP_PROVIDER');
  if (provider !== 'gemini') return { reason: 'not_configured' };
  if (env('ODONTO_HELP_ENABLED') !== 'true') return { reason: 'disabled' };
  const key = env('ODONTO_HELP_GEMINI_API_KEY');
  // A dedicated key is required; never borrow a clinical or superadmin key.
  if (!key) return { reason: 'not_configured' };
  const model = env('ODONTO_HELP_GEMINI_MODEL') || HELP_GEMINI_DEFAULT_MODEL;
  if (!HELP_GEMINI_MODELS.includes(model)) return { reason: 'not_configured' };
  if (!principal || typeof reserve !== 'function') return { reason: 'disabled' };
  const reservation = await reserve(principal, signal);
  if (!reservation?.allowed) return { reason: reservation?.reason === 'quota' ? 'quota' : 'disabled', diagnostic: 'reservation_' + (reservation?.reason === 'quota' ? 'quota' : 'disabled') };
  const reference = [guide.title, guide.prereq, selectedReference || guide.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), guide.note].filter(Boolean).join('\n');
  const isV3 = typeof model === 'string' && (model.startsWith('gemini-3') || model.includes('-3.'));
  const isV25 = typeof model === 'string' && model.includes('2.5');
  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: isV3 ? 1024 : 400,
    ...(isV3 ? { thinkingConfig: { thinkingLevel: 'low' } } :
        isV25 ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
  };
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Eres OdontoIA, ayuda de funcionamiento de OdontoCloud. Responde en español con tono natural y directo, hasta 90 palabras y solo los pasos necesarios. Usa exclusivamente la REFERENCIA. Conserva nombres literales de botones entre [corchetes]; no encierres explicaciones en corchetes. Si falta información, pregunta sin inventar. Sin consejos clínicos, datos de pacientes ni acciones ejecutadas.' }] },
      contents: [{ role: 'user', parts: [{ text: `${safeHelpIntent(question, reference)}\n${screenContext ? `Pantalla: ${screenContext}\n` : ''}REFERENCIA:\n${reference}` }] }],
      generationConfig,
    }),
  });
  if (!response.ok) return { reason: response.status === 429 ? 'quota' : 'unavailable', diagnostic: 'gemini_http_' + response.status, model };
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts;
  const answer = Array.isArray(parts) ? parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim() : '';
  if (candidate?.finishReason !== 'STOP') return { reason: 'unavailable', diagnostic: candidate?.finishReason === 'MAX_TOKENS' ? 'gemini_truncated' : 'gemini_blocked', model };
  if (!answer || answer.length > 1600 || /https?:\/\//i.test(answer)) return { reason: 'unavailable', diagnostic: 'gemini_invalid_output', model };
  const documented = reference + '\n' + guide.steps.join('\n') + '\n' + guide.prereq + '\n' + guide.note;
  if (!hasDocumentedLabels(answer, documented)) return { reason: 'unavailable', diagnostic: 'gemini_unverified_labels', model };
  return { success: true, provider: 'gemini', model, version: KNOWLEDGE_VERSION, answer,
    sources: [{ id: guide.id, title: guide.title, category: guide.category }] };
}
