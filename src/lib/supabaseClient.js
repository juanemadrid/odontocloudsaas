// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key are missing in environment variables. Check your .env configuration.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
