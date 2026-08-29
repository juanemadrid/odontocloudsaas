#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTenant(tenantId, nombreComercial, nit, telefono) {
    try {
        console.log(`\n🏢 Creando tenant "${tenantId}"...`);

        const { data, error } = await supabase
            .from('tenants')
            .insert([
                {
                    id: tenantId,
                    nombreComercial: nombreComercial || 'Clínica Demo',
                    nombre: nombreComercial || 'Clínica Demo',
                    nit: nit || '',
                    telefono: telefono || '',
                    activo: true,
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            console.error('❌ Error al crear tenant:', error.message);
            return null;
        }

        console.log('✅ Tenant creado exitosamente:');
        console.log(JSON.stringify(data[0], null, 2));
        return data[0];
    } catch (err) {
        console.error('❌ Error inesperado:', err);
        return null;
    }
}

// Programa principal
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log(`
📖 Uso:
  node scripts/create_tenant.mjs <tenant_id> [nombreComercial] [nit] [telefono]

Ejemplo:
  node scripts/create_tenant.mjs "odonto-demo" "Clínica OdontoCloud Demo" "900123456-7" "3001234567"
`);
    process.exit(0);
}

const tenantId = args[0];
const nombreComercial = args[1] || 'Clínica Demo';
const nit = args[2] || '';
const telefono = args[3] || '';

await createTenant(tenantId, nombreComercial, nit, telefono);

console.log('\n✅ Proceso completado.\n');
