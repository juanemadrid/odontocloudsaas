-- Migration: FEV-RIPS v003 Fase 1 (Resolución 948 de 2026 & Documento Técnico 1 v003)
-- Implementación aditiva, reversible, aislada por tenant y con feature flag apagado por defecto.
BEGIN;

-- 1. Tabla de Feature Flags por Tenant
CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_feature_flags UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_lookup
ON public.tenant_feature_flags (tenant_id, feature_key);

ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tenant_feature_flags FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_feature_flags TO authenticated;

DROP POLICY IF EXISTS tenant_feature_flags_select_policy ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_select_policy
ON public.tenant_feature_flags
FOR SELECT
TO authenticated
USING (
  (SELECT public.is_active_user())
  AND (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.is_superadmin())
  )
);

DROP POLICY IF EXISTS tenant_feature_flags_modify_policy ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_modify_policy
ON public.tenant_feature_flags
FOR ALL
TO authenticated
USING (
  (SELECT public.is_active_user())
  AND (
    (tenant_id = (SELECT public.get_user_tenant_id()) AND (SELECT public.is_tenant_admin()))
    OR (SELECT public.is_superadmin())
  )
)
WITH CHECK (
  (SELECT public.is_active_user())
  AND (
    (tenant_id = (SELECT public.get_user_tenant_id()) AND (SELECT public.is_tenant_admin()))
    OR (SELECT public.is_superadmin())
  )
);

-- Función helper para verificar feature flag de forma segura
CREATE OR REPLACE FUNCTION public.is_fev_rips_0948_enabled(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT enabled
      FROM public.tenant_feature_flags
      WHERE tenant_id = p_tenant_id
        AND feature_key = 'ENABLE_FEV_RIPS_0948'
      LIMIT 1
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_fev_rips_0948_enabled(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_fev_rips_0948_enabled(UUID) TO authenticated;

-- 2. Tabla Versionada para Catálogos Oficiales de SISPRO / MinSalud
CREATE TABLE IF NOT EXISTS public.rips_catalogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v003_2026',
  rips_schema_version TEXT NOT NULL DEFAULT 'DT1-v003-2026',
  cups_resolution TEXT DEFAULT '2706-2025',
  cups_vigencia TEXT DEFAULT '2026',
  vigencia_desde DATE DEFAULT '2026-01-01',
  vigencia_hasta DATE,
  activo BOOLEAN NOT NULL DEFAULT true,
  fuente_oficial TEXT NOT NULL DEFAULT 'SISPRO - MinSalud',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rips_catalogos_entry UNIQUE (catalogo, codigo, version)
);

CREATE INDEX IF NOT EXISTS idx_rips_catalogos_query
ON public.rips_catalogos (catalogo, codigo)
WHERE activo IS TRUE;

ALTER TABLE public.rips_catalogos ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.rips_catalogos TO anon, authenticated;

DROP POLICY IF EXISTS rips_catalogos_read_policy ON public.rips_catalogos;
CREATE POLICY rips_catalogos_read_policy
ON public.rips_catalogos
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS rips_catalogos_write_superadmin ON public.rips_catalogos;
CREATE POLICY rips_catalogos_write_superadmin
ON public.rips_catalogos
FOR ALL
TO authenticated
USING ((SELECT public.is_superadmin()))
WITH CHECK ((SELECT public.is_superadmin()));

-- 3. Tabla de Servicios REPS Habilitados por Sede (Sucursal)
CREATE TABLE IF NOT EXISTS public.sucursal_servicios_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE CASCADE NOT NULL,
  cod_servicio TEXT NOT NULL,
  nombre_servicio TEXT NOT NULL,
  habilitado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sucursal_servicio UNIQUE (sucursal_id, cod_servicio)
);

CREATE INDEX IF NOT EXISTS idx_sucursal_servicios_reps_lookup
ON public.sucursal_servicios_reps (sucursal_id, cod_servicio)
WHERE habilitado IS TRUE;

ALTER TABLE public.sucursal_servicios_reps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sucursal_servicios_reps FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sucursal_servicios_reps TO authenticated;

DROP POLICY IF EXISTS sucursal_servicios_reps_select_policy ON public.sucursal_servicios_reps;
CREATE POLICY sucursal_servicios_reps_select_policy
ON public.sucursal_servicios_reps
FOR SELECT
TO authenticated
USING (
  (SELECT public.is_active_user())
  AND (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.is_superadmin())
  )
);

DROP POLICY IF EXISTS sucursal_servicios_reps_modify_policy ON public.sucursal_servicios_reps;
CREATE POLICY sucursal_servicios_reps_modify_policy
ON public.sucursal_servicios_reps
FOR ALL
TO authenticated
USING (
  (SELECT public.is_active_user())
  AND (
    (tenant_id = (SELECT public.get_user_tenant_id()) AND (SELECT public.is_tenant_admin()))
    OR (SELECT public.is_superadmin())
  )
)
WITH CHECK (
  (SELECT public.is_active_user())
  AND (
    (tenant_id = (SELECT public.get_user_tenant_id()) AND (SELECT public.is_tenant_admin()))
    OR (SELECT public.is_superadmin())
  )
);

