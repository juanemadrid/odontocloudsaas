/**
 * Script para sincronizar consultorios desde website_config a la tabla consultorios
 * Este script asegura que todos los recursos físicos existan en la base de datos
 * antes de intentar crear horarios para ellos.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncConsultorios() {
  try {
    console.log('🔍 Buscando consultorios en website_config...');

    // 1. Obtener todos los tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, nombre');

    if (tenantsError) throw tenantsError;

    console.log(`📋 Encontrados ${tenants.length} tenants`);

    let totalSynced = 0;

    for (const tenant of tenants) {
      console.log(`\n🏥 Procesando tenant: ${tenant.nombre} (${tenant.id})`);

      // 2. Obtener configuración de recursos físicos desde website_config
      const { data: configData, error: configError } = await supabase
        .from('website_config')
        .select('config')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (configError) {
        console.error(`  ⚠️  Error al obtener config: ${configError.message}`);
        continue;
      }

      if (!configData?.config?.recursos_fisicos) {
        console.log('  ℹ️  No hay recursos físicos en la configuración');
        continue;
      }

      const recursosConfig = configData.config.recursos_fisicos || [];
      console.log(`  📦 Encontrados ${recursosConfig.length} recursos en configuración`);

      // 3. Obtener consultorios existentes en la tabla
      const { data: existingConsultorios, error: consultoriosError } = await supabase
        .from('consultorios')
        .select('id')
        .eq('tenant_id', tenant.id);

      if (consultoriosError) {
        console.error(`  ⚠️  Error al obtener consultorios: ${consultoriosError.message}`);
        continue;
      }

      const existingIds = new Set(existingConsultorios.map(c => c.id));
      console.log(`  🗄️  Consultorios existentes en DB: ${existingIds.size}`);

      // 4. Crear consultorios faltantes
      const toCreate = recursosConfig.filter(r => r.id && !existingIds.has(r.id) && r.activo !== false);

      if (toCreate.length === 0) {
        console.log('  ✅ Todos los recursos ya están sincronizados');
        continue;
      }

      console.log(`  🔧 Creando ${toCreate.length} consultorios faltantes...`);

      const newConsultorios = toCreate.map(recurso => ({
        id: recurso.id,
        tenant_id: tenant.id,
        nombre: recurso.nombre || recurso.name || 'Consultorio',
        ubicacion: recurso.ubicacion || recurso.descripcion || '',
        activo: true,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('consultorios')
        .insert(newConsultorios);

      if (insertError) {
        console.error(`  ❌ Error al crear consultorios: ${insertError.message}`);
        continue;
      }

      console.log(`  ✅ Sincronizados ${toCreate.length} consultorios`);
      totalSynced += toCreate.length;
    }

    console.log(`\n✨ Sincronización completada. Total sincronizados: ${totalSynced}`);
    return totalSynced;

  } catch (error) {
    console.error('❌ Error en la sincronización:', error);
    throw error;
  }
}

// Ejecutar el script
syncConsultorios()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });
