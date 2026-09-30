-- ============================================================================
-- Migración: Corregir políticas RLS para almacenamiento de activos públicos
-- (public-assets: logos de clínicas, banners, avatares y branding)
-- ============================================================================

-- 1. Asegurar que el bucket public-assets existe y está configurado como público
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Eliminar políticas restrictivas previas sobre public-assets
DROP POLICY IF EXISTS "Tenant admins manage own public assets" ON storage.objects;
DROP POLICY IF EXISTS "Superadmin manages public assets" ON storage.objects;
DROP POLICY IF EXISTS "Public assets select" ON storage.objects;
DROP POLICY IF EXISTS "Public assets insert" ON storage.objects;
DROP POLICY IF EXISTS "Public assets update" ON storage.objects;
DROP POLICY IF EXISTS "Public assets delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to public-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from public-assets" ON storage.objects;

-- 3. Permitir lectura pública de activos públicos
CREATE POLICY "Public assets select"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-assets');

-- 4. Permitir a usuarios autenticados subir archivos a public-assets
CREATE POLICY "Public assets insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'public-assets');

-- 5. Permitir a usuarios autenticados actualizar archivos en public-assets
CREATE POLICY "Public assets update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'public-assets')
WITH CHECK (bucket_id = 'public-assets');

-- 6. Permitir a usuarios autenticados eliminar archivos en public-assets
CREATE POLICY "Public assets delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'public-assets');
