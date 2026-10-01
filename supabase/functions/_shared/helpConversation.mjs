import { HELP_GUIDES, KNOWLEDGE_VERSION, normalize, searchGuides } from './helpKnowledge.mjs';

export function conversationalReply(question, previousIds = []) {
  const q = normalize(question);
  const topic = HELP_GUIDES.find(g => g.id === previousIds[0]);
  let answer;
  if (/^(hola|hola buenas|buenas|buenos dias|buenas tardes|buenas noches|hey|hola como estas|como estas)$/.test(q)) {
    answer = topic ? `¡Hola! ¿Seguimos con «${topic.title}» o necesitas ayuda con otra cosa?` : '¡Hola! ¿Qué necesitas hacer en OdontoCloud? Puedo acompañarte con citas, pacientes, caja o facturación. Cuéntame dónde te quedaste.';
  } else if (/^(muchas gracias|gracias|gracias por la ayuda|listo gracias|perfecto gracias)$/.test(q)) {
    answer = '¡Con gusto! Si te atoras en otro paso, dime qué ves y lo revisamos juntos.';
  } else if (/^(que puedes hacer|en que me puedes ayudar|ayudame|necesito ayuda)$/.test(q)) {
    answer = 'Puedo explicarte cómo usar OdontoCloud, acompañarte paso a paso y ayudarte a entender sus opciones. ¿Quieres trabajar con citas, pacientes, caja, facturación u otro módulo?';
  }
  return answer ? { success: true, provider: 'assistant', version: KNOWLEDGE_VERSION, answer, sources: [], reason: 'conversation' } : null;
}

export function resolveHelpGuides(question, previousIds = []) {
  const q = normalize(question);
  if (/\bedunexus\b/.test(q)) return [];
  const followup = /^(no entendi|no entiendo|explicame( mejor| de nuevo)?|mas despacio|mas detalle|paso a paso|y ahora|y despues|siguiente|continua|listo|ya esta|ya lo hice|si|ok|no aparece|no lo veo|no encuentro|donde esta|cual boton)(\b|$)/.test(q);
  if (followup && previousIds.length) return previousIds.map(id => HELP_GUIDES.find(g => g.id === id)).filter(Boolean).slice(0, 1);
  return searchGuides(question, previousIds).slice(0, 1);
}

export function clarificationReply(question) {
  return { success: true, provider: 'assistant', version: KNOWLEDGE_VERSION, sources: [], reason: 'clarification',
    answer: /\bedunexus\b/.test(normalize(question))
      ? 'Esta conversación te ayuda con OdontoCloud. Para Edunexus, utiliza la ayuda de esa aplicación. ¿Qué necesitas resolver aquí?'
      : 'Quiero ubicar bien tu duda. ¿En qué módulo estás y qué quieres hacer? Por ejemplo: «Estoy en Caja y quiero registrar un pago». Si ves un error, describe el mensaje sin datos de pacientes.' };
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
