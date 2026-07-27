import { createClient } from '@supabase/supabase-js';

// Lee las variables desde el proceso (debes ejecutar con --env-file=.env o definirlas)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUsers() {
  console.log('🔍 Verificando usuarios en profiles...\n');
  
  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(50);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Total de usuarios encontrados: ${users?.length || 0}\n`);
  
  if (users && users.length > 0) {
    console.log('📋 Columnas disponibles:', Object.keys(users[0]).join(', '));
    console.log('\n');
  }
  
  users?.forEach((user, index) => {
    console.log(`${index + 1}. ${user.full_name || user.email}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role || '(sin rol)'}`);
    console.log(`   Tenant ID: ${user.tenant_id || '(sin tenant)'}`);
    console.log('   Datos completos:', JSON.stringify(user, null, 2));
    console.log('');
  });
}

checkUsers();
