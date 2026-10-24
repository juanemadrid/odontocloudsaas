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

export function safeHelpIntent(question) {
  const q = normalize(question);
  if (/donde|no encuentro|no veo|cual boton/.test(q)) return 'Indica la ruta y ubicación del botón para empezar.';
  if (/requisito|obligatorio|antes de/.test(q)) return 'Explica los requisitos documentados.';
  if (/error|no aparece|no funciona|no puedo/.test(q)) return 'Explica las comprobaciones documentadas. Si faltan datos, pide una descripción del error sin información personal.';
  return 'Explica el procedimiento documentado en pasos breves.';
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
  if (!reservation?.allowed) return { reason: reservation?.reason === 'quota' ? 'quota' : 'disabled' };
  const reference = [guide.title, guide.prereq, selectedReference || guide.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), guide.note].filter(Boolean).join('\n');
  const isV3 = typeof model === 'string' && (model.startsWith('gemini-3') || model.includes('-3.'));
  const isV25 = typeof model === 'string' && model.includes('2.5');
  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 400,
    ...(isV3 ? { thinkingConfig: { thinkingLevel: 'low' } } :
        isV25 ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
  };
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Eres OdontoIA, el asistente inteligente de OdontoCloud impulsado por IA. Responde de forma clara, amable y profesional en español. Guía al usuario paso a paso indicando la ruta y botones en [corchetes] basándote en la REFERENCIA. Sin consejos clínicos ni datos inventados.' }] },
      contents: [{ role: 'user', parts: [{ text: `${safeHelpIntent(question)}\n${screenContext ? `Pantalla: ${screenContext}\n` : ''}REFERENCIA:\n${reference}` }] }],
      generationConfig,
    }),
  });
  if (!response.ok) return { reason: response.status === 429 ? 'quota' : 'unavailable' };
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts;
  const answer = Array.isArray(parts) ? parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim() : '';
  if (candidate?.finishReason !== 'STOP' || !answer || answer.length > 1600 || /https?:\/\//i.test(answer)) return { reason: 'unavailable' };
  const labels = new Set([...reference.matchAll(/\[([^\]\n]+)\]/g)].map(m => normalize(m[1])));
  if ([...answer.matchAll(/\[([^\]\n]+)\]/g)].some(m => !labels.has(normalize(m[1])))) return { reason: 'unavailable' };
  return { success: true, provider: 'gemini', version: KNOWLEDGE_VERSION, answer,
    sources: [{ id: guide.id, title: guide.title, category: guide.category }] };
}
