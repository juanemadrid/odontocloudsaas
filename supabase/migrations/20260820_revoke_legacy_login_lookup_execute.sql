-- This legacy login lookup is no longer used by the application.
-- Revoke API-facing execution while preserving owner/service-role access.
revoke execute on function public.check_user_tenant_active(text)
from public, anon, authenticated;
