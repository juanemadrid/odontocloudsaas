import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function checkTables() {
    console.log("🔍 Checking all tables in Supabase...");
    const candidates = [
        "profiles",
        "perfiles",
        "users",
        "doctores",
        "dentistas",
        "staff",
        "medicos",
        "pacientes",
        "profesionales",
        "website_config",
        "tenants",
        "inquilinos",
        "auth_users",
        "user_details"
    ];

    for (const t of candidates) {
        try {
            const { data, error } = await supabase.from(t).select("*").limit(5);
            if (error) {
                console.log(`Table '${t}': ERROR -> ${error.message}`);
            } else {
                console.log(`Table '${t}': EXISTS -> count/sample: ${data?.length} rows`);
                if (data && data.length > 0) {
                    console.log(`  Sample from ${t}:`, Object.keys(data[0]), data[0]);
                }
            }
        } catch (e) {
            console.log(`Table '${t}': CATCH -> ${e.message}`);
        }
    }
}

checkTables();
