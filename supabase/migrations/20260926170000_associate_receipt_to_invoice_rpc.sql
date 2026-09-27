-- ==============================================================================
-- Migration: 20260926170000_associate_receipt_to_invoice_rpc.sql
-- Module: Facturación Electrónica (FEV) & Recibos de Caja (P1-FEV1-R2)
-- Description: RPC transaccional atómica para asociar/desasociar recibos de caja
--              a facturas (FEV), garantizando atomicidad entre recibos_caja.factura_id
--              y el modelo de lectura desnormalizado facturas.detalles.
-- ==============================================================================

-- 1. RPC Transaccional: associate_receipt_to_invoice
CREATE OR REPLACE FUNCTION public.associate_receipt_to_invoice(
  p_tenant_id UUID,
  p_factura_id UUID,
  p_recibo_id UUID,
  p_user_identifier TEXT DEFAULT 'Usuario',
  p_is_pago BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_factura RECORD;
  v_recibo RECORD;
  v_pago RECORD;
  v_recibo_numero TEXT;
  v_recibo_monto NUMERIC(12,2);
  v_recibo_fecha TEXT;
  v_recibo_metodo TEXT;
  v_recibo_paciente_id UUID;
  v_recibo_tenant_id UUID;
  v_tabla_origen TEXT;
  
  v_detalles JSONB;
  v_recibos_asociados JSONB;
  v_nuevo_enlace JSONB;
  v_item JSONB;
  v_item_id TEXT;
  v_total_pagado NUMERIC(12,2) := 0;
  v_saldo_pendiente NUMERIC(12,2) := 0;
  v_estado_pago TEXT := 'PENDIENTE';
BEGIN
  -- Validar parámetros obligatorios
  IF p_tenant_id IS NULL OR p_factura_id IS NULL OR p_recibo_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: tenant_id, factura_id y recibo_id son obligatorios.';
  END IF;

  -- Obtener factura con bloqueo pesimista y validar pertenencia de tenant
  SELECT * INTO v_factura
  FROM public.facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FACTURA_NOT_FOUND: No se encontró la factura con id %', p_factura_id;
  END IF;

  IF v_factura.tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: La factura pertenece a un tenant diferente (% vs %)', v_factura.tenant_id, p_tenant_id;
  END IF;

  -- Obtener recibo o pago y validar pertenencia
  IF NOT p_is_pago THEN
    v_tabla_origen := 'recibos_caja';
    SELECT * INTO v_recibo
    FROM public.recibos_caja
    WHERE id = p_recibo_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'RECIBO_NOT_FOUND: No se encontró el recibo en recibos_caja con id %', p_recibo_id;
    END IF;

    v_recibo_tenant_id := v_recibo.tenant_id;
    v_recibo_paciente_id := v_recibo.paciente_id;
    v_recibo_numero := COALESCE(v_recibo.nro_consecutivo, 'REC-' || SUBSTRING(p_recibo_id::text, 1, 6));
    v_recibo_monto := COALESCE(v_recibo.total, 0);
    v_recibo_fecha := COALESCE(v_recibo.fecha::text, v_recibo.created_at::text, NOW()::text);
    v_recibo_metodo := COALESCE(v_recibo.medio_pago, 'Efectivo');
  ELSE
    v_tabla_origen := 'pagos';
    SELECT * INTO v_pago
    FROM public.pagos
    WHERE id = p_recibo_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PAGO_NOT_FOUND: No se encontró el pago en pagos con id %', p_recibo_id;
    END IF;

    v_recibo_tenant_id := v_pago.tenant_id;
    v_recibo_paciente_id := v_pago.paciente_id;
    v_recibo_numero := COALESCE(v_pago.numero, 'PAG-' || SUBSTRING(p_recibo_id::text, 1, 6));
    v_recibo_monto := COALESCE(v_pago.monto, 0);
    v_recibo_fecha := COALESCE(v_pago.fecha::text, v_pago.created_at::text, NOW()::text);
    v_recibo_metodo := COALESCE(v_pago.metodo_pago, 'Efectivo');
  END IF;

  -- Validar regla de seguridad Cross-Tenant
  IF v_recibo_tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: El recibo pertenece a un tenant diferente (% vs %)', v_recibo_tenant_id, p_tenant_id;
  END IF;

  -- Validar regla de seguridad Cross-Patient
  IF v_factura.paciente_id IS NOT NULL AND v_recibo_paciente_id IS NOT NULL AND v_factura.paciente_id <> v_recibo_paciente_id THEN
    RAISE EXCEPTION 'CROSS_PATIENT_VIOLATION: El recibo pertenece al paciente %, diferente al de la factura (%)', v_recibo_paciente_id, v_factura.paciente_id;
  END IF;

  -- Validar anti-duplicidad en detalles JSONB
  v_detalles := COALESCE(v_factura.detalles, '{}'::jsonb);
  IF jsonb_typeof(v_detalles) <> 'object' THEN
    v_detalles := '{}'::jsonb;
  END IF;

  IF v_detalles ? 'recibos_asociados' AND jsonb_typeof(v_detalles->'recibos_asociados') = 'array' THEN
    v_recibos_asociados := v_detalles->'recibos_asociados';
  ELSE
    v_recibos_asociados := '[]'::jsonb;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_recibos_asociados)
  LOOP
    v_item_id := COALESCE(v_item->>'id', v_item->>'recibo_id');
    IF v_item_id = p_recibo_id::text THEN
      RAISE EXCEPTION 'DUPLICATE_LINK_VIOLATION: El recibo ya está asociado a esta factura';
    END IF;
  END LOOP;

  -- Construir nuevo enlace estructurado
  v_nuevo_enlace := jsonb_build_object(
    'id', p_recibo_id,
    'recibo_id', p_recibo_id,
    'numero', v_recibo_numero,
    'monto', v_recibo_monto,
    'fecha', v_recibo_fecha,
    'metodo', v_recibo_metodo,
    'paciente_id', v_recibo_paciente_id,
    'tenant_id', p_tenant_id,
    'asociado_at', NOW()::text,
    'asociado_por', COALESCE(p_user_identifier, 'Usuario'),
    'tabla_origen', v_tabla_origen
  );

  v_recibos_asociados := v_recibos_asociados || jsonb_build_array(v_nuevo_enlace);

  -- Calcular métricas financieras de pago
  v_total_pagado := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_recibos_asociados)
  LOOP
    v_total_pagado := v_total_pagado + COALESCE((v_item->>'monto')::numeric, 0);
  END LOOP;

  v_saldo_pendiente := GREATEST(0, COALESCE(v_factura.total, 0) - v_total_pagado);
  IF v_saldo_pendiente <= 0.001 THEN
    v_estado_pago := 'PAGADO';
  ELSIF v_total_pagado > 0 THEN
    v_estado_pago := 'PARCIAL';
  ELSE
    v_estado_pago := 'PENDIENTE';
  END IF;

  v_detalles := v_detalles || jsonb_build_object(
    'recibos_asociados', v_recibos_asociados,
    'recibo_asociado', v_nuevo_enlace,
    'monto_pagado', v_total_pagado,
    'saldo_pendiente', v_saldo_pendiente,
    'estado_pago', v_estado_pago
  );

  -- 1. Actualizar recibo o pago (Vínculo relacional autoritativo)
  IF NOT p_is_pago THEN
    UPDATE public.recibos_caja
    SET factura_id = p_factura_id,
        updated_at = NOW()
    WHERE id = p_recibo_id;
  ELSE
    UPDATE public.pagos
    SET factura_id = p_factura_id,
        updated_at = NOW()
    WHERE id = p_recibo_id;
  END IF;

  -- 2. Actualizar factura (Resumen desnormalizado / UI metadata)
  UPDATE public.facturas
  SET detalles = v_detalles,
      updated_at = NOW()
  WHERE id = p_factura_id;

  RETURN jsonb_build_object(
    'success', true,
    'factura_id', p_factura_id,
    'recibo_id', p_recibo_id,
    'monto_pagado', v_total_pagado,
    'saldo_pendiente', v_saldo_pendiente,
    'estado_pago', v_estado_pago,
    'link', v_nuevo_enlace
  );
