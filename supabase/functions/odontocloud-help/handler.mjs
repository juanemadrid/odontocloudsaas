export function getModuleLocationReference(guideId) {
  switch (guideId) {
    case 'citas':
      return 'Desde Inicio: entra a [Agenda] en el menú lateral izquierdo. Arriba a la derecha de Gestión Citas encontrarás el botón azul [+ Nueva Cita]. Ese botón no está en Inicio. En el formulario modal que se abre, completa los datos y abajo a la derecha pulsa el botón verde [CONFIRMAR REGISTRO].';
    case 'editar-cita':
      return 'En [Agenda], haz clic directamente sobre la cita en el calendario. Para modificarla cambia los datos y pulsa [CONFIRMAR REGISTRO] abajo a la derecha. Para cancelarla o cambiar estado usa [Estado de la Cita]. Para borrarla definitivamente pulsa el botón rojo [ELIMINAR CITA] abajo a la izquierda.';
    case 'odontograma':
      return 'Desde Inicio: entra a [Pacientes] en el menú lateral izquierdo, busca al paciente y haz clic en su nombre para abrir su ficha. En el menú de pestañas de la ficha entra a [Odontogramas]. El botón índigo [+ Nuevo Odontograma] está arriba a la derecha en la cabecera. Dentro del editor gráfico, los botones [Guardar] (azul) y [Finalizar] (verde) se encuentran arriba a la derecha en la barra superior.';
    case 'presupuestos':
      return 'Desde Inicio: pulsa [Pacientes] en el menú principal, busca al paciente y abre su ficha. Allí está [Presupuestos & planes] en el menú de esa ficha. En la cabecera de la tabla superior a la derecha está el botón verde [+ Nuevo Presupuesto], o más abajo [+ Nuevo Plan de Tratamiento]. No está en Inicio. En la ventana emergente pulsa el botón verde [Crear] abajo a la derecha.';
    case 'pagos-paciente':
      return 'Desde Inicio: entra a [Pacientes] en el menú principal, busca al paciente y abre su ficha. Allí está [Realizar pago] en el menú de esa ficha para pulsar el botón verde [Pagar / Abonar] en la tabla de planes a la derecha. No está en Inicio. En el formulario marca las prestaciones y pulsa el botón verde [Finalizar Transacción] abajo a la derecha.';
    case 'abrir-caja':
      return 'Desde Inicio: entra a [Caja] en el menú lateral izquierdo. El botón verde [Abrir Caja] está arriba a la derecha. En el modal digita [Ajustar Base Inicial] y confirma con el botón verde [Abrir Caja] abajo.';
    case 'cerrar-caja':
      return 'Desde Inicio: entra a [Caja] en el menú lateral izquierdo. En la tarjeta de tu caja activa pulsa [Cerrar Caja]. En el modal digita el efectivo contado, marca la confirmación de conteo físico y pulsa el botón rojo [Cerrar Caja Definitivamente] abajo a la derecha.';
    case 'pacientes':
      return 'Desde Inicio: entra a [Pacientes] en el menú lateral izquierdo. El botón verde [+ Nuevo Paciente] está arriba a la derecha. Para buscar pacientes existentes usa la barra de búsqueda superior por documento o nombre.';
    case 'evoluciones':
      return 'Desde Inicio: entra a [Pacientes], abre la ficha del paciente y selecciona la pestaña [Evoluciones & Remis]. El botón verde [Evolución] está arriba a la derecha. Nota: El odontólogo debe estar vinculado previamente como tratante en la pestaña [Profesionales].';
    case 'historia':
      return 'Desde Inicio: entra a [Pacientes], abre la ficha del paciente y selecciona la pestaña [Doc. Clínicos] en el menú lateral de la ficha.';
    case 'empresa':
      return 'Desde Inicio: entra a [Configuración] en el menú lateral izquierdo y selecciona [Datos Básicos]. En esa pantalla puedes escribir el [Nombre Comercial], [Razón Social], [NIT / Identificación] y cargar el [Logo] de tu empresa o clínica. Arriba a la derecha pulsa el botón azul [Guardar Cambios].';
    case 'usuarios':
      return 'Desde Inicio: entra a [Configuración] en el menú lateral y pulsa [Usuarios]. Arriba a la derecha haz clic en el botón azul [Nuevo Usuario]. Para registrar a un doctor o especialista: completa sus datos y activa el interruptor verde [¿Es doctor / profesional clínico?], luego en la sección [Especializaciones] selecciona y transfiere sus especialidades para que aparezca habilitado en la Agenda. Abajo a la derecha pulsa [Guardar Usuario]. Requiere perfil Administrador.';
    case 'especialidades':
      return 'Desde Inicio: entra a [Configuración] en el menú lateral y selecciona [Especialidades]. Arriba a la derecha pulsa el botón azul [+ Nueva Especialidad], escribe el nombre del área (ej. Ortodoncia o Periodoncia) y pulsa [Guardar].';
    case 'sedes':
      return 'Desde Inicio: entra a [Configuración] en el menú lateral y selecciona [Sucursales] (para sedes) o [Recursos físicos] (para sillones/consultorios). Requiere perfil Administrador.';
    case 'precios':
      return 'Desde Inicio: entra a [Configuración] en el menú lateral y haz clic en [Lista de precios] para gestionar el tarifario. Requiere perfil Administrador.';
    default:
      return null;
  }
}

