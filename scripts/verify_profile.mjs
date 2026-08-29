import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyProfile() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: process.env.ODONTOCLOUD_TEST_PASSWORD
  });

  console.log("Auth User ID:", authData?.user?.id);

  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData?.user?.id);

  console.log("Profiles for Auth User:", profiles, "Error:", profError);
}

verifyProfile();
