import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTenants() {
  console.log('🏢 Verificando tenants registrados...\n');
  
  // También revisar website_config para ver qué tenant_id existe
  const { data: wc, error: wcErr } = await supabase
    .from('website_config')
    .select('tenant_id')
    .limit(10);

  if (!wcErr && wc?.length > 0) {
    console.log('📋 Tenant IDs en website_config:');
    wc.forEach(r => console.log(' -', r.tenant_id));
    console.log('');
  }

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .limit(10);

  if (error) {
    console.error('❌ Error al consultar tenants:', error.message);
    return;
  }

  if (!tenants || tenants.length === 0) {
    console.log('⚠️  No hay tenants registrados.');
    return;
  }

  console.log(`✅ Se encontraron ${tenants.length} tenant(s):\n`);
  tenants.forEach((t, i) => {
    console.log(`${i + 1}. ID: ${t.id}`);
    console.log(`   Nombre: ${t.nombreComercial || t.nombre || t.name || '(sin nombre)'}`);
    console.log(`   NIT: ${t.nit || '(sin NIT)'}`);
    console.log(`   Teléfono: ${t.telefono || t.phone || '(sin teléfono)'}`);
    console.log('');
  });
}

checkTenants();
