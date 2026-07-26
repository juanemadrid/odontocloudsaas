import React, { useState, useEffect } from "react";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";
import { FiCheckCircle, FiArrowRight, FiSettings, FiUsers, FiAlertCircle } from "react-icons/fi";

const CHECKS = [
    { id: "tenant", label: "Datos Clínica", check: async (inq) => {
        const { data } = await supabase.from("tenants").select("nit, nombre_comercial, telefono").eq("id", inq).single();
        return !!(data?.nit && data?.nombre_comercial && data?.telefono);
    }},
    { id: "sucursales", label: "Sedes", check: async (inq) => {
        const { count } = await supabase.from("sucursales").select("id", { count: "exact", head: true }).eq("tenant_id", inq);
        return (count || 0) > 0;
    }},
    { id: "recursos-fisicos", label: "Consultorios", check: async (inq) => {
        const { count } = await supabase.from("recursos_fisicos").select("id", { count: "exact", head: true }).eq("tenant_id", inq);
        return (count || 0) > 0;
    }},
    { id: "especialidades", label: "Especialidades", check: async (inq) => {
        const { count } = await supabase.from("especialidades").select("id", { count: "exact", head: true }).eq("tenant_id", inq);
        return (count || 0) > 0;
    }},
    { id: "usuarios", label: "Doctores", check: async (inq) => {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", inq);
        return (count || 0) > 1;
    }},
    { id: "listas-precios", label: "Lista Precios", check: async (inq) => {
        const { count } = await supabase.from("listas_precios").select("id", { count: "exact", head: true }).eq("tenant_id", inq);
        return (count || 0) > 0;
    }},
    { id: "consecutivos", label: "Facturación", check: async (inq) => {
        const { count } = await supabase.from("consecutivos").select("id", { count: "exact", head: true }).eq("tenant_id", inq);
        return (count || 0) > 0;
    }}
];

export default function SetupWizardWidget() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!userProfile?.inquilino || (userProfile.rol !== "administrador" && userProfile.rol !== "superadmin")) {
            setLoading(false);
            return;
        }

        const runChecks = async () => {
            const results = await Promise.all(CHECKS.map(c => c.check(userProfile.inquilino)));
            const completed = results.filter(r => r).length;
            const perc = Math.round((completed / CHECKS.length) * 100);
            setProgress(perc);
            setVisible(perc < 100);
            setLoading(false);
        };

        runChecks();
    }, [userProfile]);


    if (loading || !visible) return null;

    return (
        <div className="bg-white rounded-[24px] p-6 border border-blue-100 shadow-sm mb-6 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-600 group-hover:scale-110 transition-transform">
                <FiSettings size={60} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FiAlertCircle size={32} />
                </div>

                <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">
                        Configuración Incompleta
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                        Tu clínica está al <strong>{progress}%</strong> de su configuración ideal. Completa los pasos faltantes para habilitar todas las funciones.
                    </p>
                    
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div 
                            className="h-full bg-blue-600 transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <button 
                    onClick={() => navigate(buildDashboardPath('config/asistente'))}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 shrink-0"
                >
                    Continuar Asistente
                    <FiArrowRight />
                </button>
            </div>
        </div>
    );
}
