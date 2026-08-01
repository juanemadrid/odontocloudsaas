import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function execSQL(label, sql) {
  try {
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    if (res.ok) {
      console.log(`✅ ${label}`);
    } else {
      console.log(`⚠️  ${label}: ${JSON.stringify(parsed).substring(0,200)}`);
    }
  } catch(e) {
    console.log(`❌ ${label}: ${e.message}`);
  }
}

async function run() {
  console.log('🚀 Ejecutando migración para tablas e infraestructuras de Configuración...\n');

  const statements = [
    // 1. Columnas en tenants
    ['ALTER tenants plan_tipo', `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_tipo TEXT`],
    ['ALTER tenants has_website', `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS has_website BOOLEAN DEFAULT TRUE`],

    // 2. Tabla perfiles
    ['CREATE perfiles', `CREATE TABLE IF NOT EXISTS public.perfiles (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL,
      nombre TEXT NOT NULL,
      permisos JSONB DEFAULT '[]'::jsonb,
      descripcion TEXT,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`],

    // 3. Tabla almacenes
    ['CREATE almacenes', `CREATE TABLE IF NOT EXISTS public.almacenes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL,
      nombre TEXT NOT NULL,
      sucursal_id UUID,
      responsable TEXT,
      direccion TEXT,
      telefono TEXT,
      principal BOOLEAN DEFAULT FALSE,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`],

    // 4. Tabla categorias_inventario
    ['CREATE categorias_inventario', `CREATE TABLE IF NOT EXISTS public.categorias_inventario (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`],

    // 5. Tabla metodos_pago
    ['CREATE metodos_pago', `CREATE TABLE IF NOT EXISTS public.metodos_pago (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT,
      comision NUMERIC(5,2) DEFAULT 0,
      requiere_referencia BOOLEAN DEFAULT FALSE,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`],

    // 6. Tabla bancos
    ['CREATE bancos', `CREATE TABLE IF NOT EXISTS public.bancos (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL,
      nombre TEXT NOT NULL,
      numero_cuenta TEXT,
      tipo_cuenta TEXT,
      titular TEXT,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`],

    // 7. RLS Enable
    ['RLS perfiles', `ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY`],
    ['RLS almacenes', `ALTER TABLE public.almacenes ENABLE ROW LEVEL SECURITY`],
    ['RLS categorias_inventario', `ALTER TABLE public.categorias_inventario ENABLE ROW LEVEL SECURITY`],
    ['RLS metodos_pago', `ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY`],
    ['RLS bancos', `ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY`],

    // 8. RLS Policies
    ['POLICY perfiles', `DO $$ BEGIN DROP POLICY IF EXISTS "all_access_perfiles" ON public.perfiles; CREATE POLICY "all_access_perfiles" ON public.perfiles USING (true) WITH CHECK (true); END $$;`],
    ['POLICY almacenes', `DO $$ BEGIN DROP POLICY IF EXISTS "all_access_almacenes" ON public.almacenes; CREATE POLICY "all_access_almacenes" ON public.almacenes USING (true) WITH CHECK (true); END $$;`],
    ['POLICY categorias_inventario', `DO $$ BEGIN DROP POLICY IF EXISTS "all_access_categorias_inventario" ON public.categorias_inventario; CREATE POLICY "all_access_categorias_inventario" ON public.categorias_inventario USING (true) WITH CHECK (true); END $$;`],
    ['POLICY metodos_pago', `DO $$ BEGIN DROP POLICY IF EXISTS "all_access_metodos_pago" ON public.metodos_pago; CREATE POLICY "all_access_metodos_pago" ON public.metodos_pago USING (true) WITH CHECK (true); END $$;`],
    ['POLICY bancos', `DO $$ BEGIN DROP POLICY IF EXISTS "all_access_bancos" ON public.bancos; CREATE POLICY "all_access_bancos" ON public.bancos USING (true) WITH CHECK (true); END $$;`]
  ];

  for (const [label, sql] of statements) {
    await execSQL(label, sql);
  }

  // Verificación final
  console.log('\n🔍 --- VERIFICACIÓN DE TABLAS NATIVAS ---');
  const tables = ['tenants', 'perfiles', 'almacenes', 'categorias_inventario', 'metodos_pago', 'bancos'];
  for (const t of tables) {
    const { data, error } = await sb.from(t).select('id').limit(1);
    console.log(`Table '${t}': ${error ? '❌ ERROR: ' + error.message : '✅ OK'}`);
  }
}

run();
