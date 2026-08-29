-- Restore least-privilege ACLs after the self-hosted database migration.
-- The browser uses authenticated Edge Functions for every privileged Auth action.
begin;

revoke all on function public.admin_change_password(text, text)
from public, anon, authenticated;
revoke all on function public.admin_create_clinic_user(text, text, text, uuid, text)
from public, anon, authenticated;
revoke all on function public.admin_force_change_password(text, text)
from public, anon, authenticated;
revoke all on function public.store_subscription_request(text, text, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.get_subscription_request_password(text)
from public, anon, authenticated;
revoke all on function public.delete_subscription_request_password(text)
from public, anon, authenticated;

grant execute on function public.admin_change_password(text, text) to service_role;
grant execute on function public.admin_create_clinic_user(text, text, text, uuid, text) to service_role;
grant execute on function public.admin_force_change_password(text, text) to service_role;
grant execute on function public.store_subscription_request(text, text, text, text, text, text) to service_role;
grant execute on function public.get_subscription_request_password(text) to service_role;
grant execute on function public.delete_subscription_request_password(text) to service_role;

revoke all on table public.tenant_secrets from anon, authenticated;
revoke all on table public.patient_portal_sessions from anon, authenticated;
revoke all on table public.registration_attempts from anon, authenticated;
revoke all on table public.outbound_message_log from anon, authenticated;
grant all on table public.tenant_secrets to service_role;
grant all on table public.patient_portal_sessions to service_role;
grant all on table public.registration_attempts to service_role;
grant all on table public.outbound_message_log to service_role;

revoke all on table public.subscription_requests from anon, authenticated;
grant select on table public.subscription_requests to authenticated;
grant all on table public.subscription_requests to service_role;

-- These privileges are never needed by PostgREST clients and bypass normal
-- row-level application operations such as SELECT/INSERT/UPDATE/DELETE.
revoke truncate, references, trigger on all tables in schema public
from anon, authenticated;

-- New objects fail closed until a migration explicitly grants API access.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
