import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getConfigItems, saveConfigItem, deleteConfigItem } from "../../services/configPersistenceService";
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
            const list = await getConfigItems(inquilino, "perfiles", "perfiles");
            const sortedList = (list || []).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setProfiles(sortedList);
        } catch (e) {
            console.error("Error al cargar perfiles desde Supabase:", e);
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
            await deleteConfigItem(inquilino, "perfiles", "perfiles", profile.id);
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
                                        {Array.isArray(p.permisos) ? `${p.permisos.length} módulos habilitados` : 'Personalizados'}
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
    const [perms, setPerms] = useState(existingProfile?.permisos || {});
    const [saving, setSaving] = useState(false);
    const toast = useToast();

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
            await saveConfigItem(inquilino, "perfiles", "perfiles", itemData);
            if (toast?.success) toast.success("Perfil guardado correctamente en Supabase");
            onBack();
        } catch (e) {
            console.error("Error al guardar perfil:", e);
            alert("Error al guardar el perfil: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 w-full max-w-6xl mx-auto relative transition-all duration-300 mb-20">
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-md p-6 mb-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            <FiArrowLeft size={16} />
                        </button>
                        <h2 className="text-base font-black text-slate-800 uppercase">{profileId ? "Editar Perfil" : "Nuevo Perfil"}</h2>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer border-0 disabled:opacity-50"
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
        </div>
    );
}
