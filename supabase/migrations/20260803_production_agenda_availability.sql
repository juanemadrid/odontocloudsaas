-- Production agenda availability: canonical schedules and database enforcement.
-- The database is authoritative; client-side checks only improve user feedback.

BEGIN;

ALTER TABLE public.horarios_predefinidos
  ADD COLUMN IF NOT EXISTS usuario_id uuid,
  ADD COLUMN IF NOT EXISTS consultorio_id uuid,
  ADD COLUMN IF NOT EXISTS dia text,
  ADD COLUMN IF NOT EXISTS recurso_nombre text,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.agenda_abierta
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS usuario_id uuid,
  ADD COLUMN IF NOT EXISTS consultorio_id uuid,
  ADD COLUMN IF NOT EXISTS fecha date,
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fin time,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.no_disponibles
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS usuario_id uuid,
  ADD COLUMN IF NOT EXISTS consultorio_id uuid,
  ADD COLUMN IF NOT EXISTS fecha date,
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fin time,
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Older deployments stored schedule times as text. Canonical TIME columns
-- make comparisons in the database availability function type-safe.
ALTER TABLE public.horarios_predefinidos
  ALTER COLUMN hora_inicio TYPE time USING nullif(hora_inicio::text, '')::time,
  ALTER COLUMN hora_fin TYPE time USING nullif(hora_fin::text, '')::time;

ALTER TABLE public.agenda_abierta
  ALTER COLUMN hora_inicio TYPE time USING nullif(hora_inicio::text, '')::time,
  ALTER COLUMN hora_fin TYPE time USING nullif(hora_fin::text, '')::time;

ALTER TABLE public.no_disponibles
  ALTER COLUMN hora_inicio TYPE time USING nullif(hora_inicio::text, '')::time,
  ALTER COLUMN hora_fin TYPE time USING nullif(hora_fin::text, '')::time;

-- Convert the original generic entity representation without deleting old data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'horarios_predefinidos' AND column_name = 'entidad_tipo'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'horarios_predefinidos' AND column_name = 'entidad_id'
  ) THEN
    EXECUTE $migration$
      UPDATE public.horarios_predefinidos
      SET usuario_id = CASE
            WHEN lower(coalesce(entidad_tipo, '')) IN ('profesional', 'doctor', 'odontologo', 'odontólogo', 'usuario')
              THEN entidad_id
            ELSE usuario_id
          END,
          consultorio_id = CASE
            WHEN lower(coalesce(entidad_tipo, '')) IN ('recurso', 'consultorio', 'sala')
              THEN entidad_id
            ELSE consultorio_id
          END
      WHERE usuario_id IS NULL AND consultorio_id IS NULL
    $migration$;

    ALTER TABLE public.horarios_predefinidos ALTER COLUMN entidad_tipo DROP NOT NULL;
    ALTER TABLE public.horarios_predefinidos ALTER COLUMN entidad_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'horarios_predefinidos' AND column_name = 'dia_semana'
  ) THEN
    EXECUTE $migration$
      UPDATE public.horarios_predefinidos
      SET dia = CASE dia_semana
        WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Lunes' WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miercoles' WHEN 4 THEN 'Jueves' WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sabado' ELSE dia
      END
      WHERE dia IS NULL
    $migration$;
    ALTER TABLE public.horarios_predefinidos ALTER COLUMN dia_semana DROP NOT NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_horarios_canonical_prof
  ON public.horarios_predefinidos (tenant_id, usuario_id, dia)
  WHERE activo IS TRUE;
CREATE INDEX IF NOT EXISTS idx_horarios_canonical_room
  ON public.horarios_predefinidos (tenant_id, consultorio_id, dia)
  WHERE activo IS TRUE;
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_prof
  ON public.agenda_abierta (tenant_id, usuario_id, fecha)
  WHERE activo IS TRUE;
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_room
  ON public.agenda_abierta (tenant_id, consultorio_id, fecha)
  WHERE activo IS TRUE;
