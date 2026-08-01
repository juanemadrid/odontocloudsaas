import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function checkPagos() {
    const patientId = "6fc5d3f9-ba8c-4131-bf61-aa281266ad48";
    const planId = "0f7ccf7e-5edf-4ed3-a4e8-f6bdf16b3fbe";

    console.log("Testing pagos query with patient_id vs paciente_id...");

    // Test 1: paciente_id
    const { data: d1, error: e1 } = await supabase.from("pagos").select("*").eq("paciente_id", patientId);
    console.log("pagos eq(paciente_id):", { count: d1?.length, error: e1?.message });

    // Test 2: patient_id
    const { data: d2, error: e2 } = await supabase.from("pagos").select("*").eq("patient_id", patientId);
    console.log("pagos eq(patient_id):", { count: d2?.length, error: e2?.message });

    // Test 3: plan_id vs planId
    const { data: d3, error: e3 } = await supabase.from("pagos").select("*").eq("plan_id", planId);
    console.log("pagos eq(plan_id):", { count: d3?.length, error: e3?.message });
}

checkPagos();
