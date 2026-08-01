#!/usr/bin/env node
// Actualiza el user_metadata de los usuarios para incluir tenant_id
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, serviceKey);

const TENANT_ID = 'b029a9c9-0cc6-4942-9961-b994293b3d34';

// Usuarios que pertenecen a este tenant
const usuarios = [
    {
        id: 'ece68fb9-7dd9-4196-82c8-199b145cd5e2',
        email: 'johnemadrid@gmail.com',
        role: 'administrador',
        full_name: 'Johne Madrid'
    },
    {
        id: 'feec38f4-3bd5-4a1c-8847-8445930dc363',
        email: 'joshuastream27@gmail.com',
        role: 'Usuario',
        full_name: 'joshua stephen madrid laguna'
    },
    {
        id: 'ada2e6b1-b4f1-4e42-b64a-2475691c8ce1',
        email: 'andres.ruiz@odontocloud.com',
        role: 'doctor',
        full_name: 'Andres Ruiz'
    },
    {
        id: '51b3150b-7394-46dc-a8f2-6f34644b5105',
        email: 'carolina.gomez@odontocloud.com',
        role: 'doctor',
        full_name: 'Dra. Carolina Gómez'
    },
];

console.log('🔧 Actualizando user_metadata para incluir tenant_id...\n');

for (const user of usuarios) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
            tenant_id: TENANT_ID,
            role: user.role,
            full_name: user.full_name,
        }
    });

    if (error) {
        console.error(`❌ Error actualizando ${user.email}:`, error.message);
    } else {
        console.log(`✅ Actualizado: ${user.email}`);
        console.log(`   tenant_id: ${data.user?.user_metadata?.tenant_id}`);
        console.log(`   role: ${data.user?.user_metadata?.role}`);
    }
}

console.log('\n✅ Proceso completado.');
console.log('\nAhora ve al Supabase Dashboard y ejecuta el SQL de corrección de RLS:');
console.log('https://supabase.com/dashboard/project/jhdflchyhkwpedtbkusp/sql/new');
