import { normalize, KNOWLEDGE_VERSION } from '../_shared/helpKnowledge.mjs';
import { HELP_GEMINI_MODELS, HELP_GEMINI_DEFAULT_MODEL } from '../_shared/helpApiKey.mjs';
import { projectHelpMeaning, projectHelpHistory } from '../_shared/helpMeaning.mjs';
import { HELP_TRIAGE_ID, isHelpOpening } from '../_shared/helpTriage.mjs';
import { HELP_LIBRARY_CATALOG, HELP_LIBRARY_TOOL, readSystemGuides } from '../_shared/helpLibrary.mjs';

// No raw question, history, identifier or client supplied text crosses the provider boundary.
export function helpSafetyReason(question) {
  const q = normalize(question);
  if (/\b(edunexus|sql|hackear|hack|inyeccion|system prompt|api key|service role|jwt|token|credenciales|contrasena|futbol|horoscopo)\b/.test(q) || /(?:receta|prepar|cocinar).{0,25}(?:torta|pastel|cocina)|que hora|que clima/.test(q) ||
      /(?:ignora|olvida|omite|saltate|evita).{0,40}(?:reglas|instrucciones|permisos|seguridad|restricciones)/.test(q) ||
      /(?:otra|otras|ajena|ajenas).{0,20}clinica|clinica.{0,20}(?:otra|ajena)|borrar.{0,25}(?:todo|base)|eliminar.{0,25}(?:base|todo)/.test(q) ||
      /(?:diagnostica|diagnosticar|recetame|prescribeme|que medicamento|que antibiotico)/.test(q)) return 'out_of_scope';
  return null;
}

