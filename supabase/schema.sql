-- =======================================================
-- ODONTOCLOUD MULTI-TENANT DATABASE SCHEMA FOR SUPABASE
-- SEGURIDAD AVANZADA (ANTI-HACKEOS / RLS BLINDADO)
-- =======================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------
-- 1. NÚCLEO MULTI-TENANT (CLÍNICAS / IPS)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nit TEXT,
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,
  logo_url TEXT,
  plan TEXT DEFAULT 'free',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 2. PERFILES DE USUARIO (Extensión de auth.users)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'odontologo', -- 'superadmin', 'admin', 'odontologo', 'recepcionista'
  especialidad TEXT,
  registro_medico TEXT,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Función helper SECURITY DEFINER para obtener el tenant_id de forma blindada
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Función helper para verificar si un usuario es superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'superadmin' OR email = 'madridsystem@outlook.es')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- -------------------------------------------------------
-- 3. INFRAESTRUCTURA DE LA CLÍNICA
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consultorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 4. PACIENTES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tipo_documento TEXT NOT NULL,
  documento TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  fecha_nacimiento DATE,
  genero TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  ciudad TEXT,
  ocupacion TEXT,
  eps TEXT,
  tipo_afiliacion TEXT,
  historial_medico JSONB DEFAULT '{}'::jsonb,
  contacto_emergencia JSONB DEFAULT '{}'::jsonb,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_paciente_documento_tenant UNIQUE (tenant_id, documento)
);

-- -------------------------------------------------------
-- 5. AGENDA Y CITAS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  profesional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  consultorio_id UUID REFERENCES public.consultorios(id) ON DELETE SET NULL,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  estado TEXT DEFAULT 'programada', -- 'programada', 'confirmada', 'en_atencion', 'completada', 'cancelada'
  motivo TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 6. HISTORIA CLÍNICA Y ODONTOGRAMA
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  profesional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT now(),
  diagnostico TEXT,
  tratamiento TEXT,
  notas TEXT,
  procedimiento_cups TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.odontogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  fecha TIMESTAMPTZ DEFAULT now(),
  hallazgos JSONB DEFAULT '{}'::jsonb,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  estado TEXT DEFAULT 'borrador', -- 'borrador', 'aprobado', 'en_proceso', 'finalizado'
  total NUMERIC(12,2) DEFAULT 0,
  detalles JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 7. FACTURACIÓN, PAGOS Y RIPS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consecutivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL, -- 'factura', 'recibo', 'nota_credito', 'nota_debito'
  prefijo TEXT DEFAULT '',
  ultimo_numero INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_consecutivo_tenant_tipo UNIQUE (tenant_id, tipo)
);

CREATE TABLE IF NOT EXISTS public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0,
  impuestos NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'pagada', 'anulada'
  fecha_emision TIMESTAMPTZ DEFAULT now(),
  detalles JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  factura_id UUID REFERENCES public.facturas(id) ON DELETE SET NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  monto NUMERIC(12,2) NOT NULL,
  metodo TEXT NOT NULL, -- 'efectivo', 'tarjeta', 'transferencia', 'saldo_favor'
  referencia TEXT,
  fecha TIMESTAMPTZ DEFAULT now(),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recibos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  concepto TEXT,
  fecha TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notas_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  factura_id UUID REFERENCES public.facturas(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  motivo TEXT,
  fecha TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notas_debito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  factura_id UUID REFERENCES public.facturas(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  motivo TEXT,
  fecha TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saldos_favor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  monto NUMERIC(12,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  profesional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  periodo TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rips_archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre_archivo TEXT NOT NULL,
  periodo TEXT,
  url TEXT,
  detalles JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 8. INVENTARIO Y CATÁLOGOS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  codigo TEXT,
  categoria TEXT,
  cantidad INT DEFAULT 0,
  minimo_stock INT DEFAULT 5,
  precio_costo NUMERIC(12,2) DEFAULT 0,
  precio_venta NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listas_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalogo_procedimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  codigo_cups TEXT,
  nombre TEXT NOT NULL,
  precio_base NUMERIC(12,2) DEFAULT 0,
  categoria TEXT
);

CREATE TABLE IF NOT EXISTS public.bancos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_cuenta TEXT,
  numero_cuenta TEXT,
  titular TEXT,
  logo_url TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  codigo TEXT,
  nombre TEXT NOT NULL,
  tipo TEXT
);

CREATE TABLE IF NOT EXISTS public.website_config (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  config JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 9. ÍNDICES DE RENDIMIENTO Y BÚSQUEDA
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_tenant ON public.pacientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_doc ON public.pacientes(tenant_id, documento);
CREATE INDEX IF NOT EXISTS idx_citas_tenant_fecha ON public.citas(tenant_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON public.citas(tenant_id, paciente_id);
CREATE INDEX IF NOT EXISTS idx_evoluciones_paciente ON public.evoluciones(tenant_id, paciente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant ON public.facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventario_tenant ON public.inventario(tenant_id);

-- -------------------------------------------------------
-- 10. POLÍTICAS DE SEGURIDAD ESTRICTAS (RLS BLINDADO)
-- -------------------------------------------------------

-- Habilitar RLS en absolutamente todas las tablas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consecutivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_debito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldos_favor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rips_archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_procedimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_config ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas antiguas si existen
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 10.1 Políticas para PROFILES (Evita que un usuario altere el tenant_id de otro)
CREATE POLICY "Profiles select" ON public.profiles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id() OR id = auth.uid() OR public.is_superadmin());

CREATE POLICY "Profiles insert" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR public.is_superadmin());

CREATE POLICY "Profiles update" ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_superadmin())
  WITH CHECK (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());

CREATE POLICY "Profiles delete" ON public.profiles FOR DELETE
  USING (public.is_superadmin());

-- 10.2 Políticas para TENANTS (Solo ver e interactuar con su clínica asignada)
CREATE POLICY "Tenants select" ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id() OR public.is_superadmin());

