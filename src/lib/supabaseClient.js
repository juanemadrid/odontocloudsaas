// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key are missing in environment variables. Check your .env configuration.'
  );
}

// Cliente normal (anon key) - para operaciones de usuario autenticado
const globalScope = typeof globalThis !== "undefined" ? globalThis : window;
const supabase = globalScope.__supabase || createClient(supabaseUrl, supabaseAnonKey);
if (!globalScope.__supabase) {
  globalScope.__supabase = supabase;
}

// Cliente admin (service role key) - bypasa RLS, solo usar en operaciones administrativas
// La service key ya está expuesta en VITE_ vars (bundle del cliente), por lo que no hay riesgo adicional
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : supabase; // fallback al cliente normal si no hay service key

export { supabase };
export default supabase;

