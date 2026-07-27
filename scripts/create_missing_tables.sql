-- ============================================================
-- OdontoCloud SaaS — Tablas Faltantes en Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. CAJAS
CREATE TABLE IF NOT EXISTS public.cajas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    sucursal_id UUID,
    usuario_id UUID,
    fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
    fecha_cierre TIMESTAMPTZ,
    monto_inicial NUMERIC(12,2) DEFAULT 0,
    monto_final NUMERIC(12,2),
    estado TEXT DEFAULT 'abierta',
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MOVIMIENTOS DE CAJA
CREATE TABLE IF NOT EXISTS public.movimientos_caja (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    caja_id UUID REFERENCES public.cajas(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    tipo TEXT NOT NULL,
    concepto TEXT,
    monto NUMERIC(12,2) NOT NULL,
    metodo_pago TEXT DEFAULT 'efectivo',
    referencia TEXT,
    usuario_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. NOTIFICACIONES
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    target TEXT NOT NULL DEFAULT 'admin',
    paciente_id UUID,
    title TEXT,
    message TEXT,
    type TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ESPECIALIDADES
CREATE TABLE IF NOT EXISTS public.especialidades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRECIOS
CREATE TABLE IF NOT EXISTS public.precios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio NUMERIC(12,2) DEFAULT 0,
    categoria TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. HORARIOS PREDEFINIDOS
CREATE TABLE IF NOT EXISTS public.horarios_predefinidos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    usuario_id UUID,
    consultorio_id UUID,
    dia TEXT NOT NULL,
    hora_inicio TEXT,
    hora_fin TEXT,
    recurso_id TEXT,
    recurso_nombre TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AGENDA ABIERTA
CREATE TABLE IF NOT EXISTS public.agenda_abierta (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    usuario_id UUID,
    consultorio_id UUID,
    fecha DATE NOT NULL,
    hora_inicio TEXT,
    hora_fin TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. NO DISPONIBLES
CREATE TABLE IF NOT EXISTS public.no_disponibles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    usuario_id UUID,
    consultorio_id UUID,
    fecha DATE NOT NULL,
    hora_inicio TEXT,
    hora_fin TEXT,
    motivo TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Columnas adicionales en tablas existentes
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS sucursal_id UUID;
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.consultorios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.consultorios ADD COLUMN IF NOT EXISTS nombre TEXT;

-- 10. RLS — Habilitar en tablas nuevas
ALTER TABLE public.cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_predefinidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_abierta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.no_disponibles ENABLE ROW LEVEL SECURITY;

-- 11. Políticas permisivas (ajustar según necesidad de seguridad)
CREATE POLICY "all_access_cajas" ON public.cajas USING (true) WITH CHECK (true);
CREATE POLICY "all_access_movimientos" ON public.movimientos_caja USING (true) WITH CHECK (true);
CREATE POLICY "all_access_notificaciones" ON public.notificaciones USING (true) WITH CHECK (true);
CREATE POLICY "all_access_especialidades" ON public.especialidades USING (true) WITH CHECK (true);
CREATE POLICY "all_access_precios" ON public.precios USING (true) WITH CHECK (true);
CREATE POLICY "all_access_horarios" ON public.horarios_predefinidos USING (true) WITH CHECK (true);
CREATE POLICY "all_access_agenda_abierta" ON public.agenda_abierta USING (true) WITH CHECK (true);
CREATE POLICY "all_access_no_disponibles" ON public.no_disponibles USING (true) WITH CHECK (true);
