import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function testDoctorLoader() {
    const mapDoctors = new Map();
    const tenants = ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b029a9c9-0cc6-4942-9961-b994293b3d34'];

    for (const inq of tenants) {
        console.log(`\n--- TESTING DOCTOR LOADER FOR TENANT: ${inq} ---`);
        
        // 1. Cargar desde profiles
        try {
            const { data: profs } = await supabase.from("profiles").select("*").eq("tenant_id", inq);
            (profs || []).forEach(u => {
                const name = u.full_name || u.nombreCompleto || u.nombre || u.email || "";
                if (name) mapDoctors.set(u.id || name, { id: u.id || name, nombreCompleto: name });
            });
        } catch (e) {}

        // 2. Cargar desde profesionales
        try {
            const { data: profs } = await supabase.from("profesionales").select("*").eq("tenant_id", inq);
            (profs || []).forEach(d => {
                const name = d.nombre_completo || d.nombre || "";
                if (name) mapDoctors.set(d.id || name, { id: d.id || name, nombreCompleto: name });
            });
        } catch (e) {}

        // 3. Cargar desde website_config
        try {
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", inq)
                .maybeSingle();

            if (cfgRow?.config) {
                const usuarios = cfgRow.config.usuarios || cfgRow.config.users || [];
                const userDetails = cfgRow.config.user_details || {};
                const doctores = cfgRow.config.doctores || cfgRow.config.profesionales || [];

                console.log(`website_config found ${usuarios.length} usuarios, ${Object.keys(userDetails).length} userDetails, ${doctores.length} doctores`);

                usuarios.forEach(u => {
                    const detail = userDetails[u.id || u.uid] || {};
                    const name = u.nombreCompleto || u.nombre || u.displayName || u.email || "";
                    if (name) mapDoctors.set(u.id || u.uid || name, { id: u.id || u.uid || name, nombreCompleto: name });
                });

                doctores.forEach(d => {
                    const name = d.nombreCompleto || d.nombre || d.displayName || d.email || "";
                    if (name) mapDoctors.set(d.id || d.uid || name, { id: d.id || d.uid || name, nombreCompleto: name });
                });
            }
        } catch (e) {
            console.error("Config err:", e);
        }
    }

    console.log("\nTotal doctors loaded:", mapDoctors.size);
    console.log(Array.from(mapDoctors.values()));
}

testDoctorLoader();
