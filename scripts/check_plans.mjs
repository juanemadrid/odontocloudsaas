import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPlans() {
  await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: process.env.ODONTOCLOUD_TEST_PASSWORD
  });

  const { data } = await supabase
    .from('website_config')
    .select('config')
    .eq('tenant_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
    .maybeSingle();

  console.log("Planes guardados en Supabase:", JSON.stringify(data?.config?.plans, null, 2));
}

checkPlans();
