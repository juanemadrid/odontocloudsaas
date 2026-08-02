-- =======================================================
-- COLUMNAS Y TABLAS FALTANTES — detectadas por errores 400
-- =======================================================

-- ─── 1. Tabla pacientes — columnas extra ─────────────────────────────────────
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS saldo_favor       NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS periodontograma   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS nro_historia       TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS fecha_ingreso      DATE;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS estado_civil       TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS es_extranjero      BOOLEAN DEFAULT false;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS permite_publicidad BOOLEAN DEFAULT true;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS registro_completo  BOOLEAN DEFAULT true;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS pais_nacimiento    TEXT DEFAULT 'Colombia';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS ciudad_nacimiento  TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS pais_domicilio     TEXT DEFAULT 'Colombia';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS ciudad_domicilio   TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS barrio             TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS lugar_residencia   TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS estrato            TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS zona_residencial   TEXT DEFAULT 'Urbana';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS prefijo_celular    TEXT DEFAULT '+57';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS telefono_domicilio TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS telefono_oficina   TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS extension          TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS poliza_salud       TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS plan_id            TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS plan_nombre        TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS convenio_beneficio TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS convenio_pago      TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS como_conocio       TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS campania           TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS remitido_por_type  TEXT DEFAULT 'Libre';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS remitido_por_value TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS asesor_comercial_type  TEXT DEFAULT 'Libre';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS asesor_comercial_value TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS profesional_id     TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS profesional_nombre TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS nombre_responsable TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS parentesco         TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS celular_responsable TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS telefono_responsable TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS email_responsable  TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS nombre_acompanante TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS telefono_acompanante TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS alertas            TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS notas              TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS foto_url           TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT now();

-- ─── 2. Tabla pagos — columnas extra ─────────────────────────────────────────
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS estado    TEXT DEFAULT 'completado';
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS concepto  TEXT;
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS notas     TEXT;
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS fecha     DATE DEFAULT now();
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL;

-- ─── 3. Tabla sucursales ─────────────────────────────────────────────────────
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- ─── 4. Tabla evoluciones — columnas extra ───────────────────────────────────
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS titulo          TEXT;
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS motivo          TEXT;
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS anamnesis       TEXT;
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS examen_fisico   TEXT;
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS plan_manejo     TEXT;
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS medicamentos    JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS adjuntos        JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS firma_paciente  TEXT;
ALTER TABLE public.evoluciones ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

-- ─── 5. Tabla formulaciones (medicamentos recetados) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.formulaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profesional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evolucion_id UUID REFERENCES public.evoluciones(id) ON DELETE SET NULL,
  medicamento TEXT NOT NULL,
  dosis       TEXT,
  frecuencia  TEXT,
  duracion    TEXT,
  indicaciones TEXT,
  fecha       TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.formulaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formulaciones_select" ON public.formulaciones FOR SELECT
  USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());
CREATE POLICY "formulaciones_insert" ON public.formulaciones FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());
CREATE POLICY "formulaciones_update" ON public.formulaciones FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());
CREATE POLICY "formulaciones_delete" ON public.formulaciones FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());

-- ─── 6. Índices útiles ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pagos_paciente     ON public.pagos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_tenant       ON public.pagos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_formulaciones_pac  ON public.formulaciones(paciente_id);
CREATE INDEX IF NOT EXISTS idx_evoluciones_tenant ON public.evoluciones(tenant_id, paciente_id);
