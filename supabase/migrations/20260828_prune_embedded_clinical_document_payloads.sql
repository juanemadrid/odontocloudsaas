-- Reduce el egreso de pacientes conservando una copia reversible fuera del
-- registro operativo. La aplicación leerá el contenido desde
-- documentos_clinicos y solo mantendrá índices livianos en historial_medico.

begin;

create table if not exists public.clinical_document_legacy_backups (
  patient_id uuid primary key references public.pacientes(id) on delete cascade,
  tenant_id uuid not null,
  documentos jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.clinical_document_legacy_backups enable row level security;
revoke all on table public.clinical_document_legacy_backups from anon, authenticated;

insert into public.clinical_document_legacy_backups (patient_id, tenant_id, documentos)
select
  p.id,
  p.tenant_id,
  p.historial_medico -> 'documentosClinicos'
from public.pacientes as p
where jsonb_array_length(
  coalesce(p.historial_medico -> 'documentosClinicos', '[]'::jsonb)
) > 0
on conflict (patient_id) do nothing;

with lightweight_docs as (
  select
    d.paciente_id,
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', d.legacy_id,
          'database_id', d.id,
          'tipo', d.tipo,
          'tipoDocumento', d.tipo_documento,
          'titulo', d.titulo,
          'estado', d.estado,
          'firmado', d.firmado,
          'fechaIso', d.fecha_documento,
          'created_at', d.created_at,
          'updated_at', d.updated_at
        )
      )
      order by d.created_at desc
    ) as documentos
  from public.documentos_clinicos as d
  where d.legacy_id is not null
  group by d.paciente_id
)
update public.pacientes as p
set historial_medico = jsonb_set(
  coalesce(p.historial_medico, '{}'::jsonb),
  '{documentosClinicos}',
  l.documentos,
  true
)
from lightweight_docs as l
where p.id = l.paciente_id
  and exists (
    select 1
    from public.clinical_document_legacy_backups as backup
    where backup.patient_id = p.id
  );

commit;

