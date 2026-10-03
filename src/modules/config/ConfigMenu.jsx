import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { hasElectronicInvoicingAccess } from "../../utils/subscriptionHelper";
import {
    FiSettings, FiUsers, FiMapPin, FiAward, FiCreditCard,
    FiList, FiPackage, FiCheckSquare, FiLayout, FiShield, FiFileText, FiServer
} from "react-icons/fi";

const CONFIG_ITEMS = [
    { label: "Asistente de Configuración", slug: "asistente", icon: FiCheckSquare, isPrimary: true, perm: "Gestion Configuración" },
    { label: "Datos Básicos", slug: "datos-basicos", icon: FiSettings, perm: "Gestion Configuración" },
    { label: "Logo", slug: "datos-basicos", icon: FiSettings, perm: "Gestion Configuración" },
    { label: "Lista de precios", slug: "listas-precios", icon: FiList, perm: "Lista precios" },
    { label: "Planes", slug: "planes", icon: FiLayout, perm: "Planes" },
    { label: "Consecutivos", slug: "consecutivos", icon: FiList, perm: "Consecutivos" },
    { label: "Convenios", slug: "convenios", icon: FiCheckSquare, perm: "Convenios" },
    { label: "Facturación electrónica", slug: "facturacion-electronica", icon: FiFileText, perm: "Facturación electrónica" },
    { label: "Sucursales", slug: "sucursales", icon: FiMapPin, perm: "Sucursales" },
    { label: "Bancos", slug: "bancos", icon: FiCreditCard, perm: "Bancos" },
    { label: "Métodos de pago", slug: "metodos-pago", icon: FiCreditCard, perm: "Medios pago" },
    { label: "Formulario de pacientes", slug: "formulario-pacientes", icon: FiFileText, perm: "Formulario paciente" },
    { label: "Especialidades", slug: "especialidades", icon: FiAward, perm: "Especialidades" },
    { label: "Perfiles", slug: "perfiles", icon: FiShield, perm: "Perfiles" },
    { label: "Usuarios", slug: "usuarios", icon: FiUsers, perm: "Usuarios" },
    { label: "Condiciones de pago", slug: "condiciones-pago", icon: FiCreditCard, perm: "Condiciones de pago" },
    { label: "Parámetros", slug: "parametros", icon: FiSettings, perm: "Parametros" },
    { label: "Recursos físicos", slug: "recursos-fisicos", icon: FiServer, perm: "Recursos físicos" },
    { label: "Plantillas Doc. Clínicos", slug: "plantillas-clinicas", icon: FiFileText, perm: "Plantillas" },
    { label: "Cargas", slug: "cargas", icon: FiSettings, perm: "Cargas" },
    { label: "Impuestos", slug: "impuestos", icon: FiCreditCard, perm: "Impuesto" },
    { label: "Catálogo de cuentas", slug: "catalogo-cuentas", icon: FiList, perm: "Catálogo de cuentas" },
    { label: "Suscripción", slug: "suscripcion", icon: FiAward, perm: "Suscripcion" },
];

export default function ConfigMenu() {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { can } = usePermissions();
    const hasFE = hasElectronicInvoicingAccess(userProfile);

    const visibleItems = CONFIG_ITEMS.filter(it => {
        if (it.slug === "convenios") {
            return can("Configuración", "Convenios", "consultar") || 
                   can("Administración", "Convenios", "consultar") ||
                   can("Configuración", "Gestion Configuración", "consultar");
        }
        if (it.slug === "facturacion-electronica") {
            return can("Configuración", "Facturación electrónica", "consultar") || 
                   can("Configuración", "Gestion Configuración", "consultar") ||
                   can("Configuración", "Consecutivos", "consultar");
        }
        if (it.perm && !can("Configuración", it.perm, "consultar")) return false;
        return true;
    });

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 min-h-[600px]">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">
                INFORMACIÓN GENERAL
            </h2>

            <div className="flex flex-col gap-4 max-w-3xl">
                {visibleItems.map((item, index) => (
                    <div
                        key={index} // Using index as slug is not unique
                        onClick={() => navigate(buildDashboardPath(`config/${item.slug}`))}
                        className={`group flex items-center gap-6 p-6 rounded-[24px] border transition-all duration-300 cursor-pointer relative overflow-hidden
                            ${item.isPrimary 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100' 
                                : 'bg-white border-slate-200/60 hover:border-blue-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.08)]'}`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-r transition-transform duration-1000
                            ${item.isPrimary 
                                ? 'from-white/0 via-white/10 to-white/0' 
                                : 'from-blue-50/0 via-blue-50/30 to-blue-50/0'} 
                            translate-x-[-100%] group-hover:translate-x-[100%]`} />

                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all duration-300
                            ${item.isPrimary 
                                ? 'bg-white/10 text-white' 
                                : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:scale-110'}`}
                        >
                            <item.icon />
                        </div>

                        <div className="flex-1">
                            <span className={`text-base font-bold transition-colors
                                ${item.isPrimary ? 'text-white' : 'text-slate-700 group-hover:text-blue-600'}`}>
                                {item.label}
                            </span>
                        </div>

                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                            ${item.isPrimary 
                                ? 'text-white/60' 
                                : 'text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1'}`}
                        >
                            →
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
