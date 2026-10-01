import supabase from '../lib/supabaseClient';
import { guideResponse } from '../../supabase/functions/_shared/helpKnowledge.mjs';

export async function askHelp(question, previousIds = [], options = {}) {
  const { mode = 'app' } = typeof options === 'string' ? { mode: options } : (options || {});
  try {
    const { data, error } = await supabase.functions.invoke('odontocloud-help', {
      body: { question, previousIds, mode },
      signal: AbortSignal.timeout(18000),
    });
    if (error || !data?.success || typeof data.answer !== 'string' || !Array.isArray(data.sources)) {
      return guideResponse(question, previousIds, 'unavailable');
    }
    return data;
  } catch {
    return guideResponse(question, previousIds, 'unavailable');
  }
}

export default askHelp;
