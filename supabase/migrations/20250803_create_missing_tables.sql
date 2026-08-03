-- =====================================================
-- Migración: Crear todas las tablas faltantes
-- Fecha: 2026-08-03
-- Descripción: Crear convenios, audit_logs, agenda_abierta
-- =====================================================

-- -------------------------------------------------------
-- 1. TABLA CONVENIOS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convenios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  nombre_corto VARCHAR(100),
  tipo VARCHAR(50) DEFAULT 'EPS',
  nit VARCHAR(50),
  codigo_habilitacion VARCHAR(100),
  porcentaje_descuento DECIMAL(5,2) DEFAULT 0.00,
  cobertura_servicios TEXT,
  requisitos_autorizacion TEXT,
  contacto_nombre VARCHAR(255),
  contacto_telefono VARCHAR(50),
  contacto_email VARCHAR(255),
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.convenios_descuentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id UUID REFERENCES public.convenios(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  servicio_id UUID,
  servicio_nombre VARCHAR(255),
  codigo_cups VARCHAR(50),
  porcentaje_descuento DECIMAL(5,2) DEFAULT 0.00,
  valor_fijo DECIMAL(12,2) DEFAULT 0.00,
  tipo_descuento VARCHAR(20) DEFAULT 'PORCENTAJE',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- 2. TABLA AUDIT_LOGS (Auditoría)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  inquilino UUID, -- Alias para tenant_id (compatibilidad)
  patient_id UUID,
  performed_by UUID,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  device_info JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- 3. TABLA AGENDA_ABIERTA (Horarios disponibles)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_abierta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  profesional_id UUID,
  consultorio_id UUID,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  disponible BOOLEAN DEFAULT true,
  motivo_bloqueo VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- 4. ÍNDICES
-- -------------------------------------------------------
-- Convenios
CREATE INDEX IF NOT EXISTS idx_convenios_tenant_id ON public.convenios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_convenios_activo ON public.convenios(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_convenios_descuentos_convenio_id ON public.convenios_descuentos(convenio_id);
CREATE INDEX IF NOT EXISTS idx_convenios_descuentos_tenant_id ON public.convenios_descuentos(tenant_id);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_inquilino ON public.audit_logs(inquilino);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON public.audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Agenda Abierta
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_tenant_id ON public.agenda_abierta(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_profesional_id ON public.agenda_abierta(profesional_id);
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_consultorio_id ON public.agenda_abierta(consultorio_id);
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_fecha ON public.agenda_abierta(fecha);
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_disponible ON public.agenda_abierta(disponible) WHERE disponible = true;

-- -------------------------------------------------------
-- 5. POLÍTICAS RLS (Row Level Security)
-- -------------------------------------------------------

-- CONVENIOS
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view convenios from their tenant" ON public.convenios;
CREATE POLICY "Users can view convenios from their tenant" ON public.convenios
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage convenios from their tenant" ON public.convenios;
CREATE POLICY "Users can manage convenios from their tenant" ON public.convenios
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- CONVENIOS_DESCUENTOS
ALTER TABLE public.convenios_descuentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view descuentos from their tenant" ON public.convenios_descuentos;
CREATE POLICY "Users can view descuentos from their tenant" ON public.convenios_descuentos
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage descuentos from their tenant" ON public.convenios_descuentos;
CREATE POLICY "Users can manage descuentos from their tenant" ON public.convenios_descuentos
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- AUDIT_LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit logs from their tenant" ON public.audit_logs;
CREATE POLICY "Users can view audit logs from their tenant" ON public.audit_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR inquilino IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert audit logs for their tenant" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs for their tenant" ON public.audit_logs
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR inquilino IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- AGENDA_ABIERTA
ALTER TABLE public.agenda_abierta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view agenda abierta from their tenant" ON public.agenda_abierta;
CREATE POLICY "Users can view agenda abierta from their tenant" ON public.agenda_abierta
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage agenda abierta from their tenant" ON public.agenda_abierta;
CREATE POLICY "Users can manage agenda abierta from their tenant" ON public.agenda_abierta
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- -------------------------------------------------------
-- 6. TRIGGER PARA AUTO-SYNC inquilino = tenant_id
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_inquilino_field()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL AND NEW.inquilino IS NULL THEN
    NEW.inquilino := NEW.tenant_id;
  END IF;
  IF NEW.inquilino IS NOT NULL AND NEW.tenant_id IS NULL THEN
    NEW.tenant_id := NEW.inquilino;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_inquilino ON public.audit_logs;
CREATE TRIGGER trigger_sync_inquilino
  BEFORE INSERT OR UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION sync_inquilino_field();

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
