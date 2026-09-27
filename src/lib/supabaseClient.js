// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const metaEnv = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) || 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzk2MjA4MCwiZXhwIjo0OTQzNjM1NjgwLCJyb2xlIjoiYW5vbiJ9.vEHozLhjQwX6aUboqrmLcN-hvsqF4sPRVZ8dcDJYGNE';

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

export { supabase };
export default supabase;