import { conversationalReply, resolveHelpGuides, clarificationReply, readHelpEvents, isContextualReply, isBriefFollowup, trustedScreenContext } from '../_shared/helpConversation.mjs';
import { normalize, formatGuide, KNOWLEDGE_VERSION, HELP_GUIDES, PUBLIC_GUIDE_IDS } from '../_shared/helpKnowledge.mjs';

export class HelpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Reviewed short version of the appointment guide; the full guide remains in the library.
// Other topics retain their complete instructions until a reviewed summary is available.
const appointmentSummary = 'Agenda (menú izquierdo) > botón azul [+ Nueva Cita] arriba a la derecha: abre formulario. En Identidad del Paciente busca nombre o cédula y selecciona resultado; Nuevo permite registrarlo. En Detalles de la Cita elige sede, profesional, espacio clínico, fecha, hora y duración. Estado Sin Confirmar; botón verde CONFIRMAR REGISTRO abajo a la derecha. Si falta configuración, consulta la guía completa.';

const budgetSummary = 'Desde Inicio: [Pacientes] en menú principal > busca al paciente y abre su ficha > [Presupuestos & planes] en menú lateral de esa ficha > botón verde [+ Nuevo Presupuesto] en la cabecera de la tabla a la derecha. Ese botón no está en Inicio. Abre ventana: Nombre, Profesional, Vigencia y Modalidad; pulsa [Crear] abajo a la derecha. En editor [+ Agregar Items / Procedimientos] selecciona del tarifario. Requiere lista de precios y profesional asignado. Para tratamiento activo existe [+ Nuevo Plan de Tratamiento].';

const odontogramSummary = 'Desde Inicio: [Pacientes] en menú izquierdo > busca al paciente y abre su ficha > pestaña [Odontogramas] en el menú lateral de la ficha. Arriba a la derecha en la cabecera pulsa el botón índigo [+ Nuevo Odontograma]. En el editor gráfico, los botones [Guardar] (azul) y [Finalizar] (verde) están arriba a la derecha en la barra superior.';

const conversationRules = 'Eres OdontoIA: ayuda experta de OdontoCloud. Conoces el sistema de punta a punta. Sin consejos clínicos ni acciones ejecutadas. Explica la ruta y ubicación física exacta de cada botón (arriba/abajo, derecha/izquierda, cabecera o modal) con nombres literales en [corchetes]. Responde la duda en 40 a 55 palabras, con tono natural y directo. No inventes permisos ni des ubicaciones falsas.';

export function publicSystemPrompt(relevantGuide) {
  return conversationRules + '\nAtiendes visitantes: explica el producto sin promesas no documentadas. No eres ChatGPT ni una persona.\nREFERENCIA:\n' + (relevantGuide ? formatGuide(relevantGuide, true) : 'OdontoCloud es un software de gestión odontológica. Pregunta qué función o plan le interesa antes de ofrecer detalles.');
}

