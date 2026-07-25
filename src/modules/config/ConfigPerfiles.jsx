import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiShield, FiArrowLeft, FiSave, FiCheck, FiInfo } from "react-icons/fi";

// ==========================================
// 🛡️ MATRIZ DE PERMISOS (Basado en el input del usuario)
// ==========================================
const PERMISSION_MAP = {
    "Agenda": [
        "Exportar a excell",
        "Agenda",
        "Imprimir agenda",
        "Gestion agenda"
    ],
    "Pacientes": [
        "Paciente",
        "Datos Personales",
        "Marketing",
        "eps",
        "Beneficiarios",
        "Rx/imágenes/Doc",
        "Citas",
        "Documentos clinicos",
        "Historia clinica",
        "Odontograma",
        "Periodontograma",
        "Plan tratamiento",
        "Deshacer Realizado Plan",
        "Evoluciones",
        "Realizar prestaciones",
        "Plantillas Evolución",
        "Facturacion plan de tratamiento",
        "Notificacion Whatsapp",
        "Teléfonos y correos",
        "CRM"
    ],
    "Caja": [
        "Caja",
        "Abrir Caja",
        "Cajas Abiertas",
        "Cajas cerradas",
        "Mi caja",
        "Cierre Simulado",
        "Cajas tipo Banco",
        "Saldo y Detalle Caja"
    ],
    "Administración": [
        "Gestion Administración",
        "Recaudo Manual",
        "Nota credito",
        "Nota debito",
        "Liquidaciones",
        "Traslados",
        "Egresos",
        "Orden de compra",
        "Gestion Facturas",
        "Ajuste Inventario",
        "Medicamentos y Planes de formulacion",
        "Menú Facturación",
        "Convenios",
        "Recursos",
        "Terceros",
        "Temperatura Y Humedad",
        "Ubicaciones",
        "Residuos",
        "Inventario",
        "Rips",
        "Medicamentos",
        "Planes de formulacion",
        "Esterilizacion",
        "Saldos a favor",
        "Facturas de compra",
        "Editor Web"
    ],
    "Pagos y Facturacion": [
        "Pago a proveedores"
    ],
    "Reportes": [
        "Gestion Reportes",
        "Reporte Dashboard",
        "Reporte Pacientes",
        "Reporte Planes de tratamiento",
        "Reporte Facturacion",
        "Reporte Convenios",
        "Reporte ventas y efectividad",
        "Reporte Medicamentos",
        "Reporte Cumpleaños",
        "Reporte Consultas",
        "Reporte evoluciones",
        "Log de errores de facturacion",
        "Reporte de oportunidad de citas",
        "Asistencia de clientes",
        "Indicadores de uso de la plataforma",
        "Log WhatsApp Business API",
        "Reporte Morbilidad"
    ],
    "Configuración": [
        "Gestion Configuración",
        "Lista precios",
        "Planes",
        "Consecutivos",
        "Almacenes",
        "Categorias Conceptos",
        "Sucursales",
        "Medios pago",
        "Bancos",
        "Formulario paciente",
        "Especialidades",
        "Perfiles",
        "Usuarios",
        "Condiciones de pago",
        "Parametros",
        "Plantillas",
        "Cargas",
        "Auditoria",
        "Impuesto",
        "Notificaciones",
        "Cuenta",
        "Buscador Global",
        "Tarifas Copago",
        "Catálogo de cuentas",
        "Campañas",
        "Suscripcion"
    ]
};

const ACTIONS = [
    { key: "consultar", label: "Consultar" },
    { key: "crear", label: "Crear" },
    { key: "editar", label: "Editar" },
    { key: "eliminar", label: "Eliminar" },
    { key: "desactivar", label: "Desactivar" }
];

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function ConfigPerfiles() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null); // ID si editamos, null si lista, "new" si nuevo

    const { userProfile } = useAuth(); // Access current tenant and plan
    const inquilino = userProfile?.inquilino;

    // Filtered Matrix based on Plan
    const filteredMap = React.useMemo(() => {
        // As requested for a "replica" feel and full sync, we show the complete PERMISSION_MAP
        // even if the plan list is shorter, so the user can see all possible system capabilities.
        return PERMISSION_MAP;
    }, []);


    // Suscribirse a cambios en tiempo real
    useEffect(() => {
        if (!inquilino) {
            console.warn("ConfigPerfiles: Esperando inquilino...");
            return;
        }

        setLoading(true);
        const q = query(
            collection(db, "perfiles"),
            where("inquilino", "==", inquilino)
        );

        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const sortedList = list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setProfiles(sortedList);
            setLoading(false);
        }, (error) => {
            console.error("Error en suscripción de perfiles:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [inquilino]);

    // Función loadProfiles se mantiene para compatibilidad con onBack, pero ahora es redundante para el listado
    const loadProfiles = () => {
        // La suscripción se encarga, pero podemos disparar un loading visual si se desea
        console.log("loadProfiles called (sync handled by onSnapshot)");
    };

    const [search, setSearch] = useState("");

    const filteredProfiles = profiles.filter(p =>
        p.nombre.toLowerCase().includes(search.toLowerCase())
    );

    if (editingId) {
        return (
            <EditorPerfil
                profileId={editingId === "new" ? null : editingId}
                existingProfile={profiles.find(p => p.id === editingId)}
                onBack={() => { setEditingId(null); loadProfiles(); }}
                permissionMap={filteredMap}
                inquilino={inquilino}
            />
        );
    }

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header / Search Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiShield size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Perfiles y Permisos</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Gestión de accesos, roles y seguridad del sistema</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar perfil..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => setEditingId("new")}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Perfil</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Nombre del Perfil</th>
                            <th className="py-2.5 px-4">Última Actualización</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Sincronizando perfiles...
                                </td>
                            </tr>
                        ) : filteredProfiles.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron perfiles de usuario registrados
                                </td>
                            </tr>
                        ) : (
                            filteredProfiles.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                🛡️
                                            </div>
                                            <span className="font-bold text-slate-800 capitalize">{p.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 text-[11px] text-slate-500 font-medium">
                                        {p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleString() : "-"}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => setEditingId(p.id)}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Permisos"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm(`¿Eliminar perfil "${p.nombre}"?`)) return;
                                                    try {
                                                        await deleteDoc(doc(db, "perfiles", p.id));
                                                    } catch (e) { console.error(e); }
                                                }}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Perfil"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ==========================================
