// src/services/adminService.js
import supabase from "../lib/supabaseClient";

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
export const createTenant = async (tenantData) => {
    const adminPassword = String(tenantData.adminPassword || "");
    if (adminPassword.length < 8) {
        throw new Error("La contrasena inicial debe tener al menos 8 caracteres.");
    }

    const clinicName = tenantData.name || tenantData.nombre || "Nueva Clínica";
    const adminEmail = tenantData.adminEmail || tenantData.contactEmail || "";
    const planId = tenantData.planId || "free";
    const planDuration = tenantData.planDuration || "monthly";

    // 1. Intentar registrar vía Edge Function si se encuentra disponible en la nube
    try {
        const { data, error } = await supabase.functions.invoke("register-clinic", {
            body: {
                adminEmail,
                adminPassword,
                adminName: tenantData.adminName,
                clinicName,
                requestedPlan: planId,
                planDuration,
                nit: tenantData.nit || "",
                telefono: tenantData.telefono || "",
                direccion: tenantData.address || tenantData.direccion || "",
                ciudad: tenantData.ciudad || "",
                contactEmail: tenantData.contactEmail || tenantData.email || adminEmail
            }
        });

        if (!error && data?.success && data?.tenantId) {
            return {
                id: data.tenantId,
                nombre: clinicName,
                adminEmail,
                planId,
                activo: true
            };
        }
    } catch (edgeErr) {
        console.warn("Edge function 'register-clinic' no disponible o con bloqueo CORS, ejecutando fallback de creación directa:", edgeErr);
    }

    // 2. Fallback de Creación Directa en PostgreSQL & website_config
    const tenantId = crypto.randomUUID();

    // a) Inserción en la tabla de PostgreSQL 'tenants'
    const { data: dbTenant, error: dbErr } = await supabase
        .from("tenants")
        .insert([{
            id: tenantId,
            nombre: clinicName,
            nit: tenantData.nit || "",
            email: adminEmail,
            plan: planId,
            activo: true
        }])
        .select()
        .maybeSingle();

    if (dbErr) {
        console.warn("Advertencia al insertar en tabla tenants:", dbErr.message);
    }

    // b) Sincronización en website_config global
    const { data: existingRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
        .maybeSingle();

    const currentConfig = existingRow?.config || {};
    const registeredTenants = Array.isArray(currentConfig.registered_tenants) ? currentConfig.registered_tenants : [];

    const newTenantObj = {
        id: tenantId,
        nombre: clinicName,
        name: clinicName,
        nit: tenantData.nit || "",
        telefono: tenantData.telefono || "",
        direccion: tenantData.address || tenantData.direccion || "",
        ciudad: tenantData.ciudad || "",
        contactEmail: tenantData.contactEmail || tenantData.email || adminEmail,
        adminName: tenantData.adminName || "",
        adminEmail: adminEmail,
        plan: planId,
        planId: planId,
        planDuration: planDuration,
        activo: true,
        createdAt: new Date().toISOString()
    };

    const updatedTenants = [...registeredTenants.filter(t => t?.id !== tenantId), newTenantObj];

    const { error: wcErr } = await supabase
        .from("website_config")
        .upsert({
            tenant_id: GLOBAL_CONFIG_TENANT_ID,
            config: { ...currentConfig, registered_tenants: updatedTenants }
        });

    if (wcErr && dbErr) {
        throw new Error(`No fue posible registrar la clínica: ${dbErr?.message || wcErr?.message}`);
    }

    // c) Creación y aprovisionamiento de la cuenta Auth y perfil de administrador para la clínica
    if (adminEmail && adminPassword) {
        try {
            await supabase.rpc("admin_create_clinic_user", {
                p_email: adminEmail.trim(),
                p_password: adminPassword,
                p_full_name: tenantData.adminName || `Administrador ${clinicName}`,
                p_tenant_id: tenantId
            });
        } catch (rpcErr) {
            console.warn("Nota al aprovisionar usuario mediante RPC:", rpcErr?.message);
        }
    }

    return {
        id: tenantId,
        nombre: clinicName,
        adminEmail,
        planId,
        activo: true
    };
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

        // Sincronizar en la tabla nativa 'tenants' de PostgreSQL
        const targetAdminEmail = updates.adminEmail || updates.contactEmail;
        if (targetAdminEmail) {
            await supabase
                .from("tenants")
                .update({
                    nombre: updates.name || updates.nombre,
                    email: targetAdminEmail,
                    nit: updates.nit
                })
                .eq("id", tenantId);
        }

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
    const filePath = `${folder}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("public-assets").upload(filePath, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("public-assets").getPublicUrl(filePath);
    return publicUrl;
};

export const updateTenantPlan = async (tenantId, planId) => {
    return updateTenantDetails(tenantId, { planId });
};

export const grantFreeMonth = async () => {
    return true;
};

export const createSubscriptionRequest = async ({
    adminEmail,
    adminPassword,
    adminName,
    clinicName,
    requestedPlan
}) => {
    try {
        const { data: existingRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const currentConfig = existingRow?.config || {};
        const requests = Array.isArray(currentConfig.subscription_requests) ? currentConfig.subscription_requests : [];

        const newRequest = {
            id: "req-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
            tenantName: clinicName || "Nueva Clínica",
            adminName: adminName || "",
            adminEmail: adminEmail || "",
            adminPassword: adminPassword || "",
            requestedPlanName: typeof requestedPlan === "object" ? (requestedPlan?.name || "Trial") : (requestedPlan || "Trial"),
            requestedPlanId: typeof requestedPlan === "object" ? (requestedPlan?.id || "trial") : (requestedPlan || "trial"),
            createdAt: new Date().toISOString(),
            status: "pending"
        };

        const updatedRequests = [newRequest, ...requests.filter(r => r.adminEmail !== adminEmail || r.status !== "pending")];

        const { error } = await supabase
            .from("website_config")
            .upsert({
                tenant_id: GLOBAL_CONFIG_TENANT_ID,
                config: {
                    ...currentConfig,
                    subscription_requests: updatedRequests
                },
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return newRequest;
    } catch (err) {
        console.error("Error al guardar solicitud de demostración:", err);
        throw err;
    }
};

export const getSubscriptionRequests = async () => {
    try {
        const { data: existingRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const requests = existingRow?.config?.subscription_requests || [];
        return requests.filter(r => r.status === "pending");
    } catch (err) {
        console.error("Error al obtener solicitudes:", err);
        return [];
    }
};

export const approveSubscriptionRequest = async (requestId) => {
    try {
        // 1. Obtener la solicitud destino
        const { data: rowBefore } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const requestsBefore = rowBefore?.config?.subscription_requests || [];
        const targetReq = requestsBefore.find(r => r.id === requestId);

        if (!targetReq) {
            throw new Error("No se encontró la solicitud especificada.");
        }

        // 2. Crear la clínica oficialmente en el sistema
        await createTenant({
            name: targetReq.tenantName,
            adminName: targetReq.adminName,
            adminEmail: targetReq.adminEmail,
            adminPassword: targetReq.adminPassword,
            planId: targetReq.requestedPlanId || "consultorio",
            planDuration: "monthly"
        });

        // 3. Re-consultar la configuración fresca para no sobrescribir registered_tenants creados por createTenant
        const { data: rowAfter } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const freshConfig = rowAfter?.config || {};
        const freshRequests = freshConfig.subscription_requests || [];

        const updatedRequests = freshRequests.map(r => r.id === requestId ? { ...r, status: "approved", approvedAt: new Date().toISOString() } : r);

        await supabase
            .from("website_config")
            .upsert({
                tenant_id: GLOBAL_CONFIG_TENANT_ID,
                config: {
                    ...freshConfig,
                    subscription_requests: updatedRequests
                },
                updated_at: new Date().toISOString()
            });

        return true;
    } catch (err) {
        console.error("Error al aprobar solicitud:", err);
        throw err;
    }
};

export const rejectSubscriptionRequest = async (requestId, reason = "") => {
    try {
        const { data: existingRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", GLOBAL_CONFIG_TENANT_ID)
            .maybeSingle();

        const currentConfig = existingRow?.config || {};
        const requests = currentConfig.subscription_requests || [];

        const updatedRequests = requests.map(r => r.id === requestId ? { ...r, status: "rejected", rejectReason: reason, rejectedAt: new Date().toISOString() } : r);

        await supabase
            .from("website_config")
            .upsert({
                tenant_id: GLOBAL_CONFIG_TENANT_ID,
                config: {
                    ...currentConfig,
                    subscription_requests: updatedRequests
                },
                updated_at: new Date().toISOString()
            });

        return true;
    } catch (err) {
        console.error("Error al rechazar solicitud:", err);
        throw err;
    }
};
