import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCitas() {
  const { data: citas, error } = await supabase
    .from('citas')
    .select('*, paciente:pacientes(nombres, apellidos, documento, telefono)');

  console.log("Citas count in Supabase:", citas?.length);
  console.log("Citas list in Supabase:", JSON.stringify(citas, null, 2));
}

checkCitas();
