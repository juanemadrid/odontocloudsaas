-- ============================================================================
-- CANONICAL SECURITY HARDENING
-- Retira RPC legacy admin_change_password si aún existe.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.admin_change_password(text,text)') IS NOT NULL THEN

    EXECUTE
      'REVOKE ALL ON FUNCTION public.admin_change_password(text,text) FROM PUBLIC';

    EXECUTE
      'REVOKE ALL ON FUNCTION public.admin_change_password(text,text) FROM anon';

    EXECUTE
      'REVOKE ALL ON FUNCTION public.admin_change_password(text,text) FROM authenticated';

    EXECUTE
      'DROP FUNCTION public.admin_change_password(text,text)';

    RAISE NOTICE
      'Removed insecure legacy function public.admin_change_password(text,text)';

  ELSE

    RAISE NOTICE
      'Legacy function public.admin_change_password(text,text) is already absent';

  END IF;
END
$$;

COMMIT;
