import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deleteSeededTenantNow() {
  console.log("Iniciando sesión como SuperAdmin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: process.env.ODONTOCLOUD_TEST_PASSWORD
  });

  if (authError) {
    console.error("Error de auth:", authError.message);
    return;
  }

  const oldTenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const superadminId = authData.user.id;

  // 1. Crear un tenant temporal o verificar si hay otro
  const tempTenantId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  console.log("Creando tenant comodín temporal...");
  await supabase.from('tenants').upsert([{
    id: tempTenantId,
    nombre: 'Tenant Comodin',
    activo: true
  }]);

  console.log("Reasignando SuperAdmin al tenant comodín...");
  await supabase.from('profiles').update({ tenant_id: tempTenantId }).eq('id', superadminId);

  console.log("Eliminando Clínica Principal OdontoCloud de public.tenants...");
  const { error: delErr } = await supabase.from('tenants').delete().eq('id', oldTenantId);

  if (delErr) {
    console.error("Error al eliminar tenant original:", delErr.message);
  } else {
    console.log("✅ ¡Clínica 'Clínica Principal OdontoCloud' eliminada permanentemente!");
  }

  console.log("Eliminando tenant comodín...");
  // Si no hay restricciones, también podemos intentar borrar el comodín o dejarlo listo para cuando registre su primera clínica
}

deleteSeededTenantNow();
