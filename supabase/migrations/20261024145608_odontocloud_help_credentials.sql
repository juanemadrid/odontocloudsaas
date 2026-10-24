-- Dedicated help credential; never touches clinical or superadmin Gemini keys.
BEGIN;
CREATE TABLE public.odonto_help_credentials (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  encrypted_key jsonb NOT NULL CHECK (
    jsonb_typeof(encrypted_key) = 'object' AND encrypted_key->>'v' = '1' AND encrypted_key->>'alg' = 'A256GCM'
    AND encrypted_key ?& ARRAY['v','alg','kid','iv','ciphertext']
  ),
  model text NOT NULL DEFAULT 'gemini-2.5-flash-lite'
    CHECK (model IN ('gemini-2.5-flash-lite', 'gemini-2.5-flash')),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.odonto_help_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.odonto_help_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.odonto_help_credentials TO service_role;

CREATE TABLE public.odonto_help_key_checks (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  minute_start timestamptz NOT NULL DEFAULT now(),
  minute_count integer NOT NULL DEFAULT 0,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::date,
  day_count integer NOT NULL DEFAULT 0
);
INSERT INTO public.odonto_help_key_checks(id) VALUES (true);
ALTER TABLE public.odonto_help_key_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.odonto_help_key_checks FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.odonto_help_key_checks TO service_role;

CREATE FUNCTION public.reserve_odonto_help_key_check(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  r public.odonto_help_key_checks%ROWTYPE;
  n timestamptz := clock_timestamp();
  d date := (n AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND activo IS TRUE
    AND lower(trim(role)) = 'superadmin') THEN RETURN false; END IF;
  SELECT * INTO r FROM public.odonto_help_key_checks WHERE id = true FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.minute_start <= n - interval '1 minute' THEN r.minute_start := n; r.minute_count := 0; END IF;
  IF r.day <> d THEN r.day := d; r.day_count := 0; END IF;
  IF r.minute_count >= 6 OR r.day_count >= 30 THEN RETURN false; END IF;
  UPDATE public.odonto_help_key_checks SET minute_start = r.minute_start,
    minute_count = r.minute_count + 1, day = r.day, day_count = r.day_count + 1 WHERE id = true;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_odonto_help_key_check(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_odonto_help_key_check(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
