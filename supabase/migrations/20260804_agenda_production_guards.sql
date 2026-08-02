-- Final production guards for agenda schedules and appointments.
-- This migration is intentionally additive and safe after 20260801-20260803.

BEGIN;

-- New rows must point to entities from the canonical tables. NOT VALID keeps
-- legacy rows deployable while still enforcing the constraint for new writes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.horarios_predefinidos'::regclass
      AND conname = 'horarios_predefinidos_usuario_fk'
  ) THEN
    ALTER TABLE public.horarios_predefinidos
      ADD CONSTRAINT horarios_predefinidos_usuario_fk
      FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.horarios_predefinidos'::regclass
      AND conname = 'horarios_predefinidos_consultorio_fk'
  ) THEN
    ALTER TABLE public.horarios_predefinidos
      ADD CONSTRAINT horarios_predefinidos_consultorio_fk
      FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.agenda_abierta'::regclass
      AND conname = 'agenda_abierta_usuario_fk'
  ) THEN
    ALTER TABLE public.agenda_abierta
      ADD CONSTRAINT agenda_abierta_usuario_fk
      FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.agenda_abierta'::regclass
      AND conname = 'agenda_abierta_consultorio_fk'
  ) THEN
    ALTER TABLE public.agenda_abierta
      ADD CONSTRAINT agenda_abierta_consultorio_fk
      FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.no_disponibles'::regclass
      AND conname = 'no_disponibles_usuario_fk'
  ) THEN
    ALTER TABLE public.no_disponibles
      ADD CONSTRAINT no_disponibles_usuario_fk
      FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.no_disponibles'::regclass
      AND conname = 'no_disponibles_consultorio_fk'
  ) THEN
    ALTER TABLE public.no_disponibles
      ADD CONSTRAINT no_disponibles_consultorio_fk
      FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE CASCADE NOT VALID;
  END IF;
END;
$$;

-- A tenant administrator cannot attach another tenant's professional or room
-- to a row even if they know its UUID.
CREATE OR REPLACE FUNCTION public.enforce_schedule_entity_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.usuario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = NEW.usuario_id
      AND profile.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'El profesional no pertenece a la clínica seleccionada.';
  END IF;

  IF NEW.consultorio_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.consultorios AS room
    WHERE room.id = NEW.consultorio_id
      AND room.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'El consultorio no pertenece a la clínica seleccionada.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_schedule_entity_tenant() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  schedule_table text;
BEGIN
  FOREACH schedule_table IN ARRAY ARRAY['horarios_predefinidos', 'agenda_abierta', 'no_disponibles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', schedule_table || '_entity_tenant', schedule_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF tenant_id, usuario_id, consultorio_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_schedule_entity_tenant()',
      schedule_table || '_entity_tenant',
      schedule_table
    );
  END LOOP;
END;
$$;

-- Remove every legacy permissive policy. PostgreSQL combines permissive
-- policies with OR, so leaving even one old policy would bypass admin-only
-- schedule writes.
DO $$
DECLARE
  schedule_table text;
  policy_record record;
BEGIN
  FOREACH schedule_table IN ARRAY ARRAY['horarios_predefinidos', 'agenda_abierta', 'no_disponibles'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', schedule_table);

    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = schedule_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, schedule_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_active_user() AND (tenant_id = public.get_user_tenant_id() OR public.is_superadmin()))',
      schedule_table || '_tenant_select',
      schedule_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_tenant_admin() AND (tenant_id = public.get_user_tenant_id() OR public.is_superadmin())) WITH CHECK (public.is_tenant_admin() AND (tenant_id = public.get_user_tenant_id() OR public.is_superadmin()))',
      schedule_table || '_tenant_manage',
      schedule_table
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', schedule_table);
  END LOOP;
END;
$$;

