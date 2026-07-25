import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";
import {
    FiSettings, FiUsers, FiMapPin, FiAward, FiCreditCard,
    FiList, FiPackage, FiCheckSquare, FiLayout, FiShield, FiFileText, FiServer
} from "react-icons/fi";

const CONFIG_ITEMS = [
    { label: "Asistente de Configuración", slug: "asistente", icon: FiCheckSquare, isPrimary: true },
    { label: "Datos Básicos", slug: "datos-basicos", icon: FiSettings },
    { label: "Logo", slug: "datos-basicos", icon: FiSettings }, // Mapped to same for now or separate if needed
    { label: "Lista de precios", slug: "listas-precios", icon: FiList },
    { label: "Planes", slug: "planes", icon: FiLayout },
    { label: "Consecutivos", slug: "consecutivos", icon: FiList },
    { label: "Almacenes", slug: "almacenes", icon: FiPackage },
    { label: "Categorías inventario", slug: "categorias-inventario", icon: FiPackage },
    { label: "Sucursales", slug: "sucursales", icon: FiMapPin },
    { label: "Métodos de pago", slug: "metodos-pago", icon: FiCreditCard },
    { label: "Bancos", slug: "bancos", icon: FiCreditCard },
    { label: "Formulario de pacientes", slug: "formulario-pacientes", icon: FiFileText },
    { label: "Especialidades", slug: "especialidades", icon: FiAward },
    { label: "Perfiles", slug: "perfiles", icon: FiShield },
    { label: "Usuarios", slug: "usuarios", icon: FiUsers },
    { label: "Condiciones de pago", slug: "condiciones-pago", icon: FiCreditCard },
    { label: "Parámetros", slug: "parametros", icon: FiSettings },
    { label: "Recursos físicos", slug: "recursos-fisicos", icon: FiServer },
    { label: "Plantillas Doc. Clínicos", slug: "plantillas-clinicas", icon: FiFileText },
    { label: "Pestañas Consulta Med.", slug: "pestanas-consulta", icon: FiLayout },
    { label: "Cargas", slug: "cargas", icon: FiSettings },
    { label: "Impuestos", slug: "impuestos", icon: FiCreditCard },
    { label: "Catálogo de cuentas", slug: "catalogo-cuentas", icon: FiList },
    { label: "Facturación electrónica", slug: "facturacion-electronica", icon: FiFileText },
    { label: "Suscripción", slug: "suscripcion", icon: FiAward },
];

export default function ConfigMenu() {
    const navigate = useNavigate();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 min-h-[600px]">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">
                INFORMACIÓN GENERAL
            </h2>

            <div className="flex flex-col gap-4 max-w-3xl">
                {CONFIG_ITEMS.map((item, index) => (
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

                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 shrink-0
                            ${item.isPrimary 
                                ? 'bg-white/20 text-white group-hover:bg-white group-hover:text-blue-600' 
                                : 'bg-blue-50/50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                            <item.icon size={26} />
                        </div>

                        <div className="flex-1">
                            <h3 className={`text-[15px] font-black uppercase tracking-tight mb-1 transition-colors
                                ${item.isPrimary ? 'text-white' : 'text-slate-800 group-hover:text-blue-700'}`}>
                                {item.label}
                            </h3>
                        </div>

                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0
                            ${item.isPrimary 
                                ? 'border border-white/30 text-white' 
                                : 'border border-slate-100 text-slate-300 group-hover:border-blue-200 group-hover:text-blue-500'}`}>
                            <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
