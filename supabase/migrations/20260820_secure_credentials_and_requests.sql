-- Secure pending subscriptions and move operational secrets out of website_config.
-- This migration is intentionally additive first; the stricter RLS migration follows
-- after the compatible Edge Functions are deployed.
begin;

create table if not exists public.subscription_requests (
  id text primary key,
  tenant_name text not null,
  admin_name text not null,
  admin_email text not null,
  password_secret_id uuid,
  requested_plan_id text not null default 'trial',
  requested_plan_name text not null default 'Trial',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.subscription_requests enable row level security;

revoke all on table public.subscription_requests from anon, authenticated;
grant select, update, delete on table public.subscription_requests to authenticated;

drop policy if exists subscription_requests_superadmin_select on public.subscription_requests;
create policy subscription_requests_superadmin_select
on public.subscription_requests
for select
to authenticated
using ((select public.is_superadmin()));

drop policy if exists subscription_requests_superadmin_update on public.subscription_requests;
create policy subscription_requests_superadmin_update
on public.subscription_requests
for update
to authenticated
using ((select public.is_superadmin()))
with check ((select public.is_superadmin()));

drop policy if exists subscription_requests_superadmin_delete on public.subscription_requests;
create policy subscription_requests_superadmin_delete
on public.subscription_requests
for delete
to authenticated
using ((select public.is_superadmin()));

create unique index if not exists subscription_requests_pending_email_idx
on public.subscription_requests (lower(admin_email))
where status = 'pending';

create index if not exists subscription_requests_status_created_idx
on public.subscription_requests (status, created_at desc);

alter table public.tenant_secrets
  add column if not exists sispro_config jsonb not null default '{}'::jsonb;

create or replace function public.store_subscription_request(
  p_admin_email text,
  p_admin_password text,
  p_admin_name text,
  p_clinic_name text,
  p_requested_plan_id text,
  p_requested_plan_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_admin_email));
  v_request_id text;
  v_previous_secret uuid;
  v_new_secret uuid;
begin
  if v_email = '' or position('@' in v_email) = 0 or length(v_email) > 254 then
    raise exception 'El correo no es valido.';
  end if;
  if length(coalesce(p_admin_password, '')) < 8
     or length(p_admin_password) > 72 then
    raise exception 'La contrasena debe tener entre 8 y 72 caracteres.';
  end if;
  if length(trim(coalesce(p_admin_name, ''))) < 3
     or length(p_admin_name) > 120 then
    raise exception 'El nombre del administrador no es valido.';
  end if;
  if length(trim(coalesce(p_clinic_name, ''))) < 3
     or length(p_clinic_name) > 120 then
    raise exception 'El nombre de la clinica no es valido.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_email));

  select id, password_secret_id
    into v_request_id, v_previous_secret
  from public.subscription_requests
  where lower(admin_email) = v_email
    and status = 'pending'
  for update;

  if v_previous_secret is not null then
    delete from vault.secrets where id = v_previous_secret;
  end if;

  v_new_secret := vault.create_secret(
    p_admin_password,
    'subscription_request_' || pg_catalog.replace(
      coalesce(v_request_id, pg_catalog.gen_random_uuid()::text),
      '-',
      '_'
    ) || '_' || pg_catalog.gen_random_uuid()::text,
    'One-time password for an OdontoCloud subscription request'
  );

  if v_request_id is null then
    v_request_id := 'req-' || pg_catalog.gen_random_uuid()::text;
    insert into public.subscription_requests (
      id,
      tenant_name,
      admin_name,
      admin_email,
      password_secret_id,
      requested_plan_id,
      requested_plan_name
    ) values (
      v_request_id,
      trim(p_clinic_name),
      trim(p_admin_name),
      v_email,
      v_new_secret,
      coalesce(nullif(trim(p_requested_plan_id), ''), 'trial'),
      coalesce(nullif(trim(p_requested_plan_name), ''), 'Trial')
    );
  else
    update public.subscription_requests
    set tenant_name = trim(p_clinic_name),
        admin_name = trim(p_admin_name),
        password_secret_id = v_new_secret,
        requested_plan_id = coalesce(nullif(trim(p_requested_plan_id), ''), 'trial'),
        requested_plan_name = coalesce(nullif(trim(p_requested_plan_name), ''), 'Trial'),
        reject_reason = null,
        created_at = now()
    where id = v_request_id;
  end if;

  return v_request_id;
end;
$$;

revoke all on function public.store_subscription_request(text, text, text, text, text, text)
from public, anon, authenticated;
grant execute on function public.store_subscription_request(text, text, text, text, text, text)
to service_role;

