import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function forceDeleteTenant() {
  console.log("Iniciando sesión como SuperAdmin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  if (authError) {
    console.error("Auth error:", authError.message);
    return;
  }

  const tenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  console.log("Desvinculando perfiles que tengan este tenant_id...");
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ tenant_id: null })
    .eq('tenant_id', tenantId);

  if (profileErr) {
    console.warn("Aviso profiles:", profileErr.message);
  }

  console.log("Eliminando clínica de public.tenants...");
  const { error: delErr } = await supabase
    .from('tenants')
    .delete()
    .eq('id', tenantId);

  if (delErr) {
    console.error("Error al eliminar tenant:", delErr.message);
  } else {
    console.log("✅ ¡Clínica 'Clínica Principal OdontoCloud' eliminada permanentemente de Supabase PostgreSQL!");
  }
}

forceDeleteTenant();
