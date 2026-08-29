\set ON_ERROR_STOP on

create temp table migration_fingerprints (
  scope text not null,
  object_name text not null,
  row_count bigint not null,
  content_hash text not null
);

do $$
declare
  target record;
  current_count bigint;
  current_hash text;
begin
  for target in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format(
      'select count(*), md5(coalesce(string_agg(row_hash, '''' order by row_hash), '''')) from (select md5(to_jsonb(t)::text) as row_hash from %I.%I as t) as hashes',
      target.schemaname,
      target.tablename
    ) into current_count, current_hash;

    insert into migration_fingerprints
    values ('public', target.tablename, current_count, current_hash);
  end loop;

  select count(*), md5(coalesce(string_agg(row_hash, '' order by row_hash), ''))
  into current_count, current_hash
  from (
    select md5(to_jsonb(login_material)::text) as row_hash
    from (
      select
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_anonymous,
        banned_until
      from auth.users
    ) as login_material
  ) as hashes;

  insert into migration_fingerprints
  values ('auth', 'users_login_material', current_count, current_hash);

  for target in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'storage'
      and tablename in ('buckets', 'objects')
    order by tablename
  loop
    execute format(
      'select count(*), md5(coalesce(string_agg(row_hash, '''' order by row_hash), '''')) from (select md5(to_jsonb(t)::text) as row_hash from %I.%I as t) as hashes',
      target.schemaname,
      target.tablename
    ) into current_count, current_hash;

    insert into migration_fingerprints
    values ('storage', target.tablename, current_count, current_hash);
  end loop;
end $$;

select scope, object_name, row_count, content_hash
from migration_fingerprints
order by scope, object_name;
