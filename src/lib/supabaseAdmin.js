// src/lib/supabaseAdmin.js
import supabase from "./supabaseClient";

/**
 * Cambia la contraseña de un usuario de Supabase Auth directamente.
 * Utiliza la función RPC de Supabase (admin_change_password) sin requerir claves secretas en el navegador.
 * Si la función RPC no está presente en la base de datos, envía un correo seguro de restablecimiento.
 * 
 * @param {string} userEmail  - Email del usuario admin de la clínica
 * @param {string} newPassword - Nueva contraseña (mínimo 6 caracteres)
 */
export const adminChangePassword = async (userEmail, newPassword) => {
    if (!userEmail) throw new Error('Se requiere el email del administrador.');
    if (!newPassword || newPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    const cleanEmail = userEmail.toLowerCase().trim();

    try {
        // 1. Intentar cambiar la contraseña mediante RPC en PostgreSQL
        const { data, error } = await supabase.rpc('admin_change_password', {
            user_email: cleanEmail,
            new_password: newPassword
        });

        if (!error && data) {
            if (data.success === false) {
                throw new Error(data.message || 'No se encontró ningún usuario con ese correo.');
            }
            return { success: true, via: 'rpc' };
        }

        // 2. Si la función RPC aún no está creada en la base de datos, fallback seguro a email reset
        if (error) {
            console.warn("RPC admin_change_password no encontrada o restringida:", error.message);
        }

        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: `${window.location.origin}${import.meta.env.BASE_URL || '/odontocloudsaas/'}reset-password`
        });

        if (resetErr) throw resetErr;

        return { 
            success: true, 
            via: 'reset_email',
            message: `Se ha enviado un correo seguro a ${cleanEmail} para restablecer la contraseña.` 
        };
    } catch (err) {
        console.error("Error en adminChangePassword:", err);
        throw new Error(err.message || 'Error al procesar la contraseña.');
    }
};

export default { adminChangePassword };
