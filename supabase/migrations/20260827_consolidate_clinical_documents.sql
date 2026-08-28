-- Consolida documentos clínicos sin modificar la clave primaria UUID.
-- legacy_id conserva los identificadores históricos usados por el frontend.
-- Esta migración copia los documentos y mantiene intacto el respaldo embebido.

begin;

alter table public.documentos_clinicos
  add column if not exists legacy_id text,
  add column if not exists tipo_documento text,
  add column if not exists estado text,
  add column if not exists firma_doctor text,
  add column if not exists firmado_en timestamptz,
  add column if not exists firmado_por uuid,
  add column if not exists creado_por uuid,
  add column if not exists fecha_documento date;

create unique index if not exists documentos_clinicos_tenant_legacy_id_idx
  on public.documentos_clinicos (tenant_id, legacy_id)
  where legacy_id is not null;

create index if not exists documentos_clinicos_tenant_patient_created_idx
  on public.documentos_clinicos (tenant_id, paciente_id, created_at desc);

create index if not exists documentos_clinicos_tipo_documento_idx
  on public.documentos_clinicos (tipo_documento);

with legacy_docs as (
  select
    p.id as paciente_id,
    p.tenant_id,
    entry.doc
  from public.pacientes as p
  cross join lateral jsonb_array_elements(
    coalesce(p.historial_medico -> 'documentosClinicos', '[]'::jsonb)
  ) as entry(doc)
  where coalesce(entry.doc ->> 'id', '') <> ''
),
normalized as (
  select
    doc ->> 'id' as legacy_id,
    tenant_id,
    paciente_id,
    coalesce(doc ->> 'tipo', doc ->> 'tipoDocumento', 'Documento') as tipo,
    coalesce(doc ->> 'tipoDocumento', doc ->> 'tipo', 'Documento') as tipo_documento,
    coalesce(doc ->> 'titulo', doc ->> 'tipoDocumento', doc ->> 'tipo', 'Documento') as titulo,
    coalesce(doc ->> 'contenido', '') as contenido,
    coalesce(doc ->> 'estado', 'Borrador') as estado,
    case when lower(coalesce(doc ->> 'firmado', 'false')) in ('true', '1', 'yes') then true else false end as firmado,
    coalesce(doc -> 'receta_items', doc -> 'recetaItems', '[]'::jsonb) as receta_items,
    (
      doc - array[
        'id', 'tenant_id', 'paciente_id', 'tipo', 'tipoDocumento', 'titulo',
        'contenido', 'estado', 'firmado', 'receta_items', 'recetaItems',
        'created_at', 'updated_at', 'metadata', 'doctorSignature'
      ]
    )
      || case when jsonb_typeof(doc -> 'metadata') = 'object'
              then doc -> 'metadata' else '{}'::jsonb end
      || case when coalesce(doc -> 'doctorSignature', doc -> 'metadata' -> 'doctorSignature') is not null
              then jsonb_build_object(
                'doctorSignature',
                coalesce(doc -> 'doctorSignature', doc -> 'metadata' -> 'doctorSignature')
              )
              else '{}'::jsonb end as metadata,
    case when coalesce(doc ->> 'created_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
         then (doc ->> 'created_at')::timestamptz else now() end as created_at,
    case when coalesce(doc ->> 'updated_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
         then (doc ->> 'updated_at')::timestamptz
         when coalesce(doc ->> 'created_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
         then (doc ->> 'created_at')::timestamptz else now() end as updated_at,
    case when coalesce(doc ->> 'fechaIso', doc ->> 'created_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
         then left(coalesce(doc ->> 'fechaIso', doc ->> 'created_at'), 10)::date
         else current_date end as fecha_documento
  from legacy_docs
)
insert into public.documentos_clinicos (
  legacy_id, tenant_id, paciente_id, tipo, tipo_documento, titulo, contenido,
  estado, firmado, receta_items, metadata, created_at, updated_at, fecha_documento
)
select
  n.legacy_id, n.tenant_id, n.paciente_id, n.tipo, n.tipo_documento, n.titulo,
  n.contenido, n.estado, n.firmado, n.receta_items, n.metadata,
  n.created_at, n.updated_at, n.fecha_documento
from normalized as n
where not exists (
  select 1
  from public.documentos_clinicos as existing
  where existing.tenant_id = n.tenant_id
    and existing.legacy_id = n.legacy_id
);

commit;
