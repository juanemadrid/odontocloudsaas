// src/constants/DefaultProfiles.js

export const DEFAULT_PERFILES = [
    {
        id: "admin",
        nombre: "Administrador",
        descripcion: "Acceso total a la administración, finanzas, configuración y todos los módulos de la clínica.",
        baseRole: "administrador",
        permisos: {
            "Agenda": { consultar: true, crear: true, editar: true, eliminar: true },
            "Pacientes": { consultar: true, crear: true, editar: true, eliminar: true },
            "Caja": { consultar: true, crear: true, editar: true, eliminar: true },
            "Administración": { consultar: true, crear: true, editar: true, eliminar: true },
            "Pagos y Facturacion": { consultar: true, crear: true, editar: true, eliminar: true },
            "Reportes": { consultar: true, crear: true, editar: true, eliminar: true },
            "Configuración": { consultar: true, crear: true, editar: true, eliminar: true }
        }
    },
    {
        id: "doctor",
        nombre: "Odontólogo / Doctor",
        descripcion: "Acceso a Agenda de citas, Historia Clínica, Odontograma, Evoluciones, Presupuestos y Tratamientos.",
        baseRole: "doctor",
        permisos: {
            "Agenda": { consultar: true, crear: true, editar: true, eliminar: false },
            "Pacientes": { consultar: true, crear: true, editar: true, eliminar: false },
            "Administración": { consultar: true, crear: true, editar: true, eliminar: false },
            "Reportes": { consultar: true, crear: false, editar: false, eliminar: false }
        }
    },
    {
        id: "recepcion",
        nombre: "Recepcionista",
        descripcion: "Gestión de la Agenda de citas, Registro e información de Pacientes, Caja y Recaudos.",
        baseRole: "recepcionista",
        permisos: {
            "Agenda": { consultar: true, crear: true, editar: true, eliminar: true },
            "Pacientes": { consultar: true, crear: true, editar: true, eliminar: false },
            "Caja": { consultar: true, crear: true, editar: true, eliminar: false }
        }
    },
    {
        id: "auxiliar",
        nombre: "Auxiliar de Odontología",
        descripcion: "Gestión de Esterilización de instrumental, Registro de Residuos, Apoyo en Agenda e Inventarios.",
        baseRole: "auxiliar",
        permisos: {
            "Agenda": { consultar: true, crear: true, editar: false, eliminar: false },
            "Pacientes": { consultar: true, crear: false, editar: false, eliminar: false },
            "Administración": { consultar: true, crear: true, editar: true, eliminar: false }
        }
    }
];
