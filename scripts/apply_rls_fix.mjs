#!/usr/bin/env node
// Aplica la corrección de políticas RLS directamente en Supabase
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Leer el archivo SQL
const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '20250727_fix_rls_policies.sql');
const sql = readFileSync(sqlPath, 'utf-8');

console.log('🔒 Aplicando corrección de políticas RLS en Supabase...\n');

// Ejecutar SQL via REST API de Supabase
const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
    },
    body: JSON.stringify({ query: sql })
});

if (!response.ok) {
    // Intentar con el endpoint de management API
    console.log('⚠️  Intentando con Management API...');
    
    // Extraer el project ref de la URL
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    
    const mgmtResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: sql })
    });
    
    if (!mgmtResponse.ok) {
        const errText = await mgmtResponse.text();
        console.error('❌ Error en Management API:', errText);
        console.log('\n📋 INSTRUCCIONES MANUALES:');
        console.log('Debes ejecutar el SQL manualmente en Supabase Dashboard:');
        console.log('1. Abre Supabase Studio del VPS y entra al SQL Editor.');
        console.log('2. Pega el contenido del archivo:');
        console.log('   supabase/migrations/20250727_fix_rls_policies.sql');
        console.log('3. Haz clic en "Run"');
        process.exit(1);
    }
    
    const data = await mgmtResponse.json();
    console.log('✅ RLS actualizado exitosamente');
    console.log(data);
} else {
    const data = await response.json();
    console.log('✅ RLS actualizado exitosamente');
    console.log(data);
}
