// Crea la tabla anuncios_sistema via Supabase Management API
const SUPABASE_URL = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const PROJECT_REF  = 'jhdflchyhkwpedtbkusp';
const SERVICE_KEY  = 'sb_secret_Vfz6a1lTTBaDJjoIr1KKhg_AmSkJpLz';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
};

const SQL_CREATE = `
CREATE TABLE IF NOT EXISTS public.anuncios_sistema (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     TEXT         NOT NULL,
  contenido  TEXT,
  tipo       TEXT         DEFAULT 'info',
  activo     BOOLEAN      DEFAULT TRUE,
  orden      INTEGER      DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.anuncios_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lectura_publica ON public.anuncios_sistema;
DROP POLICY IF EXISTS admin_todo ON public.anuncios_sistema;
CREATE POLICY lectura_publica ON public.anuncios_sistema FOR SELECT USING (true);
CREATE POLICY admin_todo ON public.anuncios_sistema FOR ALL USING (true) WITH CHECK (true);
`;

const AVISOS = [
  {
    titulo: '🎉 ¡Bienvenido a OdontoCloud 2026!',
    contenido: 'Nos alegra tenerte en nuestra plataforma. OdontoCloud es tu sistema de gestión clínica todo en uno: agenda, pacientes, facturación y mucho más.\n\nSi tienes alguna duda, estamos aquí para ayudarte. ¡Que tengas una excelente jornada!',
    tipo: 'novedad',
    activo: true,
    orden: 10,
  },
  {
    titulo: '✨ Nueva versión v2.6 — Migración completada',
    contenido: 'Hemos completado la migración a Supabase para mayor rendimiento y seguridad.\n\nMejoras incluidas:\n• Panel de inicio renovado sin queries costosas\n• Tablón de avisos del sistema\n• Corrección de errores reportados',
    tipo: 'actualizacion',
    activo: true,
    orden: 5,
  },
];

async function tryExecSQL(sql) {
  // Intento 1: RPC exec_sql (si existe en el proyecto)
  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sql }),
  });
  if (r1.ok) return { ok: true, via: 'rpc/exec_sql' };
  
  // Intento 2: RPC exec (nombre alternativo)
  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql }),
  });
  if (r2.ok) return { ok: true, via: 'rpc/exec' };

  // Intento 3: Management API v1 database/query
  const r3 = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ query: sql }),
  });
  const t3 = await r3.text();
  if (r3.ok) return { ok: true, via: 'management/database/query', body: t3 };

  return { ok: false, status3: r3.status, body3: t3 };
}

async function insertAvisos() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/anuncios_sistema`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(AVISOS),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function checkTableExists() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/anuncios_sistema?limit=1`, { headers });
  return res.status !== 400 && res.status !== 404;
}

async function main() {
  console.log('='.repeat(60));
  console.log('  OdontoCloud — Setup tabla anuncios_sistema');
  console.log('='.repeat(60));

  // 1. Verificar si ya existe
  console.log('\n🔍 Verificando si la tabla existe...');
  const exists = await checkTableExists();

  if (exists) {
    console.log('✅ La tabla ya existe. Insertando avisos de bienvenida...');
    const { status, data } = await insertAvisos();
    if (status === 201) {
      console.log(`✅ ${data.length} avisos insertados:`);
      data.forEach(a => console.log(`   • [${a.tipo}] ${a.titulo}`));
      console.log('\n🎉 ¡Listo! Recarga el dashboard para ver los avisos.');
    } else {
      console.log('⚠️  Respuesta al insertar:', status, JSON.stringify(data));
    }
    return;
  }

  // 2. Intentar crear con distintos métodos
  console.log('❌ Tabla no existe. Intentando crearla automáticamente...\n');
  const result = await tryExecSQL(SQL_CREATE);
  
  if (result.ok) {
    console.log(`✅ Tabla creada vía ${result.via}. Insertando avisos...`);
    const { status, data } = await insertAvisos();
    if (status === 201) {
      console.log(`✅ ${data.length} avisos insertados:`);
      data.forEach(a => console.log(`   • [${a.tipo}] ${a.titulo}`));
      console.log('\n🎉 ¡Todo listo! Recarga el dashboard.');
    } else {
      console.log('⚠️ Inserción:', status, JSON.stringify(data));
    }
  } else {
    // Mostrar SQL para ejecución manual
    console.log('ℹ️  La creación automática no está disponible.');
    console.log('\n📋 EJECUTA ESTE SQL EN EL SQL EDITOR DE SUPABASE:\n');
    console.log('🔗 URL: https://supabase.com/dashboard/project/jhdflchyhkwpedtbkusp/sql/new\n');
    console.log('-'.repeat(60));
    console.log(`CREATE TABLE IF NOT EXISTS public.anuncios_sistema (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     TEXT         NOT NULL,
  contenido  TEXT,
  tipo       TEXT         DEFAULT 'info',
  activo     BOOLEAN      DEFAULT TRUE,
  orden      INTEGER      DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.anuncios_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura_publica" ON public.anuncios_sistema FOR SELECT USING (true);
CREATE POLICY "admin_todo" ON public.anuncios_sistema FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.anuncios_sistema (titulo, contenido, tipo, activo, orden) VALUES
(
  '🎉 ¡Bienvenido a OdontoCloud 2026!',
  'Nos alegra tenerte en nuestra plataforma. OdontoCloud es tu sistema de gestión clínica todo en uno: agenda, pacientes, facturación y mucho más.

Si tienes alguna duda, estamos aquí para ayudarte. ¡Que tengas una excelente jornada!',
  'novedad', true, 10
),
(
  '✨ Nueva versión v2.6 — Migración completada',
  'Hemos completado la migración a Supabase para mayor rendimiento y seguridad.

Mejoras:
• Panel de inicio renovado sin queries costosas
• Tablón de avisos del sistema
• Corrección de errores reportados',
  'actualizacion', true, 5
);`);
    console.log('-'.repeat(60));
    console.log('\n👆 Copia el SQL de arriba y pégalo en el SQL Editor de Supabase.');
    console.log('   Luego vuelve a ejecutar: node scripts/setup_anuncios.mjs\n');
  }
}

main().catch(console.error);
