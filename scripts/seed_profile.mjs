import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedTenantAndProfile() {
  console.log("Iniciando sesión como SuperAdmin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  if (authError) {
    console.error("Error al autenticar:", authError.message);
    return;
  }

  const userId = authData.user.id;
  const tenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  console.log("Creando/Verificando clínica inicial (Tenant)...");
  const { error: tenantError } = await supabase
    .from('tenants')
    .upsert([{
      id: tenantId,
      nombre: 'Clínica Principal OdontoCloud',
      nit: '900123456-1',
      plan: 'enterprise',
      activo: true
    }], { onConflict: 'id' });

  if (tenantError) {
    console.warn("Tenant notice:", tenantError.message);
  }

  console.log("Creando/Verificando perfil de SuperAdmin...");
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert([{
      id: userId,
      tenant_id: tenantId,
      full_name: 'SuperAdmin OdontoCloud',
      email: 'madridsystem@outlook.es',
      role: 'superadmin',
      activo: true
    }], { onConflict: 'id' });

  if (profileError) {
    console.error("Profile error:", profileError.message);
  } else {
    console.log("🚀 Perfil SuperAdmin y Clínica principal configurados exitosamente en Supabase PostgreSQL!");
  }
}

seedTenantAndProfile();
