import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
  await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  const { data: paciente } = await supabase
    .from('pacientes')
    .select('*')
    .eq('nombres', 'Carlos Alberto')
    .single();

  console.log("=== PACIENTE REGISTRADO ===");
  console.log(JSON.stringify(paciente, null, 2));

  if (paciente) {
    const { data: citas } = await supabase
      .from('citas')
      .select('*, paciente:pacientes(nombres, apellidos, documento, telefono)')
      .eq('paciente_id', paciente.id);

    console.log("=== CITA PROGRAMADA ===");
    console.log(JSON.stringify(citas, null, 2));
  }
}

verify();
