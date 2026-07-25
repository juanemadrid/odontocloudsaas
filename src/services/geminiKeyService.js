// src/services/geminiKeyService.js
import supabase from "../lib/supabaseClient";

const CACHE_KEY = "odontovox_gemini_api_key";
const CACHE_TTL = 1000 * 60 * 30;

export async function getGeminiApiKey(tenantId) {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY + "_cache") || "{}");
        if (cached.key && cached.ts && Date.now() - cached.ts < CACHE_TTL) {
            return cached.key;
        }
    } catch {}

    if (tenantId) {
        try {
            const { data: row } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", tenantId)
                .maybeSingle();

            if (row?.config?.geminiApiKey) {
                const key = row.config.geminiApiKey;
                localStorage.setItem(CACHE_KEY + "_cache", JSON.stringify({ key, ts: Date.now() }));
                return key;
            }
        } catch (e) {
            console.warn("[GeminiKeyService] No se pudo cargar la key desde Supabase:", e.message);
        }
    }

    const envKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (envKey) return envKey;

    return localStorage.getItem(CACHE_KEY) || "";
}

export async function saveGeminiApiKey(tenantId, apiKey) {
    if (!tenantId) throw new Error("ID de clínica requerido");
    if (!apiKey?.trim()) throw new Error("API Key no puede estar vacía");

    const { data: existing } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", tenantId)
        .maybeSingle();

    const updatedConfig = {
        ...(existing?.config || {}),
        geminiApiKey: apiKey.trim(),
        geminiKeyUpdatedAt: new Date().toISOString()
    };

    const { error } = await supabase
        .from("website_config")
        .upsert({
            tenant_id: tenantId,
            config: updatedConfig,
            updated_at: new Date().toISOString()
        });

    if (error) throw error;

    localStorage.setItem(CACHE_KEY + "_cache", JSON.stringify({ key: apiKey.trim(), ts: Date.now() }));
    localStorage.setItem(CACHE_KEY, apiKey.trim());
}

export function clearGeminiKeyCache() {
    localStorage.removeItem(CACHE_KEY + "_cache");
}
