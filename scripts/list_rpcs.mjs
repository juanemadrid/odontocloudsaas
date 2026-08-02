import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listRpcs() {
  await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: process.env.ODONTOCLOUD_TEST_PASSWORD
  });

  // Try calling common helper functions
  const f1 = await supabase.rpc('get_user_tenant_id');
  console.log("get_user_tenant_id:", f1);

  const f2 = await supabase.rpc('is_superadmin');
  console.log("is_superadmin:", f2);
}

listRpcs();
