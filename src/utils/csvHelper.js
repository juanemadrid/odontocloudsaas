/**
 * Utilidades para procesamiento de CSV en OdontoCloud.
 */

/**
 * Parsea un string CSV y devuelve un array de objetos.
 * Soporta delimitadores por coma o punto y coma.
 */
export const parseCSV = (csvText) => {
    if (!csvText) return [];

    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) return [];

    // Detectar delimitador (coma o punto y coma)
    const headerLine = lines[0];
    const delimiter = headerLine.includes(";") ? ";" : ",";

    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());

    return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || "";
        });
        return obj;
    });
};

/**
 * Mapea los campos de un objeto CSV a la estructura interna de Pacientes.
 */
export const mapCSVToPatient = (csvData) => {
    // Diccionario de sinónimos para facilitar la importación
    const mapping = {
        documento: ["documento", "nro documento", "identificacion", "cedula", "cc", "dni"],
        nombres: ["nombres", "nombre", "first name"],
        apellidos: ["apellidos", "apellido", "last name"],
        sexo: ["sexo", "genero", "gender"],
        fechaNacimiento: ["fecha nacimiento", "nacimiento", "fecha_nacimiento", "birth date", "birthday"],
        celular: ["celular", "telefono", "phone", "mobile"],
        email: ["email", "correo", "correo electronico", "mail"],
        tipoDocumento: ["tipo documento", "tipo", "tipo_documento", "document type"],
        tipoVinculacion: ["vinculacion", "tipo vinculacion", "afiliacion"],
        nombreEps: ["eps", "entidad", "nombre eps"],
    };

    const patient = {};

    // Buscar correspondencias
    Object.keys(mapping).forEach(targetKey => {
        const synonyms = mapping[targetKey];
        const sourceKey = Object.keys(csvData).find(key => synonyms.includes(key.toLowerCase()));
        if (sourceKey) {
            patient[targetKey] = csvData[sourceKey];
        }
    });

    // Valores por defecto para campos obligatorios faltantes
    if (!patient.tipoDocumento) patient.tipoDocumento = "CC";
    if (!patient.tipoVinculacion) patient.tipoVinculacion = "Cotizante";
    if (!patient.nombreEps) patient.nombreEps = "PARTICULAR";
    if (!patient.sexo) patient.sexo = "Otro";

    // Nombre completo calculado
    patient.nombreCompleto = `${patient.nombres || ""} ${patient.apellidos || ""}`.trim();
    patient.nroDocumento = patient.documento || "";

    return patient;
};

/**
 * Genera un string CSV de plantilla para descargar.
 */
export const generateTemplateCSV = () => {
    const headers = [
        "Tipo Documento",
        "Documento",
        "Nombres",
        "Apellidos",
        "Sexo",
        "Fecha Nacimiento (AAAA-MM-DD)",
        "Celular",
        "Email",
        "EPS",
        "Tipo Vinculacion"
    ];
    const example = [
        "CC",
        "12345678",
        "Juan",
        "Perez",
        "Masculino",
        "1990-05-15",
        "3001234567",
        "juan@ejemplo.com",
        "Sanitas",
        "Cotizante"
    ];
    return [headers.join(","), example.join(",")].join("\n");
};
