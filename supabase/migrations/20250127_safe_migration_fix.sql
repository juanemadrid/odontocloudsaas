-- ===============================================================
-- MIGRACIÓN SEGURA - CORREGIR CONFLICTOS
-- Fecha: 2025-01-27
-- Descripción: Migración segura que verifica tablas existentes
-- ===============================================================

-- Verificar si la tabla pacientes ya existe y tiene las columnas necesarias
DO $$
BEGIN
  -- Agregar columnas a pacientes solo si no existen
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'barrio') THEN
    ALTER TABLE public.pacientes ADD COLUMN barrio TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'estado_civil') THEN
    ALTER TABLE public.pacientes ADD COLUMN estado_civil TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'nombre_responsable') THEN
    ALTER TABLE public.pacientes ADD COLUMN nombre_responsable TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'alertas') THEN
    ALTER TABLE public.pacientes ADD COLUMN alertas TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'notas') THEN
    ALTER TABLE public.pacientes ADD COLUMN notas TEXT;
  END IF;
  
  -- Agregar resto de columnas importantes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'pais_nacimiento') THEN
    ALTER TABLE public.pacientes ADD COLUMN pais_nacimiento TEXT DEFAULT 'Colombia';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'ciudad_nacimiento') THEN
    ALTER TABLE public.pacientes ADD COLUMN ciudad_nacimiento TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'pais_domicilio') THEN
    ALTER TABLE public.pacientes ADD COLUMN pais_domicilio TEXT DEFAULT 'Colombia';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'ciudad_domicilio') THEN
    ALTER TABLE public.pacientes ADD COLUMN ciudad_domicilio TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'lugar_residencia') THEN
    ALTER TABLE public.pacientes ADD COLUMN lugar_residencia TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'estrato') THEN
    ALTER TABLE public.pacientes ADD COLUMN estrato TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'zona_residencial') THEN
    ALTER TABLE public.pacientes ADD COLUMN zona_residencial TEXT DEFAULT 'Urbana';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'prefijo_celular') THEN
    ALTER TABLE public.pacientes ADD COLUMN prefijo_celular TEXT DEFAULT '+57';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'telefono_responsable') THEN
    ALTER TABLE public.pacientes ADD COLUMN telefono_responsable TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'celular_responsable') THEN
    ALTER TABLE public.pacientes ADD COLUMN celular_responsable TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'email_responsable') THEN
    ALTER TABLE public.pacientes ADD COLUMN email_responsable TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'parentesco') THEN
    ALTER TABLE public.pacientes ADD COLUMN parentesco TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'nombre_acompanante') THEN
    ALTER TABLE public.pacientes ADD COLUMN nombre_acompanante TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'telefono_acompanante') THEN
    ALTER TABLE public.pacientes ADD COLUMN telefono_acompanante TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'foto_url') THEN
    ALTER TABLE public.pacientes ADD COLUMN foto_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'updated_at') THEN
    ALTER TABLE public.pacientes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
  
END $$;

-- Crear tabla de catálogo de barrios si no existe
CREATE TABLE IF NOT EXISTS public.barrios_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  ciudad TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_barrio_nombre UNIQUE (tenant_id, nombre)
);

-- Crear tabla de catálogo de EPS si no existe
CREATE TABLE IF NOT EXISTS public.eps_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  codigo TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_eps_nombre UNIQUE (tenant_id, nombre)
);

-- Crear tabla de profesionales si no existe
CREATE TABLE IF NOT EXISTS public.profesionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre_completo TEXT NOT NULL,
  especialidad TEXT,
  telefono TEXT,
  email TEXT,
  registro_medico TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla de configuración de formularios si no existe
CREATE TABLE IF NOT EXISTS public.configuracion_formularios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tipo_formulario TEXT NOT NULL,
  configuracion JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_config_formulario UNIQUE (tenant_id, tipo_formulario)
);

-- Crear índices solo si no existen
DO $$
BEGIN
  -- Índices para pacientes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pacientes_barrio') THEN
    CREATE INDEX idx_pacientes_barrio ON public.pacientes(barrio);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pacientes_estado_civil') THEN
    CREATE INDEX idx_pacientes_estado_civil ON public.pacientes(estado_civil);
  END IF;
  
  -- Índices para barrios_catalogo
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_barrios_tenant') THEN
    CREATE INDEX idx_barrios_tenant ON public.barrios_catalogo(tenant_id);
  END IF;
  
  -- Índices para eps_catalogo
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_eps_tenant') THEN
    CREATE INDEX idx_eps_tenant ON public.eps_catalogo(tenant_id);
  END IF;
  
  -- Índices para profesionales
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profesionales_tenant') THEN
    CREATE INDEX idx_profesionales_tenant ON public.profesionales(tenant_id);
  END IF;
  
END $$;

-- Función para actualizar updated_at si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para pacientes si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_pacientes') THEN
    CREATE TRIGGER set_updated_at_pacientes 
    BEFORE UPDATE ON public.pacientes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Comentarios
COMMENT ON TABLE public.barrios_catalogo IS 'Catálogo de barrios por tenant';
COMMENT ON TABLE public.eps_catalogo IS 'Catálogo de EPS por tenant';  
COMMENT ON TABLE public.profesionales IS 'Profesionales de la salud por tenant';
COMMENT ON TABLE public.configuracion_formularios IS 'Configuración de formularios por tenant';

-- Verificación final
DO $$
BEGIN
  RAISE NOTICE 'Migración completada exitosamente';
  RAISE NOTICE 'Tablas verificadas: pacientes, barrios_catalogo, eps_catalogo, profesionales, configuracion_formularios';
END $$;