// src/services/registrationService.js
import supabase from "../lib/supabaseClient";

export const registerTrialClinic = async ({ adminEmail, adminPassword, adminName, clinicName, requestedPlan }) => {
    try {
        const { data: tenant, error: tenantErr } = await supabase
            .from("tenants")
            .insert([{
                nombre: clinicName,
                nit: "900123456",
                telefono: "3001234567",
                direccion: "Calle Principal #123",
                ciudad: "Bogotá D.C.",
                plan: requestedPlan ? requestedPlan.toLowerCase() : "free",
                activo: true
            }])
            .select()
            .single();

        if (tenantErr) throw tenantErr;

        const { data: authData, error: authErr } = await supabase.auth.signUp({
            email: adminEmail.trim(),
            password: adminPassword,
            options: {
                data: {
                    full_name: adminName,
                    tenant_id: tenant.id
                }
            }
        });

        if (authErr) throw authErr;

        if (authData?.user) {
            await supabase.from("profiles").insert([{
                id: authData.user.id,
                tenant_id: tenant.id,
                full_name: adminName,
                email: adminEmail.trim(),
                role: "administrador"
            }]);
        }

        await supabase.from("sucursales").insert([{
            tenant_id: tenant.id,
            nombre: "Sede Principal",
            direccion: "Calle Principal #123",
            telefono: "3001234567",
            activo: true
        }]);

        await supabase.from("consultorios").insert([{
            tenant_id: tenant.id,
            nombre: "Consultorio Principal",
            activo: true
        }]);

        return { user: authData?.user, inquilino: tenant.id };
    } catch (error) {
        console.error("Error al registrar clínica en Supabase:", error);
        throw error;
    }
};
