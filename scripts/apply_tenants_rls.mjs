import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTenantInsert() {
  console.log("Iniciando sesión como SuperAdmin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  if (authError) {
    console.error("Auth error:", authError.message);
    return;
  }

  console.log("Probando inserción directa en tenants...");
  const { data, error } = await supabase
    .from('tenants')
    .insert([{
      nombre: "Clínica Test RLS",
      nit: "123456789",
      plan: "pro",
      activo: true
    }])
    .select()
    .single();

  if (error) {
    console.error("Error al insertar tenant:", error);
  } else {
    console.log("✅ Inserción exitosa de tenant en Supabase:", data);
  }
}

testTenantInsert();
