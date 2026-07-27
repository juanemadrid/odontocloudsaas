-- Migración: Agregar campos completos a la tabla pacientes
-- Fecha: 2025-01-27
-- Descripción: Expande el esquema de pacientes para incluir TODOS los campos del formulario

-- Agregar campos de identificación adicionales
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS nro_historia TEXT,
ADD COLUMN IF NOT EXISTS fecha_ingreso DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS estado_civil TEXT,
ADD COLUMN IF NOT EXISTS es_extranjero BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permite_publicidad BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS registro_completo BOOLEAN DEFAULT true;

-- Agregar campos de ubicación y contacto
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS pais_nacimiento TEXT DEFAULT 'Colombia',
ADD COLUMN IF NOT EXISTS ciudad_nacimiento TEXT,
ADD COLUMN IF NOT EXISTS pais_domicilio TEXT DEFAULT 'Colombia',
ADD COLUMN IF NOT EXISTS ciudad_domicilio TEXT,
ADD COLUMN IF NOT EXISTS barrio TEXT,
ADD COLUMN IF NOT EXISTS lugar_residencia TEXT,
ADD COLUMN IF NOT EXISTS estrato TEXT,
ADD COLUMN IF NOT EXISTS zona_residencial TEXT DEFAULT 'Urbana',
ADD COLUMN IF NOT EXISTS prefijo_celular TEXT DEFAULT '+57',
ADD COLUMN IF NOT EXISTS telefono_domicilio TEXT,
ADD COLUMN IF NOT EXISTS telefono_oficina TEXT,
ADD COLUMN IF NOT EXISTS extension TEXT;

-- Agregar campos de EPS y aseguramiento
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS poliza_salud TEXT,
ADD COLUMN IF NOT EXISTS plan_id TEXT,
ADD COLUMN IF NOT EXISTS plan_nombre TEXT;

-- Agregar campos de marketing
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS convenio_beneficio TEXT,
ADD COLUMN IF NOT EXISTS convenio_pago TEXT,
ADD COLUMN IF NOT EXISTS como_conocio TEXT,
ADD COLUMN IF NOT EXISTS campania TEXT,
ADD COLUMN IF NOT EXISTS remitido_por_type TEXT DEFAULT 'Libre',
ADD COLUMN IF NOT EXISTS remitido_por_value TEXT,
ADD COLUMN IF NOT EXISTS asesor_comercial_type TEXT DEFAULT 'Libre',
ADD COLUMN IF NOT EXISTS asesor_comercial_value TEXT;

-- Agregar campos de profesional asignado
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS profesional_id TEXT,
ADD COLUMN IF NOT EXISTS profesional_nombre TEXT;

-- Agregar campos de responsable
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS nombre_responsable TEXT,
ADD COLUMN IF NOT EXISTS parentesco TEXT,
ADD COLUMN IF NOT EXISTS celular_responsable TEXT,
ADD COLUMN IF NOT EXISTS telefono_responsable TEXT,
ADD COLUMN IF NOT EXISTS email_responsable TEXT;

-- Agregar campos de acompañante
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS nombre_acompanante TEXT,
ADD COLUMN IF NOT EXISTS telefono_acompanante TEXT;

-- Agregar campos de alertas y notas
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS alertas TEXT,
ADD COLUMN IF NOT EXISTS notas TEXT;

-- Agregar campo de foto
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Agregar campo de última actualización
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Crear índices para mejorar el rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_pacientes_barrio ON public.pacientes(barrio);
CREATE INDEX IF NOT EXISTS idx_pacientes_estado_civil ON public.pacientes(estado_civil);
CREATE INDEX IF NOT EXISTS idx_pacientes_ciudad_domicilio ON public.pacientes(ciudad_domicilio);
CREATE INDEX IF NOT EXISTS idx_pacientes_profesional_id ON public.pacientes(profesional_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_updated_at ON public.pacientes(updated_at);

-- Comentarios para documentar las columnas
COMMENT ON COLUMN public.pacientes.barrio IS 'Barrio de residencia del paciente';
COMMENT ON COLUMN public.pacientes.estado_civil IS 'Estado civil del paciente';
COMMENT ON COLUMN public.pacientes.nombre_responsable IS 'Nombre completo del responsable del paciente';
COMMENT ON COLUMN public.pacientes.nombre_acompanante IS 'Nombre completo del acompañante del paciente';
COMMENT ON COLUMN public.pacientes.alertas IS 'Alertas médicas importantes (alergias, condiciones)';
COMMENT ON COLUMN public.pacientes.notas IS 'Notas adicionales sobre el paciente';
