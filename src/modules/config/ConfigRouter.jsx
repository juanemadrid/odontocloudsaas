import React from "react";
import { useParams, useLocation } from "react-router-dom";

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
import EmpresaAlmacenes from "./EmpresaAlmacenes";
import ConfigConsecutivos from "./ConfigConsecutivos";
import EmpresaPlanes from "./EmpresaPlanes";
import EmpresaUsuarios from "./EmpresaUsuarios";
import EmpresaCategorias from "./EmpresaCategorias"; // NEW COMPONENT
import WebsiteEditor from "../cms/WebsiteEditor";
import ConfigCondicionesPago from "./ConfigCondicionesPago";
import ConfigPlantillas from "./ConfigPlantillas";
import ConfigPestanasMedicas from "./ConfigPestanasMedicas";
import EmpresaBancos from "./EmpresaBancos";
import ConfigRecursosFisicos from "./ConfigRecursosFisicos";
import EmpresaFormularioPacientes from "./EmpresaFormularioPacientes";
import ConfigConsentimientos from "./ConfigConsentimientos";
import ConfigCargas from "./ConfigCargas";
import ConfigImpuestos from "./ConfigImpuestos";
import ConfigCatalogoCuentas from "./ConfigCatalogoCuentas";
import ConfigFacturacionElectronica from "./ConfigFacturacionElectronica";

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
    const params = useParams();
    const location = useLocation();

    // ⬇️ Fallback: si no viene en params, buscarlo en la URL manualmente
    // Default to "datos-basicos" directly
    const slug = params.slug || location.pathname.split("/config/")[1]?.split("/")[0] || "datos-basicos";

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
            case "almacenes":
                return <EmpresaAlmacenes />;
            case "categorias-inventario":
                return <EmpresaCategorias />;
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
            case "pestanas-consulta":
                return <ConfigPestanasMedicas />;
            case "consentimientos":
                return <ConfigConsentimientos />;
            case "cargas":
                return <ConfigCargas />;
            case "impuestos":
                return <ConfigImpuestos />;
            case "catalogo-cuentas":
                return <ConfigCatalogoCuentas />;
            case "facturacion-electronica":
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
