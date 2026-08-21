-- Low-risk indexes and Realtime publication entries used by existing frontend channels.
begin;

create index if not exists notificaciones_tenant_target_created_idx
on public.notificaciones (tenant_id, target, created_at desc);

create index if not exists pacientes_tenant_created_idx
on public.pacientes (tenant_id, created_at desc);

create index if not exists treatment_plans_tenant_patient_idx
on public.treatment_plans (tenant_id, paciente_id);

create index if not exists documentos_clinicos_tenant_patient_created_idx
on public.documentos_clinicos (tenant_id, paciente_id, created_at desc);

create index if not exists odontogramas_tenant_patient_created_idx
on public.odontogramas (tenant_id, paciente_id, created_at desc);

create index if not exists pagos_tenant_patient_created_idx
on public.pagos (tenant_id, paciente_id, created_at desc);

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'notificaciones',
    'odontogramas',
    'citas',
    'pacientes',
    'cajas'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end;
$$;

commit;
