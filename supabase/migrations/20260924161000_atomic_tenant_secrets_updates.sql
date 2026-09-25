-- Migration: 20260924161000_atomic_tenant_secrets_updates.sql
-- ============================================================================
-- RPCs Atómicas y Privadas para Gestión Concurrente de tenant_secrets
-- ============================================================================
-- Invariantes de seguridad:
-- 1. search_path endurecido (search_path = '').
-- 2. Bloqueo a nivel de fila y actualización JSONB atómica in-place (evita lost updates).
-- 3. Preserva factus_config, gemini_api_key y campos no objetivo.
-- 4. Accesible EXCLUSIVAMENTE por service_role (revocado de public, anon, authenticated).
-- ============================================================================

-- 1. Actualización atómica de configuración institucional SISPRO
create or replace function public.set_tenant_sispro_institutional_config(
  p_tenant_id uuid,
  p_usuario text,
  p_tipo_doc text,
  p_codigo_prestador text,
  p_password_encrypted jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_sispro jsonb;
  v_next_sispro jsonb;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id es requerido';
  end if;

  -- Asegurar existencia de fila base
  insert into public.tenant_secrets (tenant_id, sispro_config, updated_at)
  values (p_tenant_id, '{}'::jsonb, pg_catalog.now())
  on conflict (tenant_id) do nothing;

  -- Bloquear fila para actualización transaccional
  select sispro_config into v_current_sispro
  from public.tenant_secrets
  where tenant_id = p_tenant_id
  for update;

  v_current_sispro := coalesce(v_current_sispro, '{}'::jsonb);

  if p_password_encrypted is not null then
    -- Actualizar credencial cifrada y remover plaintext legacy si existiera
    v_next_sispro := (v_current_sispro - 'sisproPassword') || pg_catalog.jsonb_build_object(
      'sisproUsuario', coalesce(p_usuario, ''),
      'sisproTipoDoc', coalesce(p_tipo_doc, 'CC'),
      'codigoPrestador', coalesce(p_codigo_prestador, ''),
      'sisproPasswordEncrypted', p_password_encrypted
    );
  else
    -- Preservar credencial previa (cifrada o existente)
    v_next_sispro := v_current_sispro || pg_catalog.jsonb_build_object(
      'sisproUsuario', coalesce(p_usuario, ''),
      'sisproTipoDoc', coalesce(p_tipo_doc, 'CC'),
      'codigoPrestador', coalesce(p_codigo_prestador, '')
    );
  end if;

  -- Actualizar únicamente sispro_config y updated_at
  update public.tenant_secrets
  set sispro_config = v_next_sispro,
      updated_at = pg_catalog.now()
  where tenant_id = p_tenant_id;

  return true;
end;
$$;

-- 2. Actualización atómica de credencial SISPRO de doctor
create or replace function public.set_tenant_doctor_sispro_secret(
  p_tenant_id uuid,
  p_doctor_id uuid,
  p_password_encrypted jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_sispro jsonb;
  v_doctores jsonb;
  v_doctor_entry jsonb;
  v_next_sispro jsonb;
begin
  if p_tenant_id is null or p_doctor_id is null then
    raise exception 'tenant_id y doctor_id son requeridos';
  end if;

  if p_password_encrypted is null then
    raise exception 'password_encrypted es requerido';
  end if;

  -- Asegurar existencia de fila base
  insert into public.tenant_secrets (tenant_id, sispro_config, updated_at)
  values (p_tenant_id, '{}'::jsonb, pg_catalog.now())
  on conflict (tenant_id) do nothing;

  -- Bloquear fila para actualización atómica
  select sispro_config into v_current_sispro
  from public.tenant_secrets
  where tenant_id = p_tenant_id
  for update;

  v_current_sispro := coalesce(v_current_sispro, '{}'::jsonb);
  v_doctores := coalesce(v_current_sispro -> 'doctores', '{}'::jsonb);

  v_doctor_entry := pg_catalog.jsonb_build_object(
    'sisproPasswordEncrypted', p_password_encrypted,
    'configured', true,
    'updatedAt', pg_catalog.to_char(pg_catalog.now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  v_doctores := v_doctores || pg_catalog.jsonb_build_object(p_doctor_id::text, v_doctor_entry);

  v_next_sispro := pg_catalog.jsonb_set(
    v_current_sispro,
    '{doctores}',
    v_doctores,
    true
  );

  update public.tenant_secrets
  set sispro_config = v_next_sispro,
      updated_at = pg_catalog.now()
  where tenant_id = p_tenant_id;

  return true;
end;
$$;

-- 3. Eliminación atómica de credencial SISPRO de doctor
create or replace function public.delete_tenant_doctor_sispro_secret(
  p_tenant_id uuid,
  p_doctor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_sispro jsonb;
  v_doctores jsonb;
  v_next_sispro jsonb;
begin
  if p_tenant_id is null or p_doctor_id is null then
    raise exception 'tenant_id y doctor_id son requeridos';
  end if;

  select sispro_config into v_current_sispro
  from public.tenant_secrets
  where tenant_id = p_tenant_id
  for update;

  if v_current_sispro is null then
    return true;
  end if;

  v_doctores := coalesce(v_current_sispro -> 'doctores', '{}'::jsonb);
  v_doctores := v_doctores - p_doctor_id::text;

  v_next_sispro := pg_catalog.jsonb_set(
    v_current_sispro,
    '{doctores}',
    v_doctores,
    true
  );

  update public.tenant_secrets
  set sispro_config = v_next_sispro,
      updated_at = pg_catalog.now()
  where tenant_id = p_tenant_id;

  return true;
end;
$$;

-- Permisos estrictos: BACKEND ONLY
revoke all on function public.set_tenant_sispro_institutional_config(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.set_tenant_sispro_institutional_config(uuid, text, text, text, jsonb) to service_role;

revoke all on function public.set_tenant_doctor_sispro_secret(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_tenant_doctor_sispro_secret(uuid, uuid, jsonb) to service_role;

revoke all on function public.delete_tenant_doctor_sispro_secret(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_tenant_doctor_sispro_secret(uuid, uuid) to service_role;
