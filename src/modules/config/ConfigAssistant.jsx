import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { buildDashboardPath } from "../../utils/dashboardBasePath";
import { 
    FiCheckCircle, FiCircle, FiArrowRight, FiSettings, FiUsers, 
    FiMapPin, FiAward, FiCreditCard, FiList, FiFileText, FiAlertTriangle, 
    FiCheckSquare, FiMonitor
} from "react-icons/fi";

const STEPS = [
    {
        id: "datos-basicos",
        label: "1. Datos de la Clínica",
        description: "Nombre, logo, NIT y contacto principal.",
        icon: FiSettings,
        path: buildDashboardPath('config/datos-basicos'),
        check: async (db, inquilino) => {
            const docRef = doc(db, "tenants", inquilino);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return false;
            const data = snap.data();
            return !!(data.nit && (data.nombreComercial || data.name) && (data.telefono || data.phone));
        }
    },
    {
        id: "sucursales",
        label: "2. Sedes y Sucursales",
        description: "Registra las sedes físicas donde atiendes.",
        icon: FiMapPin,
        path: buildDashboardPath('config/sucursales'),
        check: async (db, inquilino) => {
            const q = query(collection(db, "sucursales"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            return !snap.empty;
        }
    },
    {
        id: "recursos-fisicos",
        label: "3. Consultorios / Unidades",
        description: "Configura las unidades dentales o cubículos.",
        icon: FiMonitor,
        path: buildDashboardPath('config/recursos-fisicos'),
        check: async (db, inquilino) => {
            const snap = await getDocs(collection(db, "tenants", inquilino, "recursos_fisicos"));
            return !snap.empty;
        }
    },
    {
        id: "especialidades",
        label: "4. Especialidades",
        description: "Define las ramas odontológicas de tu clínica.",
        icon: FiAward,
        path: buildDashboardPath('config/especialidades'),
        check: async (db, inquilino) => {
            const q = query(collection(db, "especialidades"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            return !snap.empty;
        }
    },
    {
        id: "usuarios",
        label: "5. Profesionales y Staff",
        description: "Crea perfiles para doctores y recepcionistas.",
        icon: FiUsers,
        path: buildDashboardPath('config/usuarios'),
        check: async (db, inquilino) => {
            const q = query(collection(db, "usuarios"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            return snap.size > 1; // Más de 1 porque el admin ya existe
        }
    },
    {
        id: "listas-precios",
        label: "6. Lista de Precios",
        description: "Costos de tratamientos y servicios.",
        icon: FiList,
        path: buildDashboardPath('config/listas-precios'),
        check: async (db, inquilino) => {
            const q = query(collection(db, "listas_precios"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            return !snap.empty;
        }
    },
    {
        id: "consecutivos",
        label: "7. Facturación",
        description: "Numeración para facturas y recibos.",
        icon: FiFileText,
        path: buildDashboardPath('config/consecutivos'),
        check: async (db, inquilino) => {
            const q = query(collection(db, "consecutivos"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            return !snap.empty;
        }
    }
];

export default function ConfigAssistant() {
    const { userProfile } = useAuth();
    const [stepStatus, setStepStatus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isComplete, setIsComplete] = useState(false);
    const [stats, setStats] = useState({ total: STEPS.length, completed: 0 });

    useEffect(() => {
        if (userProfile?.inquilino) {
            checkProgress();
        }
    }, [userProfile]);

    const checkProgress = async () => {
        setLoading(true);
        try {
            const results = await Promise.all(
                STEPS.map(step => step.check(db, userProfile.inquilino))
            );
            const completedCount = results.filter(r => r).length;
            setStats({ total: STEPS.length, completed: completedCount });
            setStepStatus(results);
            setIsComplete(completedCount === STEPS.length);
        } catch (error) {
            console.error("Error checking setup progress:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 animate-pulse">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Analizando configuración...</p>
            </div>
        );
    }

    const progressPercentage = Math.round((stats.completed / stats.total) * 100);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-10 pb-32">
            
            {/* Header con Progreso */}
            <div className="bg-white rounded-[40px] border border-slate-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.04)] p-10 mb-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full -translate-y-32 translate-x-32 blur-3xl -z-10" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-blue-600 text-[10px] font-black uppercase tracking-widest mb-2">
                            <FiCheckSquare /> Asistente de Puesta en Marcha
                        </div>
                        <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                            Configura tu Clínica
                        </h1>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest max-w-md">
                            Sigue estos pasos para dejar tu software listo para atender pacientes.
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        <div className="relative w-24 h-24">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                                <path className="text-slate-100" strokeDasharray="100, 100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-blue-600 transition-all duration-1000" strokeDasharray={`${progressPercentage}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-xl font-black text-slate-800">{progressPercentage}%</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stats.completed} de {stats.total} Pasos</span>
                    </div>
                </div>
            </div>

            {/* Lista de Pasos */}
            <div className="grid grid-cols-1 gap-4">
                {STEPS.map((step, index) => {
                    const isDone = stepStatus[index];
                    return (
                        <Link 
                            key={step.id} 
                            to={buildDashboardPath(`config/${step.id}`)}
                            className={`
                                group relative flex items-center gap-6 p-6 rounded-[32px] border transition-all duration-500
                                ${isDone 
                                    ? 'bg-emerald-50/30 border-emerald-100/50 hover:bg-emerald-50' 
                                    : 'bg-white border-slate-200/60 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1'
                                }
                            `}
                        >
                            <div className={`
                                w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-500 shadow-lg
                                ${isDone ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white shadow-slate-100'}
                            `}>
                                {isDone ? <FiCheckSquare size={24} /> : <step.icon size={24} />}
                            </div>

                            <div className="flex-1">
                                <h3 className={`text-[15px] font-black uppercase tracking-tight ${isDone ? 'text-emerald-700' : 'text-slate-800'}`}>
                                    {step.label}
                                </h3>
                                <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isDone ? 'text-emerald-500/70' : 'text-slate-400'}`}>
                                    {step.description}
                                </p>
                            </div>

                            <div className={`
                                px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                ${isDone 
                                    ? 'bg-emerald-100 text-emerald-600' 
                                    : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                                }
                            `}>
                                {isDone ? "Completado" : "Configurar"}
                            </div>
                        </Link>
                    );
                })}
            </div>

            {isComplete && (
                <div className="mt-12 p-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] text-center shadow-2xl shadow-blue-200 animate-in zoom-in duration-700">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md">
                        <FiCheckSquare size={40} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">¡Todo Listo para Atender!</h2>
                    <p className="text-blue-100 text-sm font-bold uppercase tracking-widest mb-8">Has completado la configuración base de tu clínica.</p>
                    <Link to={buildDashboardPath('')} className="inline-flex px-10 py-4 bg-white text-blue-600 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">
                        Ir al Panel Principal
                    </Link>
                </div>
            )}
        </div>
    );
}
