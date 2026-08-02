import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignupTenant() {
  const testEmail = `admin_clinic_${Date.now()}@gmail.com`;
  console.log("Creando usuario admin de clínica mediante Auth signUp:", testEmail);

  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: testEmail,
    password: process.env.ODONTOCLOUD_TEST_PASSWORD,
    options: {
      data: {
        full_name: "Dr. Admin Prueba",
        clinic_name: "Clínica OdontoCloud Real Test"
      }
    }
  });

  console.log("Auth Signup Result:", authData?.user?.id, "Error:", authErr);
}

testSignupTenant();
