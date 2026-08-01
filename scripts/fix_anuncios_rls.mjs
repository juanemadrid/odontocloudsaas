import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseService = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('🔍 Probando inserción y verificación de RLS en anuncios_sistema...');

  // 1. Probar insert directo con SERVICE_KEY
  const { data, error } = await supabaseService
    .from('anuncios_sistema')
    .insert([
      {
        titulo: 'Sistema OdontoCloud Actualizado',
        descripcion: 'Mejoras en el módulo de novedades y notificaciones.',
        contenido: 'Hemos actualizado el sistema con nuevas funcionalidades.',
        tipo: 'Información',
        activo: true,
        visible_usuarios: true,
        prioridad: 1,
        orden: 1
      }
    ])
    .select();

  if (error) {
    console.error('❌ Error al insertar con service key:', error);
  } else {
    console.log('✅ Inserción con Service Key exitosa:', data);
  }
}

run();
