-- Configuracion SaaS: escrituras atomicas por seccion, solicitudes de cambio de plan
-- e indices de soporte para las relaciones mas consultadas.

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
  v_config jsonb;
  v_key text := btrim(coalesce(p_key, ''));
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
    jsonb_build_object(v_key, coalesce(p_value, 'null'::jsonb), 'updatedAt', to_jsonb(now())),
    now()
  )
  on conflict (tenant_id) do update
  set config = coalesce(public.website_config.config, '{}'::jsonb)
      || jsonb_build_object(v_key, coalesce(p_value, 'null'::jsonb), 'updatedAt', to_jsonb(now())),
      updated_at = now()
  returning config into v_config;

  return v_config;
end;
$$;

revoke all on function public.set_tenant_config_section(uuid, text, jsonb) from public;
revoke all on function public.set_tenant_config_section(uuid, text, jsonb) from anon;
grant execute on function public.set_tenant_config_section(uuid, text, jsonb) to authenticated;

create table if not exists public.subscription_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requester_email text,
  tenant_name text not null default '',
  tenant_phone text not null default '',
  request_type text not null check (request_type in ('upgrade', 'trial')),
  current_plan_id text not null default 'custom',
  requested_plan_id text not null,
  requested_plan_name text not null,
  plan_duration text not null default 'monthly' check (plan_duration in ('monthly', 'yearly')),
  payment_status text not null default 'awaiting_validation'
    check (payment_status in ('awaiting_validation', 'trial_request', 'validated', 'not_required')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  notes text
);

alter table public.subscription_change_requests enable row level security;

drop policy if exists subscription_change_requests_select on public.subscription_change_requests;
create policy subscription_change_requests_select
on public.subscription_change_requests
for select
to authenticated
using (
  public.is_active_user()
  and (tenant_id = public.get_user_tenant_id() or public.is_superadmin())
);

drop policy if exists subscription_change_requests_insert on public.subscription_change_requests;
create policy subscription_change_requests_insert
on public.subscription_change_requests
for insert
to authenticated
with check (
  public.is_active_user()
  and tenant_id = public.get_user_tenant_id()
  and requested_by = auth.uid()
);

drop policy if exists subscription_change_requests_update on public.subscription_change_requests;
create policy subscription_change_requests_update
on public.subscription_change_requests
for update
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists subscription_change_requests_delete on public.subscription_change_requests;
create policy subscription_change_requests_delete
on public.subscription_change_requests
for delete
to authenticated
using (public.is_superadmin());

create unique index if not exists subscription_change_requests_one_pending_per_tenant_idx
  on public.subscription_change_requests (tenant_id)
  where status = 'pending';

create index if not exists subscription_change_requests_status_created_idx
  on public.subscription_change_requests (status, created_at desc);

create index if not exists bancos_tenant_id_idx on public.bancos (tenant_id);
create index if not exists consultorios_tenant_id_idx on public.consultorios (tenant_id);
create index if not exists consultorios_sucursal_id_idx on public.consultorios (sucursal_id);
create index if not exists listas_precios_tenant_id_idx on public.listas_precios (tenant_id);
create index if not exists sucursales_tenant_id_idx on public.sucursales (tenant_id);

