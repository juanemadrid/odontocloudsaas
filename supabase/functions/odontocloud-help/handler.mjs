import { conversationalReply, resolveHelpGuides, clarificationReply, readHelpEvents } from '../_shared/helpConversation.mjs';
import { normalize, formatGuide, KNOWLEDGE_VERSION, HELP_GUIDES, PUBLIC_GUIDE_IDS } from '../_shared/helpKnowledge.mjs';

export class HelpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Reviewed short version of the appointment guide; the full guide remains in the library.
// Other topics retain their complete instructions until a reviewed summary is available.
const appointmentSummary = '📌 Recuerda antes de agendar: Para apartar citas, tu clínica debe tener configurados previamente en el sistema:\n• La Sede activa en [Configuración] > [Sucursales].\n• El Odontólogo/Profesional creado como usuario en [Configuración] > [Usuarios].\n• El Sillón o Espacio Clínico asignado a esa sede en [Configuración] > [Recursos físicos].\n• Los Horarios de atención y turnos del doctor en [Administración] > [Gestión Agenda].\n\nPasos para apartar la cita:\n1. Haz clic en Agenda (menú izquierdo).\n2. Pulsa el botón azul + Nueva Cita, arriba a la derecha; abre el formulario.\n3. En Identidad del Paciente, escribe nombre o cédula en BUSCAR POR NOMBRE O CC... y haz clic en el resultado. Si no está registrado, marca Nuevo y completa sus datos obligatorios.\n4. En Detalles de la Cita, selecciona sede, profesional (odontólogo) y espacio clínico (sillón/consultorio); indica fecha, hora y duración.\n5. Revisa que el estado sea Sin Confirmar y pulsa el botón verde CONFIRMAR REGISTRO, abajo. Corrige los campos o cruces de horario que el sistema señale.';

const budgetSummary = '📌 Recuerda antes de empezar:\n• Tu clínica debe tener la Lista de Precios configurada en [Configuración] > [Lista de precios] con los procedimientos y valores en pesos (COP).\n• El Odontólogo tratante debe estar asignado en la pestaña [Profesionales] del expediente del paciente.\n\nPasos para crear un presupuesto o plan de tratamiento:\n1. Abre la ficha del paciente y haz clic en la pestaña [Presupuestos & planes] (menú lateral izquierdo del paciente).\n2. Encontrarás dos secciones: para una cotización pulsa el botón verde [+ Nuevo Presupuesto], o para un tratamiento activo pulsa [+ Nuevo Plan de Tratamiento].\n3. En la ventana emergente, escribe el Nombre (ej: Ortodoncia o Tratamiento General), selecciona el Profesional tratante, revisa la Vigencia (días) y la Modalidad (Particular o EPS/Convenio), y pulsa el botón verde [Crear].\n4. En el editor de la propuesta, pulsa el botón azul [+ Agregar Items / Procedimientos] (o [+ Agregar items]) para seleccionar los procedimientos directamente del tarifario de la clínica. (Solo si ya le habías hecho un odontograma al paciente, puedes pulsar opcionalmente el botón verde [Odonto. Actual] para cargar esos tratamientos sin digitarlos).\n5. Ajusta cantidades y descuentos. Puedes imprimir la cotización en PDF con el ícono de impresora, o pulsar el botón superior [Convertir a Plan] cuando el paciente la apruebe.\n6. En planes de tratamiento activos, para ejecutar un procedimiento marca la casilla (✓) y pulsa el botón azul superior [Realizar] para mandarlo directo a evolución clínica.';

const conversationRules = 'Eres OdontoIA. Explica como con plastilina: claro, paso a paso y amable. Si la acción requiere requisitos previos (sedes, doctores, sillones, horarios, lista de precios o caja abierta), incluye al inicio "📌 Recuerda antes de empezar:" explicando qué configurar antes de los pasos numerados. Luego da los pasos numerados indicando con precisión dónde pulsar y el nombre exacto del botón. No supongas acciones ya hechas. Si pide acompañamiento, explica los primeros dos pasos y pregunta si abrió el formulario. En presupuestos y planes se crean en [Presupuestos & planes] con [+ Nuevo Presupuesto] o [+ Nuevo Plan de Tratamiento]; no obligues a usar odontograma. Usa solo la referencia; si falta algo, pregunta. No inventes acciones, datos ni consejos clínicos. Solo OdontoCloud.';

export function publicSystemPrompt(relevantGuide) {
  return conversationRules + '\nAtiendes visitantes: explica el producto sin promesas no documentadas. No eres ChatGPT ni una persona.\nREFERENCIA:\n' + (relevantGuide ? formatGuide(relevantGuide, true) : 'OdontoCloud es un software de gestión odontológica. Pregunta qué función o plan le interesa antes de ofrecer detalles.');
}

