import supabase from "../lib/supabaseClient";

const CONFIGURED_SENTINEL = "__SERVER_MANAGED__";

const invokeGeminiProxy = async (body) => {
    const { data, error } = await supabase.functions.invoke("gemini-proxy", { body });
    if (error) {
        let message = error.message || "No fue posible contactar el servicio de IA.";
        try {
            const details = await error.context?.json();
            message = details?.error || message;
        } catch {
            // La respuesta no siempre incluye JSON.
        }
        throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "La operación de IA fue rechazada.");
    return data;
};

export async function getGeminiApiKey() {
    const data = await invokeGeminiProxy({ action: "status" });
    return data.configured ? CONFIGURED_SENTINEL : "";
}

export async function saveGeminiApiKey(_tenantId, apiKey) {
    const cleanKey = String(apiKey || "").trim();
    if (cleanKey === CONFIGURED_SENTINEL) return true;
    if (!cleanKey) throw new Error("API Key no puede estar vacía");
    await invokeGeminiProxy({ action: "configure", apiKey: cleanKey });
    return true;
}

export async function generateGeminiContent(
    contents,
    generationConfig = {},
    model = "gemini-2.5-flash"
) {
    const data = await invokeGeminiProxy({
        action: "generate",
        contents,
        generationConfig,
        model
    });
    return data.result;
}

export function clearGeminiKeyCache() {
    localStorage.removeItem("odontovox_gemini_api_key");
    localStorage.removeItem("odontovox_gemini_api_key_cache");
}
