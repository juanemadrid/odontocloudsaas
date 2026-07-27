import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { createClient } from '@supabase/supabase-js';

const firebaseConfig = {
  apiKey: atob("QUl6YVN5QzcwbUdDUnJqRThpT2FwOGlUSHVpZDhIRXV5YWR1ZThZ"),
  authDomain: "odontocloud-d92ac.firebaseapp.com",
  projectId: "odontocloud-d92ac",
  storageBucket: "odontocloud-d92ac.firebasestorage.app",
  messagingSenderId: "267020714981",
  appId: "1:267020714981:web:a44416ea83aa1d1172650c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const patientId = "6fc5d3f9-ba8c-4131-bf61-aa281266ad48";
    const ref = doc(db, "pacientes", patientId);

    const fullCarlosData = {
        id: patientId,
        inquilino: "b029a9c9-0cc6-4942-9961-b994293b3d34",
        tenant_id: "b029a9c9-0cc6-4942-9961-b994293b3d34",
        tipoDocumento: "CC",
        tipo_documento: "CC",
        nroDocumento: "964158600",
        documento: "964158600",
        nombres: "Carlos",
        apellidos: "Madrid",
        nombreCompleto: "Carlos Madrid",
        sexo: "Masculino",
        genero: "Masculino",
        estadoCivil: "Soltero",
        estado_civil: "Soltero",
        paisNacimiento: "Colombia",
        pais_nacimiento: "Colombia",
        ciudadNacimiento: "Sincelejo",
        ciudad_nacimiento: "Sincelejo",
        fechaNacimiento: "1990-05-06",
        fecha_nacimiento: "1990-05-06",
        paisDomicilio: "Colombia",
        pais_domicilio: "Colombia",
        ciudadDomicilio: "Sincelejo",
        ciudad_domicilio: "Sincelejo",
        barrio: "Centro",
        lugarResidencia: "Calle 20 # 15-30",
        lugar_residencia: "Calle 20 # 15-30",
        direccion: "Calle 20 # 15-30",
        zonaResidencial: "Urbana",
        zona_residencial: "Urbana",
        celular: "3004445566",
        telefono: "3004445566",
        email: "carlos.madrid@odontocloud.com",
        ocupacion: "Ingeniero",
        registroCompleto: true,
        registro_completo: true,
        updatedAt: new Date().toISOString()
    };

    // Save in Firestore
    await setDoc(ref, fullCarlosData, { merge: true });
    console.log("FIRESTORE SAVED SUCCESFULLY!");

    // Upsert in Supabase
    const { data, error } = await supabase
        .from("pacientes")
        .upsert([{
            id: patientId,
            tenant_id: "b029a9c9-0cc6-4942-9961-b994293b3d34",
            tipo_documento: "CC",
            documento: "964158600",
            nombres: "Carlos",
            apellidos: "Madrid",
            fecha_nacimiento: "1990-05-06",
            genero: "Masculino",
            telefono: "3004445566",
            email: "carlos.madrid@odontocloud.com",
            direccion: "Calle 20 # 15-30",
            ciudad: "Sincelejo",
            ocupacion: "Ingeniero",
            activo: true
        }]);

    if (error) {
        console.warn("Supabase upsert error:", error);
    } else {
        console.log("SUPABASE UPSERT SUCCESSFUL!");
    }

    process.exit(0);
}

run().catch(err => {
    console.error("Error in script:", err);
    process.exit(1);
});
