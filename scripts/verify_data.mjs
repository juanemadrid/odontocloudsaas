import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
const anonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';

const supabaseAdmin = createClient(supabaseUrl, serviceKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

const TENANT_ID = 'b029a9c9-0cc6-4942-9961-b994293b3d34';

console.log('=== Con SERVICE KEY (sin RLS) ===\n');

const { data: cons1, error: e1 } = await supabaseAdmin
    .from('consultorios').select('id, nombre, ubicacion, activo, tenant_id')
    .eq('tenant_id', TENANT_ID);
console.log(`Consultorios: ${e1 ? '❌ '+e1.message : cons1?.length + ' registros'}`);
cons1?.forEach(c => console.log(`  - ${c.nombre} | ${c.ubicacion}`));

const { data: profs1, error: e2 } = await supabaseAdmin
    .from('profiles').select('id, full_name, email, role, activo, tenant_id')
    .eq('tenant_id', TENANT_ID);
console.log(`\nProfiles: ${e2 ? '❌ '+e2.message : profs1?.length + ' registros'}`);
profs1?.forEach(p => console.log(`  - ${p.full_name || p.email} | role: ${p.role} | activo: ${p.activo}`));

console.log('\n=== Con ANON KEY (con RLS) ===\n');

const { data: cons2, error: e3 } = await supabaseAnon
    .from('consultorios').select('id, nombre, ubicacion, activo, tenant_id')
    .eq('tenant_id', TENANT_ID);
console.log(`Consultorios: ${e3 ? '❌ '+e3.message : cons2?.length + ' registros'}`);
cons2?.forEach(c => console.log(`  - ${c.nombre}`));

const { data: profs2, error: e4 } = await supabaseAnon
    .from('profiles').select('id, full_name, email, role, activo, tenant_id')
    .eq('tenant_id', TENANT_ID);
console.log(`\nProfiles: ${e4 ? '❌ '+e4.message : profs2?.length + ' registros'}`);
profs2?.forEach(p => console.log(`  - ${p.full_name || p.email}`));
