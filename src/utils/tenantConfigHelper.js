import supabase from "../lib/supabaseClient";
import { DEFAULT_CONFIG } from "../constants/DefaultConfig";
import { MASTER_CONFIG } from "../constants/MasterConfig";

export function slugify(text) {
    if (!text) return "";
    return text
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

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
            const normSlug = slugify(clinicSlug);

            // 1. Exact match on config.slug
            let matchedRow = rows.find(r => {
                const s = r.config?.slug;
                return s && slugify(s) === normSlug;
            });

            // 2. Match slug derived from config.name, empresa_datos.nombreComercial, or empresaNombre
            if (!matchedRow) {
                matchedRow = rows.find(r => {
                    const c = r.config || {};
                    const nameCandidate = c.name || c.empresa_datos?.nombreComercial || c.empresa_datos?.razonSocial || c.empresaNombre || "";
                    if (!nameCandidate) return false;
                    const normName = slugify(nameCandidate);
                    return normName === normSlug || normName.includes(normSlug) || normSlug.includes(normName);
                });
            }

            // 3. Fallback to first tenant that has real clinic data (non-master)
            if (!matchedRow) {
                matchedRow = rows.find(r => 
                    r.tenant_id !== "general" && 
                    r.tenant_id !== "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" &&
                    (r.config?.empresa_datos || r.config?.name)
                );
            }

            if (matchedRow && matchedRow.config) {
                const data = matchedRow.config;
                const empresaData = data.empresa_datos || {};

                // Determine proper clinic name (never generic fallback)
                let clinicName = data.name;
                if (!clinicName || clinicName === "OdontoCloud" || clinicName === "Nombre de tu Clínica" || clinicName === "Clínica Dental" || clinicName === "CL NICA DENTAL") {
                    clinicName = empresaData.nombreComercial || empresaData.razonSocial || data.empresaNombre || "ATM CENTRO DEL DOLOR OROFACIAL";
                }

                const logo = data.logo || empresaData.logoUrl || DEFAULT_CONFIG.logo;
                const phone = data.contactPhone || data.phone || empresaData.telefono || empresaData.celular || "605 284 6190";
                const email = data.email || empresaData.email || "atmcentrodeldolor@gmail.com";
                const address = data.address || empresaData.direccion || "CALLE 16#17-68";
                const city = data.city || empresaData.ciudad || "Sincelejo";

                // Map locations/sedes
                const rawSedes = data.locations || data.sucursales || data.empresa_sucursales || [];
                const locations = rawSedes.length > 0 ? rawSedes.map((s, idx) => ({
                    name: s.nombre || s.name || s.nombreComercial || `Sede ${idx + 1}`,
                    address: s.direccion || s.address || address,
                    phone: s.telefono || s.phone || phone,
                    schedule: s.horario || s.schedule || "Lun - Vie: 7:00 AM - 7:00 PM · Sáb: 8:00 AM - 1:00 PM",
                    city: s.ciudad || s.city || city,
                    image: s.image || s.foto || "",
                    mapUrl: s.mapUrl || ""
                })) : [
                    {
                        name: "Sede Principal - " + (city || "Sincelejo"),
                        address: address,
                        phone: phone,
                        schedule: "Lun - Vie: 7:00 AM - 7:00 PM · Sáb: 8:00 AM - 1:00 PM",
                        city: city,
                        image: "",
                        mapUrl: ""
                    }
                ];

                let heroTitle = data.heroTitle;
                if (!heroTitle || heroTitle.toLowerCase().includes("gestiona tu clínica") || heroTitle.includes("Clínica Dental") || heroTitle.includes("CL NICA DENTAL") || heroTitle.includes("Nombre de tu Clínica")) {
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
                    locations,
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
    const formattedFallbackName = "ATM CENTRO DEL DOLOR OROFACIAL";
    return {
        ...DEFAULT_CONFIG,
        name: formattedFallbackName,
        heroTitle: `Cuidamos la sonrisa de tu familia en ${formattedFallbackName}`,
        address: "CALLE 16#17-68",
        city: "Sincelejo",
        contactPhone: "605 284 6190",
        phone: "605 284 6190",
        slug: clinicSlug,
        isMaster: false
    };
}
