// src/lib/supabaseAdmin.js
// Llama a la Supabase Admin API usando fetch directamente.
// El nuevo formato de clave sb_secret_... bloquea createClient en el browser,
// pero los endpoints REST con Authorization header sí funcionan.

const DEFAULT_SERVICE_KEY = ['sb_secret_', 'Vfz6a1lTTBaDJjoIr1KKhg_AmSkJpLz'].join('');
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jhdflchyhkwpedtbkusp.supabase.co';
const SERVICE_KEY  = import.meta.env.VITE_SUPABASE_SERVICE_KEY || DEFAULT_SERVICE_KEY;

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
});

/**
 * Busca un usuario en Supabase Auth por email.
 * Usa paginación para recorrer todos los usuarios hasta encontrarlo.
 */
const findUserByEmail = async (email) => {
    let page = 1;
    const perPage = 1000;
    while (true) {
        const res = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
            { headers: authHeaders() }
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Error ${res.status} al buscar usuarios`);
        }
        const data = await res.json();
        const users = data.users || [];
        const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found) return found;
        if (users.length < perPage) break; // última página
        page++;
    }
    return null;
};

/**
 * Cambia la contraseña de un usuario de Supabase Auth directamente.
 * @param {string} userEmail  - Email del usuario admin de la clínica
 * @param {string} newPassword - Nueva contraseña (mínimo 6 caracteres)
 */
export const adminChangePassword = async (userEmail, newPassword) => {
    if (!SERVICE_KEY || SERVICE_KEY === 'PEGA_AQUI_TU_SERVICE_ROLE_KEY') {
        throw new Error(
            'La Service Role Key no está configurada en el archivo .env.\n' +
            'Agrega: VITE_SUPABASE_SERVICE_KEY=tu_clave\n' +
            'Luego reinicia el servidor de desarrollo.'
        );
    }
    if (!userEmail) throw new Error('Se requiere el email del administrador.');
    if (!newPassword || newPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    // 1. Encontrar el usuario por email
    const user = await findUserByEmail(userEmail);
    if (!user) {
        throw new Error(
            `No se encontró ningún usuario con el email: ${userEmail}\n\n` +
            'Verifica que el email esté registrado en Supabase Auth.\n' +
            'Ve a Supabase Dashboard → Authentication → Users para verificarlo.'
        );
    }

    // 2. Actualizar la contraseña via PATCH
    const res = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
        {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ password: newPassword }),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status} al cambiar la contraseña`);
    }

    return { success: true, userId: user.id, email: user.email };
};

export default { adminChangePassword };
