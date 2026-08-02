import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSuperAdminProfile() {
  await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: process.env.ODONTOCLOUD_TEST_PASSWORD
  });

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'madridsystem@outlook.es')
    .single();

  console.log("Perfil SuperAdmin:", profile, "Error:", error);
}

checkSuperAdminProfile();
