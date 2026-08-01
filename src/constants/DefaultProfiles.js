// src/constants/DefaultProfiles.js

export const PERMISSION_MAP = {
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
// Selección de Administración (Medicamentos, Planes de formulación, Residuos, Esterilización)
["Medicamentos", "Planes de formulacion", "Medicamentos y Planes de formulacion", "Residuos", "Esterilizacion", "Gestion Administración"].forEach(f => {
    doctorPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Selección de Reportes
["Gestion Reportes", "Reporte Dashboard", "Reporte Pacientes", "Reporte Planes de tratamiento", "Reporte evoluciones", "Reporte Consultas", "Reporte Morbilidad"].forEach(f => {
    doctorPerms[f] = { consultar: true, crear: false, editar: false, eliminar: false };
});

// 3. Permisos para Recepcionista
const recepcionPerms = {};
// Agenda completa
PERMISSION_MAP.Agenda.forEach(f => {
    recepcionPerms[f] = { consultar: true, crear: true, editar: true, eliminar: true };
});
// Pacientes (Citas, Paciente, Datos personales, Documentos, WhatsApp, CRM)
["Paciente", "Datos Personales", "Citas", "Documentos clinicos", "Notificacion Whatsapp", "Teléfonos y correos", "CRM", "Marketing", "eps", "Beneficiarios"].forEach(f => {
    recepcionPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Caja completa
PERMISSION_MAP.Caja.forEach(f => {
    recepcionPerms[f] = { consultar: true, crear: true, editar: true, eliminar: false };
});
// Selección de Administración
["Recaudo Manual", "Convenios", "Terceros", "Saldos a favor"].forEach(f => {
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
["Esterilizacion", "Residuos", "Inventario", "Ajuste Inventario", "Medicamentos", "Temperatura Y Humedad"].forEach(f => {
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
        descripcion: "Acceso completo a Agenda, Historia Clínica, Odontograma, Periodontograma, Evoluciones, RX, Presupuestos y Formulaciones.",
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
        descripcion: "Gestión de Esterilización de instrumental, Registro de Residuos, Control de Inventario y Apoyo en Agenda.",
        baseRole: "auxiliar",
        permisos: auxiliarPerms
    }
];
