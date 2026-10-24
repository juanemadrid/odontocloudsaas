-- OdontoCloud only. Additive: no changes to clinical tables or existing flags.
BEGIN;
CREATE TABLE public.odonto_help_global (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 40 CHECK (daily_limit BETWEEN 1 AND 200),
  monthly_limit integer NOT NULL DEFAULT 500 CHECK (monthly_limit BETWEEN 1 AND 5000)
);
INSERT INTO public.odonto_help_global (id) VALUES (true);

CREATE TABLE public.odonto_help_clinics (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 15 CHECK (daily_limit BETWEEN 1 AND 100),
  monthly_limit integer NOT NULL DEFAULT 150 CHECK (monthly_limit BETWEEN 1 AND 2000)
);

-- Counts attempts, including failed provider calls. Never stores prompts or answers.
CREATE TABLE public.odonto_help_usage (
  scope text NOT NULL,
  period text NOT NULL,
  requests bigint NOT NULL DEFAULT 0 CHECK (requests >= 0),
  PRIMARY KEY (scope, period)
);

ALTER TABLE public.odonto_help_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odonto_help_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odonto_help_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.odonto_help_global, public.odonto_help_clinics, public.odonto_help_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.odonto_help_global TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.odonto_help_clinics TO authenticated;
GRANT SELECT ON public.odonto_help_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.odonto_help_global, public.odonto_help_clinics, public.odonto_help_usage TO service_role;

CREATE POLICY odonto_help_global_admin ON public.odonto_help_global FOR ALL TO authenticated
  USING ((SELECT public.is_superadmin())) WITH CHECK ((SELECT public.is_superadmin()));
CREATE POLICY odonto_help_clinics_admin ON public.odonto_help_clinics FOR ALL TO authenticated
  USING ((SELECT public.is_superadmin())) WITH CHECK ((SELECT public.is_superadmin()));
CREATE POLICY odonto_help_usage_admin ON public.odonto_help_usage FOR SELECT TO authenticated
  USING ((SELECT public.is_superadmin()));

-- Invoker; only the backend service role can execute. Row locks serialize reservations
-- across replicas and switches. Limits use America/Bogota, independent of server timezone.
CREATE FUNCTION public.reserve_odonto_help_request(p_user_id uuid, p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  g public.odonto_help_global%ROWTYPE;
  c public.odonto_help_clinics%ROWTYPE;
  d text := to_char(clock_timestamp() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD');
  m text := to_char(clock_timestamp() AT TIME ZONE 'America/Bogota', 'YYYY-MM');
  n timestamptz := clock_timestamp();
  tenant_scope text := 'clinic:' || p_tenant_id::text;
  user_scope text := 'user:' || p_user_id::text;
BEGIN
  SELECT * INTO g FROM public.odonto_help_global WHERE id = true FOR UPDATE;
  IF NOT FOUND OR NOT g.enabled THEN RETURN '{"allowed":false,"reason":"disabled"}'::jsonb; END IF;
  SELECT * INTO c FROM public.odonto_help_clinics WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND OR NOT c.enabled THEN RETURN '{"allowed":false,"reason":"disabled"}'::jsonb; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.tenants t ON t.id = p.tenant_id
    WHERE p.id = p_user_id AND p.tenant_id = p_tenant_id AND p.activo IS TRUE AND t.activo IS TRUE
  ) THEN RETURN '{"allowed":false,"reason":"disabled"}'::jsonb; END IF;

  -- One request per user every 10 seconds; a global minute cap protects free-tier RPM.
  IF EXISTS (SELECT 1 FROM public.odonto_help_usage WHERE scope = user_scope AND period = 'cooldown'
    AND requests > extract(epoch FROM n)::bigint - 10) OR
    COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = 'global' AND period = to_char(n AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI')), 0) >= 4 OR
    COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = 'global' AND period = d), 0) >= g.daily_limit OR
    COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = 'global' AND period = m), 0) >= g.monthly_limit OR
    COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = tenant_scope AND period = d), 0) >= c.daily_limit OR
    COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = tenant_scope AND period = m), 0) >= c.monthly_limit
  THEN RETURN '{"allowed":false,"reason":"quota"}'::jsonb; END IF;

  INSERT INTO public.odonto_help_usage(scope, period, requests) VALUES
    ('global', d, 1), ('global', m, 1),
    ('global', to_char(n AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI'), 1),
    (tenant_scope, d, 1), (tenant_scope, m, 1)
  ON CONFLICT (scope, period) DO UPDATE SET requests = public.odonto_help_usage.requests + 1;
  INSERT INTO public.odonto_help_usage(scope, period, requests) VALUES (user_scope, 'cooldown', extract(epoch FROM n)::bigint)
  ON CONFLICT (scope, period) DO UPDATE SET requests = EXCLUDED.requests;
  -- Bound retention; this table has no clinical information.
  DELETE FROM public.odonto_help_usage WHERE period <> 'cooldown' AND period < to_char((n - interval '65 days') AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD');
  RETURN '{"allowed":true}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_odonto_help_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_odonto_help_request(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
