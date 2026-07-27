/**
 * create_user.mjs - Crea un usuario en Supabase Auth + perfil en profiles
 * 
 * Uso: node scripts/create_user.mjs <email> <password> "<Nombre Completo>" <rol>
 * 
 * Ejemplos:
 *   node scripts/create_user.mjs andres.ruiz@odontocloud.com MiPass123 "Andres Ruiz" "Odontólogo / Doctor"
 *   node scripts/create_user.mjs recepcion@clinica.com Pass2024! "Maria Lopez" "Administrativo / Recepción"
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const TENANT_ID    = process.env.VITE_TENANT_ID || 'b029a9c9-0cc6-4942-9961-b994293b3d34';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const [,, email, password, fullName, role = 'Odontólogo / Doctor'] = process.argv;

if (!email || !password || !fullName) {
    console.error('❌ Uso: node scripts/create_user.mjs <email> <password> "<Nombre Completo>" [rol]');
    console.error('');
    console.error('Roles disponibles:');
    console.error('  "Odontólogo / Doctor"');
    console.error('  "Administrativo / Recepción"');
    console.error('  "Auxiliar de Odontología"');
    process.exit(1);
}

async function main() {
    console.log(`\n🚀 Creando usuario: ${fullName} <${email}> → rol: ${role}\n`);

    // 1. Crear cuenta en Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role, tenant_id: TENANT_ID }
    });

    if (authErr) {
        if (authErr.message?.includes('already registered') || authErr.message?.includes('already exists') || authErr.message?.includes('has already been registered')) {
            console.warn(`⚠️  Auth: El email ${email} ya tiene cuenta. Actualizando contraseña...`);
            // Buscar usuario existente
            const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 200 });
            const existUser = existing?.users?.find(u => u.email === email);
            if (existUser) {
                const { error: updErr } = await supabase.auth.admin.updateUserById(existUser.id, { password });
                if (updErr) { console.error('❌ Error actualizando contraseña:', updErr.message); process.exit(1); }
                console.log(`✅ Contraseña actualizada para ${email} (id: ${existUser.id})`);
                await upsertProfile(existUser.id, fullName, email, role);
                return;
            }
        }
        console.error('❌ Error creando usuario Auth:', authErr.message);
        process.exit(1);
    }


    const userId = authData.user.id;
    console.log(`✅ Auth user created: ${userId}`);

    // 2. Crear/actualizar perfil en profiles
    await upsertProfile(userId, fullName, email, role);
}

async function upsertProfile(userId, fullName, email, role) {
    const { error: profErr } = await supabase.from('profiles').upsert({
        id: userId,
        tenant_id: TENANT_ID,
        full_name: fullName,
        email,
        role,
        activo: true
    }, { onConflict: 'id' });

    if (profErr) {
        console.error('❌ Error en profiles:', profErr.message);
    } else {
        console.log(`✅ Perfil guardado en profiles`);
        console.log(`\n🎉 LISTO. El usuario puede iniciar sesión con:`);
        console.log(`   Email:      ${email}`);
        console.log(`   Contraseña: (la que pusiste)`);
        console.log(`   Tenant:     ${TENANT_ID}\n`);
    }
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
