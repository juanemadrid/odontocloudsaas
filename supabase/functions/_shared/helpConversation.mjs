import { HELP_GUIDES, PUBLIC_GUIDE_IDS, KNOWLEDGE_VERSION, normalize, searchGuides } from './helpKnowledge.mjs';

export function conversationalReply(question, previousIds = [], mode = 'app') {
  const q = normalize(question);
  const topic = HELP_GUIDES.find(g => g.id === previousIds[0] && (mode !== 'public' || PUBLIC_GUIDE_IDS.has(g.id)));
  let answer;
  if (/^(hola|hola buenas|buenas|buenos dias|buenas tardes|buenas noches|hey|hola como estas|como estas|que tal|saludos)$/.test(q)) {
    answer = topic ? `¡Hola! ¿Seguimos con «${topic.title}» o necesitas ayuda con otra cosa?` : mode === 'public' ? '¡Hola! Soy OdontoIA. Puedo ayudarte a conocer OdontoCloud y encontrar el plan que encaje con tu consultorio. ¿Qué te gustaría saber?' : '¡Hola! Soy OdontoIA. ¿Qué necesitas hacer en OdontoCloud? Cuéntame dónde te quedaste y lo vemos paso a paso.';
  } else if (/^(muchas gracias|gracias|gracias por la ayuda|listo gracias|perfecto gracias)$/.test(q)) {
    answer = '¡Con gusto! Si te atoras en otro paso, dime qué ves y lo revisamos juntos.';
  } else if (/^(que puedes hacer|en que me puedes ayudar|ayudame|necesito ayuda)$/.test(q)) {
    answer = 'Puedo explicarte cómo usar OdontoCloud, acompañarte paso a paso y ayudarte a entender sus opciones. ¿Quieres trabajar con citas, pacientes, caja, facturación u otro módulo?';
  } else if (/^(eres (una )?ia|eres un robot|quien eres|eres chatgpt)$/.test(q)) {
    answer = 'Soy OdontoIA, el asistente de OdontoCloud. Puedo explicarte sus funciones y ayudarte a resolver dudas de uso. No soy una persona ni puedo realizar operaciones por ti.';
  }
  return answer ? { success: true, provider: 'assistant', version: KNOWLEDGE_VERSION, answer, sources: [], reason: 'conversation' } : null;
}

// Replies to a choice or a completed step belong to the active workflow.
export function isBriefFollowup(question) {
  return /^(?:si(?: ya| listo| lo veo| ya lo veo)?|ya(?: esta| lo hice)?|ok|okay|vale|listo|perfecto|hecho|y ahora|y despues|despues|siguiente|continua|continuar|que sigue|no entendi|no entiendo|explicame(?: mejor| de nuevo)?|mas despacio|mas detalle|paso a paso|no aparece|no lo veo|no encuentro|donde esta|cual boton)$/.test(normalize(question));
}

export function isContextualReply(question) {
  const q = normalize(question);
  return /^(?:(?:la|el) (?:primer[oa]|segund[oa]|tercer[oa]|ultim[oa])(?: opcion)?|(?:opcion )?[123]|es[ao]|esa opcion)$/.test(q) ||
    /^(?:(?:si|listo|perfecto) )?ya (?:lo |la |los |las )?(?:agregue|anadi|seleccione|elegi|guarde|cree|abri|termine|complete|hice|veo|aparece|estan|esta)(?:\b|$)/.test(q) ||
    /^(?:acabo de|termine de) (?:agregar|anadir|seleccionar|guardar|crear|abrir)(?:\b|$)/.test(q);
}

