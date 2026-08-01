import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function checkWebsiteConfig() {
    console.log("🔍 Inspecting website_config rows...");
    const { data, error } = await supabase.from("website_config").select("*");
    if (error) {
        console.error("Error:", error);
        return;
    }
    console.log("Found rows:", data.length);
    data.forEach((row, i) => {
        console.log(`--- ROW ${i} (tenant_id: ${row.tenant_id}) ---`);
        console.log("Keys in config:", Object.keys(row.config || {}));
        if (row.config?.registered_tenants) {
            console.log("registered_tenants:", JSON.stringify(row.config.registered_tenants, null, 2));
        }
        if (row.config?.profesionales || row.config?.doctores || row.config?.users || row.config?.user_details) {
            console.log("Users/Doctors in config:", row.config.profesionales || row.config.doctores || row.config.users || row.config.user_details);
        }
    });
}

checkWebsiteConfig();
