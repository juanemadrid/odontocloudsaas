import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Autenticando usuario...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: "@Joshuamadrid27"
  });

  if (authError) {
    console.error("Error al autenticar:", authError);
    return;
  }

  console.log("Usuario autenticado con éxito:", authData.user.email);

  // Obtener perfil del usuario o tenant
  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profError) {
    console.error("Error al obtener perfil:", profError);
  } else {
    console.log("Perfil del usuario:", profile);
  }

  const tenantId = profile?.tenant_id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  console.log("Usando Tenant ID:", tenantId);

  // Datos del nuevo paciente
  const documentoNuevo = "10987" + Math.floor(10000 + Math.random() * 90000);
  const nuevoPacienteData = {
    tenant_id: tenantId,
    tipo_documento: "CC",
    documento: documentoNuevo,
    nombres: "Carlos Alberto",
    apellidos: "Mendoza Gómez",
    fecha_nacimiento: "1992-05-15",
    genero: "Masculino",
    telefono: "3109876543",
    email: `carlos.mendoza.${documentoNuevo}@example.com`,
    direccion: "Calle 100 # 15-20",
    ciudad: "Bogotá",
    ocupacion: "Ingeniero de Software",
    eps: "Sura",
    tipo_afiliacion: "Cotizante",
    activo: true
  };

  console.log("Creando paciente en Supabase...", nuevoPacienteData.nombres, nuevoPacienteData.apellidos);
  const { data: pacienteCreado, error: pacError } = await supabase
    .from("pacientes")
    .insert([nuevoPacienteData])
    .select()
    .single();

  if (pacError) {
    console.error("Error al crear paciente:", pacError);
    return;
  }

  console.log("✅ Paciente creado exitosamente ID:", pacienteCreado.id);
  console.log("   Nombre:", pacienteCreado.nombres, pacienteCreado.apellidos);
  console.log("   Documento:", pacienteCreado.documento);

  // Crear la cita para este nuevo paciente
  const ahora = new Date();
  const fechaInicio = new Date(ahora.getTime() + 2 * 60 * 60 * 1000); // En 2 horas
  const fechaFin = new Date(fechaInicio.getTime() + 45 * 60 * 1000); // 45 minutos de duración

  const nuevaCitaData = {
    tenant_id: tenantId,
    paciente_id: pacienteCreado.id,
    profesional_id: authData.user.id,
    fecha_inicio: fechaInicio.toISOString(),
    fecha_fin: fechaFin.toISOString(),
    estado: "programada",
    motivo: "Valoración Odontológica Inicial",
    notas: "Cita programada remotamente para paciente nuevo."
  };

  console.log("Creando cita para el paciente nuevo...");
  const { data: citaCreada, error: citaError } = await supabase
    .from("citas")
    .insert([nuevaCitaData])
    .select()
    .single();

  if (citaError) {
    console.error("Error al crear la cita:", citaError);
    return;
  }

  console.log("✅ Cita creada exitosamente ID:", citaCreada.id);
  console.log("   Fecha Inicio:", citaCreada.fecha_inicio);
  console.log("   Fecha Fin:", citaCreada.fecha_fin);
  console.log("   Motivo:", citaCreada.motivo);
  console.log("   Estado:", citaCreada.estado);
}

main();
