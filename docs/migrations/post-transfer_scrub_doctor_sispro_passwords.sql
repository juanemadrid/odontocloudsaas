-- docs/migrations/post-transfer_scrub_doctor_sispro_passwords.sql
-- ============================================================================
-- POST-TRANSFER ONLY — DO NOT DEPLOY BEFORE SECRET MIGRATION JOB
-- ============================================================================
-- Esta migración es un cinturón defensivo que solo debe ejecutarse DESPUÉS de que
-- el job de migración (scripts/migrate_doctor_sispro_secrets.mjs) haya transferido
-- y verificado todos los secretos en tenant_secrets.
-- NUNCA aplicar en un deployment antes de la ejecución exitosa de dicho job.
-- ============================================================================

update public.website_config
set config = jsonb_set(
  config,
  '{user_details}',
  (
    select coalesce(
      jsonb_object_agg(
        d.key,
        case
          when jsonb_typeof(d.value) = 'object' then d.value - 'ripsSisproPassword'
          else d.value
        end
      ),
      '{}'::jsonb
    )
    from jsonb_each(config -> 'user_details') as d
  )
)
where jsonb_typeof(config -> 'user_details') = 'object'
  and exists (
    select 1
    from jsonb_each(config -> 'user_details') as d(k, v)
    where jsonb_typeof(v) = 'object'
      and v ? 'ripsSisproPassword'
  );
