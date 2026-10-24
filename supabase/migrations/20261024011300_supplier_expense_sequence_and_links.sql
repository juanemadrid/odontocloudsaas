-- Financial JSON sections are authoritative in the self-hosted installation.
-- All mutations serialize on the tenant's configuration row and preserve other sections.
create or replace function public.consume_supplier_expense_number(p_tenant_id uuid)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare c jsonb; counters jsonb; first_counter jsonb; last_number bigint := 0; candidate text; entry jsonb;
begin
  if auth.uid() is null or not public.is_active_user() or
     (p_tenant_id is distinct from public.get_user_tenant_id() and not public.is_superadmin()) then
    raise exception 'No tiene acceso a los egresos de esta clinica' using errcode='42501';
  end if;
  select config into c from public.website_config where tenant_id=p_tenant_id for update;
  if not found then raise exception 'No existe la configuracion de la clinica'; end if;
  counters := coalesce(c->'consecutivos','[]'::jsonb);
  first_counter := coalesce(counters->0, jsonb_build_object('id','consecutivo-principal','nombre','Principal','tenant_id',p_tenant_id));
  foreach candidate in array array[first_counter->>'contEgresos',first_counter->>'egresos',first_counter->>'cont_egresos'] loop
    if candidate ~ '^[0-9]{1,12}$' then last_number := greatest(last_number,candidate::bigint); end if;
  end loop;
  for entry in select value from jsonb_array_elements(coalesce(c->'pagos_proveedor','[]'::jsonb)) loop
    candidate := coalesce(nullif(entry->>'consecutivo',''),nullif(entry->>'numero',''),nullif(entry->>'nroConsecutivo',''),nullif(entry->>'nroPago',''));
    if candidate ~ '^[0-9]{1,12}$' then last_number := greatest(last_number,candidate::bigint); end if;
  end loop;
  last_number := last_number + 1;
  first_counter := first_counter || jsonb_build_object('contEgresos',last_number,'egresos',last_number,'updated_at',now());
  if jsonb_array_length(counters)=0 then counters := jsonb_build_array(first_counter);
  else counters := jsonb_set(counters,'{0}',first_counter); end if;
  update public.website_config set config=jsonb_set(c,'{consecutivos}',counters)||jsonb_build_object('updatedAt',now()),updated_at=now() where tenant_id=p_tenant_id;
  return last_number;
end;
$$;

