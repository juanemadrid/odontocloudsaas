-- Conservative production hardening: replacements are created before legacy access is removed.
begin;

create or replace function public.sanitize_public_json(p_value jsonb)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_result jsonb;
  v_entry record;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      v_result := '{}'::jsonb;
      for v_entry in select key, value from jsonb_each(p_value)
      loop
        if lower(v_entry.key) ~ '(password|secret|token|api[_-]?key|client[_-]?secret|clave|credential)'
           or lower(v_entry.key) in ('sisprousuario', 'factususername') then
          continue;
        end if;
        v_result := v_result || jsonb_build_object(
          v_entry.key,
          public.sanitize_public_json(v_entry.value)
        );
      end loop;
      return v_result;
    when 'array' then
      select coalesce(jsonb_agg(public.sanitize_public_json(item)), '[]'::jsonb)
      into v_result
      from jsonb_array_elements(p_value) as item;
      return v_result;
    else
      return p_value;
  end case;
end;
$$;

revoke all on function public.sanitize_public_json(jsonb)
from public, anon, authenticated;

create or replace function public.get_public_website_configs()
returns table(tenant_id text, config jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    wc.tenant_id::text,
    public.sanitize_public_json(coalesce((
      select jsonb_object_agg(entry.key, entry.value)
      from jsonb_each(coalesce(wc.config, '{}'::jsonb)) as entry
      where entry.key = any (array[
        'accentColor', 'address', 'city', 'contactPhone', 'ctaBtnLink',
        'ctaBtnText', 'ctaText', 'ctaTitle', 'doctors', 'email',
        'empresa_datos', 'faq', 'faqs', 'fontFamily', 'heroBadgeText',
        'heroBtn1Link', 'heroBtn1Text', 'heroBtn2Link', 'heroBtn2Text',
        'heroSubtitle', 'heroTitle', 'heroVideoUrl', 'identityHeroImage',
        'identityMission', 'identitySubtitle', 'identityTitle',
        'identityValues', 'identityVision', 'logo', 'mission', 'name',
        'phone', 'plans', 'primaryColor', 'seoDesc', 'seoTitle',
        'services', 'servicesSectionBadge', 'servicesSectionDesc',
        'servicesSectionTitle', 'slides', 'slug', 'testimonials',
        'testimonialsTitle', 'vision'
      ]::text[])
    ), '{}'::jsonb))
  from public.website_config as wc;
$$;

revoke all on function public.get_public_website_configs() from public;
grant execute on function public.get_public_website_configs() to anon, authenticated;

-- Rebuild secure profile policies before removing legacy public policies.
drop policy if exists profiles_select_secure on public.profiles;
create policy profiles_select_secure
on public.profiles
for select
to authenticated
using (
  (select public.is_active_user())
  and (
    id = (select auth.uid())
    or tenant_id = (select public.get_user_tenant_id())
    or (select public.is_superadmin())
  )
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  and (select public.is_active_user())
)
with check (
  id = (select auth.uid())
  and tenant_id = (select public.get_user_tenant_id())
  and (select public.is_active_user())
);

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_superadmin() then
    if new.id is distinct from old.id
       or new.tenant_id is distinct from old.tenant_id
       or new.inquilino is distinct from old.inquilino
       or new.role is distinct from old.role
       or new.activo is distinct from old.activo
       or new.email is distinct from old.email then
      raise exception 'Los campos de seguridad del perfil solo se modifican desde el servicio administrativo.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_security_fields()
from public, anon, authenticated;

drop trigger if exists protect_profile_security_fields_trigger on public.profiles;
create trigger protect_profile_security_fields_trigger
before update on public.profiles
for each row
execute function public.protect_profile_security_fields();

drop policy if exists "Public access profiles" on public.profiles;
drop policy if exists "Users can update profiles from their tenant" on public.profiles;
drop policy if exists "Users can view profiles from their tenant" on public.profiles;
revoke all on table public.profiles from anon;

-- Rebuild tenant policies before removing public tenant access.
drop policy if exists tenants_select_secure on public.tenants;
create policy tenants_select_secure
on public.tenants
for select
to authenticated
using (
  (select public.is_active_user())
  and (
    id = (select public.get_user_tenant_id())
    or (select public.is_superadmin())
  )
);

drop policy if exists tenants_insert_superadmin on public.tenants;
create policy tenants_insert_superadmin
on public.tenants
for insert
to authenticated
with check ((select public.is_superadmin()));

drop policy if exists tenants_update_admin on public.tenants;
create policy tenants_update_admin
on public.tenants
for update
to authenticated
using (
  (select public.is_active_user())
  and (
    (id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()))
    or (select public.is_superadmin())
  )
)
with check (
  (select public.is_active_user())
  and (
    (id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()))
    or (select public.is_superadmin())
  )
);

drop policy if exists tenants_delete_superadmin on public.tenants;
create policy tenants_delete_superadmin
on public.tenants
for delete
to authenticated
using ((select public.is_superadmin()));

drop policy if exists "Public access tenants" on public.tenants;
drop policy if exists "Public read tenants" on public.tenants;
revoke all on table public.tenants from anon;

-- Rebuild private configuration policies before removing raw public access.
drop policy if exists website_config_select_secure on public.website_config;
create policy website_config_select_secure
on public.website_config
for select
to authenticated
using ((select public.can_access_config_key(tenant_id::text)));

