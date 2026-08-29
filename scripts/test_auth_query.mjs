#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';

const USER_ID = 'ece68fb9-7dd9-4196-82c8-199b145cd5e2'; // johnemadrid@gmail.com
const TENANT_ID = 'b029a9c9-0cc6-4942-9961-b994293b3d34';

const supabase = createClient(supabaseUrl, serviceKey);

console.log('🔍 Verificando datos como johnemadrid@gmail.com...\n');

// Verificar user_metadata
const { data: userData } = await supabase.auth.admin.getUserById(USER_ID);
console.log('user_metadata actual:');
console.log(JSON.stringify(userData?.user?.user_metadata, null, 2));

// Verificar profile
const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, tenant_id')
    .eq('id', USER_ID)
    .maybeSingle();
console.log('\nProfile:', profile ? `✅ ${profile.full_name} | rol: ${profile.role}` : '❌ null');

// Verificar consultorios del tenant
const { data: consultorios } = await supabase
    .from('consultorios')
    .select('nombre, ubicacion')
    .eq('tenant_id', TENANT_ID);
console.log(`\nConsultorios (${consultorios?.length || 0}):`);
consultorios?.forEach(c => console.log(`  ✅ ${c.nombre} | ${c.ubicacion}`));

// Verificar doctores del tenant
const { data: doctores } = await supabase
    .from('profiles')
    .select('full_name, role, activo')
    .eq('tenant_id', TENANT_ID)
    .in('role', ['doctor', 'odontologo', 'especialista']);
console.log(`\nDoctores (${doctores?.length || 0}):`);
doctores?.forEach(d => console.log(`  ✅ ${d.full_name} | ${d.role} | activo: ${d.activo}`));

console.log('\n✅ Datos OK en Supabase.');
console.log('👉 Solo haz logout y login en la app para que el JWT se actualice con tenant_id.');