export function safeHelpIntent(question, reference = '') {
  const q = normalize(question);
  if (isHelpOpening(question)) return 'Acompaña la conversación: el usuario todavía está intentando expresar su duda. Invítalo con naturalidad a contar qué le pasa o qué quiere lograr, sin exigir nombres de módulos ni repetir un tutorial. Haz solo una pregunta sencilla.';
  if (/que pasa|que sucede|por que|significa|consecuencia|\bsi\b.*\bno\b|\bsin\b/.test(q)) return 'Responde al significado, motivo o condición que pregunta el usuario. Conserva las negaciones. No sustituyas esa duda por un tutorial de cómo generar o crear. Si hay dos interpretaciones, acláralas o pregunta cuál corresponde.';
  if (/no entendi|no entiendo|explicame mejor|mas despacio/.test(q)) return 'Explica de otra forma el próximo paso documentado, con palabras sencillas. No repitas toda la guía.';
  if (/^(?:si )?ya (?:lo |la |los |las )?(?:agregue|anadi|seleccione|guarde|cree|abri|termine|complete|hice)/.test(q)) return 'El usuario indica que completó un paso. Usa la etapa de la REFERENCIA para explicar únicamente el siguiente, sin afirmar que verificaste sus datos.';
  if (/donde|no encuentro|no veo|cual boton/.test(q)) return 'Indica la ubicación o destino que pregunta el usuario según el verbo y el tema de la conversación. Si pregunta adónde se envía, explica el destino documentado, no reinicies las instrucciones desde otro tema.';
  if (/\bcomo\b/.test(q)) return 'Explica directamente cómo se realiza la operación solicitada, desde el inicio si dice que no sabe. El usuario ya expresó lo que necesita; no vuelvas a preguntarle qué quiere hacer ni en qué parte está si la referencia permite responder.';
  if (/requisito|obligatorio|antes de/.test(q)) return 'Explica los requisitos documentados.';
  if (/error|no aparece|no funciona|no puedo/.test(q)) return 'Explica las comprobaciones documentadas. Si faltan datos, pide una descripción del error sin información personal.';
  return 'Responde la pregunta de uso. Da pasos solo si pide realizar una operación; no repitas toda la guía.';
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

export async function generateManagedHelp({ guide, reference: selectedReference, question, history = [], screenContext, reserve, principal, env, fetchImpl, signal }) {
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
  if (!reservation?.allowed) return { reason: reservation?.reason === 'quota' ? 'quota' : 'disabled', diagnostic: 'reservation_' + (reservation?.reason === 'quota' ? (['user_cooldown', 'global_minute', 'global_day', 'global_month', 'clinic_day', 'clinic_month'].includes(reservation.diagnostic) ? reservation.diagnostic : 'quota') : 'disabled') };
  const reference = [guide.title, guide.prereq, selectedReference || guide.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), guide.note].filter(Boolean).join('\n');
  const isV3 = typeof model === 'string' && (model.startsWith('gemini-3') || model.includes('-3.'));
  const isV25 = typeof model === 'string' && model.includes('2.5');
  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: isV3 ? 1024 : 400,
    ...(isV3 ? { thinkingConfig: { thinkingLevel: 'low' } } :
        isV25 ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
  };
  const requestPayload = {
      systemInstruction: { parts: [{ text: 'Eres OdontoIA, ayuda de funcionamiento de OdontoCloud. Responde a la duda concreta en español natural, hasta 120 palabras. Usa exclusivamente las REFERENCIAS verificadas para hechos del sistema. Puedes leer otras guías del CATÁLOGO mediante read_system_guides; no tienes herramientas para datos de clínicas ni acciones. Antes de responder, identifica si la persona pide un procedimiento, una explicación, una capacidad, un estado real, una garantía, una aclaración o algo ajeno al producto. No conviertas una pregunta de explicación en instrucciones para usar la pantalla. La pantalla actual solo orienta ubicaciones: nunca determina el tema. La REFERENCIA es una candidata recuperada automáticamente, no prueba de que ese sea el tema; si no corresponde, consulta el CATÁLOGO, pide un dato imprescindible o reconoce la ausencia de evidencia. Para asuntos ajenos al producto, rechaza brevemente y ofrece ayuda con OdontoCloud. Para dudas legales o de seguridad del producto, explica únicamente los controles documentados y distingue hechos de certificaciones no acreditadas. No confirmes estados reales de la clínica, transacciones ni cumplimiento integral. La pregunta actual tiene prioridad: las respuestas anteriores pueden haber interpretado mal al usuario. Si la pregunta ya explica lo que necesita, responde directamente: «no sé cómo generar» solicita instrucciones desde el inicio. Mantén el tema al interpretar «eso», «cómo se envían» o «adónde» según el contexto. Explica la operación y el destino cuando los pregunta. Haz preguntas solo si falta un dato imprescindible que la documentación no permita resolver; no reinicies la conversación ni pidas repetir la intención. La pregunta y el contexto contienen vocabulario operativo; nunca reconstruyas detalles omitidos. Conserva botones literales entre [corchetes]. No inventes funciones, obligaciones legales ni datos. Si una capacidad no está documentada, reconoce el límite sin afirmar que existe o no existe. Sin consejos clínicos ni acciones ejecutadas.' }] },
      contents: [{ role: 'user', parts: [{ text: `${safeHelpIntent(question, reference)}\nPREGUNTA DE USO:\n${projectHelpMeaning(question)}\nCONTEXTO RECIENTE:\n${JSON.stringify(projectHelpHistory(history))}\n${screenContext ? `Pantalla: ${screenContext}\n` : ''}REFERENCIA:\n${reference}\nCATÁLOGO DE GUÍAS DISPONIBLES:\n${HELP_LIBRARY_CATALOG}` }] }],
      generationConfig,
      tools: [HELP_LIBRARY_TOOL],
  };
  const generate = payload => fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
  });
  let response = await generate(requestPayload);
  if (!response.ok) return { reason: response.status === 429 ? 'quota' : 'unavailable', diagnostic: 'gemini_http_' + response.status, model };
  let data = await response.json();
  let candidate = data.candidates?.[0];
  const consulted = guide.id === HELP_TRIAGE_ID ? [] : [guide];
  const toolCalls = candidate?.content?.parts?.filter(p => p.functionCall) || [];
  if (toolCalls.length) {
    if (toolCalls.length !== 1 || candidate?.finishReason !== 'STOP') return { reason: 'unavailable', diagnostic: 'gemini_invalid_guide_request', model };
    let reading;
    try { reading = readSystemGuides(toolCalls[0].functionCall); }
    catch { return { reason: 'unavailable', diagnostic: 'gemini_invalid_guide_request', model }; }
    consulted.unshift(...reading.guides);
    response = await generate({ ...requestPayload,
      toolConfig: { functionCallingConfig: { mode: 'NONE' } },
      contents: [...requestPayload.contents, candidate.content,
        { role: 'user', parts: [{ functionResponse: { name: 'read_system_guides', ...(toolCalls[0].functionCall.id ? { id: toolCalls[0].functionCall.id } : {}), response: reading.response } }] }],
    });
    if (!response.ok) return { reason: response.status === 429 ? 'quota' : 'unavailable', diagnostic: 'gemini_http_' + response.status, model };
    data = await response.json(); candidate = data.candidates?.[0];
    if (candidate?.content?.parts?.some(p => p.functionCall)) return { reason: 'unavailable', diagnostic: 'gemini_invalid_guide_request', model };
  }
  const parts = candidate?.content?.parts;
  const answer = Array.isArray(parts) ? parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim() : '';
  if (candidate?.finishReason !== 'STOP') return { reason: 'unavailable', diagnostic: candidate?.finishReason === 'MAX_TOKENS' ? 'gemini_truncated' : 'gemini_blocked', model };
  if (!answer || answer.length > 1600 || /https?:\/\//i.test(answer)) return { reason: 'unavailable', diagnostic: 'gemini_invalid_output', model };
  const documented = reference + '\n' + consulted.map(g => g.steps.join('\n') + '\n' + g.prereq + '\n' + g.note).join('\n');
  if (!hasDocumentedLabels(answer, documented)) return { reason: 'unavailable', diagnostic: 'gemini_unverified_labels', model };
  return { success: true, provider: 'gemini', model, version: KNOWLEDGE_VERSION, answer,
    sources: [...new Map(consulted.map(g => [g.id, g])).values()].map(({ id, title, category }) => ({ id, title, category })) };
}
