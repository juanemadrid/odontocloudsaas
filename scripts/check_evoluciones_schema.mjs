import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function checkEvolucionesSchema() {
    console.log("🔍 Checking evoluciones table columns in Supabase...");

    const { data, error } = await supabase.from("evoluciones").select("*").limit(2);
    if (error) {
        console.error("Error selecting evoluciones:", error);
    } else {
        console.log("evoluciones count:", data?.length);
        if (data && data.length > 0) {
            console.log("Columns in evoluciones table:", Object.keys(data[0]));
        } else {
            console.log("Table 'evoluciones' exists but is empty. Testing dummy insertion to catch invalid columns...");
            
            // Try minimalist insert to find valid columns
            const testPayload = {
                paciente_id: "6fc5d3f9-ba8c-4131-bf61-aa281266ad48",
                tenant_id: "b029a9c9-0cc6-4942-9961-b994293b3d34",
                comentario: "Test schema check"
            };

            const { data: insData, error: insErr } = await supabase
                .from("evoluciones")
                .insert([testPayload])
                .select();

            console.log("Test insert result:", { data: insData, error: insErr?.message || "None" });
        }
    }
}

checkEvolucionesSchema();
