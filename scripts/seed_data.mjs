#!/usr/bin/env node
// Script para poblar datos iniciales: consultorios + sincronizar profesionales
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, serviceKey);

const TENANT_ID = 'b029a9c9-0cc6-4942-9961-b994293b3d34';

// ─── 1. Crear consultorios ───────────────────────────────────────────────────
async function seedConsultorios() {
    console.log('\n🏥 Creando consultorios...');

    const consultorios = [
        { nombre: 'Consultorio 1', ubicacion: 'Planta Principal', activo: true },
        { nombre: 'Consultorio 2', ubicacion: 'Planta Principal', activo: true },
        { nombre: 'Consultorio 3 - Cirugía', ubicacion: 'Planta Principal', activo: true },
    ];

    for (const c of consultorios) {
        // Verificar si ya existe
        const { data: existing } = await supabase
            .from('consultorios')
            .select('id')
            .eq('tenant_id', TENANT_ID)
            .eq('nombre', c.nombre)
            .maybeSingle();

        if (existing) {
            console.log(`  ⏭️  Ya existe: ${c.nombre}`);
            continue;
        }

        const { error } = await supabase.from('consultorios').insert({
            ...c,
            tenant_id: TENANT_ID,
            created_at: new Date().toISOString()
        });

        if (error) console.error(`  ❌ Error creando ${c.nombre}:`, error.message);
        else console.log(`  ✅ Creado: ${c.nombre}`);
    }
}

// ─── 2. Sincronizar profesionales desde auth.users a profiles ────────────────
async function syncProfiles() {
    console.log('\n👨‍⚕️ Sincronizando profesionales a tabla profiles...');

    // Usuarios doctores que están en auth.users pero podrían faltar en profiles
    const doctores = [
        {
            id: 'ada2e6b1-b4f1-4e42-b64a-2475691c8ce1',
            email: 'andres.ruiz@odontocloud.com',
            full_name: 'Andres Ruiz',
            role: 'doctor',
            especialidad: 'Cirugía Oral y Maxilofacial',
            registro_medico: 'RM-78120-CO'
        },
        {
            id: '51b3150b-7394-46dc-a8f2-6f34644b5105',
            email: 'carolina.gomez@odontocloud.com',
            full_name: 'Dra. Carolina Gómez',
            role: 'doctor',
            especialidad: 'Ortodoncia y Odontología General',
            registro_medico: 'RM-45892-CO'
        },
    ];

    for (const doc of doctores) {
        // Verificar si ya existe en profiles
        const { data: existing } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', doc.id)
            .maybeSingle();

        if (existing) {
            // Actualizar rol si es incorrecto
            if (existing.role !== 'doctor' && existing.role !== 'odontologo') {
                const { error } = await supabase
                    .from('profiles')
                    .update({ role: 'doctor' })
                    .eq('id', doc.id);
                if (error) console.error(`  ❌ Error actualizando ${doc.email}:`, error.message);
                else console.log(`  🔄 Rol actualizado a "doctor": ${doc.email}`);
            } else {
                console.log(`  ⏭️  Ya existe con rol correcto: ${doc.email} (${existing.role})`);
            }
            continue;
        }

        // Insertar en profiles
        const { error } = await supabase.from('profiles').insert({
            id: doc.id,
            tenant_id: TENANT_ID,
            email: doc.email,
            full_name: doc.full_name,
            role: 'doctor',
            activo: true,
            created_at: new Date().toISOString()
        });

        if (error) console.error(`  ❌ Error insertando ${doc.email}:`, error.message);
        else console.log(`  ✅ Insertado: ${doc.email} (${doc.full_name})`);
    }
}

// ─── 3. Verificar resultado final ───────────────────────────────────────────
async function verify() {
    console.log('\n📊 Verificando resultado final...\n');

    const { data: consultorios } = await supabase
        .from('consultorios')
        .select('nombre, ubicacion, activo')
        .eq('tenant_id', TENANT_ID);

    console.log(`Consultorios (${consultorios?.length || 0}):`);
    consultorios?.forEach(c => console.log(`  - ${c.nombre} | ${c.ubicacion}`));

    const { data: doctores } = await supabase
        .from('profiles')
        .select('full_name, email, role')
        .eq('tenant_id', TENANT_ID)
        .in('role', ['doctor', 'odontologo', 'especialista']);

    console.log(`\nDoctores/Profesionales (${doctores?.length || 0}):`);
    doctores?.forEach(d => console.log(`  - ${d.full_name || d.email} | role: ${d.role}`));
}

// ─── Ejecutar ────────────────────────────────────────────────────────────────
await seedConsultorios();
await syncProfiles();
await verify();
console.log('\n✅ Proceso completado.\n');
