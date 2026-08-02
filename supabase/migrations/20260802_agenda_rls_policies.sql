-- Bootstrap canonical agenda tables so this migration is safe on fresh projects.
CREATE TABLE IF NOT EXISTS public.agenda_abierta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id uuid,
  consultorio_id uuid,
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.no_disponibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id uuid,
  consultorio_id uuid,
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  motivo text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.horarios_predefinidos
  ADD COLUMN IF NOT EXISTS usuario_id uuid,
  ADD COLUMN IF NOT EXISTS consultorio_id uuid,
  ADD COLUMN IF NOT EXISTS dia text,
  ADD COLUMN IF NOT EXISTS recurso_nombre text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- =======================================================
-- MIGRACIÓN DE POLÍTICAS RLS PARA TABLAS DE AGENDA
-- Tablas: horarios_predefinidos, agenda_abierta, no_disponibles
-- =======================================================

-- Habilitar RLS en las 3 tablas de agenda
ALTER TABLE public.horarios_predefinidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_abierta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.no_disponibles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "horarios_predefinidos_all" ON public.horarios_predefinidos;
DROP POLICY IF EXISTS "agenda_abierta_all" ON public.agenda_abierta;
DROP POLICY IF EXISTS "no_disponibles_all" ON public.no_disponibles;

DROP POLICY IF EXISTS "horarios_predefinidos_select" ON public.horarios_predefinidos;
DROP POLICY IF EXISTS "horarios_predefinidos_insert" ON public.horarios_predefinidos;
DROP POLICY IF EXISTS "horarios_predefinidos_update" ON public.horarios_predefinidos;
DROP POLICY IF EXISTS "horarios_predefinidos_delete" ON public.horarios_predefinidos;

DROP POLICY IF EXISTS "agenda_abierta_select" ON public.agenda_abierta;
DROP POLICY IF EXISTS "agenda_abierta_insert" ON public.agenda_abierta;
DROP POLICY IF EXISTS "agenda_abierta_update" ON public.agenda_abierta;
DROP POLICY IF EXISTS "agenda_abierta_delete" ON public.agenda_abierta;

DROP POLICY IF EXISTS "no_disponibles_select" ON public.no_disponibles;
DROP POLICY IF EXISTS "no_disponibles_insert" ON public.no_disponibles;
DROP POLICY IF EXISTS "no_disponibles_update" ON public.no_disponibles;
DROP POLICY IF EXISTS "no_disponibles_delete" ON public.no_disponibles;

-- Crear políticas permisivas por tenant (o superadmin) para horarios_predefinidos
CREATE POLICY "horarios_predefinidos_all" ON public.horarios_predefinidos FOR ALL
  USING (
    public.is_active_user()
    AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin())
  );

-- Crear políticas permisivas por tenant (o superadmin) para agenda_abierta
CREATE POLICY "agenda_abierta_all" ON public.agenda_abierta FOR ALL
  USING (
    public.is_active_user()
    AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin())
  );

-- Crear políticas permisivas por tenant (o superadmin) para no_disponibles
CREATE POLICY "no_disponibles_all" ON public.no_disponibles FOR ALL
  USING (
    public.is_active_user()
    AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin())
  );