drop policy if exists website_config_insert_secure on public.website_config;
create policy website_config_insert_secure
on public.website_config
for insert
to authenticated
with check ((select public.can_access_config_key(tenant_id::text)));

drop policy if exists website_config_update_secure on public.website_config;
create policy website_config_update_secure
on public.website_config
for update
to authenticated
using ((select public.can_access_config_key(tenant_id::text)))
with check ((select public.can_access_config_key(tenant_id::text)));

drop policy if exists website_config_delete_secure on public.website_config;
create policy website_config_delete_secure
on public.website_config
for delete
to authenticated
using ((select public.can_access_config_key(tenant_id::text)));

drop policy if exists "Public access website_config" on public.website_config;
drop policy if exists "Public read website_config" on public.website_config;
revoke all on table public.website_config from anon;

alter view public.usuarios set (security_invoker = true);
revoke all on table public.usuarios from anon;
revoke insert, update, delete on table public.usuarios from authenticated;
grant select on table public.usuarios to authenticated;

revoke all on function public.admin_create_clinic_user(text, text, text, uuid, text)
from public, anon, authenticated;
revoke all on function public.admin_force_change_password(text, text)
from public, anon, authenticated;

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
      and p.proname <> 'protect_profile_security_fields'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      v_function.signature
    );
  end loop;
end;
$$;

-- Recreate all tenant-scoped Storage policies in the same transaction first.
drop policy if exists "Tenant read private attachments" on storage.objects;
create policy "Tenant read private attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'adjuntos'
  and (select public.can_access_private_attachment(name))
);

drop policy if exists "Tenant insert private attachments" on storage.objects;
create policy "Tenant insert private attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'adjuntos'
  and (select public.can_access_private_attachment(name))
);

drop policy if exists "Tenant update private attachments" on storage.objects;
create policy "Tenant update private attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'adjuntos'
  and (select public.can_access_private_attachment(name))
)
with check (
  bucket_id = 'adjuntos'
  and (select public.can_access_private_attachment(name))
);

drop policy if exists "Tenant delete private attachments" on storage.objects;
create policy "Tenant delete private attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'adjuntos'
  and (select public.can_access_private_attachment(name))
);

drop policy if exists "Storage select adjuntos" on storage.objects;
drop policy if exists "Storage insert adjuntos" on storage.objects;
drop policy if exists "Storage update adjuntos" on storage.objects;
drop policy if exists "Storage delete adjuntos" on storage.objects;

update storage.buckets
set file_size_limit = 20971520
where id in ('adjuntos', 'clinical-files', 'public-assets')
  and (file_size_limit is null or file_size_limit > 20971520);

-- Explicit tenant policies for clinical documents.
drop policy if exists documentos_clinicos_tenant_select on public.documentos_clinicos;
create policy documentos_clinicos_tenant_select
on public.documentos_clinicos
for select
to authenticated
using (
  (select public.is_active_user())
  and (
    tenant_id = (select public.get_user_tenant_id())
    or (select public.is_superadmin())
  )
);

drop policy if exists documentos_clinicos_tenant_insert on public.documentos_clinicos;
create policy documentos_clinicos_tenant_insert
on public.documentos_clinicos
for insert
to authenticated
with check (
  (select public.is_active_user())
  and (
    tenant_id = (select public.get_user_tenant_id())
    or (select public.is_superadmin())
  )
);

drop policy if exists documentos_clinicos_tenant_update on public.documentos_clinicos;
create policy documentos_clinicos_tenant_update
on public.documentos_clinicos
for update
to authenticated
using (
  (select public.is_active_user())
  and (
    tenant_id = (select public.get_user_tenant_id())
    or (select public.is_superadmin())
  )
)
with check (
  (select public.is_active_user())
  and (
    tenant_id = (select public.get_user_tenant_id())
    or (select public.is_superadmin())
  )
);

drop policy if exists documentos_clinicos_tenant_delete on public.documentos_clinicos;
create policy documentos_clinicos_tenant_delete
on public.documentos_clinicos
for delete
to authenticated
using (
  (select public.is_active_user())
  and (
    tenant_id = (select public.get_user_tenant_id())
    or (select public.is_superadmin())
  )
);
revoke all on table public.documentos_clinicos from anon;

-- Announcements are readable by active users and writable only by superadmin.
drop policy if exists anuncios_sistema_authenticated_select on public.anuncios_sistema;
create policy anuncios_sistema_authenticated_select
on public.anuncios_sistema
for select
to authenticated
using ((select public.is_active_user()));

drop policy if exists anuncios_sistema_superadmin_insert on public.anuncios_sistema;
create policy anuncios_sistema_superadmin_insert
on public.anuncios_sistema
for insert
to authenticated
with check ((select public.is_superadmin()));

drop policy if exists anuncios_sistema_superadmin_update on public.anuncios_sistema;
create policy anuncios_sistema_superadmin_update
on public.anuncios_sistema
for update
to authenticated
using ((select public.is_superadmin()))
with check ((select public.is_superadmin()));

drop policy if exists anuncios_sistema_superadmin_delete on public.anuncios_sistema;
create policy anuncios_sistema_superadmin_delete
on public.anuncios_sistema
for delete
to authenticated
using ((select public.is_superadmin()));
revoke all on table public.anuncios_sistema from anon;
revoke all on table public.notificaciones from anon;

commit;
