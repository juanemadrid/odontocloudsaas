/**
 * src/modules/odontograma/services/cupsReferenceDictionary.js
 * Capa opcional y desacoplada de referencias normativas CUPS.
 * 
 * REGLAS ARQUITECTÓNICAS OBLIGATORIAS:
 * 1. Inicialmente DESACTIVADA hasta que la clínica o el administrador configure la fuente oficial.
 * 2. El motor de sugerencias NO depende de este archivo para calificar y sugerir procedimientos.
 * 3. NO contiene códigos CUPS asumidos ni inventados.
 */

export const CUPS_REFERENCE_MAP = {
    enabled: false,
    vigencia: null,
    // Estructura lista para mapeos normativos oficiales validados:
    // "tipo_intencion": ["codigo_cups_oficial_1", "codigo_cups_oficial_2"]
    intenciones: {}
};