CREATE INDEX IF NOT EXISTS idx_no_disponibles_prof
  ON public.no_disponibles (tenant_id, usuario_id, fecha)
  WHERE activo IS TRUE;
CREATE INDEX IF NOT EXISTS idx_no_disponibles_room
  ON public.no_disponibles (tenant_id, consultorio_id, fecha)
  WHERE activo IS TRUE;
CREATE INDEX IF NOT EXISTS idx_citas_agenda_conflicts
  ON public.citas (tenant_id, fecha_inicio, fecha_fin, profesional_id, consultorio_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'horarios_predefinidos_owner_required') THEN
    ALTER TABLE public.horarios_predefinidos
      ADD CONSTRAINT horarios_predefinidos_owner_required
      CHECK (usuario_id IS NOT NULL OR consultorio_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'horarios_predefinidos_valid_time') THEN
    ALTER TABLE public.horarios_predefinidos
      ADD CONSTRAINT horarios_predefinidos_valid_time
      CHECK (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio < hora_fin) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agenda_abierta_single_owner') THEN
    ALTER TABLE public.agenda_abierta
      ADD CONSTRAINT agenda_abierta_single_owner
      CHECK (num_nonnulls(usuario_id, consultorio_id) = 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agenda_abierta_valid_range') THEN
    ALTER TABLE public.agenda_abierta
      ADD CONSTRAINT agenda_abierta_valid_range
      CHECK (fecha IS NOT NULL AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio < hora_fin) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_disponibles_single_owner') THEN
    ALTER TABLE public.no_disponibles
      ADD CONSTRAINT no_disponibles_single_owner
      CHECK (num_nonnulls(usuario_id, consultorio_id) = 1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_disponibles_valid_range') THEN
    ALTER TABLE public.no_disponibles
      ADD CONSTRAINT no_disponibles_valid_range
      CHECK (fecha IS NOT NULL AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio < hora_fin) NOT VALID;
  END IF;
END;
$$;

-- Remove legacy plaintext passwords from extended user configuration.
UPDATE public.website_config AS wc
SET config = jsonb_set(
  wc.config::jsonb,
  '{user_details}',
  COALESCE((
    SELECT jsonb_object_agg(entry.key, entry.value - 'password')
    FROM jsonb_each(COALESCE(wc.config::jsonb -> 'user_details', '{}'::jsonb)) AS entry
  ), '{}'::jsonb),
  true
)
WHERE wc.config::jsonb ? 'user_details';
-- Users may read schedules for their tenant; only tenant administrators may mutate them.
DO $$
DECLARE
  schedule_table text;
BEGIN
  FOREACH schedule_table IN ARRAY ARRAY['horarios_predefinidos', 'agenda_abierta', 'no_disponibles'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', schedule_table || '_all', schedule_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', schedule_table || '_select', schedule_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', schedule_table || '_manage', schedule_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_active_user() AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin()))',
      schedule_table || '_select', schedule_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_tenant_admin() AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin())) WITH CHECK (public.is_tenant_admin() AND (tenant_id::text = public.get_user_tenant_id()::text OR public.is_superadmin()))',
      schedule_table || '_manage', schedule_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._appointment_availability_result(
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
DECLARE
  local_start timestamp;
  local_end timestamp;
  local_date date;
  local_start_time time;
  local_end_time time;
  day_number integer;
  professional_configured boolean;
  room_configured boolean;
  professional_has_open boolean;
  room_has_open boolean;
  professional_available boolean;
  room_available boolean;
BEGIN
  IF p_tenant_id IS NULL OR p_professional_id IS NULL OR p_room_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REQUIRED_ASSIGNMENT', 'message', 'Debe seleccionar un profesional y un consultorio.');
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_RANGE', 'message', 'El horario de inicio y fin de la cita no es valido.');
  END IF;

  local_start := timezone('America/Bogota', p_start);
  local_end := timezone('America/Bogota', p_end);
  IF local_start::date <> local_end::date THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CROSS_DAY_APPOINTMENT', 'message', 'La cita debe iniciar y terminar el mismo dia.');
  END IF;

  local_date := local_start::date;
  local_start_time := local_start::time;
  local_end_time := local_end::time;
  day_number := extract(dow FROM local_date)::integer;

  SELECT EXISTS (
    SELECT 1 FROM public.horarios_predefinidos h
    WHERE h.tenant_id = p_tenant_id AND h.usuario_id = p_professional_id AND h.activo IS TRUE
  ) OR EXISTS (
    SELECT 1 FROM public.agenda_abierta a
    WHERE a.tenant_id = p_tenant_id AND a.usuario_id = p_professional_id AND a.activo IS TRUE
  ) INTO professional_configured;
  IF NOT professional_configured THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PROFESSIONAL_SCHEDULE_REQUIRED', 'message', 'El profesional no tiene un horario de atencion configurado.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.horarios_predefinidos h
    WHERE h.tenant_id = p_tenant_id AND h.usuario_id IS NULL AND h.consultorio_id = p_room_id AND h.activo IS TRUE
  ) OR EXISTS (
    SELECT 1 FROM public.agenda_abierta a
    WHERE a.tenant_id = p_tenant_id AND a.usuario_id IS NULL AND a.consultorio_id = p_room_id AND a.activo IS TRUE
  ) INTO room_configured;
  IF NOT room_configured THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROOM_SCHEDULE_REQUIRED', 'message', 'El consultorio no tiene un horario de atencion configurado.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.agenda_abierta a
    WHERE a.tenant_id = p_tenant_id
      AND a.usuario_id = p_professional_id
      AND (a.consultorio_id IS NULL OR a.consultorio_id = p_room_id)
      AND a.fecha = local_date AND a.activo IS TRUE
  ) INTO professional_has_open;

  IF professional_has_open THEN
    SELECT EXISTS (
      SELECT 1 FROM public.agenda_abierta a
      WHERE a.tenant_id = p_tenant_id
        AND a.usuario_id = p_professional_id
        AND (a.consultorio_id IS NULL OR a.consultorio_id = p_room_id)
        AND a.fecha = local_date AND a.activo IS TRUE
        AND a.hora_inicio <= local_start_time AND a.hora_fin >= local_end_time
    ) INTO professional_available;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.horarios_predefinidos h
      WHERE h.tenant_id = p_tenant_id
        AND h.usuario_id = p_professional_id
        AND (h.consultorio_id IS NULL OR h.consultorio_id = p_room_id)
        AND h.activo IS TRUE
        AND CASE day_number
          WHEN 0 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'domingo'
          WHEN 1 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'lunes'
          WHEN 2 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'martes'
          WHEN 3 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'miercoles'
          WHEN 4 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'jueves'
          WHEN 5 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'viernes'
          WHEN 6 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'sabado'
        END
        AND h.hora_inicio <= local_start_time AND h.hora_fin >= local_end_time
    ) INTO professional_available;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.agenda_abierta a
    WHERE a.tenant_id = p_tenant_id AND a.usuario_id IS NULL
      AND a.consultorio_id = p_room_id AND a.fecha = local_date AND a.activo IS TRUE
  ) INTO room_has_open;

  IF room_has_open THEN
    SELECT EXISTS (
      SELECT 1 FROM public.agenda_abierta a
      WHERE a.tenant_id = p_tenant_id AND a.usuario_id IS NULL
        AND a.consultorio_id = p_room_id AND a.fecha = local_date AND a.activo IS TRUE
        AND a.hora_inicio <= local_start_time AND a.hora_fin >= local_end_time
    ) INTO room_available;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.horarios_predefinidos h
      WHERE h.tenant_id = p_tenant_id AND h.usuario_id IS NULL
        AND h.consultorio_id = p_room_id AND h.activo IS TRUE
        AND CASE day_number
          WHEN 0 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'domingo'
          WHEN 1 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'lunes'
          WHEN 2 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'martes'
          WHEN 3 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'miercoles'
          WHEN 4 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'jueves'
          WHEN 5 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'viernes'
          WHEN 6 THEN translate(lower(h.dia), 'áéíóú', 'aeiou') = 'sabado'
        END
        AND h.hora_inicio <= local_start_time AND h.hora_fin >= local_end_time
    ) INTO room_available;
  END IF;

  IF NOT professional_available OR NOT room_available THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OUTSIDE_COMMON_SCHEDULE', 'message', 'La cita debe quedar completamente dentro del horario coincidente del profesional y el consultorio.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.no_disponibles n
    WHERE n.tenant_id = p_tenant_id AND n.activo IS TRUE AND n.fecha = local_date
      AND (
        (n.usuario_id = p_professional_id AND (n.consultorio_id IS NULL OR n.consultorio_id = p_room_id))
        OR (n.usuario_id IS NULL AND n.consultorio_id = p_room_id)
      )
      AND n.hora_inicio < local_end_time AND n.hora_fin > local_start_time
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BLOCKED_SCHEDULE', 'message', 'El profesional o el consultorio tiene un bloqueo en este horario.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.citas c
    WHERE c.tenant_id = p_tenant_id
      AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
      AND c.fecha_inicio < p_end AND c.fecha_fin > p_start
      AND translate(lower(coalesce(c.estado, '')), 'áéíóú', 'aeiou') NOT IN ('cancelada', 'cancelado', 'cancelled')
      AND c.profesional_id = p_professional_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PROFESSIONAL_CONFLICT', 'message', 'El profesional ya tiene una cita que se cruza con este horario.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.citas c
    WHERE c.tenant_id = p_tenant_id
      AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
      AND c.fecha_inicio < p_end AND c.fecha_fin > p_start
      AND translate(lower(coalesce(c.estado, '')), 'áéíóú', 'aeiou') NOT IN ('cancelada', 'cancelado', 'cancelled')
      AND c.consultorio_id = p_room_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROOM_CONFLICT', 'message', 'El consultorio ya esta ocupado por otra cita en este horario.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'AVAILABLE', 'message', 'Horario disponible.');
