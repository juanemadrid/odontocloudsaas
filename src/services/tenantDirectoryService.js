import supabase from "../lib/supabaseClient";

const DIRECTORY_TTL_MS = 5 * 60 * 1000;
let cachedDirectory = null;
let cachedAt = 0;
let pendingRequest = null;

const emptyDirectory = () => ({
    usuarios: [],
    user_details: {},
    doctores: [],
    profesionales: [],
});

/**
 * Directorio operativo del tenant actual sin firmas, fotos ni credenciales.
 * La función SQL aplica el tenant de la sesión; el caché evita que varios
 * módulos descarguen el mismo catálogo durante una sola navegación.
 */
export async function getMyTenantUserDirectory(force = false) {
    if (!force && cachedDirectory && Date.now() - cachedAt < DIRECTORY_TTL_MS) {
        return cachedDirectory;
    }
    if (!force && pendingRequest) return pendingRequest;

    pendingRequest = (async () => {
        const { data, error } = await supabase.rpc("get_my_tenant_user_directory");
        if (error) throw error;

        const normalized = {
            ...emptyDirectory(),
            ...(data || {}),
        };
        cachedDirectory = normalized;
        cachedAt = Date.now();
        return normalized;
    })();

    try {
        return await pendingRequest;
    } finally {
        pendingRequest = null;
    }
}

export function invalidateMyTenantUserDirectory() {
    cachedDirectory = null;
    cachedAt = 0;
    pendingRequest = null;
}

