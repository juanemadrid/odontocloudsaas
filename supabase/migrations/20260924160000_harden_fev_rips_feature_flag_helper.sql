-- Migration: 20260924160000_harden_fev_rips_feature_flag_helper.sql
-- Hardening de autorizacion en funcion helper is_fev_rips_0948_enabled
-- Cierra fuga cross-tenant impidiendo que un usuario autenticado consulte flags de otro tenant.

CREATE OR REPLACE FUNCTION public.is_fev_rips_0948_enabled(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN
      public.is_superadmin()
      OR (
        p_tenant_id = public.get_user_tenant_id()
        AND public.is_active_user()
      )
    THEN
      COALESCE(
        (
          SELECT enabled
          FROM public.tenant_feature_flags
          WHERE tenant_id = p_tenant_id
            AND feature_key = 'ENABLE_FEV_RIPS_0948'
          LIMIT 1
        ),
        false
      )
    ELSE
      false
  END;
$$;

REVOKE ALL ON FUNCTION public.is_fev_rips_0948_enabled(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_fev_rips_0948_enabled(UUID) TO authenticated;