export function isGeneralAppointment(question) {
  return /^(?:(?:hola )?(?:quiero|necesito|quisiera|deseo|ayudame a|me ayudas a) |como (?:hago para |puedo )?)?(?:apartar|aparto|agendar|agendo|reservar|reservo|crear|creo)(?: una)? cita(?: nueva)?(?: por favor)?$/.test(normalize(question));
}

export function isGeneralBudget(question) {
  return /^(?:(?:hola )?(?:quiero|necesito|quisiera|deseo|ayudame a|me ayudas a) |como (?:hago para |puedo )?)?(?:crear|hacer|elaborar|generar|cotizar)(?: un)? (?:presupuesto|plan de tratamiento|cotizacion)(?: nuevo)?(?: por favor)?$/.test(normalize(question)) ||
    /^(?:quiero|necesito|deseo) (?:un )?(?:presupuesto|plan de tratamiento|cotizacion)$/.test(normalize(question));
}

export function helpPrompt(guide, question, isPublic = false) {
  if (isPublic) return publicSystemPrompt(guide);
  const generalAppointment = isGeneralAppointment(question);
  const generalBudget = isGeneralBudget(question);
  const reference = (guide.id === 'citas' && generalAppointment)
    ? appointmentSummary
    : (guide.id === 'presupuestos' && generalBudget)
      ? budgetSummary
      : formatGuide(guide);
  return conversationRules + '\nLas opciones dependen de los permisos.\nREFERENCIA:\n' + reference;
}