export function isGeneralAppointment(question) {
  return /^(?:(?:hola )?(?:quiero|necesito|quisiera|deseo|ayudame a|me ayudas a) |como (?:hago para |puedo )?)?(?:apartar|aparto|agendar|agendo|reservar|reservo|crear|creo)(?: una)? cita(?: nueva)?(?: por favor)?$/.test(normalize(question).replace(/(?: por favor)? explicame paso a paso(?: por favor)?$/, "").trim());
}

export function isGeneralBudget(question) {
  return /^(?:(?:hola )?(?:quiero|necesito|quisiera|deseo|ayudame a|me ayudas a) |como (?:hago para |puedo )?)?(?:crear|hacer|elaborar|generar|cotizar)(?: un)? (?:presupuesto|plan de tratamiento|cotizacion)(?: nuevo)?(?: por favor)?$/.test(normalize(question).replace(/(?: por favor)? explicame paso a paso(?: por favor)?$/, "").trim()) ||
    /^(?:quiero|necesito|deseo) (?:un )?(?:presupuesto|plan de tratamiento|cotizacion)$/.test(normalize(question).replace(/(?: por favor)? explicame paso a paso(?: por favor)?$/, "").trim());
}

// Keep the most recent exchange, rather than replaying older turns on the CPU.
export function recentModelHistory(history) {
  return history.slice(-2).map(message => ({
    role: message.role,
    content: message.role === 'assistant' ? message.content : (message.content.length <= 180 ? message.content : message.content.slice(0, 180)),
  }));
}

// Select complete relevant steps, never a raw character cut through an instruction.
export function focusedReference(guide, question, limit = 1000) {
 const terms = normalize(question).split(' ').filter(w => w.length > 3);
 const blocks = guide.steps.map((text, index) => ({text, index, score:terms.reduce((n,w)=>n+(normalize(text).includes(w)?1:0),0)}));
 const ranked = [...blocks].sort((a,b)=>b.score-a.score || a.index-b.index);
 const chosen = new Map();
 let used=guide.title.length;
 for (const block of [blocks[0], ...ranked].filter(Boolean)) {
   if (chosen.has(block.index) || used + block.text.length > limit) continue;
   chosen.set(block.index,block); used+=block.text.length+5;
 }
 return guide.title+'\n'+[...chosen.values()].sort((a,b)=>a.index-b.index).map(b=>(b.index+1)+'. '+b.text).join('\n')+'\nSi falta información en esta referencia, pregunta; no inventes el paso.';
}

export function budgetStageReference(question, screenContext, history = []) {
 const q=normalize(question);
 const relevant=[question,...history.slice().reverse().map(m=>m.content)].find(text=>/plan de tratamiento|nuevo plan|presupuesto|cotizacion/.test(normalize(text))) || '';
 const treatment=/plan de tratamiento|nuevo plan/.test(normalize(relevant));
 const button=treatment?'[+ Nuevo Plan de Tratamiento]':'[+ Nuevo Presupuesto]';
 const lastAssistant=history.filter(m=>m.role==='assistant').at(-1)?.content || '';
 const acceptsGuidance=/^(si|si claro|claro|dale|continua|de acuerdo|ok)$/.test(q) && /(?:deseas|quieres|continuar|continuamos|seguimos)/.test(normalize(lastAssistant));
 if (acceptsGuidance) return 'El usuario acepta que lo guíes; no afirma haber completado acciones. No repitas tu resumen ni vuelvas a pedir permiso. Si ya está en Presupuestos & planes, indícale pulsar '+button+'; si no, explica cómo llegar desde Pacientes y la ficha. Al abrir el formulario completa Nombre y Profesional, revisa Vigencia y Modalidad ANTES de Crear. Da solo la próxima acción desde su ubicación.';
 const navigation='Desde Inicio: pulsa [Pacientes] en el menú principal, busca al paciente y abre su ficha. Allí está [Presupuestos & planes] en el menú de esa ficha. No está en Inicio. Explica cómo llegar y detente antes de crear el presupuesto.';
 if (/no (?:se|veo|encuentro)|donde (?:esta|estan)|estoy en inicio/.test(q)) return navigation;
 if (/^(?:si )?ya (?:agregue|anadi|seleccione)\b/.test(q)) return 'El usuario informa que ya añadió procedimientos. Reconócelo sin afirmar que verificaste sus datos. En el editor revisa cantidades, descuentos y total. Para cotización existe icono de impresora; [Convertir a Plan] solo cuando la aprueben. No vuelvas a pedir que agregue esos procedimientos.';
 if (/ya (?:abri|veo)|estoy en/.test(q) && /presupuestos|planes/.test(q)) return 'En [Presupuestos & planes], pulsa '+button+'. Se abre un formulario: completa [Nombre], selecciona [Profesional], revisa Vigencia y Modalidad. Solo después de completar esos campos pulsa [Crear]. Explica primero abrir el formulario; no des por hecho que los campos están completos.';
 if (isGeneralBudget(question) && /inicio|dashboard_admin$/.test(normalize(screenContext))) return navigation;
 return null;
}

