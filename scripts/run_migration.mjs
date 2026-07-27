import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Execute SQL via pg endpoint
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

const statements = [
  ['CREATE cajas', `CREATE TABLE IF NOT EXISTS public.cajas (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL, sucursal_id UUID, usuario_id UUID, fecha_apertura TIMESTAMPTZ DEFAULT NOW(), fecha_cierre TIMESTAMPTZ, monto_inicial NUMERIC(12,2) DEFAULT 0, monto_final NUMERIC(12,2), estado TEXT DEFAULT 'abierta', notas TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`],
  ['CREATE movimientos_caja', `CREATE TABLE IF NOT EXISTS public.movimientos_caja (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, caja_id UUID, tenant_id UUID NOT NULL, tipo TEXT NOT NULL, concepto TEXT, monto NUMERIC(12,2) NOT NULL, metodo_pago TEXT DEFAULT 'efectivo', referencia TEXT, usuario_id UUID, created_at TIMESTAMPTZ DEFAULT NOW())`],
  ['CREATE notificaciones', `CREATE TABLE IF NOT EXISTS public.notificaciones (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL, target TEXT DEFAULT 'admin', paciente_id UUID, title TEXT, message TEXT, type TEXT, read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`],
  ['CREATE especialidades', `CREATE TABLE IF NOT EXISTS public.especialidades (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL, nombre TEXT NOT NULL, descripcion TEXT, activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`],
  ['CREATE precios', `CREATE TABLE IF NOT EXISTS public.precios (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL, nombre TEXT NOT NULL, descripcion TEXT, precio NUMERIC(12,2) DEFAULT 0, categoria TEXT, activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`],
  ['CREATE horarios_predefinidos', `CREATE TABLE IF NOT EXISTS public.horarios_predefinidos (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL, usuario_id UUID, consultorio_id UUID, dia TEXT NOT NULL, hora_inicio TEXT, hora_fin TEXT, activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`],
  ['CREATE agenda_abierta', `CREATE TABLE IF NOT EXISTS public.agenda_abierta (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL, usuario_id UUID, consultorio_id UUID, fecha DATE NOT NULL, hora_inicio TEXT, hora_fin TEXT, activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`],
  ['CREATE no_disponibles', `CREATE TABLE IF NOT EXISTS public.no_disponibles (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id UUID NOT NULL, usuario_id UUID, consultorio_id UUID, fecha DATE NOT NULL, hora_inicio TEXT, hora_fin TEXT, motivo TEXT, activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`],
  ['ALTER citas sucursal_id', `ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS sucursal_id UUID`],
  ['ALTER sucursales activo', `ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE`],
  ['ALTER consultorios activo', `ALTER TABLE public.consultorios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE`],
  ['ALTER consultorios nombre', `ALTER TABLE public.consultorios ADD COLUMN IF NOT EXISTS nombre TEXT`],
  ['RLS cajas', `ALTER TABLE public.cajas DISABLE ROW LEVEL SECURITY`],
  ['RLS movimientos_caja', `ALTER TABLE public.movimientos_caja DISABLE ROW LEVEL SECURITY`],
  ['RLS notificaciones', `ALTER TABLE public.notificaciones DISABLE ROW LEVEL SECURITY`],
  ['RLS especialidades', `ALTER TABLE public.especialidades DISABLE ROW LEVEL SECURITY`],
  ['RLS precios', `ALTER TABLE public.precios DISABLE ROW LEVEL SECURITY`],
  ['RLS horarios', `ALTER TABLE public.horarios_predefinidos DISABLE ROW LEVEL SECURITY`],
  ['RLS agenda_abierta', `ALTER TABLE public.agenda_abierta DISABLE ROW LEVEL SECURITY`],
  ['RLS no_disponibles', `ALTER TABLE public.no_disponibles DISABLE ROW LEVEL SECURITY`],
];

for (const [label, sql] of statements) {
  await execSQL(label, sql);
}

// Verify tables now exist
console.log('\n--- Verification ---');
const tables = ['cajas','movimientos_caja','notificaciones','especialidades','precios','horarios_predefinidos','agenda_abierta','no_disponibles'];
for (const t of tables) {
  const { data, error, status } = await sb.from(t).select('id').limit(1);
  console.log(`${t}: ${error ? 'MISSING - ' + error.message : 'EXISTS ✅'}`);
}
