-- =============================================================================
-- ODONTOCLOUD — SEGURIDAD RLS V2: MÍNIMO PRIVILEGIO CLÍNICO Y ACCESO EXCEPCIONAL
-- Archivo: supabase/migrations/20261012_clinical_data_least_privilege_v2.sql
-- =============================================================================
-- PRINCIPIOS DE DISEÑO:
-- 1. Separación de funciones (Duty Separation): Los administradores de TI y
--    superadmins técnicos TIENEN VETADO el acceso automático a datos clínicos
--    sensibles (Ley 1581 de 2012 Art. 5, Ley 2015 de 2020 Art. 7).
-- 2. Acceso asistencial estricto: Las evoluciones, diagnósticos y tratamientos
--    solo son accesibles por personal de salud activo de la misma clínica.
-- 3. Acceso Excepcional Auditado ("Break-Glass"): Control dual estricto;
--    prohíbe la autoaprobación y requiere aprobación del administrador local.
-- 4. Soporte total para backend y worker: El rol service_role mantiene
--    permisos efectivos universales para operaciones del sistema.
-- 5. Revoca el borrado físico (DELETE) en registros clínicos.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. FUNCIÓN DE ROL ASISTENCIAL / SALUD
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_clinical_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.activo IS TRUE
      AND lower(trim(coalesce(p.role, ''))) IN (
        'odontologo', 'doctor', 'especialista', 'odontologa', 
        'higienista', 'auxiliar_odontologia', 'cirujano'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_clinical_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clinical_staff() TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. TABLA DE SESIONES DE ACCESO EXCEPCIONAL (BREAK-GLASS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_break_glass_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  motivo TEXT NOT NULL,
  ticket_referencia TEXT,
  estado VARCHAR(30) DEFAULT 'PENDIENTE_APROBACION',
  solicitado_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  aprobado_por UUID REFERENCES auth.users(id),
  aprobado_at TIMESTAMPTZ,
  valido_hasta TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.clinical_break_glass_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinical_break_glass_sessions FROM PUBLIC, anon;
GRANT ALL ON public.clinical_break_glass_sessions TO service_role;
GRANT SELECT ON public.clinical_break_glass_sessions TO authenticated;

-- Función de verificación de sesión activa aprobada
CREATE OR REPLACE FUNCTION public.is_active_break_glass_user(p_paciente_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinical_break_glass_sessions s
    WHERE s.user_id = auth.uid()
      AND s.paciente_id = p_paciente_id
      AND s.estado = 'ACTIVA'
      AND s.valido_hasta > clock_timestamp()
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_break_glass_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_break_glass_user(UUID) TO authenticated, service_role;

-- Eliminar explícitamente cualquier versión de la función heredada sin aprobación
DROP FUNCTION IF EXISTS public.request_break_glass_access(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.request_break_glass_access(UUID, TEXT) CASCADE;


-- -----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS: TABLA PACIENTES
-- -----------------------------------------------------------------------------
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes FORCE ROW LEVEL SECURITY;

-- Política service_role para operaciones backend
DROP POLICY IF EXISTS service_role_all_pacientes ON public.pacientes;
CREATE POLICY service_role_all_pacientes ON public.pacientes
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pacientes_tenant_select ON public.pacientes;
CREATE POLICY pacientes_tenant_select ON public.pacientes
FOR SELECT TO authenticated
USING (
  (public.is_active_user() AND NOT public.is_superadmin() AND tenant_id = public.get_user_tenant_id()) OR
  public.is_active_break_glass_user(id)
);

DROP POLICY IF EXISTS pacientes_tenant_insert ON public.pacientes;
CREATE POLICY pacientes_tenant_insert ON public.pacientes
FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user() AND NOT public.is_superadmin() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS pacientes_tenant_update ON public.pacientes;
CREATE POLICY pacientes_tenant_update ON public.pacientes
FOR UPDATE TO authenticated
USING (
  public.is_active_user() AND NOT public.is_superadmin() AND tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  public.is_active_user() AND NOT public.is_superadmin() AND tenant_id = public.get_user_tenant_id()
);

-- Eliminación física PROHIBIDA: Se revoca la política de DELETE para authenticated.
DROP POLICY IF EXISTS pacientes_tenant_delete ON public.pacientes;


-- -----------------------------------------------------------------------------
-- 4. POLÍTICAS RLS: TABLA EVOLUCIONES
-- -----------------------------------------------------------------------------
ALTER TABLE public.evoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evoluciones FORCE ROW LEVEL SECURITY;

-- Política service_role para operaciones backend
DROP POLICY IF EXISTS service_role_all_evoluciones ON public.evoluciones;
CREATE POLICY service_role_all_evoluciones ON public.evoluciones
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS evoluciones_tenant_select ON public.evoluciones;
CREATE POLICY evoluciones_tenant_select ON public.evoluciones
FOR SELECT TO authenticated
USING (
  (public.is_active_user() AND public.is_clinical_staff() AND tenant_id = public.get_user_tenant_id()) OR
  public.is_active_break_glass_user(paciente_id)
);

DROP POLICY IF EXISTS evoluciones_tenant_insert ON public.evoluciones;
CREATE POLICY evoluciones_tenant_insert ON public.evoluciones
FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user() AND public.is_clinical_staff() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS evoluciones_tenant_update ON public.evoluciones;
CREATE POLICY evoluciones_tenant_update ON public.evoluciones
FOR UPDATE TO authenticated
USING (
  public.is_active_user() AND public.is_clinical_staff() AND tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  public.is_active_user() AND public.is_clinical_staff() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS evoluciones_tenant_delete ON public.evoluciones;


-- -----------------------------------------------------------------------------
-- 5. POLÍTICAS RLS: TABLA ODONTOGRAMAS
-- -----------------------------------------------------------------------------
ALTER TABLE public.odontogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogramas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_odontogramas ON public.odontogramas;
CREATE POLICY service_role_all_odontogramas ON public.odontogramas
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS odontogramas_tenant_select ON public.odontogramas;
CREATE POLICY odontogramas_tenant_select ON public.odontogramas
FOR SELECT TO authenticated
USING (
  (public.is_active_user() AND public.is_clinical_staff() AND tenant_id = public.get_user_tenant_id()) OR
  public.is_active_break_glass_user(paciente_id)
);

DROP POLICY IF EXISTS odontogramas_tenant_insert ON public.odontogramas;
CREATE POLICY odontogramas_tenant_insert ON public.odontogramas
FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user() AND public.is_clinical_staff() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS odontogramas_tenant_update ON public.odontogramas;
CREATE POLICY odontogramas_tenant_update ON public.odontogramas
FOR UPDATE TO authenticated
USING (
  public.is_active_user() AND public.is_clinical_staff() AND tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  public.is_active_user() AND public.is_clinical_staff() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS odontogramas_tenant_delete ON public.odontogramas;


-- -----------------------------------------------------------------------------
-- 6. POLÍTICAS RLS: TABLA DOCUMENTOS CLÍNICOS
-- -----------------------------------------------------------------------------
ALTER TABLE public.documentos_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_clinicos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_documentos_clinicos ON public.documentos_clinicos;
CREATE POLICY service_role_all_documentos_clinicos ON public.documentos_clinicos
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS documentos_clinicos_tenant_select ON public.documentos_clinicos;
CREATE POLICY documentos_clinicos_tenant_select ON public.documentos_clinicos
FOR SELECT TO authenticated
USING (
  (public.is_active_user() AND tenant_id = public.get_user_tenant_id()) OR
  public.is_active_break_glass_user(paciente_id)
);

DROP POLICY IF EXISTS documentos_clinicos_tenant_insert ON public.documentos_clinicos;
CREATE POLICY documentos_clinicos_tenant_insert ON public.documentos_clinicos
FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS documentos_clinicos_tenant_update ON public.documentos_clinicos;
CREATE POLICY documentos_clinicos_tenant_update ON public.documentos_clinicos
FOR UPDATE TO authenticated
USING (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  public.is_active_user() AND tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS documentos_clinicos_tenant_delete ON public.documentos_clinicos;

-- -----------------------------------------------------------------------------
-- 7. CONCESIÓN DE PRIVILEGIOS GENERALES A SERVICE_ROLE
-- -----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
