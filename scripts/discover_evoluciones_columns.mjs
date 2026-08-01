import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function discoverColumns() {
    const candidateColumns = [
        "id",
        "type",
        "tipo",
        "paciente_id",
        "patient_id",
        "profesional_id",
        "profesional",
        "doctor_id",
        "doctorId",
        "tratamiento",
        "treatment",
        "descripcion",
        "description",
        "comentario",
        "comentarios",
        "observacion",
        "observaciones",
        "fecha",
        "date",
        "hora_inicio",
        "hora_fin",
        "datos",
        "data",
        "detalles",
        "details",
        "metadata",
        "content",
        "contenido",
        "tenant_id",
        "inquilino",
        "created_at",
        "updated_at"
    ];

    console.log("Testing individual column insertions on 'evoluciones'...");
    const validCols = [];

    for (const col of candidateColumns) {
        let dummyVal = "test";
        if (col === "created_at" || col === "updated_at" || col === "fecha" || col === "date") dummyVal = new Date().toISOString();
        if (col.includes("id")) dummyVal = "b029a9c9-0cc6-4942-9961-b994293b3d34";

        const { error } = await supabase.from("evoluciones").insert([{ [col]: dummyVal }]);
        if (error && error.message.includes("schema cache")) {
            // Column does not exist
        } else {
            console.log(`✅ Column '${col}' EXISTS or accepted! (Error msg: ${error?.message || "NONE"})`);
            validCols.push(col);
        }
    }

    console.log("\nValid columns discovered for 'evoluciones':", validCols);
}

discoverColumns();
