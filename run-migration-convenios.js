#!/usr/bin/env node

/**
 * Script para ejecutar la migración de convenios directamente en Supabase
 * Uso: node run-migration-convenios.js
 */

const fs = require('fs');
const path = require('path');

// Leer archivo .env manualmente
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_KEY || envVars.VITE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Faltan variables de entorno VITE_SUPABASE_URL o SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Leer el archivo de migración
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250803_create_convenios.sql');
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

console.log('🔄 Ejecutando migración de convenios...');
console.log('📄 Archivo:', migrationPath);
console.log('🌐 Supabase URL:', SUPABASE_URL);
console.log('');

console.log('📝 EJECUTA MANUALMENTE EN SUPABASE SQL EDITOR:');
console.log('');
console.log('1. Abre el SQL Editor de Supabase:');
const projectId = SUPABASE_URL.replace('https://', '').split('.')[0];
console.log(`   https://supabase.com/dashboard/project/${projectId}/sql/new`);
console.log('');
console.log('2. Copia y pega el contenido del archivo:');
console.log(`   ${migrationPath}`);
console.log('');
console.log('3. Haz clic en "RUN" para ejecutar el SQL');
console.log('');
console.log('✅ Esto creará:');
console.log('   • Tabla convenios');
console.log('   • Tabla convenios_descuentos');
console.log('   • Políticas RLS');
console.log('   • Índices para performance');
console.log('');

