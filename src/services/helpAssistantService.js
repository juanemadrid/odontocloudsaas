import supabase from '../lib/supabaseClient';
import { guideResponse } from '../../supabase/functions/_shared/helpKnowledge.mjs';
import { compactHistory, conversationalReply, readHelpEvents } from '../../supabase/functions/_shared/helpConversation.mjs';

export async function askHelp(question, previousIds = [], options = {}) {
  const { mode = 'app', history = [], signal, onUpdate, screenContext = '' } = typeof options === 'string' ? { mode: options } : (options || {});
  const local = conversationalReply(question, previousIds, mode);
  if (local) return local;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 58000);
  const valid = data => data?.success && typeof data.answer === 'string' && Array.isArray(data.sources) && ['manual', 'ollama', 'assistant', 'gemini'].includes(data.provider);
  try {
    const payload = { question, previousIds, mode, history: compactHistory(history), stream: true };
    if (screenContext) payload.screenContext = screenContext;
    const { data, error } = await supabase.functions.invoke('odontocloud-help', {
      body: payload,
      signal: controller.signal,
    });
    if (error) throw error;
    if (data instanceof Response) {
      let answer = '';
      for await (const event of readHelpEvents(data.body)) {
        if (event.type === 'delta') {
          if (typeof event.text !== 'string' || answer.length + event.text.length > 12000) throw new Error('Invalid response');
          answer += event.text;
          onUpdate?.(answer);
        } else if (event.type === 'result') {
          if (!valid(event.result)) throw new Error('Invalid result');
          return event.result;
        }
      }
      throw new Error('Incomplete response');
    }
    if (!valid(data)) throw new Error('Invalid response');
    return data;
  } catch {
    if (signal?.aborted) return { provider: 'assistant', answer: 'Respuesta detenida. Puedes reformular tu pregunta cuando quieras.', sources: [], reason: 'cancelled' };
    return guideResponse(question, previousIds, 'unavailable', mode);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export default askHelp;
