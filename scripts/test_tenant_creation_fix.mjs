import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFix() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  console.log("Logged in user:", authData?.user?.email);

  const customId = '11111111-2222-3333-4444-555555555555';
  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert([{
      id: customId,
      nombre: "Clínica OdontoCloud Real",
      nit: "900123456-1",
      plan: "pro",
      activo: true
    }])
    .select()
    .single();

  console.log("Tenant insert result:", tenant, "Error:", error);
}

testFix();
