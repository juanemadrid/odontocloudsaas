-- Fusion atomica de varias claves de website_config sin reemplazar secciones ajenas.

create or replace function public.merge_tenant_config(
  p_tenant_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config jsonb;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Usuario no autenticado o inactivo' using errcode = '42501';
  end if;

  if p_tenant_id is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Parche de configuracion invalido' using errcode = '22023';
  end if;

  if p_tenant_id <> public.get_user_tenant_id() and not public.is_superadmin() then
    raise exception 'No tiene acceso a la configuracion de esta clinica' using errcode = '42501';
  end if;

  insert into public.website_config (tenant_id, config, updated_at)
  values (
    p_tenant_id,
    p_patch || jsonb_build_object('updatedAt', to_jsonb(now())),
    now()
  )
  on conflict (tenant_id) do update
  set config = coalesce(public.website_config.config, '{}'::jsonb)
      || p_patch
      || jsonb_build_object('updatedAt', to_jsonb(now())),
      updated_at = now()
  returning config into v_config;

  return v_config;
end;
$$;

revoke all on function public.merge_tenant_config(uuid, jsonb) from public;
revoke all on function public.merge_tenant_config(uuid, jsonb) from anon;
grant execute on function public.merge_tenant_config(uuid, jsonb) to authenticated;

