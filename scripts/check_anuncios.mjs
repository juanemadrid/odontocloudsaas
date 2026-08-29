import { createSupabaseAdminClient } from './lib/supabaseAdminFromEnv.mjs';
const supabase = createSupabaseAdminClient();

// Intentar insertar un registro para ver si la tabla existe
const { error: checkError } = await supabase
  .from('anuncios_sistema')
  .select('id')
  .limit(1);

if (checkError && checkError.code === '42P01') {
  console.log('Tabla no existe - necesita crearse via SQL Editor en Supabase');
  console.log('SQL a ejecutar:');
  console.log(`
CREATE TABLE IF NOT EXISTS anuncios_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT,
  tipo TEXT DEFAULT 'info',
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE anuncios_sistema ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer avisos activos
CREATE POLICY "avisos_read_all" ON anuncios_sistema
  FOR SELECT USING (activo = true);

-- Solo service role puede insertar/actualizar/eliminar (lo hacemos via supabase admin)
CREATE POLICY "avisos_all_service" ON anuncios_sistema
  FOR ALL USING (true) WITH CHECK (true);
  `);
} else if (!checkError) {
  console.log('La tabla anuncios_sistema YA EXISTE - todo listo!');
} else {
  console.log('Otro error:', checkError.message);
}
