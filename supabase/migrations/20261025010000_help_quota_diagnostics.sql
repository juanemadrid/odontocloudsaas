-- OdontoCloud only: preserve limits, locks and counters; distinguish denial causes.
BEGIN;
CREATE OR REPLACE FUNCTION public.reserve_odonto_help_request(p_user_id uuid, p_tenant_id uuid)
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

  IF EXISTS (SELECT 1 FROM public.odonto_help_usage WHERE scope = user_scope AND period = 'cooldown' AND requests > extract(epoch FROM n)::bigint - 10) THEN RETURN '{"allowed":false,"reason":"quota","diagnostic":"user_cooldown"}'::jsonb; END IF;
  IF COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = 'global' AND period = to_char(n AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI')), 0) >= 4 THEN RETURN '{"allowed":false,"reason":"quota","diagnostic":"global_minute"}'::jsonb; END IF;
  IF COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = 'global' AND period = d), 0) >= g.daily_limit THEN RETURN '{"allowed":false,"reason":"quota","diagnostic":"global_day"}'::jsonb; END IF;
  IF COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = 'global' AND period = m), 0) >= g.monthly_limit THEN RETURN '{"allowed":false,"reason":"quota","diagnostic":"global_month"}'::jsonb; END IF;
  IF COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = tenant_scope AND period = d), 0) >= c.daily_limit THEN RETURN '{"allowed":false,"reason":"quota","diagnostic":"clinic_day"}'::jsonb; END IF;
  IF COALESCE((SELECT requests FROM public.odonto_help_usage WHERE scope = tenant_scope AND period = m), 0) >= c.monthly_limit THEN RETURN '{"allowed":false,"reason":"quota","diagnostic":"clinic_month"}'::jsonb; END IF;
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
