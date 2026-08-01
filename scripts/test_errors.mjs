import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function testErrors() {
    const tenantId = "b029a9c9-0cc6-4942-9961-b994293b3d34";
    const patientId = "6fc5d3f9-ba8c-4131-bf61-aa281266ad48";

    console.log("--- 1. Testing profesionales query ---");
    const { data: pData, error: pErr } = await supabase
        .from("profesionales")
        .select("*")
        .eq("tenant_id", tenantId);
    console.log("profesionales eq(tenant_id):", { count: pData?.length, error: pErr?.message });

    const { error: pOrErr } = await supabase
        .from("profesionales")
        .select("*")
        .or(`tenant_id.eq.${tenantId},inquilino.eq.${tenantId}`);
    console.log("profesionales .or():", { error: pOrErr?.message });

    console.log("\n--- 2. Testing medicamentos query ---");
    const { data: mData, error: mErr } = await supabase
        .from("medicamentos")
        .select("*");
    console.log("medicamentos:", { count: mData?.length, error: mErr?.message });

    console.log("\n--- 3. Testing pagos query ---");
    const { data: pagosData, error: pagosErr } = await supabase
        .from("pagos")
        .select("*")
        .limit(2);
    console.log("pagos select:", { count: pagosData?.length, sampleKeys: pagosData?.[0] ? Object.keys(pagosData[0]) : null, error: pagosErr?.message });

    if (pagosData && pagosData[0]) {
        console.log("pagos columns sample:", pagosData[0]);
    }
}

testErrors();
