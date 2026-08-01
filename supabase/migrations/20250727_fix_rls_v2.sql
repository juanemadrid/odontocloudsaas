-- =======================================================
-- CORRECCIÓN DE POLÍTICAS RLS v2
-- Soluciona: infinite recursion in policy for relation "profiles"
-- La causa: la política SELECT de profiles se auto-referenciaba.
-- Solución: usar SOLO JWT metadata (sin subconsultas a profiles).
-- =======================================================

-- ─── 1. Función get_user_tenant_id — solo usa JWT, sin consultar profiles ────
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ─── 2. Función is_superadmin — solo usa JWT, sin consultar profiles ─────────
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
      OR (auth.jwt() ->> 'email') = 'madridsystem@outlook.es';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ─── 3. Eliminar todas las políticas existentes ──────────────────────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ─── 4. PROFILES — Sin recursión, solo JWT ───────────────────────────────────
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
      OR id = auth.uid()
      OR public.is_superadmin()
    )
  );

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR public.is_superadmin()
  );

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR public.is_superadmin()
  );

CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
  USING (public.is_superadmin());

-- ─── 5. TENANTS ──────────────────────────────────────────────────────────────
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT
  USING (
    id = public.get_user_tenant_id()
    OR public.is_superadmin()
  );

CREATE POLICY "tenants_insert" ON public.tenants FOR INSERT
  WITH CHECK (public.is_superadmin() OR auth.role() = 'authenticated');

CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE
  USING (id = public.get_user_tenant_id() OR public.is_superadmin());

CREATE POLICY "tenants_delete" ON public.tenants FOR DELETE
  USING (public.is_superadmin());

-- ─── 6. Políticas para todas las demás tablas con tenant_id ──────────────────
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'sucursales', 'consultorios', 'pacientes', 'citas', 'evoluciones',
    'odontogramas', 'treatment_plans', 'consecutivos', 'facturas', 'pagos',
    'recibos_caja', 'notas_credito', 'notas_debito', 'saldos_favor',
    'liquidaciones', 'rips_archivos', 'inventario', 'listas_precios',
    'catalogo_procedimientos', 'bancos', 'entidades', 'website_config',
    'actividad'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT
       USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());',
      tbl || '_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT
       WITH CHECK (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());',
      tbl || '_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE
       USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin())
       WITH CHECK (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());',
      tbl || '_update', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE
       USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());',
      tbl || '_delete', tbl
    );
  END LOOP;
END $$;

-- website_config también se puede leer públicamente (para landing pages)
CREATE POLICY "website_config_public_select" ON public.website_config FOR SELECT USING (true);