-- 4. Tabla de Trazabilidad y Validación RIPS v003
CREATE TABLE IF NOT EXISTS public.rips_validaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  factura_id UUID REFERENCES public.facturas(id) ON DELETE SET NULL,
  tipo_documento TEXT NOT NULL,
  documento_id TEXT,
  esquema_version TEXT NOT NULL DEFAULT 'DT1-v003-2026',
  estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE', 'VALIDADO', 'RECHAZADO', 'ERROR', 'valido', 'con_errores')),
  cufe TEXT,
  cuv TEXT,
  errores JSONB NOT NULL DEFAULT '[]'::jsonb,
  advertencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload_hash TEXT,
  payload_resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rips_validaciones_tenant
ON public.rips_validaciones (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rips_validaciones_factura
ON public.rips_validaciones (factura_id);

CREATE INDEX IF NOT EXISTS idx_rips_validaciones_cuv
ON public.rips_validaciones (cuv)
WHERE cuv IS NOT NULL;

ALTER TABLE public.rips_validaciones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rips_validaciones FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rips_validaciones TO authenticated;

DROP POLICY IF EXISTS rips_validaciones_select_policy ON public.rips_validaciones;
CREATE POLICY rips_validaciones_select_policy
ON public.rips_validaciones
FOR SELECT
TO authenticated
USING (
  (SELECT public.is_active_user())
  AND (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.is_superadmin())
  )
);

DROP POLICY IF EXISTS rips_validaciones_insert_policy ON public.rips_validaciones;
CREATE POLICY rips_validaciones_insert_policy
ON public.rips_validaciones
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT public.is_active_user())
  AND (
    tenant_id = (SELECT public.get_user_tenant_id())
    OR (SELECT public.is_superadmin())
  )
);

