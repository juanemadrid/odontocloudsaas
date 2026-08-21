import supabase from "./supabaseClient";
import { changeManagedUserPassword } from "../services/userAdminService";

export const adminChangePassword = async (userEmail, newPassword) => {
    if (!userEmail) throw new Error('Se requiere el email del administrador.');
    if (!newPassword || newPassword.length < 8) {
        throw new Error('La contraseña debe tener al menos 8 caracteres.');
    }

    const emailClean = userEmail.toLowerCase().trim();

    // 1. Ejecutar RPC directo en Supabase PostgreSQL (SECURITY DEFINER para SuperAdmin)
    const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_force_change_password", {
        p_email: emailClean,
        p_new_password: newPassword
    });

    if (!rpcErr && rpcData?.success) {
        return { success: true, message: rpcData.message || `Contraseña de ${emailClean} actualizada exitosamente.` };
    }

    if (rpcErr && !rpcErr.message.includes("Could not find the function")) {
        throw new Error(rpcErr.message);
    }

    // 2. Fallback a Edge Function si la función RPC aún no está creada
    try {
        await changeManagedUserPassword({
            email: emailClean,
            password: newPassword
        });
        return { success: true, via: 'edge_function' };
    } catch (edgeErr) {
        throw new Error(edgeErr?.message || rpcErr?.message || "No se pudo actualizar la contraseña.");
    }
};

export default { adminChangePassword };
