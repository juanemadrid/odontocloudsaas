create table if not exists public.ecosystem_presence (
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null,
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 last_seen timestamptz not null default now(),
 primary key(user_id, session_id)
);
alter table public.ecosystem_presence enable row level security;
revoke all on public.ecosystem_presence from anon, authenticated;
grant select, insert, update, delete on public.ecosystem_presence to authenticated;
grant all on public.ecosystem_presence to service_role;
create policy presence_own_select on public.ecosystem_presence for select to authenticated using (user_id = (select auth.uid()));
create policy presence_own_insert on public.ecosystem_presence for insert to authenticated with check (
 user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.tenant_id = ecosystem_presence.tenant_id and p.activo is distinct from false)
);
create policy presence_own_update on public.ecosystem_presence for update to authenticated using (user_id = (select auth.uid())) with check (
 user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.tenant_id = ecosystem_presence.tenant_id and p.activo is distinct from false)
);
create policy presence_own_delete on public.ecosystem_presence for delete to authenticated using (user_id = (select auth.uid()));
create function public.stamp_ecosystem_presence() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.last_seen = now(); return new; end;
$$;
revoke execute on function public.stamp_ecosystem_presence() from public, anon, authenticated;
create trigger stamp_ecosystem_presence before insert or update on public.ecosystem_presence for each row execute function public.stamp_ecosystem_presence();
create index ecosystem_presence_last_seen_idx on public.ecosystem_presence(last_seen);
notify pgrst, 'reload schema';