export function canonicalButtonLabels(answer, reference) {
 const labels=[...reference.matchAll(/\[([^\]\n]+)\]/g)].map(m=>m[1]);
 const key=value=>normalize(value).replace(/ /g,'');
 return answer.replace(/\[([^\]\n]+)\]/g,(whole,label)=>{
   const match=labels.find(candidate=>key(candidate)===key(label));
   return match ? '['+match+']' : whole;
 });
}

export function helpPrompt(guide, question, isPublic = false, screenContext = '', history = []) {
  if (isPublic) return publicSystemPrompt(guide);
  const q = normalize(question);
  const isLost = /(?:d[oe]nde|no (?:se|veo|encuentro)|como llego|como entro|estoy en inicio|ubicacion|cual boton|le doy|hago clic|presiono|pongo|cambio)/.test(q);
  const followup = isContextualReply(question) || isBriefFollowup(question);
  const generalAppointment = isGeneralAppointment(question) || followup || isLost;
  const generalBudget = isGeneralBudget(question) || followup || isLost;
  const stageReference = guide.id === 'presupuestos' ? budgetStageReference(question, screenContext, history) : null;
  const navRef = isLost ? getModuleLocationReference(guide.id) : null;
  const paymentReference = guide.id === 'pagos-paciente' ? (navRef || 'Pacientes > ficha > [Realizar pago] > [Pagar / Abonar] abre [Prestaciones]. Marca procedimientos; aún no están pagados. [Abono parcial] vacío paga el total seleccionado; con importe hace abono. Revisa [Total a pagar]. Elige [Medio de Pago]. [Número de Referencia / Comprobante] aparece solo con Transferencia, Cheque, Consignación, Nequi, Daviplata o PSE; con Efectivo NO aparece. Selecciona [Profesional / Responsable]; [Observaciones] opcional. Pulsa [Finalizar Transacción] y espera «Pago registrado exitosamente»; no afirmes haber verificado el pago. Un abono no liquida toda la deuda. Los nombres de esta referencia prevalecen sobre errores del historial.') : null;
  const appointmentNav = isLost ? 'Desde Inicio: entra a [Agenda] en el menú lateral izquierdo. Arriba a la derecha de Gestión Citas encontrarás el botón azul [+ Nueva Cita]. Ese botón no está en Inicio.' : null;
  const budgetNav = isLost ? 'Desde Inicio: entra a [Pacientes] en el menú lateral izquierdo, busca al paciente y abre su ficha. Entra a la pestaña [Presupuestos & planes] en la ficha. Arriba a la derecha en la tabla de Presupuestos está el botón verde [+ Nuevo Presupuesto], o más abajo [+ Nuevo Plan de Tratamiento]. Ese botón no está en Inicio.' : null;
  const reference = paymentReference || stageReference || navRef || ((guide.id === 'citas' && generalAppointment)
    ? (appointmentNav || appointmentSummary)
    : (guide.id === 'presupuestos' && generalBudget)
      ? (budgetNav || budgetSummary)
      : (guide.id === 'odontograma' && (isLost || q.includes('odontograma') || q.includes('diente')))
        ? odontogramSummary
        : focusedReference(guide, question, 750));
  const contextNote = screenContext ? `\nPANTALLA ACTUAL DEL USUARIO: ${screenContext}\n` : '';
  return conversationRules + contextNote + '\nLas opciones dependen de los permisos.\nREFERENCIA:\n' + reference;
}

