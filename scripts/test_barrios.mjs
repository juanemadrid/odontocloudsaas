import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function testTables() {
    console.log("🔍 Testing barrios_catalogo and configuracion_formularios...");

    const tenantId = "b029a9c9-0cc6-4942-9961-b994293b3d34";

    // 1. barrios_catalogo
    try {
        const { data, error } = await supabase.from("barrios_catalogo").select("*").limit(5);
        console.log("barrios_catalogo select result:", { count: data?.length, error: error?.message || error?.code || "None" });
    } catch (e) {
        console.error("barrios_catalogo catch:", e.message);
    }

    // Try insert in barrios_catalogo
    try {
        const { data, error } = await supabase.from("barrios_catalogo").insert([{
            tenant_id: tenantId,
            nombre: "Barrio Test " + Date.now(),
            ciudad: "Abrego"
        }]).select();
        console.log("barrios_catalogo insert result:", { data, error: error?.message || error?.code || "None" });
    } catch (e) {
        console.error("barrios_catalogo insert catch:", e.message);
    }

    // 2. configuracion_formularios
    try {
        const { data, error } = await supabase.from("configuracion_formularios").select("*").limit(5);
        console.log("configuracion_formularios select result:", { count: data?.length, error: error?.message || error?.code || "None" });
    } catch (e) {
        console.error("configuracion_formularios catch:", e.message);
    }
}

testTables();
