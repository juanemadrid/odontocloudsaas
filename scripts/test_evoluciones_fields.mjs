import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function testAllColumns() {
    const columns = [
        "id", "paciente_id", "profesional_id", "tratamiento", "fecha", "tenant_id", "created_at",
        "descripcion", "observaciones", "datos", "detalles", "metadata", "content", "contenido",
        "type", "tipo", "remision", "nota", "comentario", "comentarios", "plan_id", "plantilla_items",
        "rips", "medicamentos", "esterilizaciones", "dx_principal", "ambito", "finalidad"
    ];

    const results = {};
    for (const c of columns) {
        const { error } = await supabase.from("evoluciones").insert([{ [c]: "test" }]);
        if (error && error.message.includes("schema cache")) {
            results[c] = false;
        } else {
            results[c] = true;
        }
    }

    console.log("ALL TABLE 'evoluciones' COLUMNS RESULT:", results);
}

testAllColumns();
