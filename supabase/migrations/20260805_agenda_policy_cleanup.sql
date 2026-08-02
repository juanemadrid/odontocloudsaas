-- Production cleanup after advisor review: least privilege and lean agenda RLS.

BEGIN;

-- These helpers are used only by authenticated RLS/storage policies. Direct
-- anonymous RPC execution is unnecessary and may be inherited from old grants.
REVOKE ALL ON FUNCTION public.get_user_tenant_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_config_key(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_private_attachment(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_public_asset(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_config_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_private_attachment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_public_asset(text) TO authenticated;

-- Trigger functions do not need to be exposed as RPC endpoints.
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Public buckets serve object URLs without a broad object-listing policy.
DROP POLICY IF EXISTS "Public read clinical files" ON storage.objects;

-- FOR ALL also participates in SELECT, so use one policy per operation to
-- avoid duplicate permissive policy evaluation on schedule reads.
DO $$
DECLARE
  schedule_table text;
BEGIN
  FOREACH schedule_table IN ARRAY ARRAY['horarios_predefinidos', 'agenda_abierta', 'no_disponibles'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', schedule_table || '_tenant_select', schedule_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', schedule_table || '_tenant_manage', schedule_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', schedule_table || '_tenant_insert', schedule_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', schedule_table || '_tenant_update', schedule_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', schedule_table || '_tenant_delete', schedule_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_active_user()) AND (tenant_id = (SELECT public.get_user_tenant_id()) OR (SELECT public.is_superadmin())))',
      schedule_table || '_tenant_select', schedule_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_tenant_admin()) AND (tenant_id = (SELECT public.get_user_tenant_id()) OR (SELECT public.is_superadmin())))',
      schedule_table || '_tenant_insert', schedule_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.is_tenant_admin()) AND (tenant_id = (SELECT public.get_user_tenant_id()) OR (SELECT public.is_superadmin()))) WITH CHECK ((SELECT public.is_tenant_admin()) AND (tenant_id = (SELECT public.get_user_tenant_id()) OR (SELECT public.is_superadmin())))',
      schedule_table || '_tenant_update', schedule_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.is_tenant_admin()) AND (tenant_id = (SELECT public.get_user_tenant_id()) OR (SELECT public.is_superadmin())))',
      schedule_table || '_tenant_delete', schedule_table
    );
  END LOOP;
END;
$$;

-- Full indexes support FK checks/deletes, including inactive legacy rows.
CREATE INDEX IF NOT EXISTS idx_horarios_predefinidos_usuario_fk
  ON public.horarios_predefinidos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_horarios_predefinidos_consultorio_fk
  ON public.horarios_predefinidos (consultorio_id);
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_usuario_fk
  ON public.agenda_abierta (usuario_id);
CREATE INDEX IF NOT EXISTS idx_agenda_abierta_consultorio_fk
  ON public.agenda_abierta (consultorio_id);
CREATE INDEX IF NOT EXISTS idx_no_disponibles_usuario_fk
  ON public.no_disponibles (usuario_id);
CREATE INDEX IF NOT EXISTS idx_no_disponibles_consultorio_fk
  ON public.no_disponibles (consultorio_id);

NOTIFY pgrst, 'reload schema';

COMMIT;
