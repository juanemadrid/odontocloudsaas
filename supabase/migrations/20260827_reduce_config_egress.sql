-- Reduce el egreso de website_config sin cambiar el modelo de datos.
-- Las escrituras siguen siendo atomicas, pero ya no devuelven el JSON completo.

create or replace function public.set_tenant_config_section(
  p_tenant_id uuid,
  p_key text,
  p_value jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text := btrim(coalesce(p_key, ''));
  v_value jsonb := coalesce(p_value, 'null'::jsonb);
  v_updated_at timestamptz;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Usuario no autenticado o inactivo' using errcode = '42501';
  end if;

  if p_tenant_id is null or v_key = '' or v_key !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'Seccion de configuracion invalida' using errcode = '22023';
  end if;

  if p_tenant_id <> public.get_user_tenant_id() and not public.is_superadmin() then
    raise exception 'No tiene acceso a la configuracion de esta clinica' using errcode = '42501';
  end if;

  insert into public.website_config (tenant_id, config, updated_at)
  values (
    p_tenant_id,
    jsonb_build_object(v_key, v_value, 'updatedAt', to_jsonb(now())),
    now()
  )
  on conflict (tenant_id) do update
  set config = coalesce(public.website_config.config, '{}'::jsonb)
      || jsonb_build_object(v_key, v_value, 'updatedAt', to_jsonb(now())),
      updated_at = now()
  returning updated_at into v_updated_at;

  return jsonb_build_object(
    v_key, v_value,
    'updatedAt', to_jsonb(v_updated_at)
  );
end;
$$;

revoke all on function public.set_tenant_config_section(uuid, text, jsonb) from public;
revoke all on function public.set_tenant_config_section(uuid, text, jsonb) from anon;
grant execute on function public.set_tenant_config_section(uuid, text, jsonb) to authenticated;

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
  v_updated_at timestamptz;
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
  values (p_tenant_id, p_patch || jsonb_build_object('updatedAt', to_jsonb(now())), now())
  on conflict (tenant_id) do update
  set config = coalesce(public.website_config.config, '{}'::jsonb)
      || p_patch
      || jsonb_build_object('updatedAt', to_jsonb(now())),
      updated_at = now()
  returning updated_at into v_updated_at;

  return p_patch || jsonb_build_object('updatedAt', to_jsonb(v_updated_at));
end;
$$;

revoke all on function public.merge_tenant_config(uuid, jsonb) from public;
revoke all on function public.merge_tenant_config(uuid, jsonb) from anon;
grant execute on function public.merge_tenant_config(uuid, jsonb) to authenticated;

-- Contexto minimo de inicio: solo la ficha del usuario autenticado, no las
-- firmas ni fotos de todos los integrantes de la clinica.
create or replace function public.get_my_tenant_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'empresa_datos', coalesce(wc.config -> 'empresa_datos', '{}'::jsonb),
    'user_detail', coalesce(
      wc.config -> 'user_details' -> (auth.uid())::text,
      '{}'::jsonb
    ),
    'perfiles', coalesce(wc.config -> 'perfiles', '[]'::jsonb)
  )
  from public.website_config as wc
  where wc.tenant_id = public.get_user_tenant_id()
    and public.is_active_user()
  limit 1
$$;

revoke all on function public.get_my_tenant_context() from public;
revoke all on function public.get_my_tenant_context() from anon;
grant execute on function public.get_my_tenant_context() to authenticated;
