-- Pin function search paths without changing function bodies or behavior.
begin;

alter function public.admin_change_password(text, text)
set search_path = auth, extensions, pg_catalog;

alter function public.check_appointment_availability(
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  uuid
)
set search_path = public, pg_catalog;

alter function public.sync_inquilino_field()
set search_path = pg_catalog;

commit;