export function createHelpHandler({ authenticate, env, fetchImpl = fetch, log = () => {}, authTimeoutMs = 8000, ollamaTimeoutMs = 45000 }) {
  return async request => {
    const started = Date.now();
    const trace = (stage, details = {}) => log({ stage, elapsedMs: Date.now() - started, ...details });
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
    try {
      // Bound bytes while reading, including requests without Content-Length.
      const reader = request.body?.getReader();
      if (!reader) throw new HelpError(400, 'Falta la pregunta.');
      const chunks = [];
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) { await reader.cancel(); throw new HelpError(413, 'La pregunta es demasiado larga.'); }
        chunks.push(value);
      }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
      let body;
      try { body = JSON.parse(new TextDecoder().decode(buffer)); } catch { throw new HelpError(400, 'Solicitud inválida.'); }
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key => !['question', 'previousIds', 'mode', 'history', 'stream'].includes(key))) {
        throw new HelpError(400, 'Solo se admiten preguntas sobre OdontoCloud.');
      }

      if (body.mode !== undefined && !['app', 'public'].includes(body.mode)) throw new HelpError(400, 'Modo inválido.');
      if (body.stream !== undefined && typeof body.stream !== 'boolean') throw new HelpError(400, 'Formato inválido.');
      const history = body.history ?? [];
      if (!Array.isArray(history) || history.length > 4 || history.some(m => !m || typeof m !== 'object' || Object.keys(m).some(k => !['role','content'].includes(k)) || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 600) || history.reduce((n,m) => n + m.content.length, 0) > 1800) throw new HelpError(400, 'Historial inválido.');
      const isPublic = body.mode === 'public';
      if (!isPublic) {
        const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
        if (!token) throw new HelpError(401, 'Debes iniciar sesión.');
        // Auth and clinic membership are resolved against OdontoCloud, never from the request body.
        trace('auth_started');
        const authController = new AbortController();
        let authTimer;
        let principal;
        try {
          principal = await Promise.race([
            authenticate(token, authController.signal),
            new Promise((_, reject) => {
              authTimer = setTimeout(() => {
                authController.abort();
                reject(new HelpError(503, 'La verificación de sesión tardó demasiado. Intenta nuevamente.'));
              }, authTimeoutMs);
            }),
          ]);
        } finally { clearTimeout(authTimer); }
        if (!principal?.userId || !principal?.tenantId || principal.active !== true) {
          throw new HelpError(403, 'Tu cuenta no puede utilizar esta ayuda.');
        }
        trace('auth_completed');
      }

      const question = typeof body.question === 'string' ? body.question.trim() : '';
      if (!question || question.length > 1200) throw new HelpError(400, 'Escribe una pregunta de hasta 1200 caracteres.');
      let previousIds = body.previousIds ?? [];
      if (!Array.isArray(previousIds) || previousIds.length > 3 || previousIds.some(id => !HELP_GUIDES.some(g => g.id === id))) {
        throw new HelpError(400, 'El contexto de ayuda no es válido.');
      }
      if (isPublic) previousIds = previousIds.filter(id => PUBLIC_GUIDE_IDS.has(id));
      const conversation = conversationalReply(question, previousIds, isPublic ? 'public' : 'app');
      if (conversation) return json(conversation);
      if (/\bedunexus\b/.test(normalize(question))) return json(clarificationReply(question));
      const guides = resolveHelpGuides(question, previousIds, isPublic ? 'public' : 'app');
      if (!guides.length) return json(clarificationReply(question, isPublic ? 'public' : 'app'));
      const fallback = reason => {
        trace('manual_fallback', { reason });
        const publicReason = ['timeout', 'provider_error', 'incomplete_response'].includes(reason) ? 'unavailable' : reason;
        return json({ success: true, provider: 'manual', reason: publicReason, version: KNOWLEDGE_VERSION, answer: formatGuide(guides[0], isPublic), sources: guides.map(({ id, title, category }) => ({ id, title, category })) });
      };

      const base = env('ODONTO_HELP_OLLAMA_URL');
      const model = env('ODONTO_HELP_OLLAMA_MODEL');
      if (!base || !model) return fallback('not_configured');
      let url;
      try {
        url = new URL(base);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
        url.pathname = url.pathname.replace(/\/$/, '') + '/api/chat';
      } catch { return fallback('unavailable'); }
      const controller = new AbortController();
      const abort = () => controller.abort();
      request.signal.addEventListener('abort', abort, { once: true });
      if (request.signal.aborted) abort();
      const timer = setTimeout(abort, ollamaTimeoutMs);
      const sources = guides.map(({ id, title, category }) => ({ id, title, category }));
      // A standalone appointment or budget request needs no previous transcript. Keep history for follow-ups.
      const isStandalone = (guides[0].id === 'citas' && isGeneralAppointment(question)) ||
                           (guides[0].id === 'presupuestos' && isGeneralBudget(question));
      const modelHistory = isStandalone ? [] : history;
      const systemPrompt = helpPrompt(guides[0], question, isPublic);
      const run = async emit => {
        try {
          trace('ollama_started', { promptChars: systemPrompt.length + question.length + modelHistory.reduce((n, m) => n + m.content.length, 0), historyMessages: modelHistory.length });
          const response = await fetchImpl(url.toString(), {
            method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', ...(env('ODONTO_HELP_OLLAMA_TOKEN') ? { Authorization: 'Bearer ' + env('ODONTO_HELP_OLLAMA_TOKEN') } : {}) },
            body: JSON.stringify({ model, stream: !!emit, keep_alive: '30m', options: { temperature: 0.3, num_predict: 300, num_ctx: 4096 },
              messages: [{ role: 'system', content: systemPrompt }, ...modelHistory, { role: 'user', content: question }] }),
          });
          trace('ollama_headers', { status: response.status });
          if (!response.ok) return fallback('provider_error');
          let result;
          let answer = '';
          if (emit) {
            for await (const event of readHelpEvents(response.body)) {
              if (event.error) throw new Error('Provider stream failed');
              const chunk = event.message?.content ?? '';
              if (typeof chunk !== 'string' || answer.length + chunk.length > 12000) throw new Error('Invalid output');
              if (chunk && !answer) trace('first_token');
              answer += chunk;
              if (chunk) emit({ type: 'delta', text: chunk });
              if (event.done) { result = event; break; }
            }
          } else {
            result = await response.json();
            answer = result?.message?.content;
          }
          if (typeof answer !== 'string' || !answer.trim() || answer.length > 12000 || !result?.done || result.done_reason === 'length') return fallback('incomplete_response');
          trace('answer_completed');
          return json({ success: true, provider: 'ollama', version: KNOWLEDGE_VERSION, answer: answer.trim(), sources });
        } catch { return fallback(controller.signal.aborted ? 'timeout' : 'unavailable'); }
        finally { clearTimeout(timer); request.signal.removeEventListener('abort', abort); }
      };
      if (!body.stream) return await run(null);
      const encoder = new TextEncoder();
      let cancelled = false;
      const stream = new ReadableStream({
        start(output) {
          const emit = event => { if (!cancelled) output.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\n\n')); };
          void (async () => { try {
            emit({ type: 'status', text: 'Preparando la respuesta…' });
            const result = await run(emit);
            emit({ type: 'result', result: await result.json() });
          } finally { if (!cancelled) output.close(); } })().catch(() => { abort(); });
        },
        cancel() { cancelled = true; abort(); },
      });
      return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no' } });
    } catch (error) {
      trace('request_rejected', { status: error instanceof HelpError ? error.status : 503 });
      return json({ success: false, error: error instanceof HelpError ? error.message : 'No fue posible verificar el acceso a la ayuda.' }, error instanceof HelpError ? error.status : 503);
    }
  };
}
