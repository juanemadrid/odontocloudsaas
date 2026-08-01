import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";
import { DEFAULT_PERFILES } from "../../constants/DefaultProfiles";
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiShield, FiArrowLeft, FiSave, FiCheck, FiInfo } from "react-icons/fi";

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

// Todas las features planas del mapa
const ALL_FEATURES = Object.values(PERMISSION_MAP).flat();

/**
 * Normaliza permisos al formato objeto { feature: { action: bool } }
 * Soporta:
 *  - Objeto nuevo:   { "Agenda": { consultar: true, ... } }
 *  - Array de strings antiguo: ["Agenda", "Pacientes"]
 *    → habilita consultar:true en todas las features de ese módulo
 *  - Array de objetos: [{ modulo: "Agenda", consultar: true, ... }]
 */
const normalizePermisos = (permisos) => {
    if (!permisos) return {};

    // Ya es objeto nuevo → verificar que las keys son features (no módulos vacíos)
    if (!Array.isArray(permisos) && typeof permisos === 'object') {
        // Si tiene keys que son features del PERMISSION_MAP → válido
        const keys = Object.keys(permisos);
        if (keys.length === 0) return {};
        const hasFeatureKeys = keys.some(k => ALL_FEATURES.includes(k));
        if (hasFeatureKeys) return permisos;

        // Puede ser objeto keyed por módulo { "Agenda": true } → convertir
        const result = {};
        keys.forEach(k => {
            const moduleFeatures = PERMISSION_MAP[k];
            if (moduleFeatures) {
                // Es un nombre de módulo → habilitar consultar en sus features
                moduleFeatures.forEach(f => {
                    result[f] = { ...(result[f] || {}), consultar: true };
                });
            } else if (ALL_FEATURES.includes(k)) {
                // Es una feature directa
                result[k] = typeof permisos[k] === 'object' ? permisos[k] : { consultar: !!permisos[k] };
            }
        });
        return result;
    }

    // Es array → formato viejo (array de nombres de features/módulos)
    if (Array.isArray(permisos)) {
        const result = {};
        permisos.forEach(item => {
            if (typeof item === 'string') {
                // Prioridad 1: ¿Es un nombre de feature exacto? → habilitar solo esa feature
                if (ALL_FEATURES.includes(item)) {
                    result[item] = { ...(result[item] || {}), consultar: true };
                }
                // Prioridad 2: ¿Es nombre de módulo sin ser feature? → habilitar todas las features del módulo
                else if (PERMISSION_MAP[item]) {
                    PERMISSION_MAP[item].forEach(f => {
                        result[f] = { ...(result[f] || {}), consultar: true };
                    });
                }
                // Compatibilidad: "Pacientes" (módulo) → habilitar "Paciente" (feature singular)
                // y otras variaciones comunes
                else {
                    const normalized = item.toLowerCase().trim();
                    // Buscar feature con nombre similar (singular/plural)
                    const match = ALL_FEATURES.find(f =>
                        f.toLowerCase() === normalized ||
                        f.toLowerCase() === normalized.replace(/s$/, '') ||
                        normalized === f.toLowerCase() + 's'
                    );
                    if (match) {
                        result[match] = { ...(result[match] || {}), consultar: true };
                    } else {
                        // Buscar módulo con nombre similar
                        const modMatch = Object.entries(PERMISSION_MAP).find(([mod]) =>
                            mod.toLowerCase() === normalized
                        );
                        if (modMatch) {
                            modMatch[1].forEach(f => {
                                result[f] = { ...(result[f] || {}), consultar: true };
                            });
                        }
                    }
                }
            } else if (item && typeof item === 'object') {
                const name = item.modulo || item.nombre || item.feature || item.name;
                if (name) {
                    if (ALL_FEATURES.includes(name)) {
                        result[name] = { ...(result[name] || {}), consultar: true };
                    } else if (PERMISSION_MAP[name]) {
                        PERMISSION_MAP[name].forEach(f => {
                            result[f] = { ...(result[f] || {}), consultar: true };
                        });
                    }
                }
            }
        });
        return result;
    }

    return {};
};

/** Cuenta features habilitadas (con al menos un permiso true) en un permisos normalizado */
const countEnabledFeatures = (permisos) => {
    if (!permisos) return 0;
    if (Array.isArray(permisos)) return permisos.length; // formato viejo: length directo
    return Object.values(permisos).filter(v =>
        v && typeof v === 'object' && Object.values(v).some(Boolean)
    ).length;
};

