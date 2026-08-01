import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function checkDoctors() {
    console.log("🔍 Inspecting professionals and users in Supabase...");
    
    try {
        const { data: profs, error: pErr } = await supabase.from("profesionales").select("*");
        console.log("Table 'profesionales' count:", profs?.length, "Error:", pErr?.message || "None");
        if (profs && profs.length > 0) {
            console.log("Sample profesional:", profs.slice(0, 3));
        }
    } catch (e) {
        console.error("profesionales catch:", e.message);
    }

    try {
        const { data: usrs, error: uErr } = await supabase.from("usuarios").select("*");
        console.log("Table 'usuarios' count:", usrs?.length, "Error:", uErr?.message || "None");
        if (usrs && usrs.length > 0) {
            console.log("Sample usuario:", usrs.slice(0, 3));
        }
    } catch (e) {
        console.error("usuarios catch:", e.message);
    }
}

checkDoctors();