END;
$$;

REVOKE ALL ON FUNCTION public._appointment_availability_result(uuid, uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

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
  RETURN public._appointment_availability_result(
    p_tenant_id, p_professional_id, p_room_id, p_start, p_end, p_exclude_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_appointment_availability(uuid, uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_appointment_availability(uuid, uuid, uuid, timestamptz, timestamptz, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_appointment_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  normalized_state text;
BEGIN
  normalized_state := translate(lower(coalesce(NEW.estado, '')), 'áéíóú', 'aeiou');
  IF normalized_state IN ('cancelada', 'cancelado', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL OR NEW.profesional_id IS NULL OR NEW.consultorio_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Debe seleccionar un profesional y un consultorio.',
      DETAIL = 'REQUIRED_ASSIGNMENT';
  END IF;

  -- Consistent lock order closes the race between validation and insert/update.
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

DROP TRIGGER IF EXISTS citas_enforce_availability ON public.citas;
CREATE TRIGGER citas_enforce_availability
BEFORE INSERT OR UPDATE
ON public.citas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_appointment_availability();

REVOKE ALL ON FUNCTION public.enforce_appointment_availability() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.check_appointment_availability(uuid, uuid, uuid, timestamptz, timestamptz, uuid)
  IS 'Checks strict professional/room schedule intersection, blocks and appointment conflicts.';
COMMENT ON TRIGGER citas_enforce_availability ON public.citas
  IS 'Authoritative protection against appointments outside common availability or concurrent overlaps.';

COMMIT;