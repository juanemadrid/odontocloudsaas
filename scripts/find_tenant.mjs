import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, serviceKey);

async function findTenantId() {
    console.log('🔍 Buscando tenant_id en todas las tablas...\n');

    // Buscar en tenants
    const { data: t1, error: e1 } = await supabase.from('tenants').select('*').limit(5);
    console.log('tenants:', e1 ? '❌ ' + e1.message : `${t1?.length || 0} registros`);
    if (t1?.length) console.log(t1);

    // Buscar en website_config
    const { data: t2, error: e2 } = await supabase.from('website_config').select('tenant_id').limit(5);
    console.log('\nwebsite_config:', e2 ? '❌ ' + e2.message : `${t2?.length || 0} registros`);
    if (t2?.length) console.log(t2);

    // Buscar en profiles
    const { data: t3, error: e3 } = await supabase.from('profiles').select('tenant_id, id, email, role').limit(5);
    console.log('\nprofiles:', e3 ? '❌ ' + e3.message : `${t3?.length || 0} registros`);
    if (t3?.length) console.log(t3);

    // Buscar en auth.users
    const { data: t4, error: e4 } = await supabase.auth.admin.listUsers();
    console.log('\nauth.users:', e4 ? '❌ ' + e4.message : `${t4?.users?.length || 0} usuarios`);
    if (t4?.users?.length) {
        t4.users.forEach(u => console.log(` - ${u.email} | id: ${u.id} | meta: ${JSON.stringify(u.user_metadata)}`));
    }

    // Buscar en consultorios
    const { data: t5, error: e5 } = await supabase.from('consultorios').select('*').limit(5);
    console.log('\nconsultorios:', e5 ? '❌ ' + e5.message : `${t5?.length || 0} registros`);
    if (t5?.length) console.log(t5);

    // Buscar en sucursales
    const { data: t6, error: e6 } = await supabase.from('sucursales').select('*').limit(5);
    console.log('\nsucursales:', e6 ? '❌ ' + e6.message : `${t6?.length || 0} registros`);
    if (t6?.length) console.log(t6);
}

findTenantId();