END;
$$;

-- 2. RPC Transaccional: unlink_receipt_from_invoice
CREATE OR REPLACE FUNCTION public.unlink_receipt_from_invoice(
  p_tenant_id UUID,
  p_factura_id UUID,
  p_recibo_id UUID,
  p_is_pago BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_factura RECORD;
  v_detalles JSONB;
  v_recibos_asociados JSONB;
  v_filtrados JSONB := '[]'::jsonb;
  v_item JSONB;
  v_item_id TEXT;
  v_ultimo_recibo JSONB := NULL;
  v_total_pagado NUMERIC(12,2) := 0;
  v_saldo_pendiente NUMERIC(12,2) := 0;
  v_estado_pago TEXT := 'PENDIENTE';
BEGIN
  IF p_tenant_id IS NULL OR p_factura_id IS NULL OR p_recibo_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: tenant_id, factura_id y recibo_id son obligatorios.';
  END IF;

  SELECT * INTO v_factura
  FROM public.facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FACTURA_NOT_FOUND: Factura no encontrada.';
  END IF;

  IF v_factura.tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: La factura pertenece a un tenant diferente.';
  END IF;

  v_detalles := COALESCE(v_factura.detalles, '{}'::jsonb);
  IF jsonb_typeof(v_detalles) <> 'object' THEN
    v_detalles := '{}'::jsonb;
  END IF;

  IF v_detalles ? 'recibos_asociados' AND jsonb_typeof(v_detalles->'recibos_asociados') = 'array' THEN
    v_recibos_asociados := v_detalles->'recibos_asociados';
  ELSE
    v_recibos_asociados := '[]'::jsonb;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_recibos_asociados)
  LOOP
    v_item_id := COALESCE(v_item->>'id', v_item->>'recibo_id');
    IF v_item_id <> p_recibo_id::text THEN
      v_filtrados := v_filtrados || jsonb_build_array(v_item);
      v_total_pagado := v_total_pagado + COALESCE((v_item->>'monto')::numeric, 0);
      v_ultimo_recibo := v_item;
    END IF;
  END LOOP;

  v_saldo_pendiente := GREATEST(0, COALESCE(v_factura.total, 0) - v_total_pagado);
  IF v_saldo_pendiente <= 0.001 THEN
    v_estado_pago := 'PAGADO';
  ELSIF v_total_pagado > 0 THEN
    v_estado_pago := 'PARCIAL';
  ELSE
    v_estado_pago := 'PENDIENTE';
  END IF;

  v_detalles := v_detalles || jsonb_build_object(
    'recibos_asociados', v_filtrados,
    'recibo_asociado', v_ultimo_recibo,
    'monto_pagado', v_total_pagado,
    'saldo_pendiente', v_saldo_pendiente,
    'estado_pago', v_estado_pago
  );

  -- 1. Limpiar vínculo relacional
  IF NOT p_is_pago THEN
    UPDATE public.recibos_caja
    SET factura_id = NULL,
        updated_at = NOW()
    WHERE id = p_recibo_id AND factura_id = p_factura_id;
  ELSE
    UPDATE public.pagos
    SET factura_id = NULL,
        updated_at = NOW()
    WHERE id = p_recibo_id AND factura_id = p_factura_id;
  END IF;

  -- 2. Actualizar JSONB de factura
  UPDATE public.facturas
  SET detalles = v_detalles,
      updated_at = NOW()
  WHERE id = p_factura_id;

  RETURN jsonb_build_object(
    'success', true,
    'factura_id', p_factura_id,
    'recibo_id', p_recibo_id,
    'monto_pagado', v_total_pagado,
    'saldo_pendiente', v_saldo_pendiente,
    'estado_pago', v_estado_pago
  );
END;
$$;

-- 3. Permisos
GRANT EXECUTE ON FUNCTION public.associate_receipt_to_invoice(UUID, UUID, UUID, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlink_receipt_from_invoice(UUID, UUID, UUID, BOOLEAN) TO authenticated, service_role;

COMMENT ON FUNCTION public.associate_receipt_to_invoice IS 'Asocia atómicamente un recibo a una factura actualizando recibos_caja.factura_id y facturas.detalles con validaciones cross-tenant y cross-patient.';
COMMENT ON FUNCTION public.unlink_receipt_from_invoice IS 'Desvincula atómicamente un recibo de una factura limpiando recibos_caja.factura_id y recalculando facturas.detalles.';
