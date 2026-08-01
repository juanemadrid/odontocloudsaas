-- ============================================================
-- Supabase Storage RLS Policies (clinical-files & adjuntos)
-- Copiar y ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Acceso de LECTURA PÚBLICA para consultar imágenes/logos
CREATE POLICY "Public Read Storage clinical-files"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('clinical-files', 'adjuntos'));

-- 2. Permiso de CARGA (INSERT) para usuarios autenticados
CREATE POLICY "Authenticated Insert Storage clinical-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id IN ('clinical-files', 'adjuntos')
  );

-- 3. Permiso de ACTUALIZACIÓN (UPDATE) para usuarios autenticados
CREATE POLICY "Authenticated Update Storage clinical-files"
  ON storage.objects FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    bucket_id IN ('clinical-files', 'adjuntos')
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id IN ('clinical-files', 'adjuntos')
  );

-- 4. Permiso de ELIMINACIÓN (DELETE) para usuarios autenticados
CREATE POLICY "Authenticated Delete Storage clinical-files"
  ON storage.objects FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    bucket_id IN ('clinical-files', 'adjuntos')
  );
