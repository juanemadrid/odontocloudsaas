\pset pager off
\pset border 1

\echo === PUBLIC/STORAGE TABLES WITHOUT RLS ===
select n.nspname as schema_name, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity
order by 1, 2;

\echo === PUBLIC VIEWS WITHOUT SECURITY_INVOKER ===
select n.nspname as schema_name, c.relname as view_name,
       coalesce(array_to_string(c.reloptions, ','), '') as options
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and not coalesce(c.reloptions, '{}'::text[]) @> array['security_invoker=true']
order by 1, 2;

\echo === ANON TABLE PRIVILEGES IN PUBLIC ===
select table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
group by table_name
order by table_name;

\echo === AUTHENTICATED TABLE PRIVILEGES ON SERVER-ONLY TABLES ===
select table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in (
    'tenant_secrets', 'patient_portal_sessions', 'registration_attempts',
    'outbound_message_log', 'subscription_requests'
  )
group by table_name
order by table_name;

\echo === SECURITY DEFINER FUNCTIONS CALLABLE BY PUBLIC/ANON ===
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       has_function_privilege('public', p.oid, 'execute') as public_execute,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       coalesce(array_to_string(p.proconfig, ','), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (
    has_function_privilege('public', p.oid, 'execute')
    or has_function_privilege('anon', p.oid, 'execute')
  )
order by p.proname, arguments;

\echo === SECURITY DEFINER ACL DETAILS ===
select p.oid::regprocedure as function_signature,
       pg_get_userbyid(p.proowner) as owner,
       p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname, pg_get_function_identity_arguments(p.oid);

\echo === API ROLE ATTRIBUTES AND MEMBERSHIPS ===
select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
       rolcanlogin, rolbypassrls
from pg_roles
where rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
order by rolname;

select member_role.rolname as member_role, granted_role.rolname as granted_role
from pg_auth_members m
join pg_roles member_role on member_role.oid = m.member
join pg_roles granted_role on granted_role.oid = m.roleid
where member_role.rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
order by member_role.rolname, granted_role.rolname;

\echo === POLICIES ASSIGNED TO PUBLIC ROLE ===
select schemaname, tablename, policyname, cmd,
       coalesce(qual, '') as using_expression,
       coalesce(with_check, '') as check_expression
from pg_policies
where schemaname in ('public', 'storage')
  and roles @> array['public']::name[]
order by schemaname, tablename, policyname;

\echo === POLICY SUMMARY ===
select schemaname, tablename, policyname, cmd,
       array_to_string(roles, ',') as roles
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

\echo === STORAGE BUCKETS ===
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select bucket_id, count(*) as object_count,
       coalesce(sum((metadata ->> 'size')::bigint), 0) as total_bytes
from storage.objects
group by bucket_id
order by bucket_id;
