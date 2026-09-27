-- Migration: 20260926_fev_operation_locks.sql
-- Microfase P1-FEV2-R: Atomic backend concurrency guard for FEV operations
-- Prevents concurrent retry / status check / delete across tabs, browsers, users, and serverless instances.

CREATE TABLE IF NOT EXISTS public.fev_operation_locks (
  tenant_id UUID NOT NULL,
  factura_id UUID NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('IDLE', 'CHECKING_STATUS', 'RETRYING', 'DELETING')),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  lock_token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes'),
  CONSTRAINT pk_fev_operation_locks PRIMARY KEY (tenant_id, factura_id)
);

CREATE INDEX IF NOT EXISTS idx_fev_operation_locks_expires 
  ON public.fev_operation_locks (expires_at);

-- RLS
ALTER TABLE public.fev_operation_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fev_operation_locks_tenant_isolation" ON public.fev_operation_locks;
CREATE POLICY "fev_operation_locks_tenant_isolation" ON public.fev_operation_locks
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR (
      is_active_user() 
      AND (((tenant_id)::text = (get_user_tenant_id())::text) OR is_superadmin())
    )
  );

-- RPC: acquire_fev_operation_lock
CREATE OR REPLACE FUNCTION public.acquire_fev_operation_lock(
  p_tenant_id UUID,
  p_factura_id UUID,
  p_state TEXT,
  p_locked_by TEXT DEFAULT NULL,
  p_timeout_seconds INT DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_lock_token UUID := gen_random_uuid();
  v_timeout INT := COALESCE(p_timeout_seconds, 120);
  v_expires_at TIMESTAMPTZ := v_now + (v_timeout || ' seconds')::interval;
  v_existing RECORD;
BEGIN
  IF p_state NOT IN ('CHECKING_STATUS', 'RETRYING', 'DELETING') THEN
    RAISE EXCEPTION 'Invalid lock state: %', p_state;
  END IF;

  -- 1. Purge expired lock if present for this (tenant_id, factura_id)
  DELETE FROM public.fev_operation_locks
  WHERE tenant_id = p_tenant_id
    AND factura_id = p_factura_id
    AND expires_at <= v_now;

  -- 2. Attempt atomic insertion
  BEGIN
    INSERT INTO public.fev_operation_locks (
      tenant_id,
      factura_id,
      state,
      locked_at,
      locked_by,
      lock_token,
      expires_at
    ) VALUES (
      p_tenant_id,
      p_factura_id,
      p_state,
      v_now,
      p_locked_by,
      v_lock_token,
      v_expires_at
    );

    RETURN jsonb_build_object(
      'success', true,
      'acquired', true,
      'lock_token', v_lock_token,
      'state', p_state,
      'expires_at', v_expires_at
    );
  EXCEPTION WHEN unique_violation THEN
    -- Lock is already held by an active operation
    SELECT * INTO v_existing
    FROM public.fev_operation_locks
    WHERE tenant_id = p_tenant_id
      AND factura_id = p_factura_id;

    RETURN jsonb_build_object(
      'success', false,
      'acquired', false,
      'error', 'FEV_OPERATION_ALREADY_IN_PROGRESS',
      'message', 'Ya hay una operación FEV en curso para esta factura (' || COALESCE(v_existing.state, 'BUSY') || ').',
      'state', v_existing.state,
      'locked_at', v_existing.locked_at,
      'expires_at', v_existing.expires_at
    );
  END;
END;
$$;

-- RPC: release_fev_operation_lock
CREATE OR REPLACE FUNCTION public.release_fev_operation_lock(
  p_tenant_id UUID,
  p_factura_id UUID,
  p_lock_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.fev_operation_locks
  WHERE tenant_id = p_tenant_id
    AND factura_id = p_factura_id
    AND lock_token = p_lock_token;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'released', (v_deleted > 0)
  );
END;
$$;

-- Permissions
GRANT ALL ON public.fev_operation_locks TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.acquire_fev_operation_lock TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.release_fev_operation_lock TO authenticated, service_role, anon;
