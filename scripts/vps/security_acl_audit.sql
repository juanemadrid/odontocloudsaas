\pset pager off
\pset border 1

\echo === HIGH-RISK FUNCTION ACLS ===
select p.oid::regprocedure as function_signature,
       pg_get_userbyid(p.proowner) as owner,
       p.proacl,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'execute') as service_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_change_password', 'admin_create_clinic_user',
    'admin_force_change_password', 'get_subscription_request_password',
    'delete_subscription_request_password', 'store_subscription_request'
  )
order by p.proname;

\echo === API ROLE ATTRIBUTES ===
select rolname, rolsuper, rolinherit, rolcanlogin, rolbypassrls
from pg_roles
where rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
order by rolname;

\echo === API ROLE MEMBERSHIPS ===
select member_role.rolname as member_role, granted_role.rolname as granted_role
from pg_auth_members m
join pg_roles member_role on member_role.oid = m.member
join pg_roles granted_role on granted_role.oid = m.roleid
where member_role.rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
order by member_role.rolname, granted_role.rolname;

\echo === PUBLIC-ROLE POLICY EXPRESSIONS ===
select schemaname, tablename, policyname, cmd,
       coalesce(qual, '') as using_expression,
       coalesce(with_check, '') as check_expression
from pg_policies
where schemaname in ('public', 'storage')
  and roles @> array['public']::name[]
order by schemaname, tablename, policyname;
