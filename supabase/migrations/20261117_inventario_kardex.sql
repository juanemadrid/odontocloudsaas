-- =====================================================================
-- INVENTARIO: kardex de movimientos (entradas, salidas y ajustes)
-- 17/11/2026 — SOLO AGREGA: no borra ni cambia datos existentes.
--  * public.inventario: se agregan columnas opcionales (unidad, activo, updated_at).
--  * public.inventario_movimientos: tabla nueva (historial inmutable por clínica).
--  * public.inventario_registrar_movimiento(): única vía para mover el stock,
--    en una sola transacción (bloquea la fila, valida, actualiza y registra).
-- Se puede ejecutar más de una vez sin efectos dobles.
-- =====================================================================

BEGIN;

ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'UND';
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Si el producto se elimina en Lista de precios, el historial se conserva (con nombre y código copiados).
  producto_id UUID REFERENCES public.inventario(id) ON DELETE SET NULL,
  producto_nombre TEXT NOT NULL,
  producto_codigo TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  motivo TEXT,
  cantidad INTEGER NOT NULL,            -- con signo: + entra, - sale
  stock_anterior INTEGER NOT NULL,
  stock_nuevo INTEGER NOT NULL CHECK (stock_nuevo >= 0),
  costo_unitario NUMERIC(14,2),
  lote TEXT,
  fecha_vencimiento DATE,
  tercero_id TEXT,
  tercero_nombre TEXT,
  documento TEXT,
  observaciones TEXT,
  usuario_id UUID,
  usuario_nombre TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_tenant_fecha ON public.inventario_movimientos (tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_producto ON public.inventario_movimientos (producto_id, fecha DESC);

ALTER TABLE public.inventario_movimientos ENABLE ROW LEVEL SECURITY;

-- Solo lectura para los usuarios de la misma clínica. No hay políticas de INSERT/UPDATE/DELETE:
-- los movimientos solo se crean con la función de abajo y nunca se editan ni se borran.
DROP POLICY IF EXISTS inventario_movimientos_tenant_select ON public.inventario_movimientos;
CREATE POLICY inventario_movimientos_tenant_select ON public.inventario_movimientos
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

REVOKE ALL ON public.inventario_movimientos FROM anon;
GRANT SELECT ON public.inventario_movimientos TO authenticated;

CREATE OR REPLACE FUNCTION public.inventario_registrar_movimiento(
  p_producto_id UUID,
  p_tipo TEXT,
  p_cantidad INTEGER,              -- entrada/salida: unidades (> 0). ajuste: conteo físico (>= 0)
  p_motivo TEXT DEFAULT NULL,
  p_costo_unitario NUMERIC DEFAULT NULL,
  p_lote TEXT DEFAULT NULL,
  p_fecha_vencimiento DATE DEFAULT NULL,
  p_tercero_id TEXT DEFAULT NULL,
  p_tercero_nombre TEXT DEFAULT NULL,
  p_documento TEXT DEFAULT NULL,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS public.inventario_movimientos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID := public.get_user_tenant_id();
  v_prod public.inventario%ROWTYPE;
  v_anterior INTEGER;
  v_delta INTEGER;
  v_nuevo INTEGER;
  v_usuario TEXT;
  v_mov public.inventario_movimientos;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuario sin clínica activa.' USING ERRCODE = '42501';
  END IF;
  IF p_tipo NOT IN ('entrada', 'salida', 'ajuste') THEN
    RAISE EXCEPTION 'Tipo de movimiento no válido.';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad < 0 OR (p_tipo <> 'ajuste' AND p_cantidad = 0) THEN
    RAISE EXCEPTION 'La cantidad no es válida.';
  END IF;

  SELECT * INTO v_prod FROM public.inventario
   WHERE id = p_producto_id AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado en esta clínica.';
  END IF;
  IF COALESCE(v_prod.es_servicio, false) THEN
    RAISE EXCEPTION 'Los servicios no manejan inventario.';
  END IF;

  v_anterior := COALESCE(v_prod.cantidad, 0);
  IF p_tipo = 'entrada' THEN
    v_delta := p_cantidad;
  ELSIF p_tipo = 'salida' THEN
    v_delta := -p_cantidad;
  ELSE
    v_delta := p_cantidad - v_anterior;
    IF v_delta = 0 THEN
      RAISE EXCEPTION 'El conteo es igual al stock actual; no hay nada que ajustar.';
    END IF;
  END IF;
  v_nuevo := v_anterior + v_delta;
  IF v_nuevo < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente: hay % y se intentan sacar %.', v_anterior, p_cantidad;
  END IF;

  UPDATE public.inventario
     SET cantidad = v_nuevo,
         precio_costo = CASE WHEN p_tipo = 'entrada' AND p_costo_unitario IS NOT NULL AND p_costo_unitario > 0
                             THEN p_costo_unitario ELSE precio_costo END,
         updated_at = now()
   WHERE id = v_prod.id;

  SELECT NULLIF(btrim(full_name), '') INTO v_usuario FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.inventario_movimientos (
    tenant_id, producto_id, producto_nombre, producto_codigo, tipo, motivo, cantidad,
    stock_anterior, stock_nuevo, costo_unitario, lote, fecha_vencimiento,
    tercero_id, tercero_nombre, documento, observaciones, usuario_id, usuario_nombre
  ) VALUES (
    v_tenant, v_prod.id, v_prod.nombre, v_prod.codigo, p_tipo, NULLIF(btrim(p_motivo), ''), v_delta,
    v_anterior, v_nuevo, p_costo_unitario, NULLIF(btrim(p_lote), ''), p_fecha_vencimiento,
    NULLIF(btrim(p_tercero_id), ''), NULLIF(btrim(p_tercero_nombre), ''), NULLIF(btrim(p_documento), ''),
    NULLIF(btrim(p_observaciones), ''), auth.uid(), v_usuario
  ) RETURNING * INTO v_mov;

  RETURN v_mov;
END;
$$;

REVOKE ALL ON FUNCTION public.inventario_registrar_movimiento(UUID, TEXT, INTEGER, TEXT, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventario_registrar_movimiento(UUID, TEXT, INTEGER, TEXT, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;

-- PostgREST: recargar el esquema para que la función y la tabla nuevas queden disponibles de inmediato.
NOTIFY pgrst, 'reload schema';
