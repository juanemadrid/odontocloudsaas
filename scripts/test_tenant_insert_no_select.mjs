import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNoSelect() {
  await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  const { error } = await supabase
    .from('tenants')
    .insert([{
      nombre: "Clínica Test No Select",
      nit: "999888777",
      plan: "pro",
      activo: true
    }]);

  console.log("Insert result without select:", error);
}

testNoSelect();
