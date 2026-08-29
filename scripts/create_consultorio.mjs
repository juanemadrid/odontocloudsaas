#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createConsultorio(tenantId, nombre, ubicacion) {
    try {
        console.log(`\n🏥 Creando consultorio "${nombre}" para tenant ${tenantId}...`);

        const { data, error } = await supabase
            .from('consultorios')
            .insert([
                {
                    tenant_id: tenantId,
                    nombre: nombre,
                    ubicacion: ubicacion || '',
                    activo: true,
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            console.error('❌ Error al crear consultorio:', error.message);
            return null;
        }

        console.log('✅ Consultorio creado exitosamente:');
        console.log(JSON.stringify(data[0], null, 2));
        return data[0];
    } catch (err) {
        console.error('❌ Error inesperado:', err);
        return null;
    }
}

async function listConsultorios(tenantId) {
    try {
        console.log(`\n📋 Listando consultorios del tenant ${tenantId}...`);

        const { data, error } = await supabase
            .from('consultorios')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('nombre', { ascending: true });

        if (error) {
            console.error('❌ Error al listar consultorios:', error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.log('⚠️  No hay consultorios registrados para este tenant.');
            return;
        }

        console.log(`\n✅ Se encontraron ${data.length} consultorio(s):\n`);
        data.forEach((c, i) => {
            console.log(`${i + 1}. ${c.nombre}`);
            console.log(`   ID: ${c.id}`);
            console.log(`   Ubicación: ${c.ubicacion || 'No especificada'}`);
            console.log(`   Activo: ${c.activo ? 'Sí' : 'No'}`);
            console.log('');
        });
    } catch (err) {
        console.error('❌ Error inesperado:', err);
    }
}

// Programa principal
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log(`
📖 Uso:
  node scripts/create_consultorio.mjs <tenant_id> <nombre> [ubicacion]  - Crear un consultorio
  node scripts/create_consultorio.mjs <tenant_id> list                   - Listar consultorios

Ejemplos:
  node scripts/create_consultorio.mjs "odonto-demo" "Consultorio 1" "Planta Baja"
  node scripts/create_consultorio.mjs "odonto-demo" "Sillón 2" "Primer Piso - Sala A"
  node scripts/create_consultorio.mjs "odonto-demo" list
`);
    process.exit(0);
}

const tenantId = args[0];

if (args[1] === 'list') {
    await listConsultorios(tenantId);
} else {
    const nombre = args[1];
    const ubicacion = args[2] || '';
    
    if (!nombre) {
        console.error('❌ Debes proporcionar un nombre para el consultorio.');
        process.exit(1);
    }

    await createConsultorio(tenantId, nombre, ubicacion);
    await listConsultorios(tenantId);
}

console.log('\n✅ Proceso completado.\n');
