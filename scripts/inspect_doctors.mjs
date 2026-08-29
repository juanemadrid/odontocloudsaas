import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectProfilesAll() {
  const { data, error } = await supabase.from("profiles").select("*");
  console.log("Profiles count:", error ? error.message : data?.length);
  if (data?.length > 0) {
    data.forEach(p => console.log("Profile:", JSON.stringify(p)));
  }
}

inspectProfilesAll();
