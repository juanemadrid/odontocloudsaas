-- ====================================================================
-- ODONTOCLOUD — AUDITORÍA DE CORREOS Y NOTIFICACIONES (RESEND)
-- Migración: 20261001_create_email_logs.sql
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    template_type TEXT NOT NULL DEFAULT 'welcome_clinic',
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    resend_id TEXT,
    error_message TEXT,
    initiated_by TEXT, -- Email o ID del usuario que disparó el envío (ej: superadmin o 'system')
    metadata JSONB DEFAULT '{}'::jsonb, -- Datos no sensibles (plan, nombre de clínica, acción)
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de consulta rápida y auditoría
CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_id ON public.email_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON public.email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);

-- Activar RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Política de lectura: Únicamente Superadministradores autenticados
DROP POLICY IF EXISTS "Superadmins can read email logs" ON public.email_logs;
CREATE POLICY "Superadmins can read email logs"
    ON public.email_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(profiles.role) = 'superadmin'
            AND profiles.activo IS TRUE
        )
    );

-- Política de escritura: Restringida a service_role (usado por Edge Functions) y Superadmins
DROP POLICY IF EXISTS "Superadmins can insert email logs" ON public.email_logs;
CREATE POLICY "Superadmins can insert email logs"
    ON public.email_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(profiles.role) = 'superadmin'
            AND profiles.activo IS TRUE
        )
    );
