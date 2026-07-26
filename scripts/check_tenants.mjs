import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTenants() {
  const { data, error } = await supabase.from('tenants').select('*');
  console.log("Tenants actuales en Supabase:", data);
}

checkTenants();
