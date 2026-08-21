-- Backfill operational configuration tables from website_config.
-- Existing rows are never updated or deleted; only missing UUID ids are inserted.

insert into public.sucursales (id, tenant_id, nombre, direccion, telefono, activo)
select
  (item ->> 'id')::uuid,
  wc.tenant_id,
  coalesce(item ->> 'nombre', ''),
  coalesce(item ->> 'direccion', ''),
  coalesce(item ->> 'telefono', item ->> 'celular', ''),
  case lower(coalesce(item ->> 'activo', 'true')) when 'false' then false when '0' then false else true end
from public.website_config wc
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(wc.config -> 'sucursales') = 'array'
    then wc.config -> 'sucursales' else '[]'::jsonb end
) item
where coalesce(item ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (id) do nothing;

insert into public.bancos (id, tenant_id, nombre, tipo_cuenta, numero_cuenta, activo)
select
  (item ->> 'id')::uuid,
  wc.tenant_id,
  coalesce(item ->> 'nombre', ''),
  coalesce(item ->> 'tipo_cuenta', item ->> 'tipoCuenta', 'Ahorros'),
  coalesce(item ->> 'numero_cuenta', item ->> 'numeroCuenta', ''),
  case lower(coalesce(item ->> 'activo', 'true')) when 'false' then false when '0' then false else true end
from public.website_config wc
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(wc.config -> 'bancos') = 'array'
    then wc.config -> 'bancos' else '[]'::jsonb end
) item
where coalesce(item ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (id) do nothing;

insert into public.consecutivos (id, tenant_id, tipo, prefijo, ultimo_numero)
select
  (item ->> 'id')::uuid,
  wc.tenant_id,
  coalesce(item ->> 'tipo', item ->> 'nombre', 'general'),
  coalesce(item ->> 'prefijo', item ->> 'fvPrefijo', item ->> 'fePrefijoFactura', ''),
  case
    when coalesce(item ->> 'ultimo_numero', item ->> 'contReciboCaja', item ->> 'fvNumActual', item ->> 'feNumActual', '0') ~ '^[0-9]+$'
      then coalesce(item ->> 'ultimo_numero', item ->> 'contReciboCaja', item ->> 'fvNumActual', item ->> 'feNumActual', '0')::integer
    else 0
  end
from public.website_config wc
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(wc.config -> 'consecutivos') = 'array'
    then wc.config -> 'consecutivos' else '[]'::jsonb end
) item
where coalesce(item ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (id) do nothing;

insert into public.consultorios (id, tenant_id, sucursal_id, nombre, ubicacion, activo)
select
  (item ->> 'id')::uuid,
  wc.tenant_id,
  case
    when coalesce(item ->> 'sucursal_id', item ->> 'sucursalId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and exists (
        select 1 from public.sucursales s
        where s.id = coalesce(item ->> 'sucursal_id', item ->> 'sucursalId')::uuid
      )
      then coalesce(item ->> 'sucursal_id', item ->> 'sucursalId')::uuid
    else null
  end,
  coalesce(item ->> 'nombre', ''),
  coalesce(item ->> 'ubicacion', item ->> 'descripcion', ''),
  case lower(coalesce(item ->> 'activo', 'true')) when 'false' then false when '0' then false else true end
from public.website_config wc
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(wc.config -> 'recursos_fisicos') = 'array'
    then wc.config -> 'recursos_fisicos' else '[]'::jsonb end
) item
where coalesce(item ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (id) do nothing;

insert into public.especialidades (id, tenant_id, nombre, descripcion, activo)
select
  (item ->> 'id')::uuid,
  wc.tenant_id,
  coalesce(item ->> 'nombre', ''),
  coalesce(item ->> 'descripcion', ''),
  case lower(coalesce(item ->> 'activo', 'true')) when 'false' then false when '0' then false else true end
from public.website_config wc
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(wc.config -> 'especialidades') = 'array'
    then wc.config -> 'especialidades' else '[]'::jsonb end
) item
where coalesce(item ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (id) do nothing;

insert into public.listas_precios (id, tenant_id, nombre, descripcion, activa)
select
  (item ->> 'id')::uuid,
  wc.tenant_id,
  coalesce(item ->> 'nombre', ''),
  coalesce(item ->> 'descripcion', ''),
  case lower(coalesce(item ->> 'activa', 'true')) when 'false' then false when '0' then false else true end
from public.website_config wc
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(wc.config -> 'listas_precios') = 'array'
    then wc.config -> 'listas_precios' else '[]'::jsonb end
) item
where coalesce(item ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (id) do nothing;
