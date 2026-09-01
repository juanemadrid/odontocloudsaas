-- Migration: Allow simultaneous booking of same room across different sedes / sucursales
-- Professional conflict applies everywhere (same doctor cannot be in 2 places).
-- Room conflict applies ONLY if both appointments belong to the SAME sucursal / sede.

BEGIN;

CREATE OR REPLACE FUNCTION public._appointment_availability_result(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_room_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_id uuid DEFAULT NULL,
  p_sucursal_id uuid DEFAULT NULL
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

  -- 1. Conflicto de profesional: el profesional NO puede estar en 2 citas al mismo tiempo en ninguna sede
  IF EXISTS (
    SELECT 1 FROM public.citas c
    WHERE c.tenant_id = p_tenant_id
      AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
      AND c.fecha_inicio < p_end AND c.fecha_fin > p_start
      AND translate(lower(coalesce(c.estado, '')), 'áéíóú', 'aeiou') NOT IN ('cancelada', 'cancelado', 'cancelled', 'no asiste', 'no-show')
      AND c.profesional_id = p_professional_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PROFESSIONAL_CONFLICT', 'message', 'El profesional ya tiene una cita que se cruza con este horario.');
  END IF;

  -- 2. Conflicto de consultorio: el consultorio solo entra en conflicto si es en la MISMA sede
  IF EXISTS (
    SELECT 1 FROM public.citas c
    WHERE c.tenant_id = p_tenant_id
      AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
      AND c.fecha_inicio < p_end AND c.fecha_fin > p_start
      AND translate(lower(coalesce(c.estado, '')), 'áéíóú', 'aeiou') NOT IN ('cancelada', 'cancelado', 'cancelled', 'no asiste', 'no-show')
      AND c.consultorio_id = p_room_id
      AND (
        p_sucursal_id IS NULL 
        OR c.sucursal_id IS NULL 
        OR c.sucursal_id = p_sucursal_id
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ROOM_CONFLICT', 'message', 'El consultorio ya esta ocupado por otra cita en esta sede en este horario.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'AVAILABLE', 'message', 'Horario disponible.');
END;
$$;

REVOKE ALL ON FUNCTION public._appointment_availability_result(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Overload check_appointment_availability to accept p_sucursal_id
CREATE OR REPLACE FUNCTION public.check_appointment_availability(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_room_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_id uuid DEFAULT NULL,
  p_sucursal_id uuid DEFAULT NULL
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
    p_tenant_id, p_professional_id, p_room_id, p_start, p_end, p_exclude_id, p_sucursal_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_appointment_availability(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_appointment_availability(uuid, uuid, uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated;

-- Update trigger function to pass NEW.sucursal_id
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
  IF normalized_state IN ('cancelada', 'cancelado', 'cancelled', 'no asiste', 'no-show') THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL OR NEW.profesional_id IS NULL OR NEW.consultorio_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Debe seleccionar un profesional y un consultorio.',
      DETAIL = 'REQUIRED_ASSIGNMENT';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('agenda:professional:' || NEW.tenant_id::text || ':' || NEW.profesional_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda:room:' || NEW.tenant_id::text || ':' || NEW.consultorio_id::text || ':' || coalesce(NEW.sucursal_id::text, 'global'), 0));

  result := public._appointment_availability_result(
    NEW.tenant_id,
    NEW.profesional_id,
    NEW.consultorio_id,
    NEW.fecha_inicio,
    NEW.fecha_fin,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END,
    NEW.sucursal_id
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

COMMIT;