-- The public RPC checks entity ownership/activity before applying the shared
-- interval, block and conflict rules from the previous migration.
CREATE OR REPLACE FUNCTION public.check_appointment_availability(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_room_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_active_user() OR (
    p_tenant_id IS DISTINCT FROM public.get_user_tenant_id() AND NOT public.is_superadmin()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'No tiene permiso para consultar esta agenda.');
  END IF;

  IF p_tenant_id IS NULL OR p_professional_id IS NULL OR p_room_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUIRED_ASSIGNMENT', 'message', 'Debe seleccionar un profesional y un consultorio.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_professional_id
      AND profile.tenant_id = p_tenant_id
      AND profile.activo IS TRUE
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PROFESSIONAL', 'message', 'El profesional no está activo o no pertenece a esta clínica.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.consultorios AS room
    WHERE room.id = p_room_id
      AND room.tenant_id = p_tenant_id
      AND room.activo IS TRUE
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ROOM', 'message', 'El consultorio no está activo o no pertenece a esta clínica.');
  END IF;

  RETURN public._appointment_availability_result(
    p_tenant_id, p_professional_id, p_room_id, p_start, p_end, p_exclude_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_appointment_availability(uuid, uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_appointment_availability(uuid, uuid, uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- Status/notes updates on legacy appointments remain possible. New or moved
-- appointments, and reactivation of a cancelled appointment, are validated.
CREATE OR REPLACE FUNCTION public.enforce_appointment_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  normalized_state text;
  normalized_old_state text;
  schedule_changed boolean := true;
BEGIN
  normalized_state := translate(lower(coalesce(NEW.estado, '')), 'áéíóú', 'aeiou');

  IF TG_OP = 'UPDATE' THEN
    normalized_old_state := translate(lower(coalesce(OLD.estado, '')), 'áéíóú', 'aeiou');
    schedule_changed := NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.profesional_id IS DISTINCT FROM OLD.profesional_id
      OR NEW.consultorio_id IS DISTINCT FROM OLD.consultorio_id
      OR NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
      OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin;

    IF NOT schedule_changed AND NOT (
      normalized_old_state IN ('cancelada', 'cancelado', 'cancelled')
      AND normalized_state NOT IN ('cancelada', 'cancelado', 'cancelled')
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.tenant_id IS NULL OR NEW.profesional_id IS NULL OR NEW.consultorio_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Debe seleccionar un profesional y un consultorio.',
      DETAIL = 'REQUIRED_ASSIGNMENT';
  END IF;

  IF normalized_state IN ('cancelada', 'cancelado', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = NEW.profesional_id
      AND profile.tenant_id = NEW.tenant_id
      AND profile.activo IS TRUE
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'El profesional no está activo o no pertenece a esta clínica.',
      DETAIL = 'INVALID_PROFESSIONAL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.consultorios AS room
    WHERE room.id = NEW.consultorio_id
      AND room.tenant_id = NEW.tenant_id
      AND room.activo IS TRUE
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'El consultorio no está activo o no pertenece a esta clínica.',
      DETAIL = 'INVALID_ROOM';
  END IF;

  -- Consistent lock order prevents concurrent bookings from racing.
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda:professional:' || NEW.tenant_id::text || ':' || NEW.profesional_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda:room:' || NEW.tenant_id::text || ':' || NEW.consultorio_id::text, 0));

  result := public._appointment_availability_result(
    NEW.tenant_id,
    NEW.profesional_id,
    NEW.consultorio_id,
    NEW.fecha_inicio,
    NEW.fecha_fin,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END
  );

  IF NOT coalesce((result ->> 'ok')::boolean, false) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = result ->> 'message',
      DETAIL = result ->> 'code';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_appointment_availability() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_schedule_entity_tenant()
  IS 'Prevents cross-tenant professional or room references in schedule tables.';
COMMENT ON FUNCTION public.check_appointment_availability(uuid, uuid, uuid, timestamptz, timestamptz, uuid)
  IS 'Authoritative tenant-aware availability check for active professionals and rooms.';

NOTIFY pgrst, 'reload schema';

COMMIT;
