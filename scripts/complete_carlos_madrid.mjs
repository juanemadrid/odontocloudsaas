import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const patientId = "6fc5d3f9-ba8c-4131-bf61-aa281266ad48";
    
    // Fetch patient
    const { data: patient, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", patientId)
        .single();

    if (error) {
        console.error("Error fetching patient:", error);
        process.exit(1);
    }

    console.log("Current patient from Supabase:", patient);

    const payload = {
        nombres: "Carlos",
        apellidos: "Madrid",
        documento: "964158600",
        tipo_documento: "CC",
        fecha_nacimiento: "1990-05-06",
        genero: "Masculino",
        telefono: "3004445566",
        email: "carlos.madrid@odontocloud.com",
        direccion: "Calle 20 # 15-30",
        ciudad: "Sincelejo",
        ocupacion: "Ingeniero",
        eps: "Sura EPS",
        tipo_afiliacion: "Cotizante"
    };

    const { data: updated, error: updateErr } = await supabase
        .from("pacientes")
        .update(payload)
        .eq("id", patientId)
        .select()
        .single();

    if (updateErr) {
        console.error("Error updating patient in Supabase:", updateErr);
        process.exit(1);
    }

    console.log("Successfully updated Carlos Madrid in Supabase:", updated);
}

run();
