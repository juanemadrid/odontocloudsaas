import React, { useState, useLayoutEffect } from "react";
import TenantsPanelV2 from "../modules/superadmin/TenantsPanelV2";
import PlanManagement from "../modules/superadmin/PlanManagement";
import PaymentManagement from "../modules/superadmin/PaymentManagement";
import FacturasQuotaPanel from "../modules/superadmin/FacturasQuotaPanel";
import WebCms from "../modules/cms/WebsiteEditor";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FiHome, FiSettings, FiCreditCard, FiActivity, FiGlobe, FiLogOut, FiFileText } from "react-icons/fi";
import "../styles/modern.css";
import "../styles/utilities.css";
import "../styles/theme.css";

const IconClinic = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
);

const IconPlan = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const IconCheck = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const IconFolder = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
);

export default function SuperAdminPanel() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("clinics");
    const { logout, user } = useAuth();

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    useLayoutEffect(() => {
        // Enforce white background immediately to prevent style bleeding
        document.documentElement.style.setProperty("background-color", "#ffffff", "important");
        document.body.style.setProperty("background-color", "#ffffff", "important");
        document.body.style.setProperty("background-image", "none", "important");

        // Remove potentially conflicting classes
        document.body.classList.remove("dark");
        document.body.classList.add("light-theme-forced");

        return () => {
            document.body.style.removeProperty("background-color");
            document.body.style.removeProperty("background-image");
            document.documentElement.style.removeProperty("background-color");
            document.body.classList.remove("light-theme-forced");
        };
    }, []);

    return (
        <div className="flex min-h-screen bg-white font-sans text-slate-900">

            {/* Sidebar Enterprise (Strict Professional - Force White) */}
            <aside className="w-64 border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-50" style={{ backgroundColor: '#ffffff' }}>
                {/* Brand Identity Area - Clean White Headers */}
                <div className="h-16 flex items-center px-6 border-b border-slate-100 shadow-sm z-10 relative" style={{ backgroundColor: '#ffffff' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="flex flex-col justify-center">
                            <h1 className="text-lg font-black leading-none tracking-tight">
                                <span style={{ color: '#0f172a' }}>Madrid</span>
                                <span style={{ color: '#2563eb' }}>System</span>
                            </h1>
                            <span className="text-[9px] text-blue-600 font-bold uppercase tracking-[0.2em] leading-tight mt-0.5">Software Master</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Principal</p>

                    <button
                        onClick={() => setActiveTab("clinics")}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium ${activeTab === "clinics"
                            ? "bg-slate-100 text-slate-900 border border-slate-200"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                    >
                        <IconClinic className={`w-4 h-4 ${activeTab === "clinics" ? "text-blue-700" : "text-slate-400"}`} />
                        <span>Gestión de Clínicas</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("plans")}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium ${activeTab === "plans"
                            ? "bg-slate-100 text-slate-900 border border-slate-200"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                    >
                        <IconPlan className={`w-4 h-4 ${activeTab === "plans" ? "text-blue-700" : "text-slate-400"}`} />
                        <span>Planes y Tarifas</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("payments")}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium ${activeTab === "payments"
                            ? "bg-slate-100 text-slate-900 border border-slate-200"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                    >
                        <IconCheck className={`w-4 h-4 ${activeTab === "payments" ? "text-blue-700" : "text-slate-400"}`} />
                        <span>Historial de Pagos</span>
                    </button>

                    <div className="pt-4 mt-4 border-t border-slate-100">
                        <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Configuración</p>
                        <button
                            onClick={() => setActiveTab("facturacion")}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium ${activeTab === "facturacion"
                                ? "bg-slate-100 text-slate-900 border border-slate-200"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                        >
                            <FiFileText className={`w-4 h-4 ${activeTab === "facturacion" ? "text-blue-700" : "text-slate-400"}`} />
                            <span>Facturación Electrónica</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("site")}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium ${activeTab === "site"
                                ? "bg-slate-100 text-slate-900 border border-slate-200"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                        >
                            <IconFolder className={`w-4 h-4 ${activeTab === "site" ? "text-blue-700" : "text-slate-400"}`} />
                            <span>CMS Sitio Web</span>
                        </button>
                    </div>
                </nav>

                {/* User Session Area */}
                <div className="p-4 border-t border-slate-200 bg-white" style={{ backgroundColor: '#ffffff' }}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs" style={{ backgroundColor: '#ffffff', color: '#334155' }}>
                            {user?.email?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-slate-900 truncate" style={{ color: '#0f172a' }}>MadridSystem</span>
                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest leading-none mt-0.5">Software Owner</span>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full py-3 rounded-xl border border-red-100 bg-red-50 flex items-center justify-center gap-2 text-red-600 hover:!bg-red-600 hover:!text-white hover:!border-red-600 transition-all text-sm group shadow-sm font-bold"
                        style={{ backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fee2e2' }}
                    >
                        <FiLogOut className="text-red-500 group-hover:text-white transition-colors" />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area - Constrained for standard views, expanded for CMS */}
            <div className="flex-1 ml-64 min-h-screen flex flex-col bg-slate-50">
                <main className={`flex-1 w-full ${activeTab === 'site' ? 'max-w-none p-0 space-y-0' : 'max-w-[1200px] mx-auto py-10 px-8 lg:px-12 space-y-8'} animate-safe-fade-in`} key={user?.uid}>

                    {/* Component Header Area - Hidden for CMS to maximize space */}
                    {activeTab !== 'site' && (
                        <header className="mb-6 pb-6 border-b border-slate-200">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                                {activeTab === "clinics" ? "Control de Clínicas" : activeTab === "plans" ? "Gestión de Planes" : activeTab === "payments" ? "Motor de Recaudo" : activeTab === "facturacion" ? "Facturación Electrónica" : "Editor Sitio Oficial"}
                            </h2>
                            <p className="text-slate-500 font-medium text-xs mt-2">
                                {activeTab === "clinics"
                                    ? "Supervisión global de infraestructura operativa de OdontoCloud."
                                    : activeTab === "plans"
                                        ? "Configuración estratégica de niveles de suscripción."
                                        : activeTab === "payments"
                                            ? "Administración de cuentas bancarias y contacto de soporte."
                                            : activeTab === "facturacion"
                                                ? "Credenciales Factus centralizadas y cuotas de facturación por clínica."
                                                : "Personalización avanzada de la landing page corporativa de OdontoCloud."}
                            </p>
                        </header>
                    )}

                    {/* Content Section */}
                    <section className={activeTab === 'site' ? 'w-full h-full' : ''}>
                        {activeTab === "clinics" && <TenantsPanelV2 />}
                        {activeTab === "plans" && <PlanManagement />}
                        {activeTab === "payments" && <PaymentManagement />}
                        {activeTab === "facturacion" && <FacturasQuotaPanel />}
                        {activeTab === "site" && <WebCms />}
                    </section>
                </main>
            </div>

            {/* NUCLEAR OPTION: Force Light Theme Overrides */}
            <style>{`
                body, #root {
                    background-color: #ffffff!important;
                    background-image: none!important;
                    color: #0f172a!important;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                }
                /* Force headings to use sans-serif, overriding index.css Playfair Display */
                h1, h2, h3, h4, h5, h6 {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                    letter-spacing: -0.025em; /* Tracking-tight */
                }
                /* Force any potential dark mode tailwind classes to behave as light */
                .dark {
                    display: none!important;
                }
            `}</style>
        </div >
    );
}