create or replace function public.create_supplier_expense(p_tenant_id uuid,p_payment jsonb,p_liquidacion_id text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c jsonb; payment jsonb; existing jsonb; liq jsonb; sequence_number text; entries jsonb; allocated numeric;
begin
  if auth.uid() is null or not public.is_active_user() or
     (p_tenant_id is distinct from public.get_user_tenant_id() and not public.is_superadmin()) then
    raise exception 'No tiene acceso a los egresos de esta clinica' using errcode='42501';
  end if;
  if jsonb_typeof(p_payment) is distinct from 'object' or coalesce(btrim(p_payment->>'id'),'')='' or
     coalesce((p_payment->>'monto')::numeric,0)<=0 or p_payment->>'monto' in ('NaN','Infinity','-Infinity') then raise exception 'El egreso no es valido'; end if;
  select config into c from public.website_config where tenant_id=p_tenant_id for update;
  if not found then raise exception 'No existe la configuracion de la clinica'; end if;
  select value into existing from jsonb_array_elements(coalesce(c->'pagos_proveedor','[]'::jsonb))
    where value->>'id'=p_payment->>'id' or (p_liquidacion_id is not null and value->>'liquidacionId'=p_liquidacion_id) limit 1;
  if found then
    if (existing->>'monto')::numeric is distinct from (p_payment->>'monto')::numeric or
       (p_liquidacion_id is not null and existing->>'liquidacionId' is distinct from p_liquidacion_id) then
      raise exception 'Ya existe otro egreso con este identificador';
    end if;
    return jsonb_build_object('pago',existing,'reused',true);
  end if;
  if p_liquidacion_id is not null then
    select value into liq from jsonb_array_elements(coalesce(c->'liquidaciones','[]'::jsonb)) where value->>'id'=p_liquidacion_id;
    if liq is null or lower(coalesce(liq->>'estado','')) in ('anulada','pagada') then
      raise exception 'La liquidacion no esta disponible para pago';
    end if;
    if (liq->>'totalPagar')::numeric is distinct from (p_payment->>'monto')::numeric then raise exception 'El valor de la liquidacion cambio. Actualice antes de pagar'; end if;
  end if;
  sequence_number := public.consume_supplier_expense_number(p_tenant_id)::text;
  select config into c from public.website_config where tenant_id=p_tenant_id;
  payment := p_payment || jsonb_build_object('tenant_id',p_tenant_id,'numero',sequence_number,'consecutivo',sequence_number,'nroConsecutivo',sequence_number,'nroPago',sequence_number);
  select coalesce(sum(coalesce((value->>'total')::numeric,0)),0) into allocated
    from jsonb_array_elements(coalesce(payment->'items','[]'::jsonb)) where value->>'isFactura'='true';
  if allocated>(payment->>'monto')::numeric then raise exception 'Las facturas superan el valor del egreso'; end if;
  payment := payment || jsonb_build_object('valorAplicado',allocated);
  if p_liquidacion_id is not null then payment := payment || jsonb_build_object('liquidacionId',p_liquidacion_id); end if;
  c := jsonb_set(c,'{pagos_proveedor}',jsonb_build_array(payment)||coalesce(c->'pagos_proveedor','[]'::jsonb));
  if p_liquidacion_id is not null then
    select jsonb_agg(case when value->>'id'=p_liquidacion_id then value || jsonb_build_object(
      'estado','Pagada','pagoProveedorId',payment->>'id','pagoConsecutivo',sequence_number,'fechaPago',payment->>'fecha',
      'medioPago',payment->>'medioPago','bancoCaja',payment->>'bancoCaja','pagadoPor',payment->>'created_by','updated_at',now()) else value end order by position)
      into entries from jsonb_array_elements(c->'liquidaciones') with ordinality as l(value,position);
    c := jsonb_set(c,'{liquidaciones}',entries);
  end if;
  update public.website_config set config=c||jsonb_build_object('updatedAt',now()),updated_at=now() where tenant_id=p_tenant_id;
  return jsonb_build_object('pago',payment,'reused',false);
end;
$$;

create or replace function public.associate_supplier_expense(p_tenant_id uuid,p_invoice_id text,p_payment_id text,p_amount numeric,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c jsonb; payment jsonb; invoice jsonb; other_invoice jsonb; entries jsonb; selection jsonb; allocations jsonb;
  sequence_number text; invoice_number text; total numeric; pending numeric; paid numeric; applied numeric := 0;
  used numeric := 0; linked numeric; item_amount numeric; amount_total numeric;
begin
  if auth.uid() is null or not public.is_active_user() or
     (p_tenant_id is distinct from public.get_user_tenant_id() and not public.is_superadmin()) then
    raise exception 'No tiene acceso a los egresos de esta clinica' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Falta el identificador de la solicitud'; end if;
  if p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2) then raise exception 'El valor a asociar no es valido'; end if;
  select config into c from public.website_config where tenant_id=p_tenant_id for update;
  select value into payment from jsonb_array_elements(coalesce(c->'pagos_proveedor','[]'::jsonb)) where value->>'id'=p_payment_id;
  select value into invoice from jsonb_array_elements(coalesce(c->'facturas_compra','[]'::jsonb)) where value->>'id'=p_invoice_id;
  if payment is null or invoice is null then raise exception 'No se encontro el egreso o el documento en esta clinica'; end if;
  if lower(coalesce(payment->>'estado','')) in ('anulado','anulada') or payment->>'anulado'='true' or
     lower(coalesce(invoice->>'estado','')) in ('anulada','anulado') then raise exception 'No se pueden asociar documentos anulados'; end if;
  sequence_number := coalesce(nullif(payment->>'consecutivo',''),nullif(payment->>'numero',''),nullif(payment->>'nroConsecutivo',''),nullif(payment->>'nroPago',''));
  if sequence_number is null then raise exception 'El egreso no tiene consecutivo asignado'; end if;
  for other_invoice in select value from jsonb_array_elements(coalesce(c->'facturas_compra','[]'::jsonb)) loop
    select value into selection from jsonb_array_elements(coalesce(other_invoice->'egresosAplicados','[]'::jsonb)) where value->>'requestId'=p_request_id::text limit 1;
    if found then
      if other_invoice->>'id'<>p_invoice_id or selection->>'egresoId'<>p_payment_id or (selection->>'valor')::numeric<>p_amount then raise exception 'La solicitud ya fue procesada con otros datos'; end if;
      return jsonb_build_object('factura',invoice,'pago',payment,'alreadyAssociated',true);
    end if;
  end loop;
  total := coalesce((invoice->>'totalNeto')::numeric,(invoice->>'total')::numeric,0);
  pending := coalesce((invoice->>'saldoPendiente')::numeric,(invoice->>'saldo_pendiente')::numeric,greatest(total-coalesce((invoice->>'valorPagado')::numeric,0),0));
  paid := coalesce((invoice->>'valorPagado')::numeric,total-pending);
  amount_total := coalesce((payment->>'monto')::numeric,(payment->>'total')::numeric,0);
  for other_invoice in select value from jsonb_array_elements(coalesce(c->'facturas_compra','[]'::jsonb)) loop
    select coalesce(sum((value->>'valor')::numeric),0) into linked
      from jsonb_array_elements(coalesce(other_invoice->'egresosAplicados','[]'::jsonb)) where value->>'egresoId'=p_payment_id;
    if linked=0 and other_invoice->>'egresoAsociadoId'=p_payment_id then
      linked := coalesce((other_invoice->>'valorPagado')::numeric,
        coalesce((other_invoice->>'totalNeto')::numeric,(other_invoice->>'total')::numeric,0)-coalesce((other_invoice->>'saldoPendiente')::numeric,(other_invoice->>'saldo_pendiente')::numeric,0));
    end if;
    select coalesce(sum(coalesce((value->>'total')::numeric,0)),0) into item_amount
      from jsonb_array_elements(coalesce(payment->'items','[]'::jsonb)) where value->>'isFactura'='true' and value->>'facturaId'=other_invoice->>'id';
    linked := greatest(linked,item_amount);
    used := used + linked;
    if other_invoice->>'id'=p_invoice_id then applied := linked; end if;
  end loop;
  if p_amount>pending then raise exception 'El valor supera el saldo del documento'; end if;
  if p_amount>amount_total-used then raise exception 'El valor supera el disponible del egreso'; end if;
  pending := pending-p_amount;
  paid := paid+p_amount;
  invoice := invoice || jsonb_build_object('saldoPendiente',pending,'saldo_pendiente',pending,'valorPagado',paid,'estado',case when pending=0 then 'Pagada' else 'Parcial' end);
  allocations := coalesce(invoice->'egresosAplicados','[]'::jsonb);
  if applied>0 and not exists(select 1 from jsonb_array_elements(allocations) where value->>'egresoId'=p_payment_id) then
    allocations := allocations || jsonb_build_array(jsonb_build_object('egresoId',p_payment_id,'numero',sequence_number,'valor',applied,'requestId','legacy:'||p_payment_id));
  end if;
  invoice := invoice || jsonb_build_object('egresoAsociadoId',p_payment_id,'egresoAsociadoDoc',sequence_number,
    'egresosAplicados',allocations||jsonb_build_array(jsonb_build_object('egresoId',p_payment_id,'numero',sequence_number,'valor',p_amount,'requestId',p_request_id)));
  select coalesce(jsonb_agg(value),'[]'::jsonb) into selection from jsonb_array_elements(coalesce(invoice->'egresos_asociados','[]'::jsonb)) where value#>>'{}' is distinct from p_payment_id;
  invoice := invoice || jsonb_build_object('egresos_asociados',selection||jsonb_build_array(p_payment_id));
  select coalesce(jsonb_agg(value),'[]'::jsonb) into selection from jsonb_array_elements(coalesce(payment->'facturasSeleccionadas','[]'::jsonb))
    where value#>>'{}' is distinct from p_invoice_id and value->>'id' is distinct from p_invoice_id;
  invoice_number := coalesce(invoice->>'nroFactura',invoice->>'documentoNumero',invoice->>'numero',p_invoice_id);
  payment := payment || jsonb_build_object('facturasSeleccionadas',selection||jsonb_build_array(p_invoice_id));
  payment := payment || jsonb_build_object('valorAplicado',used+p_amount);
  if coalesce(payment->>'facturaId','')='' then payment := payment || jsonb_build_object('facturaId',p_invoice_id,'factura_asociada',invoice_number); end if;
  select jsonb_agg(case when value->>'id'=p_invoice_id then invoice else value end order by position) into entries
    from jsonb_array_elements(c->'facturas_compra') with ordinality as f(value,position);
  c := jsonb_set(c,'{facturas_compra}',entries);
  select jsonb_agg(case when value->>'id'=p_payment_id then payment else value end order by position) into entries
    from jsonb_array_elements(c->'pagos_proveedor') with ordinality as p(value,position);
  c := jsonb_set(c,'{pagos_proveedor}',entries);
  update public.website_config set config=c||jsonb_build_object('updatedAt',now()),updated_at=now() where tenant_id=p_tenant_id;
  return jsonb_build_object('factura',invoice,'pago',payment,'alreadyAssociated',false);
end;
$$;

revoke all on function public.consume_supplier_expense_number(uuid) from public,anon;
revoke all on function public.create_supplier_expense(uuid,jsonb,text) from public,anon;
revoke all on function public.associate_supplier_expense(uuid,text,text,numeric,uuid) from public,anon;
grant execute on function public.consume_supplier_expense_number(uuid) to authenticated;
grant execute on function public.create_supplier_expense(uuid,jsonb,text) to authenticated;
grant execute on function public.associate_supplier_expense(uuid,text,text,numeric,uuid) to authenticated;
notify pgrst,'reload schema';