// SUB-COMPONENTE EDITOR (MATCHING SCREENSHOT)
// ==========================================
function EditorPerfil({ profileId, existingProfile, onBack, permissionMap, inquilino }) {
    const [nombre, setNombre] = useState(existingProfile?.nombre || "");
    const [perms, setPerms] = useState(existingProfile?.permisos || {});
    const [saving, setSaving] = useState(false);

    // Toggle Checkbox
    const toggle = (feature, action) => {
        setPerms(prev => {
            const featurePerms = prev[feature] || {};
            const newValue = !featurePerms[action];
            return {
                ...prev,
                [feature]: { ...featurePerms, [action]: newValue }
            };
        });
    };

    // Select Row (Functionalidad)
    const toggleRow = (feature, checked) => {
        setPerms(prev => {
            const newRow = {};
            if (checked) {
                ACTIONS.forEach(a => newRow[a.key] = true);
            }
            return { ...prev, [feature]: newRow };
        });
    };

    // Toggle Category Action (Módulo Column)
    const toggleCategory = (category, action) => {
        const features = permissionMap[category] || [];
        setPerms(prev => {
            const currentCount = features.filter(f => prev[f]?.[action]).length;
            const allChecked = currentCount === features.length;
            const nextMap = { ...prev };

            features.forEach(f => {
                if (!nextMap[f]) nextMap[f] = {};
                nextMap[f] = { ...nextMap[f], [action]: !allChecked };
            });
            return nextMap;
        });
    };

    // Toggle Category All (Módulo Seleccionar todo)
    const toggleCategoryAll = (category) => {
        const features = permissionMap[category] || [];
        setPerms(prev => {
            const allChecked = features.every(f => ACTIONS.every(a => prev[f]?.[a.key]));
            const nextMap = { ...prev };

            features.forEach(f => {
                const newRow = {};
                if (!allChecked) {
                    ACTIONS.forEach(a => newRow[a.key] = true);
                }
                nextMap[f] = newRow;
            });
            return nextMap;
        });
    };

    const handleSave = async () => {
        if (!nombre.trim()) return alert("El nombre es obligatorio");
        if (!inquilino) {
            console.error("No se puede guardar: inquilino no definido.");
            return alert("Error de sesión: No se identificó la clínica. Intenta recargar la página.");
        }
        setSaving(true);
        try {
            const payload = {
                nombre,
                permisos: perms,
                inquilino,
                updatedAt: serverTimestamp()
            };
            if (!profileId) payload.createdAt = serverTimestamp();

            const ref = profileId ? doc(db, "perfiles", profileId) : doc(collection(db, "perfiles"));
            await setDoc(ref, payload, { merge: true });
            onBack();
        } catch (e) {
            console.error("Error al guardar perfil:", e);
            alert("Error al guardar el perfil. Revisa la consola.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 w-full max-w-6xl mx-auto relative transition-all duration-300 mb-20">
            {/* Header: Institutional & Actions */}
            <div className="group/section bg-white rounded-[32px] border border-slate-200/50 shadow-[0_20px_60px_rgba(0,0,0,0.03)] hover:shadow-[0_35px_80px_rgba(0,0,0,0.06)] transition-all duration-700 overflow-hidden relative mb-6">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 shadow-[1px_0_10px_rgba(37,99,235,0.15)]"></div>

                <div className="bg-slate-50/50 backdrop-blur-sm px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all active:scale-90"
                        >
                            <FiArrowLeft size={18} />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-200">
                            <FiShield size={20} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[18px] font-black text-slate-800 uppercase tracking-tighter">
                                {profileId ? "Editar Perfil" : "Nuevo Perfil"}
                            </h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Configuración de seguridad</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Name Section */}
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-[0_15px_40px_rgba(0,0,0,0.02)] p-8 mb-6 relative overflow-hidden">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <FiInfo size={24} />
                    </div>
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre perfil *</label>
                        <input
                            className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-6 py-3 text-[16px] font-black text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner-sm"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            placeholder="Nombre del perfil"
                            autoFocus
                        />
                    </div>
                </div>
            </div>

            {/* Permissions Matrix */}
            <div className="bg-white rounded-[32px] border border-slate-200/50 shadow-[0_15px_40px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="p-0">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-left text-[11px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-100">Módulo / Funcionalidad</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-blue-600 uppercase tracking-tighter border-b border-slate-100 bg-blue-50/30 whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <FiCheck className="text-[12px]" />
                                        <span>Seleccionar todo</span>
                                    </div>
                                </th>
                                {ACTIONS.map(a => (
                                    <th key={a.key} className="px-4 py-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        {a.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {Object.entries(permissionMap || {}).map(([moduleName, features]) => {
                                // Check if ALL features in this module are selected for "Seleccionar todo"
                                const isCatAllChecked = features.every(f => ACTIONS.every(a => perms[f]?.[a.key]));

                                return (
                                    <React.Fragment key={moduleName}>
                                        <tr className="bg-slate-100/60 border-y border-slate-200/50">
                                            <td className="px-8 py-3 text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">
                                                {moduleName}
                                            </td>

                                            {/* Category Global Toggle */}
                                            <td className="px-4 py-3 bg-blue-100/20 border-x border-slate-200/40">
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => toggleCategoryAll(moduleName)}
                                                        className={`w-6 h-6 rounded-lg border-2 border-dashed transition-all flex items-center justify-center ${isCatAllChecked
                                                            ? "bg-blue-700 border-blue-700 shadow-lg shadow-blue-200"
                                                            : "bg-white border-blue-200 hover:border-blue-400"
                                                            }`}
                                                    >
                                                        <FiCheck className={`text-white text-sm transition-transform duration-300 ${isCatAllChecked ? "scale-100" : "scale-0"}`} />
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Category Action Column Toggles */}
                                            {ACTIONS.map(a => {
                                                const isColAllChecked = features.every(f => perms[f]?.[a.key]);
                                                return (
                                                    <td key={a.key} className="px-4 py-3 border-r border-slate-100 last:border-0">
                                                        <div className="flex justify-center">
                                                            <button
                                                                onClick={() => toggleCategory(moduleName, a.key)}
                                                                className={`w-5 h-5 rounded-md border-2 border-dotted transition-all flex items-center justify-center ${isColAllChecked
                                                                    ? "bg-emerald-600 border-emerald-600"
                                                                    : "bg-white border-slate-200 hover:border-emerald-300"
                                                                    }`}
                                                            >
                                                                <FiCheck className={`text-white text-[10px] transition-transform duration-300 ${isColAllChecked ? "scale-100" : "scale-0"}`} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>

                                        {features.map(feature => {
                                            const rowState = perms[feature] || {};
                                            const allChecked = ACTIONS.every(a => rowState[a.key]);

                                            return (
                                                <tr key={feature} className="group/row hover:bg-slate-50/50 transition-all">
                                                    <td className="px-10 py-3 group-hover/row:translate-x-1 transition-transform border-r border-slate-50">
                                                        <span className="text-[13px] font-bold text-slate-500">{feature}</span>
                                                    </td>

                                                    {/* Global Row Toggle */}
                                                    <td className="px-4 py-3 bg-blue-50/10 border-x border-slate-50/50">
                                                        <div className="flex justify-center">
                                                            <button
                                                                onClick={() => toggleRow(feature, !allChecked)}
                                                                className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${allChecked
                                                                    ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-200"
                                                                    : "bg-white border-slate-200 hover:border-blue-300"
                                                                    }`}
                                                            >
                                                                <FiCheck className={`text-white text-sm transition-transform duration-300 ${allChecked ? "scale-100" : "scale-0"}`} />
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Action Toggles */}
                                                    {ACTIONS.map(a => (
                                                        <td key={a.key} className="px-4 py-3 border-r border-slate-50 last:border-0">
                                                            <div className="flex justify-center">
                                                                <button
                                                                    onClick={() => toggle(feature, a.key)}
                                                                    className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${rowState[a.key]
                                                                        ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-100"
                                                                        : "bg-white border-slate-200 hover:border-emerald-300"
                                                                        }`}
                                                                >
                                                                    <FiCheck className={`text-white text-sm transition-transform duration-300 ${rowState[a.key] ? "scale-100" : "scale-0"}`} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="pt-10 border-t border-slate-50 flex justify-end px-8 pb-8">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-[20px] text-[13px] font-black uppercase tracking-[0.2em] shadow-[0_15px_45px_rgba(0,0,0,0.15)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all duration-700 active:scale-95 flex items-center gap-3 overflow-hidden relative group"
                >
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    <FiSave size={18} className="relative z-10 group-hover:rotate-12 transition-transform duration-500" />
                    <span className="relative z-10 font-bold">{saving ? "G U A R D A N D O..." : "GUARDAR PERFIL"}</span>
                </button>
            </div>
        </div>
    );
}
