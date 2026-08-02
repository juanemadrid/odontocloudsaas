import { createSubscriptionRequest } from "./adminService";

export const registerTrialClinic = async ({
    adminEmail,
    adminPassword,
    adminName,
    clinicName,
    requestedPlan
}) => {
    // Guarda la solicitud de la clínica en estado PENDIENTE para revisión en el panel de SuperAdmin
    const requestObj = await createSubscriptionRequest({
        adminEmail,
        adminPassword,
        adminName,
        clinicName,
        requestedPlan
    });

    return {
        success: true,
        request: requestObj
    };
};
