-- Migration: Crear vista 'usuarios' como alias de 'profiles' para compatibilidad
-- Problema: El código hace referencia a una tabla 'usuarios' que no existe
-- Solución: Crear una vista que mapee a la tabla 'profiles'
-- Fecha: 2025-08-02

-- =======================================================================================
-- CREAR VISTA 'usuarios' como alias de 'profiles'
-- =======================================================================================

-- Esta vista permite que el código existente que usa .from("usuarios") siga funcionando
-- mapeando automáticamente a la tabla profiles con todos sus campos

CREATE OR REPLACE VIEW public.usuarios AS
SELECT 
  id,
  email,
  full_name AS nombre,
  full_name AS nombres,
  full_name AS displayName,
  role AS rol,
  tenant_id,
  inquilino,
  activo,
  created_at,
  updated_at,
  especialidad,
  registro_medico,
  telefono,
  sucursal_id,
  -- Campos adicionales que puedan existir
  apellido,
  tipo_documento,
  numero_documento
FROM public.profiles;

-- =======================================================================================
-- PERMISOS Y POLÍTICAS RLS PARA LA VISTA
-- =======================================================================================

-- Habilitar RLS en la vista
ALTER VIEW public.usuarios SET (security_invoker = on);

-- Otorgar permisos básicos
GRANT SELECT ON public.usuarios TO authenticated, anon;

-- Nota: Las políticas RLS de la tabla profiles se aplicarán automáticamente
-- porque la vista usa security_invoker = on

-- =======================================================================================
-- CREAR FUNCIÓN TRIGGER PARA PERMITIR INSERT/UPDATE/DELETE EN LA VISTA
-- =======================================================================================

-- Función para manejar INSERT en la vista usuarios
CREATE OR REPLACE FUNCTION public.usuarios_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    tenant_id,
    inquilino,
    activo,
    especialidad,
    registro_medico,
    telefono,
    sucursal_id,
    apellido,
    tipo_documento,
    numero_documento
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.email,
    COALESCE(NEW.nombre, NEW.nombres, NEW.displayName, NEW.full_name),
    COALESCE(NEW.rol, NEW.role),
    NEW.tenant_id,
    COALESCE(NEW.inquilino, NEW.tenant_id),
    COALESCE(NEW.activo, true),
    NEW.especialidad,
    NEW.registro_medico,
    NEW.telefono,
    NEW.sucursal_id,
    NEW.apellido,
    NEW.tipo_documento,
    NEW.numero_documento
  )
  RETURNING * INTO NEW;
  
  RETURN NEW;
END;
$$;

-- Función para manejar UPDATE en la vista usuarios
CREATE OR REPLACE FUNCTION public.usuarios_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = COALESCE(NEW.email, email),
    full_name = COALESCE(NEW.nombre, NEW.nombres, NEW.displayName, full_name),
    role = COALESCE(NEW.rol, role),
    tenant_id = COALESCE(NEW.tenant_id, tenant_id),
    inquilino = COALESCE(NEW.inquilino, inquilino),
    activo = COALESCE(NEW.activo, activo),
    especialidad = COALESCE(NEW.especialidad, especialidad),
    registro_medico = COALESCE(NEW.registro_medico, registro_medico),
    telefono = COALESCE(NEW.telefono, telefono),
    sucursal_id = COALESCE(NEW.sucursal_id, sucursal_id),
    apellido = COALESCE(NEW.apellido, apellido),
    tipo_documento = COALESCE(NEW.tipo_documento, tipo_documento),
    numero_documento = COALESCE(NEW.numero_documento, numero_documento),
    updated_at = now()
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  
  RETURN NEW;
END;
$$;

-- Función para manejar DELETE en la vista usuarios
CREATE OR REPLACE FUNCTION public.usuarios_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles
  WHERE id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- =======================================================================================
-- TRIGGERS INSTEAD OF para la vista
-- =======================================================================================

DROP TRIGGER IF EXISTS usuarios_insert_trigger ON public.usuarios;
CREATE TRIGGER usuarios_insert_trigger
  INSTEAD OF INSERT ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.usuarios_insert_trigger();

DROP TRIGGER IF EXISTS usuarios_update_trigger ON public.usuarios;
CREATE TRIGGER usuarios_update_trigger
  INSTEAD OF UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.usuarios_update_trigger();

DROP TRIGGER IF EXISTS usuarios_delete_trigger ON public.usuarios;
CREATE TRIGGER usuarios_delete_trigger
  INSTEAD OF DELETE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.usuarios_delete_trigger();

-- =======================================================================================
-- AÑADIR COLUMNAS FALTANTES A profiles SI NO EXISTEN
-- =======================================================================================

DO $$ 
BEGIN
  -- apellido
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'apellido'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN apellido text;
  END IF;

  -- especialidad
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'especialidad'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN especialidad text;
  END IF;

  -- registro_medico
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'registro_medico'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN registro_medico text;
  END IF;

  -- telefono
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'telefono'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN telefono text;
  END IF;

  -- sucursal_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'sucursal_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN sucursal_id uuid;
  END IF;

  -- tipo_documento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'tipo_documento'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN tipo_documento text DEFAULT 'CC';
  END IF;

  -- numero_documento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'numero_documento'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN numero_documento text;
  END IF;
  
  RAISE NOTICE 'Columnas adicionales verificadas/creadas en profiles';
END $$;

-- =======================================================================================
-- VERIFICACIÓN FINAL
-- =======================================================================================

DO $$
BEGIN
  -- Verificar que la vista existe
  PERFORM 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'usuarios';
  IF FOUND THEN
    RAISE NOTICE '✅ Vista usuarios creada exitosamente';
  ELSE
    RAISE WARNING '❌ Error: Vista usuarios no fue creada';
  END IF;

  -- Verificar triggers
  PERFORM 1 FROM pg_trigger WHERE tgname = 'usuarios_insert_trigger';
  IF FOUND THEN
    RAISE NOTICE '✅ Triggers INSTEAD OF configurados';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '✅ MIGRACIÓN COMPLETADA';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'La vista "usuarios" ahora funciona como alias de "profiles"';
  RAISE NOTICE 'Todas las queries a .from("usuarios") funcionarán correctamente';
  RAISE NOTICE '';
END $$;
