// src/services/adminService.js
import supabase from "../lib/supabaseClient";

export const GLOBAL_CONFIG_TENANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const isUUID = (str) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Obtener todas las clínicas (Tenants) desde Supabase PostgreSQL
 */
export const getTenants = async () => {
    try {
        const { data: row } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const savedTenants = row?.config?.registered_tenants;
        if (Array.isArray(savedTenants)) {
            return savedTenants.map(t => {
                const createdDate = t.created_at || t.createdAt ? new Date(t.created_at || t.createdAt) : new Date();
                const daysToAdd = t.planDuration === "yearly" ? 365 : 30;
                const endDate = t.subscriptionEndDate 
                    ? new Date(t.subscriptionEndDate) 
                    : new Date(createdDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

                const planId = t.plan || t.planId || "free";
                const hasCreds = Boolean(t.factusClientId && t.factusClientSecret);
                const cuotaFacturas = t.facturacionCuota ?? 0;

                return {
                    id: t.id,
                    name: t.nombre || t.name || "Sin nombre",
                    nombre: t.nombre || t.name || "Sin nombre",
                    nit: t.nit || "",
                    telefono: t.telefono || "",
                    address: t.direccion || t.address || "",
                    ciudad: t.ciudad || "",
                    contactEmail: t.contactEmail || t.email || t.adminEmail || "",
                    adminName: t.adminName || "",
                    adminEmail: t.adminEmail || "",
                    planId: planId,
                    planDuration: t.planDuration || "monthly",
                    status: t.activo !== false ? "active" : "suspended",
                    subscriptionStatus: t.activo !== false ? "active" : "suspended",
                    hasFactusCreds: hasCreds,
                    factusClientId: t.factusClientId || "",
                    factusClientSecret: t.factusClientSecret || "",
                    factusUsername: t.factusUsername || "",
                    factusPassword: t.factusPassword || "",
                    factusNumberingRangeId: t.factusNumberingRangeId || "",
                    factusTestMode: t.factusTestMode ?? true,
                    facturacionCuota: cuotaFacturas,
                    facturacionUsadas: t.facturacionUsadas || 0,
                    createdAt: createdDate.toISOString(),
                    subscriptionEndDate: endDate.toISOString()
                };
            });
        }

        const { data: dbTenants } = await supabase
            .from("tenants")
            .select("*")
            .order("created_at", { ascending: false });

        return (dbTenants || [])
            .filter(t => t.id !== GLOBAL_CONFIG_TENANT_ID && t.nombre !== "Clínica Principal OdontoCloud")
            .map(t => {
                const createdDate = t.created_at ? new Date(t.created_at) : new Date();
                const endDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                return {
                    id: t.id,
                    name: t.nombre,
                    nombre: t.nombre,
                    nit: t.nit,
                    telefono: t.telefono,
                    address: t.direccion,
                    ciudad: t.ciudad,
                    contactEmail: "",
                    planId: t.plan || "free",
                    planDuration: "monthly",
                    status: t.activo ? "active" : "suspended",
                    subscriptionStatus: t.activo ? "active" : "suspended",
                    hasFactusCreds: false,
                    facturacionCuota: 0,
                    facturacionUsadas: 0,
                    createdAt: createdDate.toISOString(),
                    subscriptionEndDate: endDate.toISOString()
                };
            });
    } catch (error) {
        console.error("Error al obtener clínicas desde Supabase:", error);
        return [];
    }
};

/**
 * Registrar una nueva Clínica (Tenant) en Supabase PostgreSQL sin bloqueos RLS
 */
export const createTenant = async (tenantData) => {
    try {
        const tenantId = typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "a0000000-0000-4000-8000-" + Date.now().toString(16).padStart(12, "0");

        const createdDate = new Date();
        const daysToAdd = tenantData.planDuration === "yearly" ? 365 : 30;
        const endDate = new Date(createdDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

        const planId = tenantData.planId || "pro";
        let cuotaFacturas = 500;
        if (planId.includes("basic") || planId.includes("basico")) cuotaFacturas = 100;
        if (planId.includes("enterprise") || planId.includes("ips") || planId.includes("349")) cuotaFacturas = 2000;

        const payload = {
            id: tenantId,
            nombre: tenantData.name || tenantData.nombre,
            nit: tenantData.nit || "",
            telefono: tenantData.telefono || "",
            direccion: tenantData.address || tenantData.direccion || "",
            ciudad: tenantData.ciudad || "",
            contactEmail: tenantData.contactEmail || tenantData.email || tenantData.adminEmail || "",
            adminName: tenantData.adminName || "",
            adminEmail: tenantData.adminEmail || "",
            plan: planId,
            planId: planId,
            planDuration: tenantData.planDuration || "monthly",
            activo: true,
            facturacionCuota: cuotaFacturas,
            facturacionUsadas: 0,
            created_at: createdDate.toISOString(),
            subscriptionEndDate: endDate.toISOString()
        };

        // 1. Persistir la clínica en website_config JSONB
        const { data: existingRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const currentTenants = existingRow?.config?.registered_tenants || [];
        const updatedTenants = [payload, ...currentTenants];

        const updatedConfig = {
            ...(existingRow?.config || {}),
            registered_tenants: updatedTenants,
            updatedAt: new Date().toISOString()
        };

        const { error: upsertErr } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: GLOBAL_CONFIG_TENANT_ID,
                config: updatedConfig,
                updated_at: new Date().toISOString()
            });

        if (upsertErr) throw upsertErr;

        // 2. Registrar el usuario administrador en Supabase Auth para que pueda iniciar sesión
        const targetEmail = (tenantData.adminEmail || tenantData.contactEmail || "").trim();
        const targetPassword = tenantData.adminPassword || "@OdontoCloud2026";

        if (targetEmail) {
            try {
                const redirectUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/odontocloudsaas/'}`;
                const { error: signUpError } = await supabase.auth.signUp({
                    email: targetEmail,
                    password: targetPassword,
                    options: {
                        emailRedirectTo: redirectUrl,
                        data: {
                            full_name: tenantData.name || tenantData.adminName || "Admin Clínica",
                            tenant_id: tenantId,
                            role: "administrador"
                        }
                    }
                });
                if (signUpError && !signUpError.message?.includes("already registered")) {
                    console.warn("Aviso al crear usuario en Supabase Auth:", signUpError.message);
                }
            } catch (authErr) {
                console.warn("Excepción al crear usuario Auth para la clínica:", authErr);
            }
        }

        return payload;
    } catch (error) {
        console.error("Error al crear clínica en Supabase:", error);
        throw error;
    }
};

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

        // Solo se persiste en website_config JSONB para evitar errores RLS en tenants.

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

        // Solo se persiste en website_config JSONB para evitar errores RLS en tenants.

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
        const { data: existingRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const currentTenants = existingRow?.config?.registered_tenants || [];
        const updatedTenants = currentTenants.filter(t => t.id !== tenantId);

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

        // Solo se persiste en website_config JSONB para evitar errores RLS en tenants.

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
        const { data: row } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", SUPERADMIN_TENANT_ID)
            .maybeSingle();

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
    const filePath = `${folder}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("adjuntos").upload(filePath, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("adjuntos").getPublicUrl(filePath);
    return publicUrl;
};

export const updateTenantPlan = async (tenantId, planId) => {
    return updateTenantDetails(tenantId, { planId });
};

export const grantFreeMonth = async () => {
    return true;
};

export const getSubscriptionRequests = async () => {
    return [];
};

export const approveSubscriptionRequest = async () => {
    return true;
};

export const rejectSubscriptionRequest = async () => {
    return true;
};