CREATE POLICY "Tenants insert" ON public.tenants FOR INSERT
  WITH CHECK (public.is_superadmin() OR auth.role() = 'authenticated');

CREATE POLICY "Tenants update" ON public.tenants FOR UPDATE
  USING (id = public.get_user_tenant_id() OR public.is_superadmin());

CREATE POLICY "Tenants delete" ON public.tenants FOR DELETE
  USING (public.is_superadmin());

-- 10.3 Generación de Políticas RLS Estrictas para todas las entidades con tenant_id
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'sucursales', 'consultorios', 'pacientes', 'citas', 'evoluciones', 
    'odontogramas', 'treatment_plans', 'consecutivos', 'facturas', 'pagos', 
    'recibos_caja', 'notas_credito', 'notas_debito', 'saldos_favor', 
    'liquidaciones', 'rips_archivos', 'inventario', 'listas_precios', 
    'catalogo_procedimientos', 'bancos', 'entidades', 'website_config'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- SELECT: Solo ver datos de tu clínica o si eres Superadmin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());',
      tbl || '_select_policy', tbl
    );
    
    -- INSERT: Impide inyectar datos pertenecientes a otra clínica
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());',
      tbl || '_insert_policy', tbl
    );

    -- UPDATE: Impide transferir registros entre clínicas cambiando tenant_id
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin()) WITH CHECK (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());',
      tbl || '_update_policy', tbl
    );

    -- DELETE: Solo borrar registros de tu propia clínica
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin());',
      tbl || '_delete_policy', tbl
    );
  END LOOP;
END $$;

-- 10.4 Política Pública de Lectura para Configuración del Sitio Web (Planes y CMS)
DROP POLICY IF EXISTS "website_config_select_policy" ON public.website_config;
CREATE POLICY "Website config public select" ON public.website_config FOR SELECT USING (true);

-- -------------------------------------------------------
-- 11. BUCKET DE ALMACENAMIENTO (STORAGE RLS POLICIES)
-- -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('adjuntos', 'adjuntos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Storage select adjuntos" ON storage.objects;
DROP POLICY IF EXISTS "Storage insert adjuntos" ON storage.objects;
DROP POLICY IF EXISTS "Storage update adjuntos" ON storage.objects;
DROP POLICY IF EXISTS "Storage delete adjuntos" ON storage.objects;

CREATE POLICY "Storage select adjuntos" ON storage.objects FOR SELECT
  USING (bucket_id = 'adjuntos');

CREATE POLICY "Storage insert adjuntos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'adjuntos' AND auth.role() = 'authenticated');

CREATE POLICY "Storage update adjuntos" ON storage.objects FOR UPDATE
  USING (bucket_id = 'adjuntos' AND auth.role() = 'authenticated');

CREATE POLICY "Storage delete adjuntos" ON storage.objects FOR DELETE
  USING (bucket_id = 'adjuntos' AND auth.role() = 'authenticated');
