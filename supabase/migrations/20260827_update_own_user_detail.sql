-- Actualización atómica y limitada del perfil visible del propio usuario.
-- Evita descargar y reescribir todo website_config al guardar una firma.

create or replace function public.update_my_user_detail(p_patch jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id text := (select auth.uid())::text;
  tenant_id uuid := public.get_user_tenant_id();
  safe_patch jsonb;
  updated_detail jsonb;
begin
  if current_user_id is null or tenant_id is null or not public.is_active_user() then
    raise exception 'Sesión o clínica no válida';
  end if;

  safe_patch := coalesce(p_patch, '{}'::jsonb) - array[
    'id', 'uid', 'tenant_id', 'inquilino', 'email',
    'role', 'rol', 'profileType', 'tipo',
    'permissions', 'permisos', 'esDoctor', 'isDoctor', 'is_doctor',
    'activo', 'active'
  ];

  update public.website_config as wc
  set
    config = jsonb_set(
      coalesce(wc.config, '{}'::jsonb),
      '{user_details}',
      coalesce(wc.config -> 'user_details', '{}'::jsonb)
        || jsonb_build_object(
          current_user_id,
          coalesce(wc.config -> 'user_details' -> current_user_id, '{}'::jsonb)
            || safe_patch
        ),
      true
    ),
    updated_at = now()
  where wc.tenant_id = tenant_id
  returning wc.config -> 'user_details' -> current_user_id
    into updated_detail;

  if updated_detail is null then
    raise exception 'No se pudo actualizar el perfil';
  end if;

  return updated_detail;
end;
$$;

revoke all on function public.update_my_user_detail(jsonb) from public;
revoke all on function public.update_my_user_detail(jsonb) from anon;
grant execute on function public.update_my_user_detail(jsonb) to authenticated;
