import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyProfile() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  console.log("Auth User ID:", authData?.user?.id);

  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData?.user?.id);

  console.log("Profiles for Auth User:", profiles, "Error:", profError);
}

verifyProfile();
