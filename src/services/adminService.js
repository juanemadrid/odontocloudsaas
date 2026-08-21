// src/services/adminService.js
import supabase from "../lib/supabaseClient";
import { uploadOptimizedPublicFile } from "./storageUploadService";

export const GLOBAL_CONFIG_TENANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const isUUID = (str) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Obtener todas las clínicas (Tenants) desde Supabase PostgreSQL
 */
export const getTenants = async () => {
    try {
        const [{ data: dbTenants, error: tErr }, { data: row }, { data: dbProfiles }] = await Promise.all([
            supabase.from("tenants").select("*").order("created_at", { ascending: false }),
            supabase.from("website_config").select("config").eq("tenant_id", GLOBAL_CONFIG_TENANT_ID).maybeSingle(),
            supabase.from("profiles").select("id, email, full_name, role, tenant_id")
        ]);

        if (tErr) {
            console.warn("Advertencia al consultar tabla tenants:", tErr.message);
        }

        // Crear mapa de perfiles administradores por tenant_id
        const profileMap = new Map();
        (dbProfiles || []).forEach(p => {
            if (p.tenant_id && p.email && p.email.toLowerCase() !== "madridsystem@outlook.es") {
                const tId = String(p.tenant_id);
                if (!profileMap.has(tId) || (p.role || "").toLowerCase().includes("admin")) {
                    profileMap.set(tId, {
                        adminEmail: p.email,
                        adminName: p.full_name || ""
                    });
                }
            }
        });

        const savedTenants = Array.isArray(row?.config?.registered_tenants) ? row.config.registered_tenants : [];
        const tenantsMap = new Map();

        // 1. Mapear primero las clínicas encontradas en la tabla 'tenants' de PostgreSQL
        (dbTenants || []).forEach(t => {
            if (t.id === GLOBAL_CONFIG_TENANT_ID) return;
            const createdDate = t.created_at ? new Date(t.created_at) : new Date();
            const endDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            const idKey = String(t.id);
            const prof = profileMap.get(idKey);
            const initialEmail = prof?.adminEmail || (t.email && t.email.toLowerCase() !== "madridsystem@outlook.es" ? t.email : "");

            tenantsMap.set(idKey, {
                id: idKey,
                name: t.nombre || "Clínica sin nombre",
                nombre: t.nombre || "Clínica sin nombre",
                nit: t.nit || "",
                telefono: t.telefono || "",
                address: t.direccion || "",
                ciudad: t.ciudad || "",
                contactEmail: initialEmail,
                adminName: prof?.adminName || "",
                adminEmail: initialEmail,
                planId: t.plan || "free",
                planDuration: "monthly",
                status: t.activo !== false ? "active" : "suspended",
                subscriptionStatus: t.activo !== false ? "active" : "suspended",
                hasFactusCreds: false,
                facturacionCuota: 0,
                facturacionUsadas: 0,
                createdAt: createdDate.toISOString(),
                subscriptionEndDate: endDate.toISOString()
            });
        });

        // 2. Fusionar/Sobrescribir con la información detallada guardada en website_config (si existe)
        savedTenants.forEach(t => {
            if (!t || !t.id) return;
            const idKey = String(t.id);
            const existing = tenantsMap.get(idKey) || {};
            const prof = profileMap.get(idKey);
            const createdDate = t.created_at || t.createdAt ? new Date(t.created_at || t.createdAt) : new Date();
            const daysToAdd = t.planDuration === "yearly" ? 365 : 30;
            const endDate = t.subscriptionEndDate 
                ? new Date(t.subscriptionEndDate) 
                : new Date(createdDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

            const candidateEmail = prof?.adminEmail || t.adminEmail || t.contactEmail || t.email || existing.adminEmail || "";
            const resolvedAdminEmail = candidateEmail.toLowerCase() === "madridsystem@outlook.es" ? (prof?.adminEmail || existing.adminEmail || "") : candidateEmail;
            const resolvedAdminName = prof?.adminName || t.adminName || existing.adminName || "";

            tenantsMap.set(idKey, {
                ...existing,
                id: idKey,
                name: t.nombre || t.name || existing.name || "Sin nombre",
                nombre: t.nombre || t.name || existing.nombre || "Sin nombre",
                nit: t.nit || existing.nit || "",
                telefono: t.telefono || existing.telefono || "",
                address: t.direccion || t.address || existing.address || "",
                ciudad: t.ciudad || existing.ciudad || "",
                contactEmail: resolvedAdminEmail || existing.contactEmail || "",
                adminName: resolvedAdminName,
                adminEmail: resolvedAdminEmail,
                planId: t.plan || t.planId || existing.planId || "free",
                planDuration: t.planDuration || existing.planDuration || "monthly",
                status: t.activo !== false ? "active" : "suspended",
                subscriptionStatus: t.activo !== false ? "active" : "suspended",
                hasFactusCreds: Boolean(t.hasFactusCreds ?? existing.hasFactusCreds),
                factusNumberingRangeId: t.factusNumberingRangeId || existing.factusNumberingRangeId || "",
                factusTestMode: t.factusTestMode ?? existing.factusTestMode ?? true,
                facturacionCuota: t.facturacionCuota ?? existing.facturacionCuota ?? 0,
                facturacionUsadas: t.facturacionUsadas ?? existing.facturacionUsadas ?? 0,
                createdAt: createdDate.toISOString(),
                subscriptionEndDate: endDate.toISOString()
            });
        });

        return Array.from(tenantsMap.values());
    } catch (error) {
        console.error("Error al obtener clínicas desde Supabase:", error);
        return [];
    }
};

/**
 * Registrar una nueva Clínica (Tenant) en Supabase PostgreSQL sin bloqueos RLS
 */
/**
 * Actualizar detalles de una Clínica
 */
export const updateTenantDetails = async (tenantId, updates) => {
    try {
        const { data: existingRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const currentTenants = existingRow?.config?.registered_tenants || [];
        const updatedTenants = currentTenants.map(t => {
            if (t.id === tenantId) {
                const updatedPlanId = updates.planId || updates.plan || t.planId || t.plan;
                let cuotaFacturas = t.facturacionCuota;
                if (updatedPlanId.includes("basic") || updatedPlanId.includes("basico")) cuotaFacturas = 100;
                else if (updatedPlanId.includes("enterprise") || updatedPlanId.includes("ips") || updatedPlanId.includes("349")) cuotaFacturas = 2000;
                else cuotaFacturas = 500;

                return {
                    ...t,
                    nombre: updates.name || updates.nombre || t.nombre,
                    nit: updates.nit !== undefined ? updates.nit : t.nit,
                    telefono: updates.telefono !== undefined ? updates.telefono : t.telefono,
                    direccion: updates.address || updates.direccion || t.direccion,
                    contactEmail: updates.contactEmail || updates.email || t.contactEmail,
                    adminEmail: updates.adminEmail !== undefined ? updates.adminEmail : (t.adminEmail || t.contactEmail),
                    plan: updatedPlanId,
                    planId: updatedPlanId,
                    facturacionCuota: cuotaFacturas
                };
            }
            return t;
        });

        const updatedConfig = {
            ...(existingRow?.config || {}),
            registered_tenants: updatedTenants,
            updatedAt: new Date().toISOString()
        };

        await supabase
            .from("website_config")
            .upsert({
                tenant_id: GLOBAL_CONFIG_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        // Sincronizar en la tabla nativa 'tenants' de PostgreSQL
        await supabase
            .from("tenants")
            .update({
                nombre: updates.name || updates.nombre,
                nit: updates.nit
            })
            .eq("id", tenantId);

        return true;
    } catch (error) {
        console.error("Error al actualizar clínica en Supabase:", error);
        throw error;
    }
};

/**
 * Cambiar estado de la clínica (Activo / Suspendido)
 */
export const toggleTenantStatus = async (tenantId, currentActive) => {
    try {
        const isCurrentlyActive = currentActive === "active" || currentActive === true;
        const newActiveState = !isCurrentlyActive;

        const { data: existingRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const currentTenants = existingRow?.config?.registered_tenants || [];
        const updatedTenants = currentTenants.map(t => {
            if (t.id === tenantId) {
                return { ...t, activo: newActiveState, status: newActiveState ? "active" : "suspended" };
            }
            return t;
        });

        const updatedConfig = {
            ...(existingRow?.config || {}),
            registered_tenants: updatedTenants,
            updatedAt: new Date().toISOString()
        };

        await supabase
            .from("website_config")
            .upsert({
                tenant_id: GLOBAL_CONFIG_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        // Sincronizar en las tablas nativas de PostgreSQL: 'tenants' y 'profiles'
        try {
            await supabase
                .from("tenants")
                .update({ activo: newActiveState })
                .eq("id", tenantId);
        } catch (tErr) {
            console.warn("Advertencia al actualizar activo en tabla tenants:", tErr?.message);
        }

        try {
            await supabase
                .from("profiles")
                .update({ activo: newActiveState })
                .eq("tenant_id", tenantId);
        } catch (pErr) {
            console.warn("Advertencia al actualizar activo en tabla profiles:", pErr?.message);
        }

        return true;
    } catch (error) {
        console.error("Error al cambiar estado de la clínica:", error);
        throw error;
    }
};

/**
 * Eliminar Clínica en Supabase
 */
export const deleteTenant = async (tenantId) => {
    try {
        // 1. Eliminar de website_config JSONB
        const { data: existingRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const currentTenants = existingRow?.config?.registered_tenants || [];
        const updatedTenants = currentTenants.filter(t => String(t.id) !== String(tenantId));

        const updatedConfig = {
            ...(existingRow?.config || {}),
            registered_tenants: updatedTenants,
            updatedAt: new Date().toISOString()
        };

        await supabase
            .from("website_config")
            .upsert({
                tenant_id: GLOBAL_CONFIG_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        // 2. Desactivar perfiles de usuarios vinculados a esta clínica
        await supabase
            .from("profiles")
            .update({ activo: false, role: "inactivo", tenant_id: null })
            .eq("tenant_id", tenantId);

        // 3. Eliminar también de la tabla nativa 'tenants' de PostgreSQL
        await supabase
            .from("tenants")
            .delete()
            .eq("id", tenantId);

        return true;
    } catch (error) {
        console.error("Error al eliminar clínica:", error);
        throw error;
    }
};

/**
 * Obtener Planes de Suscripción
 */
const SUPERADMIN_TENANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export const getPlans = async () => {
    try {
        const { data: publicConfigs, error } = await supabase
            .rpc("get_public_website_configs");
        if (error) throw error;
        const row = publicConfigs?.find(configRow =>
            configRow.tenant_id === SUPERADMIN_TENANT_ID ||
            configRow.tenant_id === "general"
        );

        const plans = row?.config?.plans;
        if (Array.isArray(plans)) {
            return plans;
        }

        const defaultPlans = [
            {
                id: "consultorio",
                name: "Consultorio",
                description: "Ideal para dentistas independientes o consultorios pequeños.",
                maxUsers: 2,
                monthlyPrice: 59900,
                yearlyPrice: 599000,
                includeFacturacion: false,
                facturasIncluidas: 0,
                recommended: false,
                features: [
                    "🌐 Sitio Web Corporativo GRATIS Incluido",
                    "Agenda inteligente con recordatorios",
                    "Historia clínica digital ilimitada",
                    "Gestión de pacientes ilimitada",
                    "Módulo de pagos y recibos de caja",
                    "Saldo a favor del paciente",
                    "Presupuestos y planes de tratamiento",
                    "Reportes financieros básicos"
                ]
            },
            {
                id: "clinica",
                name: "Clínica",
                description: "Para clínicas en crecimiento que necesitan escalar sin pagar más.",
                maxUsers: 12,
                monthlyPrice: 99900,
                yearlyPrice: 1190000,
                includeFacturacion: true,
                facturasIncluidas: 500,
                recommended: true,
                features: [
                    "🌐 Sitio Web Corporativo GRATIS Incluido (CMS)",
                    "Todo lo del plan Consultorio",
                    "Múltiples sedes y sucursales incluidas",
                    "Hasta 12 usuarios activos",
                    "Historia clínica digital ilimitada",
                    "Facturación electrónica DIAN (RIPS)",
                    "Reportes financieros avanzados",
                    "Soporte directo por WhatsApp"
                ]
            },
            {
                id: "enterprise",
                name: "Enterprise",
                description: "Sin límites para redes de clínicas o cadenas odontológicas.",
                maxUsers: 999,
                monthlyPrice: 165800,
                yearlyPrice: 1990000,
                includeFacturacion: true,
                facturasIncluidas: 2000,
                recommended: false,
                features: [
                    "🌐 Sitio Web Corporativo GRATIS Personalizado",
                    "Todo lo del plan Clínica",
                    "Sedes y sucursales ilimitadas",
                    "Usuarios ILIMITADOS",
                    "Roles y permisos avanzados",
                    "Facturación electrónica DIAN (RIPS)",
                    "Reportes y analíticas avanzadas",
                    "API de integración disponible",
                    "Account Manager personal",
                    "Soporte prioritario 24/7",
                    "Migración de datos incluida"
                ]
            }
        ];

        return defaultPlans;
    } catch (error) {

        console.error("Error al cargar planes desde Supabase:", error);
        return [];
    }
};

export const createPlan = async (planData) => {
    try {
        const current = await getPlans();
        const newPlan = {
            id: planData.id || ("plan-" + Date.now()),
            name: planData.name || "Nuevo Plan",
            description: planData.description || "",
            maxUsers: Number(planData.maxUsers || 5),
            monthlyPrice: Number(planData.monthlyPrice || 0),
            yearlyPrice: Number(planData.yearlyPrice || 0),
            includeFacturacion: Boolean(planData.includeFacturacion),
            facturasIncluidas: Number(planData.facturasIncluidas || 0),
            recommended: Boolean(planData.recommended),
            features: planData.features || [],
            status: "active"
        };

        const updated = [...current, newPlan];

        const { data: existing } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", SUPERADMIN_TENANT_ID)
            .maybeSingle();

        const updatedConfig = {
            ...(existing?.config || {}),
            plans: updated,
            updatedAt: new Date().toISOString()
        };

        const { error } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: SUPERADMIN_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return newPlan;
    } catch (error) {
        console.error("Error al crear plan en Supabase:", error);
        throw error;
    }
};

export const updatePlan = async (planId, updates) => {
    try {
        const current = await getPlans();
        const updated = current.map(p => p.id === planId ? { ...p, ...updates } : p);

        const { data: existing } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", SUPERADMIN_TENANT_ID)
            .maybeSingle();

        const updatedConfig = {
            ...(existing?.config || {}),
            plans: updated,
            updatedAt: new Date().toISOString()
        };

        const { error } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: SUPERADMIN_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error al actualizar plan en Supabase:", error);
        throw error;
    }
};

export const deletePlan = async (planId) => {
    try {
        const current = await getPlans();
        const updated = current.filter(p => p.id !== planId);

        const { data: existing } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", SUPERADMIN_TENANT_ID)
            .maybeSingle();

        const updatedConfig = {
            ...(existing?.config || {}),
            plans: updated,
            updatedAt: new Date().toISOString()
        };

        const { error } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: SUPERADMIN_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error al eliminar plan en Supabase:", error);
        throw error;
    }
};



export const getPaymentMethods = async () => {
    try {
        const { data: row } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", SUPERADMIN_TENANT_ID)
            .maybeSingle();

        const methods = row?.config?.payment_methods;
        if (Array.isArray(methods)) {
            return methods;
        }

        const defaults = [
            { id: "nequi", name: "Nequi / Bancolombia", type: "Billetera Digital", number: "3001234567", holder: "OdontoCloud SAS", logoUrl: "", active: true },
            { id: "wompi", name: "Tarjeta de Crédito / PSE", type: "Pasarela Wompi", number: "Convenio 12345", holder: "OdontoCloud SAS", logoUrl: "", active: true }
        ];

        return defaults;
    } catch (error) {
        console.error("Error al obtener métodos de pago en Supabase:", error);
        return [
            { id: "nequi", name: "Nequi / Bancolombia", type: "Billetera Digital", number: "3001234567", holder: "OdontoCloud SAS", logoUrl: "", active: true }
        ];
    }
};

export const addPaymentMethod = async (methodData) => {
    try {
        const current = await getPaymentMethods();
        const newMethod = {
            id: "pm-" + Date.now(),
            name: methodData.name || "",
            type: methodData.type || "Billetera Digital",
            number: methodData.number || "",
            holder: methodData.holder || "",
            logoUrl: methodData.logoUrl || "",
            active: methodData.active ?? true
        };

        const updated = [...current, newMethod];

        const { data: existing } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", SUPERADMIN_TENANT_ID)
            .maybeSingle();

        const updatedConfig = {
            ...(existing?.config || {}),
            payment_methods: updated,
            updatedAt: new Date().toISOString()
        };

        const { error } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: SUPERADMIN_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return newMethod;
    } catch (error) {
        console.error("Error al agregar método de recaudo:", error);
        throw error;
    }
};

export const updatePaymentMethod = async (id, updates) => {
    try {
        const current = await getPaymentMethods();
        const updated = current.map(m => m.id === id ? { ...m, ...updates } : m);

        const { data: existing } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", SUPERADMIN_TENANT_ID)
            .maybeSingle();

        const updatedConfig = {
            ...(existing?.config || {}),
            payment_methods: updated,
            updatedAt: new Date().toISOString()
        };

        const { error } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: SUPERADMIN_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error al actualizar método de recaudo:", error);
        throw error;
    }
};

export const deletePaymentMethod = async (id) => {
    try {
        const current = await getPaymentMethods();
        const updated = current.filter(m => m.id !== id);

        const { data: existing } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", SUPERADMIN_TENANT_ID)
            .maybeSingle();

        const updatedConfig = {
            ...(existing?.config || {}),
            payment_methods: updated,
            updatedAt: new Date().toISOString()
        };

        const { error } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: SUPERADMIN_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error al eliminar método de recaudo:", error);
        throw error;
    }
};

export const getGlobalConfig = async () => {
    try {
        const { data: row } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
            .maybeSingle();

        const global = row?.config?.global || {};
        return {
            adminPhone: global.adminPhone || "3001234567",
            supportEmail: global.supportEmail || "soporte@odontocloud.com",
            supportPhone: global.supportPhone || "+57 300 000 0000"
        };
    } catch (e) {
        return {
            adminPhone: "3001234567",
            supportEmail: "soporte@odontocloud.com",
            supportPhone: "+57 300 000 0000"
        };
    }
};

export const updateGlobalConfig = async (configData) => {
    try {
        const { data: existing } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
            .maybeSingle();

        const updatedConfig = {
            ...(existing?.config || {}),
            global: {
                ...(existing?.config?.global || {}),
                ...configData,
                updatedAt: new Date().toISOString()
            }
        };

        const { error } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    } catch (e) {
        console.error("Error al actualizar configuración global:", e);
        throw e;
    }
};

export const uploadFile = async (file, folder = "general") => {
    const fileExt = file.name ? file.name.split(".").pop() : "jpg";
    const uploaded = await uploadOptimizedPublicFile({
        bucket: "public-assets",
        path: `${folder}/${Date.now()}.${fileExt}`,
        file,
        profile: "avatar",
    });
    return uploaded.publicUrl;
};

export const updateTenantPlan = async (tenantId, planId) => {
    return updateTenantDetails(tenantId, { planId });
};

export const grantFreeMonth = async () => {
    return true;
};

const invokeRegisterClinic = async (action, payload = {}) => {
    const { data, error } = await supabase.functions.invoke("register-clinic", {
        body: { action, ...payload }
    });

    if (error) {
        let message = error.message || "No fue posible completar la operacion de clinicas.";
        try {
            const details = await error.context?.json();
            message = details?.error || message;
        } catch {
            // La respuesta de Functions puede no incluir JSON.
        }
        throw new Error(message);
    }
    if (!data?.success) {
        throw new Error(data?.error || "La operacion de clinicas fue rechazada.");
    }
    return data;
};

export const createTenant = async (tenantData) => {
    const clinicName = tenantData.name || tenantData.nombre || "Nueva Clinica";
    const adminEmail = tenantData.adminEmail || tenantData.contactEmail || "";
    const response = await invokeRegisterClinic("create_clinic", {
        clinicName,
        adminName: tenantData.adminName || `Administrador ${clinicName}`,
        adminEmail,
        adminPassword: String(tenantData.adminPassword || ""),
        requestedPlan: tenantData.planId || tenantData.plan || "free",
        planDuration: tenantData.planDuration || "monthly",
        nit: tenantData.nit || "",
        telefono: tenantData.telefono || "",
        direccion: tenantData.address || tenantData.direccion || "",
        ciudad: tenantData.ciudad || "",
        contactEmail: tenantData.contactEmail || tenantData.email || adminEmail
    });

    return {
        id: response.tenantId,
        nombre: clinicName,
        adminEmail,
        planId: tenantData.planId || "free",
        activo: true
    };
};

export const createSubscriptionRequest = async ({
    adminEmail,
    adminPassword,
    adminName,
    clinicName,
    requestedPlan
}) => {
    const response = await invokeRegisterClinic("submit_request", {
        adminEmail,
        adminPassword,
        adminName,
        clinicName,
        requestedPlan
    });
    return response.request;
};

export const getSubscriptionRequests = async () => {
    const { data, error } = await supabase
        .from("subscription_requests")
        .select("id, tenant_name, admin_name, admin_email, requested_plan_id, requested_plan_name, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    if (error) throw error;

    return (data || []).map(request => ({
        id: request.id,
        tenantName: request.tenant_name,
        adminName: request.admin_name,
        adminEmail: request.admin_email,
        requestedPlanId: request.requested_plan_id,
        requestedPlanName: request.requested_plan_name,
        status: request.status,
        createdAt: request.created_at
    }));
};

export const approveSubscriptionRequest = async (requestId) => {
    await invokeRegisterClinic("approve_request", { requestId });
    return true;
};

export const rejectSubscriptionRequest = async (requestId, reason = "") => {
    await invokeRegisterClinic("reject_request", { requestId, reason });
    return true;
};
