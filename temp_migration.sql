-- =====================================================
-- Migración: Crear tabla convenios y convenios_descuentos
-- Fecha: 2026-08-03
-- Descripción: Asegurar que existan las tablas de convenios
--              institucionales y sus descuentos asociados
-- =====================================================

-- -------------------------------------------------------
-- 1. TABLA CONVENIOS (Convenios Institucionales)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convenios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  nombre_corto VARCHAR(100),
  tipo VARCHAR(50) DEFAULT 'EPS', -- EPS, ARL, Prepagada, Particular, Otro
  nit VARCHAR(50),
  codigo_habilitacion VARCHAR(100),
  porcentaje_descuento DECIMAL(5,2) DEFAULT 0.00,
  cobertura_servicios TEXT, -- JSON o texto con servicios cubiertos
  requisitos_autorizacion TEXT,
  contacto_nombre VARCHAR(255),
  contacto_telefono VARCHAR(50),
  contacto_email VARCHAR(255),
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_convenios_tenant FOREIGN KEY (tenant_id) 
    REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- 2. TABLA CONVENIOS_DESCUENTOS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convenios_descuentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  servicio_id UUID, -- Referencia a tabla de servicios/tratamientos
  servicio_nombre VARCHAR(255),
  codigo_cups VARCHAR(50),
  porcentaje_descuento DECIMAL(5,2) DEFAULT 0.00,
  valor_fijo DECIMAL(12,2) DEFAULT 0.00,
  tipo_descuento VARCHAR(20) DEFAULT 'PORCENTAJE', -- PORCENTAJE o VALOR_FIJO
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_convenios_descuentos_convenio FOREIGN KEY (convenio_id) 
    REFERENCES public.convenios(id) ON DELETE CASCADE,
  CONSTRAINT fk_convenios_descuentos_tenant FOREIGN KEY (tenant_id) 
    REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- 3. ÍNDICES PARA PERFORMANCE
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_convenios_tenant_id ON public.convenios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_convenios_activo ON public.convenios(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_convenios_tipo ON public.convenios(tipo);

CREATE INDEX IF NOT EXISTS idx_convenios_descuentos_convenio_id ON public.convenios_descuentos(convenio_id);
CREATE INDEX IF NOT EXISTS idx_convenios_descuentos_tenant_id ON public.convenios_descuentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_convenios_descuentos_activo ON public.convenios_descuentos(activo) WHERE activo = true;

-- -------------------------------------------------------
-- 4. TRIGGER PARA UPDATED_AT
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_convenios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_convenios_updated_at ON public.convenios;
CREATE TRIGGER trigger_convenios_updated_at
  BEFORE UPDATE ON public.convenios
  FOR EACH ROW
  EXECUTE FUNCTION update_convenios_updated_at();

DROP TRIGGER IF EXISTS trigger_convenios_descuentos_updated_at ON public.convenios_descuentos;
CREATE TRIGGER trigger_convenios_descuentos_updated_at
  BEFORE UPDATE ON public.convenios_descuentos
  FOR EACH ROW
  EXECUTE FUNCTION update_convenios_updated_at();

-- -------------------------------------------------------
-- 5. POLÍTICAS RLS (Row Level Security)
-- -------------------------------------------------------
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenios_descuentos ENABLE ROW LEVEL SECURITY;

-- Política para convenios
DROP POLICY IF EXISTS "Users can view convenios from their tenant" ON public.convenios;
CREATE POLICY "Users can view convenios from their tenant" ON public.convenios
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert convenios for their tenant" ON public.convenios;
CREATE POLICY "Users can insert convenios for their tenant" ON public.convenios
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update convenios from their tenant" ON public.convenios;
CREATE POLICY "Users can update convenios from their tenant" ON public.convenios
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete convenios from their tenant" ON public.convenios;
CREATE POLICY "Users can delete convenios from their tenant" ON public.convenios
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Política para convenios_descuentos
DROP POLICY IF EXISTS "Users can view descuentos from their tenant" ON public.convenios_descuentos;
CREATE POLICY "Users can view descuentos from their tenant" ON public.convenios_descuentos
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert descuentos for their tenant" ON public.convenios_descuentos;
CREATE POLICY "Users can insert descuentos for their tenant" ON public.convenios_descuentos
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update descuentos from their tenant" ON public.convenios_descuentos;
CREATE POLICY "Users can update descuentos from their tenant" ON public.convenios_descuentos
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete descuentos from their tenant" ON public.convenios_descuentos;
CREATE POLICY "Users can delete descuentos from their tenant" ON public.convenios_descuentos
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 6. DATOS DE EJEMPLO (OPCIONAL - Comentados)
-- -------------------------------------------------------
/*
-- Ejemplo de convenio EPS
INSERT INTO public.convenios (tenant_id, nombre, nombre_corto, tipo, nit, porcentaje_descuento, activo)
VALUES (
  'a8eecbc9-9c0b-4ef8-bb68-6db9bd348a11', -- Reemplazar con tenant_id real
  'EPS Sura',
  'SURA',
  'EPS',
  '800088702',
  10.00,
  true
);

-- Ejemplo de convenio Prepagada
INSERT INTO public.convenios (tenant_id, nombre, nombre_corto, tipo, nit, porcentaje_descuento, activo)
VALUES (
  'a8eecbc9-9c0b-4ef8-bb68-6db9bd348a11',
  'Colsanitas Medicina Prepagada',
  'COLSANITAS',
  'Prepagada',
  '800251440',
  15.00,
  true
);
*/

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

