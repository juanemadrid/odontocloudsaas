import { changeManagedUserPassword } from "../services/userAdminService";

export const adminChangePassword = async (userEmail, newPassword) => {
    if (!userEmail) throw new Error('Se requiere el email del administrador.');
    if (!newPassword || newPassword.length < 8) {
        throw new Error('La contraseña debe tener al menos 8 caracteres.');
    }

    const emailClean = userEmail.toLowerCase().trim();

    // Las operaciones de Auth siempre pasan por la Edge Function autenticada.
    // Nunca se llama un RPC SECURITY DEFINER directamente desde el navegador.
    await changeManagedUserPassword({
        email: emailClean,
        password: newPassword
    });
    return { success: true, via: "edge_function" };
};

export default { adminChangePassword };
