-- Devuelve solamente el profesional solicitado, incluida su firma si existe.
-- Evita transferir todo website_config al imprimir o firmar documentos clínicos.

create or replace function public.get_my_tenant_doctor_record(p_identifier text)
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
  candidates as (
    select 0 as source_priority,
           jsonb_build_object('id', detail_id) || detail_value as record
    from config_row,
         lateral jsonb_each(coalesce(config -> 'user_details', '{}'::jsonb))
           as details(detail_id, detail_value)

    union all

    select 10,
           jsonb_build_object('esDoctor', true) || professional
    from config_row,
         lateral jsonb_array_elements(
           coalesce(config -> 'profesionales', '[]'::jsonb)
         ) as professionals(professional)

    union all

    select 20,
           jsonb_build_object('esDoctor', true) || doctor
    from config_row,
         lateral jsonb_array_elements(
           coalesce(config -> 'doctores', '[]'::jsonb)
         ) as doctors(doctor)

    union all

    select 30, app_user
    from config_row,
         lateral jsonb_array_elements(
           coalesce(config -> 'usuarios', config -> 'users', '[]'::jsonb)
         ) as app_users(app_user)
  ),
  normalized as (
    select
      source_priority,
      record,
      lower(btrim(coalesce(record ->> 'id', record ->> 'uid', ''))) as record_id,
      lower(btrim(coalesce(
        record ->> 'nombreCompleto',
        record ->> 'nombre_completo',
        record ->> 'full_name',
        record ->> 'displayName',
        record ->> 'name',
        concat_ws(' ', record ->> 'nombre', record ->> 'apellido')
      ))) as record_name,
      lower(btrim(coalesce(p_identifier, ''))) as needle
    from candidates
  ),
  matched as (
    select
      source_priority,
      record,
      case
        when record_id = needle then 0
        when record_name = needle then 1
        else 2
      end as match_priority
    from normalized
    where needle <> ''
      and (
        record_id = needle
        or record_name = needle
        or (record_name <> '' and position(needle in record_name) > 0)
        or (record_name <> '' and position(record_name in needle) > 0)
      )
  )
  select record - array['password', 'passwordHash', 'fotoPerfil', 'foto_perfil']
  from matched
  order by match_priority, source_priority
  limit 1
$$;

revoke all on function public.get_my_tenant_doctor_record(text) from public;
revoke all on function public.get_my_tenant_doctor_record(text) from anon;
grant execute on function public.get_my_tenant_doctor_record(text) to authenticated;
