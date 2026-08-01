import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log('🔍 Verificando consultorios y profesionales...\n');
  
  // Check consultorios
  const { data: consultorios, error: errCon } = await supabase
    .from('consultorios')
    .select('*')
    .limit(20);

  if (errCon) {
    console.error('❌ Error consultorios:', errCon.message);
  } else {
    console.log(`✅ Consultorios encontrados: ${consultorios?.length || 0}`);
    consultorios?.forEach((c, i) => {
      console.log(`${i + 1}. ${c.nombre || '(sin nombre)'}`);
      console.log(`   Ubicación: ${c.ubicacion || '(sin ubicación)'}`);
      console.log(`   Activo: ${c.activo}`);
      console.log(`   Tenant ID: ${c.tenant_id}`);
      console.log('');
    });
  }

  console.log('\n---\n');

  // Check profiles (profesionales)
  const { data: profiles, error: errProf } = await supabase
    .from('profiles')
    .select('*')
    .limit(20);

  if (errProf) {
    console.error('❌ Error profiles:', errProf.message);
  } else {
    console.log(`✅ Profesionales encontrados: ${profiles?.length || 0}`);
    profiles?.forEach((p, i) => {
      console.log(`${i + 1}. ${p.full_name || p.email}`);
      console.log(`   Email: ${p.email}`);
      console.log(`   Role: ${p.role}`);
      console.log(`   Activo: ${p.activo}`);
      console.log(`   Tenant ID: ${p.tenant_id}`);
      console.log('');
    });
  }
}

checkData();
