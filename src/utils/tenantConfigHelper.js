import supabase from "../lib/supabaseClient";
import { DEFAULT_CONFIG } from "../constants/DefaultConfig";
import { MASTER_CONFIG } from "../constants/MasterConfig";

/**
 * Fetch and consolidate website config for a clinic tenant by slug,
 * or return MASTER_CONFIG if isMaster is true.
 */
export async function fetchTenantConfigBySlug(clinicSlug, isMaster = false) {
    if (!clinicSlug && !isMaster) return DEFAULT_CONFIG;

    try {
        const { data: rows, error } = await supabase.rpc("get_public_website_configs");

        if (isMaster) {
            const masterRow = rows?.find(row =>
                row.tenant_id === "general" ||
                row.tenant_id === "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
            );
            return masterRow?.config
                ? { ...MASTER_CONFIG, ...masterRow.config, isMaster: true }
                : MASTER_CONFIG;
        }
        
        if (!error && rows && Array.isArray(rows) && rows.length > 0) {
            const normSlug = clinicSlug.toLowerCase().trim();

            // 1. Exact match on config.slug
            let matchedRow = rows.find(r => {
                const s = r.config?.slug;
                return s && s.toLowerCase().trim() === normSlug;
            });

            // 2. Match slug derived from config.name, empresa_datos.nombreComercial, or empresaNombre
            if (!matchedRow) {
                matchedRow = rows.find(r => {
                    const c = r.config || {};
                    const nameCandidate = c.name || c.empresa_datos?.nombreComercial || c.empresaNombre || "";
                    if (!nameCandidate) return false;
                    const normName = nameCandidate.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
                    return normName === normSlug || normName.includes(normSlug) || normSlug.includes(normName);
                });
            }


            if (matchedRow && matchedRow.config) {
                const data = matchedRow.config;
                const empresaData = data.empresa_datos || {};

                // Determine proper clinic name (never 'Nombre de tu Clínica' or generic fallback)
                let clinicName = data.name;
                if (!clinicName || clinicName === "OdontoCloud" || clinicName === "Nombre de tu Clínica") {
                    clinicName = empresaData.nombreComercial || data.empresaNombre || (clinicSlug === "atm" ? "ATM" : clinicSlug.replace(/-/g, ' ').toUpperCase());
                }

                const logo = data.logo || empresaData.logoUrl || DEFAULT_CONFIG.logo;
                const phone = data.contactPhone || data.phone || empresaData.celular || empresaData.telefono || "3015768935";
                const email = data.email || empresaData.email || "";
                const address = data.address || empresaData.direccion || "";
                const city = data.city || empresaData.ciudad || "";

                let heroTitle = data.heroTitle;
                if (!heroTitle || heroTitle.toLowerCase().includes("gestiona tu clínica") || heroTitle.includes("Clínica Dental") || heroTitle.includes("Nombre de tu Clínica")) {
                    heroTitle = `Cuidamos la sonrisa de tu familia en ${clinicName}`;
                }

                const heroSubtitle = (!data.heroSubtitle || data.heroSubtitle.toLowerCase().includes("odontocloud es el software"))
                    ? "La mejor atención odontológica con tecnología avanzada y un equipo especializado."
                    : data.heroSubtitle;

                return {
                    ...DEFAULT_CONFIG,
                    ...data,
                    name: clinicName,
                    logo,
                    contactPhone: phone,
                    phone,
                    email,
                    address,
                    city,
                    heroTitle,
                    heroSubtitle,
                    tenant_id: matchedRow.tenant_id,
                    slug: clinicSlug,
                    isMaster: false
                };
            }
        }
    } catch (e) {
        console.error("Error fetching tenant website config:", e);
    }

    // Fallback when DB fails or slug not matched
    const formattedFallbackName = clinicSlug === "atm" || clinicSlug === "clinica-dental" ? "ATM" : clinicSlug.replace(/-/g, ' ').toUpperCase();
    return {
        ...DEFAULT_CONFIG,
        name: formattedFallbackName,
        heroTitle: `Cuidamos la sonrisa de tu familia en ${formattedFallbackName}`,
        slug: clinicSlug,
        isMaster: false
    };
}
