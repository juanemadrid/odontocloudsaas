import supabase from '../lib/supabaseClient';
import { guideResponse } from '../../supabase/functions/_shared/helpKnowledge.mjs';

export async function askHelp(question, previousIds = []) {
  try {
    const { data, error } = await supabase.functions.invoke('odontocloud-help', {
      body: { question, previousIds },
      signal: AbortSignal.timeout(40000),
    });
    if (error || !data?.success || typeof data.answer !== 'string' || !Array.isArray(data.sources) || !['manual', 'ollama'].includes(data.provider)) {
      return guideResponse(question, previousIds, 'unavailable');
    }
    return data;
  } catch {
    return guideResponse(question, previousIds, 'unavailable');
  }
}
