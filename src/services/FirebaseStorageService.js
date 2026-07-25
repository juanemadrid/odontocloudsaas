// src/services/FirebaseStorageService.js (Supabase Storage Provider)
import supabase from "../lib/supabaseClient";

/**
 * Uploads a file to Supabase Storage
 * @param {File} file - The file to upload
 * @param {string} path - The storage path (e.g. 'tenants/tenantId/logo.png')
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export const uploadImage = async (file, path) => {
    try {
        const fileExt = file.name ? file.name.split(".").pop() : "jpg";
        const cleanPath = path ? path.replace(/[^a-zA-Z0-9_\-\.\/]/g, "_") : `uploads/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("adjuntos")
            .upload(cleanPath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from("adjuntos")
            .getPublicUrl(cleanPath);

        return data.publicUrl;
    } catch (error) {
        console.error("Error uploading image to Supabase Storage:", error);
        throw new Error("No se pudo subir la imagen: " + error.message);
    }
};