const topicWords = text => normalize(text).split(' ').map(w=>w.startsWith('configur')?'configuracion':w.endsWith('s')?w.slice(0,-1):w).filter(w=>w.length>3 && !['crear','nuevo','nueva','modificar','hacer','como','boton','opcion','sistema','ayuda','guia','paso'].includes(w));
export function resolveHelpGuides(question, previousIds = [], mode = 'app') {
  const q = normalize(question);
  if (/\bedunexus\b/.test(q)) return [];
  const followup = isBriefFollowup(question) || /^(no entendi|no entiendo|explicame( mejor| de nuevo)?|mas despacio|mas detalle|paso a paso|y ahora|y despues|siguiente|continua|listo|ya esta|ya lo hice|si|ok|no aparece|no lo veo|no encuentro|donde esta|cual boton)(\b|$)/.test(q);
  const candidates = HELP_GUIDES.filter(g => mode !== 'public' || PUBLIC_GUIDE_IDS.has(g.id));
  const active = previousIds.map(id => candidates.find(g => g.id === id)).filter(Boolean).slice(0, 1);
  if (active.length && isContextualReply(question)) return active;
  if (/\b(planes|suscripcion|mensualidad)\b/.test(q) && !/\b(tratamientos?|pacientes?|presupuestos?)\b/.test(q)) {
    return candidates.filter(g => g.id === 'planes-suscripcion');
  }
  const matches = searchGuides(question, [], mode);
  const words = topicWords(question);
  const namedTopic = matches.find(g => topicWords(g.title+' '+g.category).some(word=>words.includes(word)));
  const direct = namedTopic ? [namedTopic] : matches.slice(0, 1);
  // A clear new topic wins over the old conversation (e.g. "explicame los planes").
  if (direct.length) {
    const anchor = topicWords(direct[0].title+' '+direct[0].category);
    const words = topicWords(question);
    // Generic words such as "button" must not replace an ongoing workflow with permissions.
    if (active.length && !anchor.some(word=>words.includes(word))) return active;
    return direct;
  }
  if (followup && previousIds.length) return previousIds.map(id => candidates.find(g => g.id === id)).filter(Boolean).slice(0, 1);
  if (active.length && /\b(ese|esa|eso|ahi|alli|otro|otra|buscarlo|hacerlo|encontrarlo|sale|aparece|veo|encuentro)\b/.test(q)) return active;
  return searchGuides(question, previousIds, mode).slice(0, 1);
}

export function clarificationReply(question, mode = 'app') {
  return { success: true, provider: 'assistant', version: KNOWLEDGE_VERSION, sources: [], reason: 'clarification',
    answer: /\bedunexus\b/.test(normalize(question))
      ? 'Esta conversación te ayuda con OdontoCloud. Para Edunexus, utiliza la ayuda de esa aplicación. ¿Qué necesitas resolver aquí?'
      : mode === 'public' ? '¿Tu duda es sobre precios, la prueba gratuita o alguna función de OdontoCloud? Cuéntame qué necesitas para orientarte sin inventar información.' : 'Quiero ubicar bien tu duda. ¿En qué módulo estás y qué quieres hacer? Por ejemplo: «Estoy en Caja y quiero registrar un pago». Si ves un error, describe el mensaje sin datos de pacientes.' };
}

export function compactHistory(messages = []) {
  let remaining = 1800;
  const result = [];
  for (const message of [...messages].reverse()) {
    if (result.length === 4 || remaining <= 0) break;
    const role = message.role || (message.sender === 'user' ? 'user' : 'assistant');
    const content = String(message.content ?? message.text ?? '').slice(0, Math.min(600, remaining));
    if (!['user', 'assistant'].includes(role) || !content.trim()) continue;
    result.unshift({ role, content });
    remaining -= content.length;
  }
  return result;
}

// Reads both Ollama NDJSON and our SSE data frames, with bounded buffering.
export async function* readHelpEvents(body) {
  if (!body) throw new Error('Missing stream');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parse = line => {
    const value = line.trim().replace(/^data:\s*/, '');
    return value ? JSON.parse(value) : null;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 65536) throw new Error('Stream frame too large');
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const event = parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (event) yield event;
      }
      if (done) {
        if (buffer.trim()) yield parse(buffer);
        break;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

// Route-derived context: no DOM text, names, identifiers or arbitrary query values.
export function screenContextFromLocation(pathname = '', search = '') {
 const parts=pathname.toLowerCase().split('/').filter(Boolean);
 if (!/^dashboard(?:_admin|_doctor|_recepcion)?$/.test(parts[0] || '')) return '';
 const section=parts[1];
 if (!section) return 'Inicio';
 const params=new URLSearchParams(search);
 if (section==='pacientes') {
   if (parts.length>2 || params.has('id')) {
     const tabs={presu:'Presupuestos & planes',datos:'Datos personales',odonto:'Odontogramas',perio:'Periodontogramas',prof:'Profesionales'};
     const tab=parts.includes('planes')?'Presupuestos & planes':tabs[params.get('tab')];
     return 'Ficha del paciente'+(tab?' > '+tab:'');
   }
   return 'Pacientes';
 }
 return {agenda:'Agenda',config:'Configuración',caja:'Caja',administracion:'Administración',reportes:'Reportes'}[section] || '';
}

export function trustedScreenContext(value) {
 const raw=String(value || '');
 const route=raw.match(/Ruta:\s*(\/[^\s|]*)/);
 if(route) return screenContextFromLocation(route[1]);
 const known=['Inicio','Pacientes','Ficha del paciente','Agenda','Configuración','Caja','Administración','Reportes'];
 if (known.includes(raw)) return raw;
 if (/^Ficha del paciente > (Presupuestos & planes|Datos personales|Odontogramas|Periodontogramas|Profesionales)$/.test(raw)) return raw;
 return '';
}
