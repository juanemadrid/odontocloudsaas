import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAllTenants() {
  await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  const { data, error } = await supabase.from('tenants').select('*');
  console.log("Tenants en Supabase con Auth:", data, "Error:", error);
}

checkAllTenants();
