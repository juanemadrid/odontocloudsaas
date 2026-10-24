-- Run after the migration inside BEGIN ... ROLLBACK. No fixture is ever committed.
select p.id as test_actor,p.tenant_id as test_tenant from public.profiles p
join public.tenants t on t.id=p.tenant_id where p.activo is distinct from false and p.tenant_id is not null and lower(coalesce(p.role,'')) not in ('superadmin','super_admin') order by p.role='administrador' desc limit 1 \gset
select id as other_tenant from public.tenants where id<>:'test_tenant' limit 1 \gset
select set_config('request.jwt.claim.sub',:'test_actor',true) is not null as authenticated;
select set_config('test.tenant',:'test_tenant',true) is not null as own_tenant;
select set_config('test.other_tenant',:'other_tenant',true) is not null as other_tenant;
set local role authenticated;
do $$
declare t uuid := current_setting('test.tenant')::uuid; result jsonb; again jsonb; c jsonb; n bigint; failed boolean;
begin
  update public.website_config set config=config || jsonb_build_object(
    'consecutivos',jsonb_build_array(jsonb_build_object('id','qa-counter','contEgresos',100)),
    'pagos_proveedor',jsonb_build_array(jsonb_build_object('id','qa-old','numero','150','monto',1)),
    'liquidaciones',jsonb_build_array(jsonb_build_object('id','qa-liq','estado','Generada','totalPagar',270000)),
    'facturas_compra',jsonb_build_array(
      jsonb_build_object('id','qa-invoice','nroFactura','QA-001','total',270000,'saldoPendiente',270000,'valorPagado',0),
      jsonb_build_object('id','qa-partial','nroFactura','QA-002','total',1000,'saldoPendiente',1000,'valorPagado',0),
      jsonb_build_object('id','qa-other','nroFactura','QA-003','total',1000,'saldoPendiente',1000,'valorPagado',0))) where tenant_id=t;

  result := public.create_supplier_expense(t,'{"id":"qa-liq-payment","monto":270000,"fecha":"2026-10-23","liquidacionId":"qa-liq"}', 'qa-liq');
  assert result->'pago'->>'numero'='151','Counter must include existing expenses when configuration is behind';
  again := public.create_supplier_expense(t,'{"id":"qa-retry","monto":270000}', 'qa-liq');
  assert again->'pago'->>'id'='qa-liq-payment' and again->>'reused'='true','Repeated liquidation payment must reuse the existing expense';
  select config into c from public.website_config where tenant_id=t;
  assert c->'consecutivos'->0->>'contEgresos'='151','Retry must not consume another consecutive';
  assert c->'liquidaciones'->0->>'estado'='Pagada','Liquidation and expense must commit together';
  result := public.create_supplier_expense(t,'{"id":"qa-manual","monto":2000,"fecha":"2026-10-23"}');
  assert result->'pago'->>'numero'='152','Manual expenses and liquidations must share the counter';

  result := public.associate_supplier_expense(t,'qa-invoice','qa-liq-payment',270000,'00000000-0000-4000-8000-000000000001');
  assert result->'factura'->>'saldoPendiente'='0' and result->'factura'->>'valorPagado'='270000','Full payment balance';
  assert result->'factura'->>'egresoAsociadoDoc'='151','Associated number must be the official expense consecutive';
  assert result->'pago'->'facturasSeleccionadas' @> '["qa-invoice"]','The expense must reference the invoice';
  again := public.associate_supplier_expense(t,'qa-invoice','qa-liq-payment',270000,'00000000-0000-4000-8000-000000000001');
  assert again->>'alreadyAssociated'='true' and again->'factura'->>'valorPagado'='270000','Network retry must not double the payment';
  failed := false;
  begin perform public.associate_supplier_expense(t,'qa-other','qa-liq-payment',1000,'00000000-0000-4000-8000-000000000002');
  exception when others then failed:=true; end;
  assert failed,'Cannot reuse money already assigned to another document';

  result := public.associate_supplier_expense(t,'qa-partial','qa-manual',500,'00000000-0000-4000-8000-000000000003');
  assert result->'factura'->>'saldoPendiente'='500' and result->'factura'->>'estado'='Parcial','Partial association must preserve the remaining balance';
  result := public.associate_supplier_expense(t,'qa-partial','qa-manual',500,'00000000-0000-4000-8000-000000000004');
  assert result->'factura'->>'saldoPendiente'='0' and result->'factura'->>'valorPagado'='1000','A distinct partial payment may complete the same document';
  assert result->'pago'->>'valorAplicado'='1000','Available expense amount must reflect all partial associations';
  failed := false;
  begin perform public.consume_supplier_expense_number(current_setting('test.other_tenant')::uuid);
  exception when insufficient_privilege then failed:=true; end;
  assert failed,'Cannot allocate another clinic consecutive';
  failed := false;
  begin perform public.associate_supplier_expense(t,'qa-other','qa-manual',1001,'00000000-0000-4000-8000-000000000005');
  exception when others then failed:=true; end;
  assert failed,'Cannot associate more than the invoice balance';
  raise notice 'PASS: shared sequence, stale counter recovery, liquidation idempotency, bidirectional links, retry safety, partial payments, budget limits and tenant isolation';
end;
$$;
