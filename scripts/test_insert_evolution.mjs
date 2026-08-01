import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function testInsertEvolution() {
    const richData = {
        type: "nota",
        comentario: "Test nota aclaratoria en Supabase",
        ambito: "Ambulatorio",
        finalidad: "Terapéutico",
        dxPrincipal: "K02.1 Caries de la dentina",
        profesional: "Carlos Madrid",
        doctorQuienRecibeName: "Dr. especialista",
        created_at: new Date().toISOString()
    };

    const payload = {
        paciente_id: "6fc5d3f9-ba8c-4131-bf61-aa281266ad48",
        tenant_id: "b029a9c9-0cc6-4942-9961-b994293b3d34",
        fecha: new Date().toISOString(),
        tratamiento: JSON.stringify(richData)
    };

    console.log("Testing inserting formatted evolution to Supabase...");
    const { data, error } = await supabase.from("evoluciones").insert([payload]).select();

    if (error) {
        console.error("Insert error:", error);
    } else {
        console.log("✅ SUCCESS inserting evolution!", data[0]);
        // Try reading it back
        const parsed = JSON.parse(data[0].tratamiento);
        console.log("Parsed rich data:", parsed);

        // Cleanup test row
        await supabase.from("evoluciones").delete().eq("id", data[0].id);
        console.log("Test row cleaned up.");
    }
}

testInsertEvolution();
