-- Directorio operativo sin firmas, fotos ni credenciales embebidas.
-- Conserva los fallbacks legacy sin transferir varios megabytes por consulta.

create or replace function public.get_my_tenant_user_directory()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with config_row as (
    select wc.config
    from public.website_config as wc
    where wc.tenant_id = public.get_user_tenant_id()
      and public.is_active_user()
    limit 1
  ),
  sanitized_users as (
    select coalesce(
      jsonb_agg(
        item - array[
          'firma', 'firmaElectronica', 'firma_url',
          'fotoPerfil', 'foto_perfil', 'password', 'passwordHash'
        ]
      ),
      '[]'::jsonb
    ) as value
    from config_row,
         lateral jsonb_array_elements(
           coalesce(config -> 'usuarios', config -> 'users', '[]'::jsonb)
         ) as entries(item)
  ),
  sanitized_details as (
    select coalesce(
      jsonb_object_agg(
        entry_key,
        entry_value - array[
          'firma', 'firmaElectronica', 'firma_url',
          'fotoPerfil', 'foto_perfil', 'password', 'passwordHash'
        ]
      ),
      '{}'::jsonb
    ) as value
    from config_row,
         lateral jsonb_each(coalesce(config -> 'user_details', '{}'::jsonb))
           as entries(entry_key, entry_value)
  )
  select jsonb_build_object(
    'usuarios', sanitized_users.value,
    'user_details', sanitized_details.value,
    'doctores', coalesce(config_row.config -> 'doctores', '[]'::jsonb),
    'profesionales', coalesce(config_row.config -> 'profesionales', '[]'::jsonb)
  )
  from config_row, sanitized_users, sanitized_details
$$;

revoke all on function public.get_my_tenant_user_directory() from public;
revoke all on function public.get_my_tenant_user_directory() from anon;
grant execute on function public.get_my_tenant_user_directory() to authenticated;