export default function ConfigPerfiles() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [search, setSearch] = useState("");

    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();

    const loadProfiles = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const list = await getConfigItems(inquilino, "perfiles", null);
            if (list && Array.isArray(list) && list.length > 0) {
                const sortedList = (list || []).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setProfiles(sortedList);
            } else {
                // Si la clínica aún no tiene perfiles guardados, mostramos y sincronizamos los perfiles base
                setProfiles(DEFAULT_PERFILES);
                try {
                    for (const p of DEFAULT_PERFILES) {
                        await saveConfigItem(inquilino, "perfiles", null, p);
                    }
                } catch (saveErr) {
                    console.warn("Aviso al auto-guardar perfiles base:", saveErr);
                }
            }
        } catch (e) {
            console.error("Error al cargar perfiles desde Supabase:", e);
            setProfiles(DEFAULT_PERFILES);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfiles();
    }, [inquilino]);

    const handleDelete = async (profile) => {
        if (!window.confirm(`⚠️ ¿Eliminar perfil "${profile.nombre}"?`)) return;
        try {
            await deleteConfigItem(inquilino, "perfiles", null, profile.id);
            setProfiles(prev => prev.filter(p => p.id !== profile.id));
            if (toast?.success) toast.success("Perfil eliminado correctamente");
        } catch (e) {
            console.error("Error al eliminar perfil:", e);
            alert("Error al eliminar perfil: " + e.message);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        (p.nombre || "").toLowerCase().includes(search.toLowerCase())
    );

    if (editingId) {
        return (
            <EditorPerfil
                profileId={editingId === "new" ? null : editingId}
                existingProfile={profiles.find(p => p.id === editingId)}
                onBack={() => { setEditingId(null); loadProfiles(); }}
                permissionMap={PERMISSION_MAP}
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
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
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
                            <th className="py-2.5 px-4">Permisos Asignados</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando perfiles...
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
                                        {(() => {
                                            const count = countEnabledFeatures(p.permisos);
                                            return count > 0 ? `${count} funciones habilitadas` : 'Sin permisos asignados';
                                        })()}
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
                                                onClick={() => handleDelete(p)}
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

function EditorPerfil({ profileId, existingProfile, onBack, permissionMap, inquilino }) {
    const [nombre, setNombre] = useState(existingProfile?.nombre || "");
    // Normalizar permisos: convierte formato viejo (array) al nuevo (objeto { feature: { action: bool } })
    const [perms, setPerms] = useState(() => normalizePermisos(existingProfile?.permisos));
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    // Toggle individual cell
    const toggle = (feature, action) => {
        setPerms(prev => {
            const featurePerms = prev[feature] || {};
            return { ...prev, [feature]: { ...featurePerms, [action]: !featurePerms[action] } };
        });
    };

    // Toggle all permissions for a single row (feature)
    const toggleRow = (feature, value) => {
        setPerms(prev => {
            const newFeaturePerms = {};
            ACTIONS.forEach(a => { newFeaturePerms[a.key] = value; });
            return { ...prev, [feature]: newFeaturePerms };
        });
    };

    // Toggle all features in a category for a specific action column
    const toggleCategory = (moduleName, actionKey) => {
        const features = permissionMap[moduleName] || [];
        const allChecked = features.every(f => perms[f]?.[actionKey]);
        setPerms(prev => {
            const next = { ...prev };
            features.forEach(f => {
                next[f] = { ...(next[f] || {}), [actionKey]: !allChecked };
            });
            return next;
        });
    };

    // Toggle ALL actions for ALL features in a category
    const toggleCategoryAll = (moduleName) => {
        const features = permissionMap[moduleName] || [];
        const allChecked = features.every(f => ACTIONS.every(a => perms[f]?.[a.key]));
        setPerms(prev => {
            const next = { ...prev };
            features.forEach(f => {
                const newFeaturePerms = {};
                ACTIONS.forEach(a => { newFeaturePerms[a.key] = !allChecked; });
                next[f] = newFeaturePerms;
            });
            return next;
        });
    };

    // Toggle everything globally
    const toggleAll = () => {
        const allFeatures = Object.values(permissionMap).flat();
        const allChecked = allFeatures.every(f => ACTIONS.every(a => perms[f]?.[a.key]));
        setPerms(() => {
            const next = {};
            allFeatures.forEach(f => {
                const newFeaturePerms = {};
                ACTIONS.forEach(a => { newFeaturePerms[a.key] = !allChecked; });
                next[f] = newFeaturePerms;
            });
            return next;
        });
    };

    const handleSave = async () => {
        if (!nombre.trim()) return alert("El nombre es obligatorio");
        if (!inquilino) return alert("Error de sesión: No se identificó la clínica.");
        setSaving(true);
        try {
            const itemData = {
                id: profileId || undefined,
                nombre: nombre.trim(),
                permisos: perms
            };
            await saveConfigItem(inquilino, "perfiles", null, itemData);
            if (toast?.success) toast.success("Perfil guardado correctamente en Supabase");
            onBack();
        } catch (e) {
            console.error("Error al guardar perfil:", e);
            alert("Error al guardar el perfil: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const allFeatures = Object.values(permissionMap).flat();
    const isAllChecked = allFeatures.every(f => ACTIONS.every(a => perms[f]?.[a.key]));

    return (
        <div className="p-4 w-full max-w-6xl mx-auto relative transition-all duration-300 mb-20">
            {/* Header Card */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-md p-6 mb-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer border-0 transition-colors">
                            <FiArrowLeft size={16} />
                        </button>
                        <div>
                            <h2 className="text-base font-black text-slate-800 uppercase">{profileId ? "Editar Perfil" : "Nuevo Perfil"}</h2>
                            <p className="text-[11px] text-slate-400 font-medium">Configura los permisos de acceso para este rol</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer border-0 disabled:opacity-50 transition-colors"
                    >
                        <FiSave size={14} />
                        <span>{saving ? "Guardando..." : "Guardar Perfil"}</span>
                    </button>
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Nombre del Perfil *</label>
                    <input
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        placeholder="Ej. Administrativo / Recepción"
                        autoFocus
                    />
                </div>
            </div>

            {/* Permissions Table */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                                <th className="px-6 py-4 text-left">Funcionalidad</th>
                                {/* Global select-all toggle */}
                                <th className="px-4 py-4 text-center border-x border-slate-700">
                                    <div className="flex flex-col items-center gap-1">
                                        <button
                                            onClick={toggleAll}
                                            className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${isAllChecked
                                                ? "bg-blue-500 border-blue-500 shadow-lg shadow-blue-900"
                                                : "bg-slate-700 border-slate-500 hover:border-blue-400"
                                            }`}
                                            title="Seleccionar todo"
                                        >
                                            <FiCheck className={`text-white text-sm transition-transform duration-300 ${isAllChecked ? "scale-100" : "scale-0"}`} />
                                        </button>
                                        <span className="text-[9px] text-slate-400">Todo</span>
                                    </div>
                                </th>
                                {ACTIONS.map(a => (
                                    <th key={a.key} className="px-4 py-4 text-center border-r border-slate-700 last:border-0">
                                        <span className="text-[11px]">{a.label}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(permissionMap).map(([moduleName, features]) => {
                                const isCatAllChecked = features.every(f => ACTIONS.every(a => perms[f]?.[a.key]));
                                return (
                                    <React.Fragment key={moduleName}>
                                        {/* Category Header Row */}
                                        <tr className="bg-slate-50 border-y border-slate-200">
                                            <td className="px-6 py-3 border-r border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <FiShield size={13} className="text-blue-500" />
                                                    <span className="text-[12px] font-black text-slate-700 uppercase tracking-wide">{moduleName}</span>
                                                </div>
                                            </td>
                                            {/* Category-level select-all toggle */}
                                            <td className="px-4 py-3 border-r border-slate-100">
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
                                            {/* Category action column toggles */}
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

                                        {/* Feature Rows */}
                                        {features.map(feature => {
                                            const rowState = perms[feature] || {};
                                            const allChecked = ACTIONS.every(a => rowState[a.key]);
                                            return (
                                                <tr key={feature} className="group/row hover:bg-slate-50/50 transition-all border-b border-slate-50">
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
                                                    {/* Individual Action Toggles */}
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

                {/* Bottom Save Button */}
                <div className="pt-6 border-t border-slate-100 flex justify-end px-8 pb-8">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-[20px] text-[13px] font-black uppercase tracking-[0.2em] shadow-[0_15px_45px_rgba(0,0,0,0.15)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all duration-700 active:scale-95 flex items-center gap-3 overflow-hidden relative group cursor-pointer border-0 disabled:opacity-50"
                    >
                        <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        <FiSave size={18} className="relative z-10 group-hover:rotate-12 transition-transform duration-500" />
                        <span className="relative z-10 font-bold">{saving ? "G U A R D A N D O..." : "GUARDAR PERFIL"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
