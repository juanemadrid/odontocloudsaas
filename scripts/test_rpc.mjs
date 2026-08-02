import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRpc() {
  await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: process.env.ODONTOCLOUD_TEST_PASSWORD
  });

  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
  console.log("RPC exec_sql result:", data, "Error:", error);
}

testRpc();