export function createHelpHandler({ authenticate, env, fetchImpl = fetch, log = () => {}, authTimeoutMs = 8000, ollamaTimeoutMs = 60000 }) {
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
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key => !['question', 'previousIds', 'mode', 'history', 'stream', 'screenContext'].includes(key))) {
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
      if (/\bedunexus\b/.test(normalize(question).replace(/(?: por favor)? explicame paso a paso(?: por favor)?$/, "").trim())) return json(clarificationReply(question));
      const guides = resolveHelpGuides(question, previousIds, isPublic ? 'public' : 'app');
      if (!guides.length) return json(clarificationReply(question, isPublic ? 'public' : 'app'));
      const fallback = reason => {
        trace('manual_fallback', { reason });
        const publicReason = ['timeout', 'provider_error', 'incomplete_response'].includes(reason) ? 'unavailable' : reason;
        return json({ success: true, provider: 'manual', reason: publicReason, version: KNOWLEDGE_VERSION, answer: formatGuide(guides[0], isPublic), sources: guides.map(({ id, title, category }) => ({ id, title, category })) });
      };

      const sources = guides.map(({ id, title, category }) => ({ id, title, category }));
      const isStandalone = (guides[0].id === 'citas' && isGeneralAppointment(question)) ||
                           (guides[0].id === 'presupuestos' && isGeneralBudget(question));
      const modelHistory = isStandalone ? [] : recentModelHistory(history);
      const screenContext = trustedScreenContext(body.screenContext);
      const systemPrompt = helpPrompt(guides[0], question, isPublic, screenContext, modelHistory);

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
      const run = async emit => {
        let answer = '';
        const interrupted = reason => {
          // Preserve visible tokens without presenting unfinished instructions as complete.
          if (!emit || !answer.trim() || answer.length > 12000 || request.signal.aborted) return fallback(reason);
          trace('answer_interrupted', { reason, answerChars: answer.length });
          return json({ success: true, provider: 'ollama', reason: 'partial', complete: false,
            version: KNOWLEDGE_VERSION, sources,
            answer: 'Respuesta incompleta: la generación se interrumpió. El texto siguiente puede quedar cortado; consulta la guía relacionada antes de seguir.\n\n' + canonicalButtonLabels(answer.trim(), systemPrompt) });
        };
        try {
          trace('ollama_started', { promptChars: systemPrompt.length + question.length + modelHistory.reduce((n, m) => n + m.content.length, 0), historyMessages: modelHistory.length });
          const response = await fetchImpl(url.toString(), {
            method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', ...(env('ODONTO_HELP_OLLAMA_TOKEN') ? { Authorization: 'Bearer ' + env('ODONTO_HELP_OLLAMA_TOKEN') } : {}) },
            body: JSON.stringify({ model, stream: !!emit, keep_alive: '30m', options: { temperature: 0.25, num_predict: 140, num_ctx: 1536 },
              messages: [{ role: 'system', content: systemPrompt }, ...modelHistory, { role: 'user', content: question }] }),
          });
          trace('ollama_headers', { status: response.status });
          if (!response.ok) return fallback('provider_error');
          let result;
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
          if (typeof answer !== 'string' || !answer.trim() || answer.length > 12000 || !result?.done || result.done_reason === 'length') return interrupted('incomplete_response');
          trace('answer_completed');
          return json({ success: true, provider: 'ollama', version: KNOWLEDGE_VERSION, answer: canonicalButtonLabels(answer.trim(), systemPrompt), sources });
        } catch { return interrupted(controller.signal.aborted ? 'timeout' : 'unavailable'); }
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
