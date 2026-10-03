// src/constants/DefaultProfiles.js

export const PERMISSION_MAP = {
    "Agenda": [
        "Exportar a excel",
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
        "Profesionales",
        "Citas",
        "Documentos clinicos",
        "Historia clinica",
        "Odontograma",
        "Periodontograma",
        "Presupuestos y planes",
        "Evoluciones",
        "Copiloto IA Insights",
        "Notificacion Whatsapp"
    ],
    "Caja": [
        "Caja",
        "Abrir Caja",
        "Cajas Abiertas",
        "Cajas cerradas",
        "Mi caja",
        "Cierres Simulados",
        "Bancos"
    ],
    "Administración": [
        "Gestion Administración",
        "Menú Facturación",
        "Recibo de caja",
        "Factura de venta",
        "Facturas de compra",
        "Saldos a favor",
        "Liquidaciones",
        "Pagos a proveedores",
        "Convenios",
        "Gestion Agenda",
        "Terceros",
        "Residuos",
        "Rips",
        "Esterilizacion",
        "Editor Web"
    ],
    "Reportes": [
        "Gestion Reportes",
        "Reporte Dashboard",
        "Reporte Pacientes",
        "Reporte Planes de tratamiento",
        "Reporte Facturacion",
        "Reporte Convenios",
        "Reporte ventas y efectividad",
        "Reporte Cumpleaños",
        "Reporte Consultas",
        "Reporte evoluciones",
        "Reporte Clínico",
        "Reporte de oportunidad de citas",
        "Reporte Morbilidad",
        "Log de errores de facturacion",
        "Log WhatsApp Business API",
        "Indicadores de uso de la plataforma",
        "Asistencia de clientes",
        "Log Interoperabilidad (IHCE)"
    ],
    "Configuración": [
        "Gestion Configuración",
        "Lista precios",
        "Planes",
        "Consecutivos",
        "Convenios",
        "Sucursales",
        "Medios pago",
        "Bancos",
        "Formulario paciente",
        "Especialidades",
        "Perfiles",
        "Usuarios",
        "Condiciones de pago",
        "Parametros",
        "Recursos físicos",
        "Plantillas",
        "Cargas",
        "Impuesto",
        "Catálogo de cuentas",
        "Campañas",
        "Facturación electrónica",
        "Suscripcion"
    ]
};

const ALL_FEATURES = Object.values(PERMISSION_MAP).flat();

// Genera un objeto de permisos habilitando features seleccionadas con acciones específicas
const buildPerms = (allowedFeaturesMap, defaultPerm = { consultar: true, crear: true, editar: true, eliminar: false }) => {
    const result = {};
    Object.entries(allowedFeaturesMap).forEach(([feature, actions]) => {
        result[feature] = actions;
    });
    return result;
};

// 1. Permisos totales para Administrador
const adminPerms = {};
ALL_FEATURES.forEach(f => {
    adminPerms[f] = { consultar: true, crear: true, editar: true, eliminar: true, desactivar: true };
});

// 2. Permisos para Odontólogo / Doctor
const doctorPerms = {};
// Agenda completa
PERMISSION_MAP.Agenda.forEach(f => {
    doctorPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Pacientes completo (Historia clínica, Odontograma, Periodontograma, Evoluciones, RX, Presupuestos, etc.)
PERMISSION_MAP.Pacientes.forEach(f => {
    doctorPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Selección de Administración (Residuos, Esterilización, Gestión Administración)
["Residuos", "Esterilizacion", "Gestion Administración", "Gestion Agenda"].forEach(f => {
    doctorPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Selección de Reportes
["Gestion Reportes", "Reporte Dashboard", "Reporte Pacientes", "Reporte Planes de tratamiento", "Reporte evoluciones", "Reporte Consultas", "Reporte Clínico", "Reporte Morbilidad"].forEach(f => {
    doctorPerms[f] = { consultar: true, crear: false, editar: false, eliminar: false };
});

// 3. Permisos para Recepcionista
const recepcionPerms = {};
// Agenda completa
PERMISSION_MAP.Agenda.forEach(f => {
    recepcionPerms[f] = { consultar: true, crear: true, editar: true, eliminar: true };
});
// Pacientes (Citas, Paciente, Datos personales, Documentos, WhatsApp, Marketing, EPS, Beneficiarios)
["Paciente", "Datos Personales", "Citas", "Documentos clinicos", "Notificacion Whatsapp", "Marketing", "eps", "Beneficiarios"].forEach(f => {
    recepcionPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Caja completa
PERMISSION_MAP.Caja.forEach(f => {
    recepcionPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Selección de Administración
["Recibo de caja", "Convenios", "Terceros", "Saldos a favor", "Factura de venta"].forEach(f => {
    recepcionPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Selección de Reportes
["Reporte Dashboard", "Reporte Pacientes", "Reporte Cumpleaños", "Asistencia de clientes"].forEach(f => {
    recepcionPerms[f] = { consultar: true, crear: false, editar: false, eliminar: false };
});

// 4. Permisos para Auxiliar de Odontología
const auxiliarPerms = {};
["Agenda", "Imprimir agenda"].forEach(f => {
    auxiliarPerms[f] = { consultar: true, crear: true, editar: false, eliminar: false };
});
["Paciente", "Citas"].forEach(f => {
    auxiliarPerms[f] = { consultar: true, crear: false, editar: false, eliminar: false };
});
["Esterilizacion", "Residuos"].forEach(f => {
    auxiliarPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});

export const DEFAULT_PERFILES = [
    {
        id: "admin",
        nombre: "Administrador",
        descripcion: "Acceso total a la administración, finanzas, configuración y todos los módulos de la clínica.",
        baseRole: "administrador",
        permisos: adminPerms
    },
    {
        id: "doctor",
        nombre: "Odontólogo / Doctor",
        descripcion: "Acceso completo a Agenda, Historia Clínica, Odontograma, Periodontograma, Evoluciones, RX, Presupuestos y Copiloto IA.",
        baseRole: "doctor",
        permisos: doctorPerms
    },
    {
        id: "recepcion",
        nombre: "Recepcionista",
        descripcion: "Gestión de la Agenda de citas, Registro de Pacientes, Caja, Recaudos y Facturación básica.",
        baseRole: "recepcionista",
        permisos: recepcionPerms
    },
    {
        id: "auxiliar",
        nombre: "Auxiliar de Odontología",
        descripcion: "Gestión de Esterilización de instrumental, Registro de Residuos y Apoyo en Agenda.",
        baseRole: "auxiliar",
        permisos: auxiliarPerms
    }
];
