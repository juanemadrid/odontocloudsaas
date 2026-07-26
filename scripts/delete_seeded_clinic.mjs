import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanSeededClinic() {
  console.log("Iniciando sesión como SuperAdmin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  if (authError) {
    console.error("Error de auth:", authError.message);
    return;
  }

  const userId = authData.user.id;

  console.log("Desvinculando tenant_id del perfil de SuperAdmin...");
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ tenant_id: null })
    .eq('id', userId);

  if (profileErr) {
    console.warn("Profile update notice:", profileErr.message);
  }

  console.log("Eliminando clínica de prueba 'Clínica Principal OdontoCloud'...");
  const { error: delErr } = await supabase
    .from('tenants')
    .delete()
    .eq('id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

  if (delErr) {
    console.error("Error al eliminar la clínica:", delErr.message);
  } else {
    console.log("✅ Clínica de prueba eliminada exitosamente en Supabase PostgreSQL!");
  }
}

cleanSeededClinic();
