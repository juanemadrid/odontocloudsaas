import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyStorageRLS() {
  console.log('🔒 Aplicando políticas RLS de Supabase Storage para clinical-files y adjuntos...\n');

  const storagePoliciesSQL = [
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "Public Access clinical-files" ON storage.objects;
      CREATE POLICY "Public Access clinical-files" ON storage.objects FOR SELECT USING (bucket_id = 'clinical-files' OR bucket_id = 'adjuntos');
    END $$;`,

    `DO $$ BEGIN
      DROP POLICY IF EXISTS "Authenticated Upload clinical-files" ON storage.objects;
      CREATE POLICY "Authenticated Upload clinical-files" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND (bucket_id = 'clinical-files' OR bucket_id = 'adjuntos'));
    END $$;`,

    `DO $$ BEGIN
      DROP POLICY IF EXISTS "Authenticated Update clinical-files" ON storage.objects;
      CREATE POLICY "Authenticated Update clinical-files" ON storage.objects FOR UPDATE USING (auth.role() = 'authenticated' AND (bucket_id = 'clinical-files' OR bucket_id = 'adjuntos')) WITH CHECK (auth.role() = 'authenticated' AND (bucket_id = 'clinical-files' OR bucket_id = 'adjuntos'));
    END $$;`,

    `DO $$ BEGIN
      DROP POLICY IF EXISTS "Authenticated Delete clinical-files" ON storage.objects;
      CREATE POLICY "Authenticated Delete clinical-files" ON storage.objects FOR DELETE USING (auth.role() = 'authenticated' AND (bucket_id = 'clinical-files' OR bucket_id = 'adjuntos'));
    END $$;`
  ];

  for (const sql of storagePoliciesSQL) {
    try {
      const res = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      });
      console.log('Result:', res.status, await res.text());
    } catch (e) {
      console.error('Error executing policy SQL:', e.message);
    }
  }
}

applyStorageRLS();
