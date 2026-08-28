-- Allow active clinic administrators to manage public branding assets only
-- inside their own tenant folder. Existing superadmin access remains intact.
drop policy if exists "Superadmin manages public assets" on storage.objects;
drop policy if exists "Tenant admins manage own public assets" on storage.objects;

create policy "Tenant admins manage own public assets"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'public-assets'
  and (
    (select public.is_superadmin())
    or (
      (select public.is_active_user())
      and (select public.is_tenant_admin())
      and (storage.foldername(name))[1]
        = (select public.get_user_tenant_id())::text
    )
  )
)
with check (
  bucket_id = 'public-assets'
  and (
    (select public.is_superadmin())
    or (
      (select public.is_active_user())
      and (select public.is_tenant_admin())
      and (storage.foldername(name))[1]
        = (select public.get_user_tenant_id())::text
    )
  )
);