create or replace function public.get_subscription_request_password(p_request_id text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where id = (
    select sr.password_secret_id
    from public.subscription_requests as sr
    where sr.id = p_request_id
      and sr.status = 'pending'
  );
$$;

revoke all on function public.get_subscription_request_password(text)
from public, anon, authenticated;
grant execute on function public.get_subscription_request_password(text)
to service_role;

create or replace function public.delete_subscription_request_password(p_request_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  select password_secret_id
    into v_secret_id
  from public.subscription_requests
  where id = p_request_id
  for update;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
    update public.subscription_requests
    set password_secret_id = null
    where id = p_request_id;
  end if;
end;
$$;

revoke all on function public.delete_subscription_request_password(text)
from public, anon, authenticated;
grant execute on function public.delete_subscription_request_password(text)
to service_role;

-- Preserve the six historical requests while moving only pending passwords to Vault.
do $$
declare
  v_entry jsonb;
  v_request_id text;
  v_status text;
  v_secret_id uuid;
begin
  for v_entry in
    select entry
    from public.website_config as wc
    cross join lateral jsonb_array_elements(
      coalesce(wc.config -> 'subscription_requests', '[]'::jsonb)
    ) as entry
  loop
    v_request_id := coalesce(
      nullif(v_entry ->> 'id', ''),
      'req-' || pg_catalog.gen_random_uuid()::text
    );
    v_status := case
      when v_entry ->> 'status' in ('approved', 'rejected') then v_entry ->> 'status'
      else 'pending'
    end;
    v_secret_id := null;

    if v_status = 'pending'
       and length(coalesce(v_entry ->> 'adminPassword', '')) >= 8 then
      v_secret_id := vault.create_secret(
        v_entry ->> 'adminPassword',
        'subscription_request_migrated_' || pg_catalog.gen_random_uuid()::text,
        'Migrated one-time password for an OdontoCloud subscription request'
      );
    end if;

    insert into public.subscription_requests (
      id,
      tenant_name,
      admin_name,
      admin_email,
      password_secret_id,
      requested_plan_id,
      requested_plan_name,
      status,
      reject_reason,
      created_at,
      processed_at
    ) values (
      v_request_id,
      coalesce(nullif(v_entry ->> 'tenantName', ''), 'Nueva Clinica'),
      coalesce(nullif(v_entry ->> 'adminName', ''), 'Administrador'),
      lower(coalesce(v_entry ->> 'adminEmail', 'sin-correo@invalid.local')),
      v_secret_id,
      coalesce(nullif(v_entry ->> 'requestedPlanId', ''), 'trial'),
      coalesce(nullif(v_entry ->> 'requestedPlanName', ''), 'Trial'),
      v_status,
      nullif(v_entry ->> 'rejectReason', ''),
      coalesce((v_entry ->> 'createdAt')::timestamptz, now()),
      coalesce(
        (v_entry ->> 'approvedAt')::timestamptz,
        (v_entry ->> 'rejectedAt')::timestamptz
      )
    )
    on conflict (id) do nothing;
  end loop;
end;
$$;

-- Move Factus and SISPRO credentials to the server-only table.
insert into public.tenant_secrets (
  tenant_id,
  factus_config,
  sispro_config,
  updated_at
)
select
  wc.tenant_id,
  case
    when jsonb_typeof(wc.config -> 'factus_config') = 'object'
      then wc.config -> 'factus_config'
    when jsonb_typeof(wc.config -> 'factus') = 'object'
      then wc.config -> 'factus'
    else '{}'::jsonb
  end,
  case
    when jsonb_typeof(wc.config -> 'empresa_datos') = 'object' then
      jsonb_strip_nulls(jsonb_build_object(
        'sisproUsuario', nullif(wc.config #>> '{empresa_datos,sisproUsuario}', ''),
        'sisproTipoDoc', nullif(wc.config #>> '{empresa_datos,sisproTipoDoc}', ''),
        'sisproPassword', nullif(wc.config #>> '{empresa_datos,sisproPassword}', ''),
        'codigoPrestador', nullif(wc.config #>> '{empresa_datos,codigoPrestador}', '')
      ))
    else '{}'::jsonb
  end,
  now()
from public.website_config as wc
where jsonb_typeof(wc.config) = 'object'
  and (
    jsonb_typeof(wc.config -> 'factus_config') = 'object'
    or jsonb_typeof(wc.config -> 'factus') = 'object'
    or jsonb_typeof(wc.config -> 'empresa_datos') = 'object'
  )
on conflict (tenant_id) do update
set factus_config = case
      when excluded.factus_config <> '{}'::jsonb then excluded.factus_config
      else public.tenant_secrets.factus_config
    end,
    sispro_config = case
      when excluded.sispro_config <> '{}'::jsonb then excluded.sispro_config
      else public.tenant_secrets.sispro_config
    end,
    updated_at = now();

-- Remove only credential copies; keep all display and scheduling data.
update public.website_config
set config = jsonb_set(
  config,
  '{empresa_datos}',
  (config -> 'empresa_datos')
    - array['sisproUsuario', 'sisproPassword', 'sisproTipoDoc', 'codigoPrestador'],
  true
)
where jsonb_typeof(config -> 'empresa_datos') = 'object';

update public.website_config
set config = jsonb_set(
  config,
  '{factus_config}',
  (config -> 'factus_config')
    - array['factusClientSecret', 'factusUsername', 'factusPassword'],
  true
)
where jsonb_typeof(config -> 'factus_config') = 'object';

update public.website_config
set config = jsonb_set(
  config,
  '{factus}',
  (config -> 'factus')
    - array['factusClientSecret', 'factusUsername', 'factusPassword'],
  true
)
where jsonb_typeof(config -> 'factus') = 'object';

update public.website_config as wc
set config = jsonb_set(
  wc.config,
  '{user_details}',
  coalesce((
    select jsonb_object_agg(entry.key, entry.value - 'password')
    from jsonb_each(wc.config -> 'user_details') as entry
  ), '{}'::jsonb),
  true
)
where jsonb_typeof(wc.config -> 'user_details') = 'object';

update public.website_config
set config = config - 'subscription_requests'
where config ? 'subscription_requests';

commit;
