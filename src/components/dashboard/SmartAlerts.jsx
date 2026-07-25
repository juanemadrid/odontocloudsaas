import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiTrendingUp, FiUsers, FiBox, FiArrowRight } from "react-icons/fi";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { buildDashboardPath } from "../../utils/dashboardBasePath";

export default function SmartAlerts() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.inquilino) return;

        const loadSmartData = async () => {
            setLoading(true);
            const foundAlerts = [];

            try {
                // 1. CRM Check: Dormant Patients (No activity in 6 months)
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                // 1. CRM Check: Dormant Patients (Fetch and filter in memory)
                const qDormant = query(
                    collection(db, "pacientes"),
                    where("inquilino", "==", userProfile.inquilino),
                    limit(20)
                );
                const snapDormant = await getDocs(qDormant);
                const dormantDocs = snapDormant.docs.filter(d => {
                    const data = d.data();
                    return data.actualizado && data.actualizado.toDate() < sixMonthsAgo;
                }).slice(0, 3);

                if (dormantDocs.length > 0) {
                    foundAlerts.push({
                        id: 'crm-dormant',
                        type: 'fidelización',
                        title: `${dormantDocs.length} pacientes sin seguimiento`,
                        description: "No han regresado en 6 meses. Sugerencia: Enviar recordatorio.",
                        icon: FiUsers,
                        color: 'blue'
                    });
                }

                // 2. Inventory Check: Predict low stock (Fetch and filter in memory)
                const qInv = query(
                    collection(db, "inventario"),
                    where("inquilino", "==", userProfile.inquilino),
                    limit(20)
                );
                const snapInv = await getDocs(qInv);
                const lowStockDocs = snapInv.docs.filter(d => {
                    const data = d.data();
                    return data.cantidad !== undefined && data.cantidad < 5;
                }).slice(0, 2);

                lowStockDocs.forEach(doc => {
                    const item = doc.data();
                    foundAlerts.push({
                        id: `inv-low-${doc.id}`,
                        type: 'inventario',
                        title: `Stock Crítico: ${item.nombre}`,
                        description: `Quedan solo ${item.cantidad} unidades. Necesario para citas próximas.`,
                        icon: FiBox,
                        color: 'amber'
                    });
                });

                // 3. Efficiency Check (Real Data from treatment_plans)
                const qPlans = query(
                    collection(db, "treatment_plans"),
                    where("inquilino", "==", userProfile.inquilino),
                    limit(50)
                );
                const snapPlans = await getDocs(qPlans);
                const treatmentCounts = {};
                
                snapPlans.docs.forEach(docPlan => {
                    const data = docPlan.data();
                    // Optional: check if data belongs to tenant if property exists
                    // if (data.inquilino && data.inquilino !== userProfile.inquilino) return;

                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach(item => {
                            // Validar que exista descripción y cantidad
                            if (!item.desc) return;
                            const name = item.desc;
                            const subtotal = (Number(item.amount) || 0) * (Number(item.qty) || 1);
                            
                            if (!treatmentCounts[name]) {
                                treatmentCounts[name] = { name, total: 0 };
                            }
                            treatmentCounts[name].total += subtotal;
                        });
                    }
                });

                let mostProfitable = null;
                Object.values(treatmentCounts).forEach(t => {
                    if (!mostProfitable || t.total > mostProfitable.total) {
                        mostProfitable = t;
                    }
                });

                if (mostProfitable && mostProfitable.total > 0) {
                    foundAlerts.push({
                        id: 'kpi-profit',
                        type: 'negocio',
                        title: 'Tratamiento Más Rentable',
                        description: `"${mostProfitable.name}" es tu tratamiento más cotizado, sumando $${mostProfitable.total.toLocaleString('es-CO')} este periodo.`,
                        icon: FiTrendingUp,
                        color: 'emerald'
                    });
                } else {
                    // Fallback visual si no hay datos suficientes todavía
                    foundAlerts.push({
                        id: 'kpi-profit-empty',
                        type: 'negocio',
                        title: 'Sin Datos Suficientes',
                        description: 'Crea más presupuestos para calcular tu tratamiento más rentable.',
                        icon: FiTrendingUp,
                        color: 'emerald'
                    });
                }

                setAlerts(foundAlerts);
            } catch (err) {
                console.error("SmartAlerts Data Error:", err);
            }
            setLoading(false);
        };

        loadSmartData();
    }, [userProfile]);

    if (loading) return (
        <div className="animate-pulse space-y-3">
            <div className="h-20 bg-slate-100 rounded-2xl" />
            <div className="h-20 bg-slate-100 rounded-2xl" />
        </div>
    );

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">IA Insight & Alertas</h3>
            </div>
            {alerts.map((alert) => (
                <div
                    key={alert.id}
                    onClick={() => {
                        if (alert.type === 'fidelización') navigate(buildDashboardPath('pacientes'));
                        else if (alert.type === 'inventario') navigate(buildDashboardPath('inventario'));
                        else if (alert.type === 'negocio') navigate(buildDashboardPath('reportes'));
                    }}
                    className="group bg-white border border-slate-100 p-4 rounded-2xl flex items-start gap-4 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 cursor-pointer"
                >
                    <div className={`
                        w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110
                        ${alert.color === 'blue' ? 'bg-blue-50 text-blue-600' : ''}
                        ${alert.color === 'amber' ? 'bg-amber-50 text-amber-600' : ''}
                        ${alert.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : ''}
                    `}>
                        <alert.icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${alert.color === 'blue' ? 'text-blue-500' :
                                alert.color === 'amber' ? 'text-amber-500' :
                                    'text-emerald-500'
                                }`}>
                                {alert.type}
                            </span>
                        </div>
                        <h4 className="text-[12px] font-black text-slate-800 leading-tight uppercase tracking-tight">{alert.title}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 leading-relaxed">{alert.description}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <FiArrowRight className="text-slate-300" />
                    </div>
                </div>
            ))}
        </div>
    );
}
