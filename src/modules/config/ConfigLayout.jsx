import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";
import {
    FiSettings, FiUsers, FiMapPin, FiAward, FiCreditCard,
    FiList, FiPackage, FiCheckSquare, FiLayout, FiShield, FiFileText,
    FiImage, FiHash, FiTag, FiDollarSign, FiClock, FiSliders, FiMonitor,
    FiClipboard, FiUploadCloud, FiPercent, FiBook, FiStar, FiGlobe
} from "react-icons/fi";


const MENU_ITEMS = [
    { label: "Datos Básicos", slug: "datos-basicos", icon: FiSettings },
    { label: "Editor Web", slug: "editor-web", icon: FiGlobe, requiresWebsite: true }, // New Item
    { label: "Lista de precios", slug: "listas-precios", icon: FiList },
    { label: "Planes", slug: "planes", icon: FiLayout },
    { label: "Consecutivos", slug: "consecutivos", icon: FiHash },
    { label: "Almacenes", slug: "almacenes", icon: FiPackage },
    { label: "Categorías inventario", slug: "categorias-inventario", icon: FiTag },
    { label: "Sucursales", slug: "sucursales", icon: FiMapPin },
    { label: "Bancos", slug: "bancos", icon: FiDollarSign },
    { label: "Métodos de pago", slug: "metodos-pago", icon: FiCreditCard },
    { label: "Formulario de pacientes", slug: "formulario-pacientes", icon: FiFileText },
    { label: "Especialidades", slug: "especialidades", icon: FiAward },
    { label: "Perfiles", slug: "perfiles", icon: FiShield },
    { label: "Usuarios", slug: "usuarios", icon: FiUsers },
    { label: "Condiciones de pago", slug: "condiciones-pago", icon: FiClock },
    { label: "Parámetros", slug: "parametros", icon: FiSliders },
    { label: "Recursos físicos", slug: "recursos-fisicos", icon: FiMonitor },
    { label: "Plantillas Doc. Clínicos", slug: "plantillas-clinicas", icon: FiClipboard },
    { label: "Cargas", slug: "cargas", icon: FiUploadCloud },
    { label: "Impuestos", slug: "impuestos", icon: FiPercent },
    { label: "Catálogo de cuentas", slug: "catalogo-cuentas", icon: FiBook },
    { label: "Facturación electrónica", slug: "facturacion-electronica", icon: FiFileText },
    { label: "Suscripción", slug: "suscripcion", icon: FiStar },
];

export default function ConfigLayout({ children }) {
    const location = useLocation();
    const hasWebsiteAccess = true;
    const [manejaCopagos, setManejaCopagos] = React.useState(false);

    const activeMenuItems = React.useMemo(() => {
        if (!manejaCopagos) return MENU_ITEMS;
        const items = [...MENU_ITEMS];
        const impIndex = items.findIndex(i => i.slug === "impuestos");
        if (impIndex !== -1) {
            items.splice(impIndex + 1, 0, {
                label: "Tarifas Copago",
                subSlug: "tarifas-copago",
                icon: FiDollarSign
            });
        }
        return items;
    }, [manejaCopagos]);

    React.useEffect(() => {
        let isMounted = true;
        const loadParams = async () => {
            try {
                const { default: supabase } = await import("../../lib/supabaseClient");
                const { data: { session } } = await supabase.auth.getSession();
                const tenantId = session?.user?.user_metadata?.tenant_id;
                if (!tenantId) return;

                const { data } = await supabase
                    .from("tenants")
                    .select("parametros")
                    .eq("id", tenantId)
                    .maybeSingle();

                if (isMounted && data?.parametros?.general) {
                    setManejaCopagos(Boolean(data.parametros.general.manejaCopagos));
                }
            } catch (err) {
                console.warn("Error cargando parametros en ConfigLayout:", err);
            }
        };

        loadParams();

        const handleParamUpdate = (e) => {
            if (e.detail?.general?.manejaCopagos !== undefined) {
                setManejaCopagos(Boolean(e.detail.general.manejaCopagos));
            }
        };
        window.addEventListener("tenant-parametros-updated", handleParamUpdate);
        return () => {
            isMounted = false;
            window.removeEventListener("tenant-parametros-updated", handleParamUpdate);
        };
    }, []);

    return (
        <div className="flex h-full gap-6 p-2 md:p-6 overflow-hidden bg-slate-50/50">
            {/* Sidebar Navigation */}
            <aside className="config-layout-sidebar w-64 flex-none flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hidden lg:flex">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-[15px] font-bold text-slate-800 uppercase tracking-tight">
                        Configuración
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">
                        Ajustes del sistema
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                    {activeMenuItems.map((item) => {
                        if (item.requiresWebsite && !hasWebsiteAccess) return null;

                        const itemSlug = item.slug || item.subSlug;
                        const isActive = location.pathname.includes(`/config/${itemSlug}`);
                        return (
                            <NavLink
                                key={itemSlug}
                                to={buildDashboardPath(`config/${itemSlug}`)}
                                className={`
                                    flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 group
                                    ${isActive
                                        ? "bg-blue-600 text-white font-semibold shadow-sm"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-blue-600 font-medium"
                                    }
                                `}
                            >
                                <item.icon size={16} className={`flex-none ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                                <span className="text-[12px] truncate">
                                    {item.label}
                                </span>
                            </NavLink>
                        );
                    })}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden flex flex-col relative bg-transparent">
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
