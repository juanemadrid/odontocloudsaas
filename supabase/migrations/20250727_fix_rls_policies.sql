-- =======================================================
-- CORRECCIÓN DE POLÍTICAS RLS
-- El problema: get_user_tenant_id() puede retornar NULL si el profile
-- no existe todavía, causando que las consultas retornen vacío.
-- Solución: usar auth.jwt() → user_metadata → tenant_id como fallback,
-- y asegurarse de que los usuarios autenticados puedan leer datos de su clínica.
-- =======================================================

-- ─── 1. Función helper mejorada que usa metadata JWT como fallback ───────────
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Primero buscar en profiles (fuente principal)
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Si no encontró, intentar con user_metadata del JWT
  IF v_tenant_id IS NULL THEN
    v_tenant_id := (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID;
  END IF;

  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ─── 2. Función helper mejorada para superadmin ──────────────────────────────
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  SELECT role, email INTO v_role, v_email
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role = 'superadmin' THEN
    RETURN true;
  END IF;

  -- Fallback: verificar email directamente desde auth
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  RETURN v_email = 'madridsystem@outlook.es';
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

-- ─── 4. PROFILES — Política especial porque es la tabla base ─────────────────
-- Un usuario autenticado puede ver todos los profiles de su mismo tenant_id
-- (usando JWT metadata como fallback cuando profile aún no existe)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      -- Ver perfil propio
      id = auth.uid()
      -- O ver perfiles del mismo tenant (por profile existente)
      OR tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      -- O ver perfiles del mismo tenant (por JWT metadata fallback)
      OR tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
      -- O si es superadmin
      OR (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1) = 'madridsystem@outlook.es'
    )
  );

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (
    id = auth.uid() 
    OR (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1) = 'madridsystem@outlook.es'
  );

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1) = 'madridsystem@outlook.es'
  );

CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1) = 'madridsystem@outlook.es'
  );

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
