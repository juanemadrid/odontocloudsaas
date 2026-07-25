/**
 * Utilidades para validación y generación de RIPS (Resolución 2275 de 2023 - JSON)
 * Cumple con la especificación técnica oficial del Ministerio de Salud y la DIAN.
 */

// ==========================================
// 1. CATÁLOGOS (Tablas de Referencia Oficiales MinSalud)
// ==========================================

export const TIPO_DOCUMENTO = {
    'CC': 'Cédula de Ciudadanía',
    'CE': 'Cédula de Extranjería',
    'TI': 'Tarjeta de Identidad',
    'RC': 'Registro Civil',
    'PA': 'Pasaporte',
    'NV': 'Nacido Vivo',
    'CD': 'Carné Diplomático',
    'SC': 'Salvoconducto',
    'PE': 'Permiso Especial de Permanencia',
    'PT': 'Permiso por Protección Temporal',
    'DE': 'Documento Extranjero'
};

export const TIPO_USUARIO = {
    '01': 'Contributivo',
    '02': 'Subsidiado',
    '03': 'Vinculado',
    '04': 'Particular',
    '05': 'Otro'
};

export const CODIGO_CONCEPTOS = {
    '01': 'Consulta',
    '02': 'Procedimiento',
    '03': 'Urgencia',
    '04': 'Hospitalización'
};

// ==========================================
// 1.1 SMART MAPPINGS (Odontología Res. 2275)
// ==========================================

export const DENTAL_CODES_MAP = [
    { keywords: ["consulta", "valoracion", "primera vez", "diagnostico"], cups: "890201", cie10: "Z012", label: "Consulta Valoración General" },
    { keywords: ["limpieza", "higiene", "detartraje", "profilaxis"], cups: "997300", cie10: "K051", label: "Limpieza Profunda" },
    { keywords: ["caries", "resina", "calza", "obturacion"], cups: "230101", cie10: "K021", label: "Tratamiento Caries / Resina" },
    { keywords: ["dolor", "pulpa", "endo", "conducto"], cups: "237101", cie10: "K040", label: "Endodoncia" },
    { keywords: ["extraccion", "sacar", "cirugia", "exodoncia"], cups: "231101", cie10: "K081", label: "Exodoncia" },
    { keywords: ["corona", "protesis", "puente", "incrustacion"], cups: "234101", cie10: "K081", label: "Prótesis / Corona" },
    { keywords: ["ortodoncia", "brackets", "frenillos", "retenedor"], cups: "247101", cie10: "M264", label: "Ortodoncia" },
    { keywords: ["blanqueamiento", "estetica"], cups: "997301", cie10: "Z012", label: "Blanqueamiento Dental" },
];

/**
 * Sugiere códigos CUPS y CIE-10 basados en una descripción textual.
 */
export const suggestClinicalCodes = (description = "") => {
    const d = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const match = DENTAL_CODES_MAP.find(item =>
        item.keywords.some(k => d.includes(k))
    );

    return match || { cups: "890201", cie10: "Z012", label: "Consulta General Odontológica" };
};

// ==========================================
// 2. VALIDADORES RES. 2275
// ==========================================

export const validateCIE10 = (code) => {
    if (!code) return false;
    return /^[A-Z][0-9]{3}$/.test(String(code).trim().toUpperCase());
};

export const validateCUPS = (code) => {
    if (!code) return false;
    return /^[A-Z0-9]{6}$/.test(String(code).trim().toUpperCase());
};

export const validateFecha = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return !isNaN(date.getTime()) && date <= now;
};

// Clean NIT: remove DV (-X) and non-alphanumeric chars
export const formatNitForRips = (nit = "") => {
    if (!nit) return "";
    const clean = String(nit).split("-")[0].replace(/\D/g, "");
    return clean;
};

// ==========================================
// 3. CONSTRUCTORES DE OBJETOS JSON (Res. 2275)
// ==========================================

/**
 * Helper para dividir nombre completo en partes requeridas por RIPS JSON
 */

function parseNombrePartes(paciente = {}) {
    if (paciente.primerNombre && paciente.primerApellido) {
        return {
            primerApellido: (paciente.primerApellido || "").trim().toUpperCase(),
            segundoApellido: (paciente.segundoApellido || "").trim().toUpperCase(),
            primerNombre: (paciente.primerNombre || "").trim().toUpperCase(),
            segundoNombre: (paciente.segundoNombre || "").trim().toUpperCase()
        };
    }

    const full = (paciente.nombreCompleto || paciente.nombre || `${paciente.nombres || ""} ${paciente.apellidos || ""}`).trim();
    const parts = full.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return { primerNombre: parts[0].toUpperCase(), segundoNombre: "", primerApellido: "REGISTRO", segundoApellido: "" };
    } else if (parts.length === 2) {
        return { primerNombre: parts[0].toUpperCase(), segundoNombre: "", primerApellido: parts[1].toUpperCase(), segundoApellido: "" };
    } else if (parts.length === 3) {
        return { primerNombre: parts[0].toUpperCase(), segundoNombre: parts[1].toUpperCase(), primerApellido: parts[2].toUpperCase(), segundoApellido: "" };
    } else {
        return {
            primerNombre: parts[0].toUpperCase(),
            segundoNombre: parts[1].toUpperCase(),
            primerApellido: parts[2].toUpperCase(),
            segundoApellido: parts.slice(3).join(" ").toUpperCase()
        };
    }
}

/**
 * Normaliza sexo a 'M' (Masculino) o 'F' (Femenino) según Res 2275
 */