-- 5. Carga Inicial de Catálogos Oficiales SISPRO v003 (RIPSTipoUsuarioVersion2: 01 a 14)
INSERT INTO public.rips_catalogos (catalogo, codigo, descripcion, version, vigencia_desde, activo, fuente_oficial)
VALUES
  -- RIPSTipoUsuarioVersion2 (Valores oficiales vigentes SISPRO 01 al 14)
  ('RIPSTipoUsuarioVersion2', '01', 'Contributivo cotizante', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '02', 'Contributivo beneficiario', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '03', 'Contributivo adicional', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '04', 'Subsidiado', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '05', 'No afiliado', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '06', 'Especial o Excepción cotizante', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '07', 'Especial o Excepción beneficiario', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '08', 'Personas privadas de la libertad a cargo del Fondo Nacional de Salud', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '09', 'Tomador / Amparado ARL', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '10', 'Tomador / Amparado SOAT', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '11', 'Tomador / Amparado Planes Voluntarios de Salud', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '12', 'Particular', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '13', 'Especial o excepción no cotizante (Ley 352 de 1997)', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla RIPSTipoUsuarioVersion2'),
  ('RIPSTipoUsuarioVersion2', '14', 'Lesionado en accidente de tránsito sin seguro SOAT', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003 / Res. 948 de 2026'),

  -- LstSiNo (Valores oficiales SISPRO: 01=SI, 02=NO)
  ('LstSiNo', '01', 'SI', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla de Referencia LstSiNo'),
  ('LstSiNo', '02', 'NO', 'v003_2026', '2026-07-01', true, 'SISPRO - Tabla de Referencia LstSiNo'),

  -- Servicios REPS Odontológicos Oficiales (Referencia para habilitación en sede)
  ('servicios_reps', '334', 'Odontología General', 'v003_2026', '2026-07-01', true, 'REPS - MinSalud'),
  ('servicios_reps', '311', 'Endodoncia', 'v003_2026', '2026-07-01', true, 'REPS - MinSalud'),
  ('servicios_reps', '338', 'Ortodoncia', 'v003_2026', '2026-07-01', true, 'REPS - MinSalud'),
  ('servicios_reps', '343', 'Periodoncia', 'v003_2026', '2026-07-01', true, 'REPS - MinSalud'),
  ('servicios_reps', '347', 'Rehabilitación Oral', 'v003_2026', '2026-07-01', true, 'REPS - MinSalud'),
  ('servicios_reps', '396', 'Odontopediatría', 'v003_2026', '2026-07-01', true, 'REPS - MinSalud'),
  ('servicios_reps', '410', 'Cirugía Oral', 'v003_2026', '2026-07-01', true, 'REPS - MinSalud'),
  ('servicios_reps', '411', 'Cirugía Maxilofacial', 'v003_2026', '2026-07-01', true, 'REPS - MinSalud'),

  -- Modalidad de Atención
  ('modalidad_atencion', '01', 'Intramural', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('modalidad_atencion', '02', 'Extramural unidad móvil', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('modalidad_atencion', '03', 'Extramural domiciliaria', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('modalidad_atencion', '04', 'Telemedicina interactiva', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('modalidad_atencion', '06', 'Telemedicina no interactiva', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('modalidad_atencion', '07', 'Telemedicina telexperticia', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('modalidad_atencion', '08', 'Telemedicina telemonitoreo', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Grupo de Servicios
  ('grupo_servicios', '01', 'Consulta externa', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('grupo_servicios', '02', 'Apoyo diagnóstico y complementación terapéutica', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('grupo_servicios', '03', 'Internación', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('grupo_servicios', '04', 'Quirúrgico', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('grupo_servicios', '05', 'Atención inmediata', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Concepto de Recaudo
  ('concepto_recaudo', '01', 'Copago', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('concepto_recaudo', '02', 'Cuota moderadora', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('concepto_recaudo', '03', 'Pagos compartidos en planes voluntarios de salud', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('concepto_recaudo', '04', 'Anticipo', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('concepto_recaudo', '05', 'No aplica / Ninguno', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Tipo de Diagnóstico Principal
  ('tipo_diagnostico', '01', 'Impresión diagnóstica', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('tipo_diagnostico', '02', 'Confirmado nuevo', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('tipo_diagnostico', '03', 'Confirmado repetido', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Sexo
  ('sexo', 'H', 'Hombre', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('sexo', 'M', 'Mujer', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Zona Territorial
  ('zonas_territoriales', '01', 'Urbana', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('zonas_territoriales', '02', 'Rural', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Causa Externa / Motivo de Atención
  ('causa_externa', '38', 'Enfermedad general', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('causa_externa', '01', 'Accidente de trabajo', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('causa_externa', '02', 'Accidente de tránsito', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Finalidad Consulta Odontológica / General
  ('finalidad_consulta', '10', 'Diagnóstico', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('finalidad_consulta', '11', 'Terapéutico', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('finalidad_consulta', '16', 'Protección específica', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Finalidad Procedimientos
  ('finalidad_procedimiento', '01', 'Diagnóstico', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('finalidad_procedimiento', '02', 'Terapéutico', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('finalidad_procedimiento', '03', 'Protección específica', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('finalidad_procedimiento', '04', 'Detección temprana', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('finalidad_procedimiento', '05', 'No aplica', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- Vía de Ingreso al Servicio de Salud (para Procedimientos)
  ('via_ingreso', '01', 'Demanda espontánea', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('via_ingreso', '02', 'Remitido', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),
  ('via_ingreso', '03', 'Urgencias', 'v003_2026', '2026-07-01', true, 'SISPRO - Documento Técnico 1 v003'),

  -- CUPSRips (Subconjunto de prueba TEST FIXTURE basado en Resolución 2706 de 2025 para vigencia 2026)
  -- 232100 NO EXISTE en CUPSRips oficial 2026
  ('CUPSRips', '890203', 'CONSULTA DE PRIMERA VEZ POR ODONTOLOGÍA GENERAL', 'v003_2026', '2026-01-01', true, 'MinSalud / SISPRO - Resolución 2706 de 2025 (TEST FIXTURE)'),
  ('CUPSRips', '890303', 'CONSULTA DE CONTROL O SEGUIMIENTO POR ODONTOLOGÍA GENERAL', 'v003_2026', '2026-01-01', true, 'MinSalud / SISPRO - Resolución 2706 de 2025 (TEST FIXTURE)'),
  ('CUPSRips', '232101', 'OBTURACIÓN DENTAL CON AMALGAMA', 'v003_2026', '2026-01-01', true, 'MinSalud / SISPRO - Resolución 2706 de 2025 (TEST FIXTURE)'),
  ('CUPSRips', '232102', 'OBTURACIÓN DENTAL CON RESINA DE FOTOCURADO', 'v003_2026', '2026-01-01', true, 'MinSalud / SISPRO - Resolución 2706 de 2025 (TEST FIXTURE)'),
  ('CUPSRips', '232103', 'OBTURACIÓN DENTAL CON IONÓMERO DE VIDRIO', 'v003_2026', '2026-01-01', true, 'MinSalud / SISPRO - Resolución 2706 de 2025 (TEST FIXTURE)'),
  ('CUPSRips', '232104', 'OBTURACIÓN DENTAL', 'v003_2026', '2026-01-01', true, 'MinSalud / SISPRO - Resolución 2706 de 2025 (TEST FIXTURE)'),
  ('CUPSRips', '997107', 'APLICACIÓN DE SELLANTES', 'v003_2026', '2026-01-01', true, 'MinSalud / SISPRO - Resolución 2706 de 2025 (TEST FIXTURE)')

ON CONFLICT (catalogo, codigo, version) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    activo = EXCLUDED.activo,
    updated_at = now();

COMMIT;
