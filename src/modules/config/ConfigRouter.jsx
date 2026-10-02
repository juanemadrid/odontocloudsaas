import React from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";
import { useAuth } from "../../context/AuthContext";
import { hasElectronicInvoicingAccess } from "../../utils/subscriptionHelper";

import ConfigMenu from "./ConfigMenu";

// Importar componentes de configuración
import ConfigParametros from "./ConfigParametros";
import ConfigAssistant from "./ConfigAssistant"; // NEW COMPONENT
import ConfigEmpresa from "./ConfigEmpresa"; // NEW COMPONENT
import ConfigUsuarios from "./ConfigUsuarios";
import ConfigPerfiles from "./ConfigPerfiles"; // ADDED
import ConfigSuscripcion from "./ConfigSuscripcion";
import EmpresaSucursales from "./EmpresaSucursales";
import EmpresaEspecialidades from "./EmpresaEspecialidades";
import EmpresaListaPrecios from "./EmpresaListaPrecios";
import EmpresaMetodosPago from "./EmpresaMetodosPago";
import ConfigConsecutivos from "./ConfigConsecutivos";
import EmpresaPlanes from "./EmpresaPlanes";
import EmpresaUsuarios from "./EmpresaUsuarios";
import WebsiteEditor from "../cms/WebsiteEditor";
import ConfigCondicionesPago from "./ConfigCondicionesPago";
import ConfigPlantillas from "./ConfigPlantillas";
import EmpresaBancos from "./EmpresaBancos";
import ConfigRecursosFisicos from "./ConfigRecursosFisicos";
import EmpresaFormularioPacientes from "./EmpresaFormularioPacientes";
import ConfigConsentimientos from "./ConfigConsentimientos";
import ConfigCargas from "./ConfigCargas";
import ConfigImpuestos from "./ConfigImpuestos";
import ConfigCatalogoCuentas from "./ConfigCatalogoCuentas";
import ConfigFacturacionElectronica from "./ConfigFacturacionElectronica";
import ConfigTarifasCopago from "./ConfigTarifasCopago";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, errorInfo) { console.error("Config Error:", error, errorInfo); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-red-600 bg-red-50 m-4 rounded-xl border border-red-200">
                    <h2 className="font-bold text-lg mb-2">Error al cargar Configuración</h2>
                    <pre className="text-xs font-mono whitespace-pre-wrap">{this.state.error?.toString()}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}


// Importar Layout
import ConfigLayout from "./ConfigLayout";

export default function ConfigRouter() {
    const { userProfile } = useAuth();
    const params = useParams();
    const location = useLocation();

    // ⬇️ Fallback: si no viene en params, buscarlo en la URL manualmente
    const pathLower = location.pathname.toLowerCase();
    let slug = params.slug;
    if (!slug) {
        if (pathLower.includes("param") || pathLower.includes("configparameters")) {
            slug = "parametros";
        } else if (pathLower.includes("ratesandcopays") || pathLower.includes("copago") || pathLower.includes("newrate")) {
            slug = "tarifas-copago";
        } else if (pathLower.includes("/config/")) {
            slug = pathLower.split("/config/")[1]?.split("/")[0];
        } else {
            slug = "datos-basicos";
        }
    }

    const renderModule = () => {
        switch (slug) {
            case "asistente":
                return <ConfigAssistant />;
            case "menu":
                // Redirect or show menu if strictly requested, but we prefer datos-basicos default
                return <ConfigEmpresa />;
            case "datos-basicos":
                return <ConfigEmpresa />;
            case "logo":
                return <div className="p-10 text-slate-400 font-bold">Módulo Logo: Usar Datos Básicos por ahora</div>;
            case "listas-precios":
                return <EmpresaListaPrecios />;
            case "planes":
                return <EmpresaPlanes />;
            case "consecutivos":
                return <ConfigConsecutivos />;
            case "editor-web": // New Route
                return <WebsiteEditor />;
            case "sucursales":
                return <EmpresaSucursales />;
            case "metodos-pago":
                return <EmpresaMetodosPago />;
            case "bancos":
                return <EmpresaBancos />;
            case "formulario-pacientes":
                return <EmpresaFormularioPacientes />;
            case "especialidades":
                return <EmpresaEspecialidades />;
            case "perfiles":
                return <ConfigPerfiles />;
            case "usuarios":
                return <EmpresaUsuarios />;
            case "condiciones-pago":
                return <ConfigCondicionesPago />;
            case "parametros":
                return <ConfigParametros />;
            case "recursos-fisicos":
                return <ConfigRecursosFisicos />;
            case "plantillas-clinicas":
                return <ConfigPlantillas />;
            case "consentimientos":
                return <ConfigConsentimientos />;
            case "cargas":
                return <ConfigCargas />;
            case "impuestos":
                return <ConfigImpuestos />;
            case "tarifas-copago":
            case "tarifas-copagos":
            case "ratesandcopays":
            case "newrate":
                return <ConfigTarifasCopago />;
            case "catalogo-cuentas":
                return <ConfigCatalogoCuentas />;
            case "facturacion-electronica":
                if (!hasElectronicInvoicingAccess(userProfile)) {
                    return (
                        <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm text-center max-w-lg mx-auto my-12">
                            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                                ⚠️
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">Facturación Electrónica no disponible</h3>
                            <p className="text-slate-500 text-xs leading-relaxed mb-6">
                                Tu plan contratado no incluye la configuración ni emisión de Facturación Electrónica DIAN oficial. Para habilitar este módulo, actualiza tu suscripción al <strong>Plan Clínica</strong>.
                            </p>
                            <Link
                                to={buildDashboardPath("config/suscripcion")}
                                className="inline-flex px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                            >
                                Ver Planes y Suscripción
                            </Link>
                        </div>
                    );
                }
                return <ConfigFacturacionElectronica />;
            case "suscripcion":
                return <ConfigSuscripcion />;
            default:
                // If unknown slug, go back to menu or map to basicos? 
                // Let's go to ConfigParametros to be safe, OR menu.
                return <ConfigParametros />;
        }
    };

    if (slug === "editor-web") {
        return (
            <React.Suspense fallback={<div className="p-10">Cargando módulo...</div>}>
                <ErrorBoundary>
                    {renderModule()}
                </ErrorBoundary>
            </React.Suspense>
        );
    }

    return (
        <ConfigLayout>
            <React.Suspense fallback={<div className="p-10">Cargando módulo...</div>}>
                <ErrorBoundary>
                    {renderModule()}
                </ErrorBoundary>
            </React.Suspense>
        </ConfigLayout>
    );
}
