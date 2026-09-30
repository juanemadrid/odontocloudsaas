-- ==============================================================================
-- Migración: Asegurar tablas de Terceros, Facturación Electrónica y RIPS
-- Fecha: 2026-09-30
-- Ejecutar en: Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. TABLA TERCEROS
CREATE TABLE IF NOT EXISTS public.terceros (
  id TEXT PRIMARY KEY,
  tenant_id UUID,
  nombre TEXT,
  apellidos TEXT,
  tipo_documento TEXT,
  "tipoDocumento" TEXT,
  nro_documento TEXT,
  "nroDocumento" TEXT,
  razon_social TEXT,
  "razonSocial" TEXT,
  telefono TEXT,
  pais TEXT DEFAULT 'Colombia',
  ciudad TEXT,
  direccion TEXT,
  codigo_postal TEXT,
  "codigoPostal" TEXT,
  email TEXT,
  cuenta_contable TEXT,
  "cuentaContable" TEXT,
  identificador_procedencia TEXT,
  "identificadorProcedencia" TEXT,
  responsabilidad_tributaria TEXT,
  "responsabilidadTributaria" TEXT,
  tipo_persona TEXT,
  "tipoPersona" TEXT,
  modalidad_pago TEXT,
  "modalidadPago" TEXT,
  contrato TEXT,
  is_eps BOOLEAN DEFAULT false,
  "isEps" BOOLEAN DEFAULT false,
  is_ips BOOLEAN DEFAULT false,
  "isIps" BOOLEAN DEFAULT false,
  codigo_entidad_administradora TEXT,
  "codigoEntidadAdministradora" TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para terceros
ALTER TABLE public.terceros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_terceros_policy" ON public.terceros;
CREATE POLICY "tenant_terceros_policy" ON public.terceros
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. TABLA FACTURAS_ELECTRONICAS
CREATE TABLE IF NOT EXISTS public.facturas_electronicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  numero TEXT,
  cufe TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  adquiriente JSONB,
  items JSONB,
  totales JSONB,
  dian_response JSONB,
  qr_url TEXT,
  xml_url TEXT,
  pdf_url TEXT,
  estado TEXT DEFAULT 'Aceptada',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.facturas_electronicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_facturas_electronicas_policy" ON public.facturas_electronicas;
CREATE POLICY "tenant_facturas_electronicas_policy" ON public.facturas_electronicas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. TABLA FACTURAS_VENTA
CREATE TABLE IF NOT EXISTS public.facturas_venta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  consecutivo TEXT,
  paciente_id UUID,
  tercero_id TEXT,
  total NUMERIC(12,2) DEFAULT 0,
  saldo_pendiente NUMERIC(12,2) DEFAULT 0,
  estado TEXT DEFAULT 'Emitida',
  detalles JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.facturas_venta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_facturas_venta_policy" ON public.facturas_venta;
CREATE POLICY "tenant_facturas_venta_policy" ON public.facturas_venta
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. TABLA RIPS_GENERADOS
CREATE TABLE IF NOT EXISTS public.rips_generados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  codigo_prestador TEXT,
  periodo TEXT,
  num_registros INTEGER DEFAULT 0,
  archivos JSONB,
  resultado_muv JSONB,
  estado TEXT DEFAULT 'Generado',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rips_generados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_rips_generados_policy" ON public.rips_generados;
CREATE POLICY "tenant_rips_generados_policy" ON public.rips_generados
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. RELOAD SCHEMA CACHE EN POSTGREST
NOTIFY pgrst, 'reload schema';