function normalizeSexo(sexo = "") {
    const s = String(sexo).trim().toUpperCase();
    if (s === "F" || s === "FEMENINO" || s === "MUJER") return "F";
    if (s === "M" || s === "MASCULINO" || s === "HOMBRE" || s === "H") return "M";
    return "F"; // Default MinSalud fallback
}

/**
 * Construye el objeto de Usuario según Res 2275
 */
export const buildUsuarioJSON = (paciente = {}, tipoUsuario = '04') => {
    const nombresParsed = parseNombrePartes(paciente);
    const docNum = String(paciente.numDoc || paciente.nroDocumento || paciente.cedula || paciente.documento || "0").trim();
    
    return {
        tipoDocumentoIdentificacion: (paciente.tipoDoc || paciente.tipoDocumento || 'CC').toUpperCase(),
        numDocumentoIdentificacion: docNum,
        tipoUsuario: paciente.tipoUsuario || tipoUsuario || '04',
        fechaNacimiento: paciente.fechaNacimiento ? String(paciente.fechaNacimiento).substring(0, 10) : '1990-01-01',
        codSexo: normalizeSexo(paciente.sexo || paciente.genero),
        paisResidencia: "170",
        municipioResidencia: String(paciente.municipio || paciente.codigoMunicipio || "11001").padStart(5, '0'),
        zonaResidencia: (paciente.zona || "U").toUpperCase(),
        incapacidad: paciente.incapacidad || "NO",
        paisOrigen: "170",
        primerApellido: nombresParsed.primerApellido,
        segundoApellido: nombresParsed.segundoApellido,
        primerNombre: nombresParsed.primerNombre,
        segundoNombre: nombresParsed.segundoNombre
    };
};

/**
 * Construye el objeto de Servicio (Consulta) según Res 2275
 */
export const buildConsultaJSON = (datos = {}, consecutivo = 1) => {
    return {
        codPrestador: String(datos.codPrestador || "000000000001").trim(),
        fechaInicioAtencion: String(datos.fechaInicio || new Date().toISOString().substring(0, 10)).substring(0, 16),
        numAutorizacion: datos.numAutorizacion || null,
        codConsulta: String(datos.codConsulta || "890201").toUpperCase(),
        modalidadGrupoServicio: "01", // Intramural
        grupoServicios: "01", // Consulta Externa
        codServicio: Number(datos.codServicio || 345), // 345: Odontología General
        finalidadTecnologiaSalud: String(datos.finalidad || "10").padStart(2, '0'),
        causaMotivoAtencion: String(datos.causaExterna || "38").padStart(2, '0'),
        codDiagnosticoPrincipal: String(datos.dxPrincipal || "Z012").toUpperCase(),
        codDiagnosticoRelacionado1: datos.dxRelacionado1 ? String(datos.dxRelacionado1).toUpperCase() : null,
        codDiagnosticoRelacionado2: datos.dxRelacionado2 ? String(datos.dxRelacionado2).toUpperCase() : null,
        codDiagnosticoRelacionado3: datos.dxRelacionado3 ? String(datos.dxRelacionado3).toUpperCase() : null,
        tipoDiagnosticoPrincipal: String(datos.tipoDx || "01").padStart(2, '0'), // 01: Impresión, 02: Confirmado nuevo, 03: Confirmado repetido
        valorPagoModerador: Number(datos.valorPagoModerador || 0),
        numFEVPagoModerador: null,
        valorServicio: Number(datos.valorServicio || 0),
        consecutivo: Number(consecutivo)
    };
};

/**
 * Construye el objeto de Servicio (Procedimiento) según Res 2275
 */
export const buildProcedimientoJSON = (datos = {}, consecutivo = 1) => {
    return {
        codPrestador: String(datos.codPrestador || "000000000001").trim(),
        fechaProcedimiento: String(datos.fechaProcedimiento || new Date().toISOString().substring(0, 10)).substring(0, 16),
        idMIPRES: null,
        numAutorizacion: datos.numAutorizacion || null,
        codProcedimiento: String(datos.codProcedimiento || "230101").toUpperCase(),
        viaIngresoServicioSalud: "01", // Demanda espontánea
        modalidadGrupoServicio: "01", // Intramural
        grupoServicios: "01", // Consulta Externa
        codServicio: Number(datos.codServicio || 345), // 345: Odontología
        finalidadTecnologiaSalud: String(datos.finalidad || "10").padStart(2, '0'),
        tipoDiagnosticoPrincipal: String(datos.tipoDx || "01").padStart(2, '0'),
        codDiagnosticoPrincipal: String(datos.dxPrincipal || "K021").toUpperCase(),
        codDiagnosticoRelacionado: datos.dxRelacionado ? String(datos.dxRelacionado).toUpperCase() : null,
        codComplicacion: null,
        valorServicio: Number(datos.valorServicio || 0),
        numFEVPagoModerador: null,
        consecutivo: Number(consecutivo)
    };
};

/**
 * Estructura Principal del RIPS JSON (Resolución 2275 de 2023)
 */
export const buildRipsJSON = (factura = {}, usuarios = [], consultas = [], procedimientos = []) => {
    return {
        numDocumentoIdObligado: formatNitForRips(factura.nitObligado || factura.nit),
        numFacturaVenta: factura.numeroFactura ? String(factura.numeroFactura).trim() : null,
        tipoNota: factura.tipoNota || null,
        numNota: factura.numNota || null,
        usuarios: usuarios,
        servicios: {
            consultas: consultas,
            procedimientos: procedimientos,
            urgencias: [],
            hospitalizacion: [],
            recienNacidos: [],
            medicamentos: [],
            otrosServicios: []
        }
    };
};
