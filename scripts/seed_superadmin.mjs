import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedSuperAdmin() {
  console.log("Intentando crear/verificar SuperAdmin en Supabase...");
  
  const email = "madridsystem@outlook.es";
  const password = process.env.ODONTOCLOUD_TEST_PASSWORD;

  // Intentar SignUp
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: "SuperAdmin OdontoCloud"
      }
    }
  });

  if (signUpError) {
    if (signUpError.message.includes("User already registered")) {
      console.log("El usuario ya estaba registrado en Supabase Auth.");
    } else {
      console.error("Error en SignUp:", signUpError.message);
    }
  } else {
    console.log("Usuario SuperAdmin creado exitosamente en Supabase Auth:", signUpData.user?.email);
  }

  // Intentar SignIn para probar la contraseña
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error("Prueba de inicio de sesión falló:", signInError.message);
  } else {
    console.log(" Autenticación probada con éxito para Superadmin:", signInData.user?.email);
  }
}

seedSuperAdmin();
