/**
 * Catálogo de códigos CUPS de odontología que se sugieren en la lista de precios, planes, convenios y facturas.
 * Cada código y su nombre son los OFICIALES de la Clasificación Única de Procedimientos en Salud (sin tildes,
 * para que la búsqueda funcione igual que antes)
 * (los mismos de src/data/cupsCompleto.js). Los precios son solo valores de referencia: cada clínica pone los suyos.
 *
 * Antes este catálogo tenía 44 de 55 códigos con el nombre de otro procedimiento o inexistentes
 * (p. ej. 890303 aparecía como "primera vez por odontología especializada" y es "control por odontología general").
 * La prueba scripts/test-cups-catalog.mjs revisa que cada código exista y tenga su nombre oficial.
 */

export const CUPS_DENTAL_CODES = [
    // CONSULTAS Y URGENCIAS
    { code: "890203", name: "CONSULTA DE PRIMERA VEZ POR ODONTOLOGIA GENERAL", precio: 80000, category: "CONSULTAS" },
    { code: "890204", name: "CONSULTA DE PRIMERA VEZ POR OTRAS ESPECIALIDADES EN ODONTOLOGIA", precio: 120000, category: "CONSULTAS" },
    { code: "890303", name: "CONSULTA DE CONTROL O DE SEGUIMIENTO POR ODONTOLOGIA GENERAL", precio: 60000, category: "CONSULTAS" },
    { code: "890304", name: "CONSULTA DE CONTROL O DE SEGUIMIENTO POR OTRAS ESPECIALIDADES EN ODONTOLOGIA", precio: 90000, category: "CONSULTAS" },
    { code: "890703", name: "CONSULTA DE URGENCIAS POR ODONTOLOGIA GENERAL", precio: 100000, category: "CONSULTAS" },

    // RADIOLOGÍA
    { code: "870450", name: "RADIOGRAFIAS INTRAORALES PERIAPICALES MILIMETRADAS", precio: 35000, category: "RADIOLOGÍA" },
    { code: "870456", name: "RADIOGRAFIAS INTRAORALES PERIAPICALES JUEGO COMPLETO", precio: 180000, category: "RADIOLOGÍA" },
    { code: "870460", name: "RADIOGRAFIAS INTRAORALES CORONALES", precio: 35000, category: "RADIOLOGÍA" },
    { code: "870440", name: "RADIOGRAFIAS INTRAORALES OCLUSALES", precio: 50000, category: "RADIOLOGÍA" },
    { code: "870114", name: "RADIOGRAFIA PANORAMICA DE MAXILARES, SUPERIOR E INFERIOR [ORTOPANTOMOGRAFIA]", precio: 85000, category: "RADIOLOGÍA" },

    // PREVENCIÓN Y PROMOCIÓN
    { code: "990203", name: "EDUCACION INDIVIDUAL EN SALUD, POR ODONTOLOGIA", precio: 40000, category: "PREVENCIÓN" },
    { code: "990212", name: "EDUCACION INDIVIDUAL EN SALUD, POR HIGIENE ORAL", precio: 40000, category: "PREVENCIÓN" },
    { code: "997103", name: "TOPICACION DE FLUOR EN GEL", precio: 60000, category: "PREVENCIÓN" },
    { code: "997106", name: "TOPICACION DE FLUOR EN BARNIZ", precio: 80000, category: "PREVENCIÓN" },
    { code: "997107", name: "APLICACION DE SELLANTES", precio: 50000, category: "PREVENCIÓN" },
    { code: "997001", name: "PROFILAXIS DENTAL O PULIDO CORONAL", precio: 110000, category: "PREVENCIÓN" },
    { code: "997301", name: "DETARTRAJE SUPRAGINGIVAL", precio: 160000, category: "PREVENCIÓN" },

    // OPERATORIA (OBTURACIONES)
    { code: "232102", name: "OBTURACION DENTAL CON RESINA DE FOTOCURADO", precio: 150000, category: "OPERATORIA" },
    { code: "232103", name: "OBTURACION DENTAL CON IONOMERO DE VIDRIO", precio: 130000, category: "OPERATORIA" },
    { code: "232401", name: "RECONSTRUCCION DE ANGULO INCISAL", precio: 180000, category: "OPERATORIA" },
    { code: "232402", name: "RECONSTRUCCION TERCIO INCISAL", precio: 200000, category: "OPERATORIA" },

    // ESTÉTICA
    { code: "237903", name: "BLANQUEAMIENTO DENTAL EXTRINSECO", precio: 450000, category: "ESTÉTICA" },
    { code: "237901", name: "BLANQUEAMIENTO DE DIENTE INTRINSECO", precio: 300000, category: "ESTÉTICA" },

    // ENDODONCIA
    { code: "237301", name: "TERAPIA DE CONDUCTO RADICULAR EN DIENTE UNIRRADICULAR", precio: 380000, category: "ENDODONCIA" },
    { code: "237302", name: "TERAPIA DE CONDUCTO RADICULAR EN DIENTE BIRRADICULAR", precio: 480000, category: "ENDODONCIA" },
    { code: "237303", name: "TERAPIA DE CONDUCTO RADICULAR EN DIENTE MULTIRRADICULAR", precio: 620000, category: "ENDODONCIA" },
    { code: "237304", name: "TERAPIA DE CONDUCTO RADICULAR EN DIENTE TEMPORAL UNIRRADICULAR", precio: 250000, category: "ENDODONCIA" },
    { code: "237305", name: "TERAPIA DE CONDUCTO RADICULAR EN DIENTE TEMPORAL MULTIRRADICULAR", precio: 280000, category: "ENDODONCIA" },
    { code: "237307", name: "DESOBTURACION DE CONDUCTO RADICULAR", precio: 200000, category: "ENDODONCIA" },
    { code: "237102", name: "PULPOTOMIA", precio: 220000, category: "ENDODONCIA" },
    { code: "237103", name: "PULPECTOMIA", precio: 250000, category: "ENDODONCIA" },
    { code: "237201", name: "APEXIFICACION (INDUCCION DE APEXOGENESIS)", precio: 320000, category: "ENDODONCIA" },

    // PERIODONCIA
    { code: "240201", name: "DETARTRAJE SUBGINGIVAL", precio: 180000, category: "PERIODONCIA" },
    { code: "240301", name: "ALISADO RADICULAR, CAMPO CERRADO", precio: 180000, category: "PERIODONCIA" },
    { code: "242201", name: "CURETAJE A CAMPO ABIERTO", precio: 280000, category: "PERIODONCIA" },
    { code: "243401", name: "GINGIVECTOMIA", precio: 320000, category: "PERIODONCIA" },
    { code: "242102", name: "PLASTIA MUCOGINGIVAL CON INJERTO GINGIVAL LIBRE", precio: 450000, category: "PERIODONCIA" },
    { code: "242401", name: "REPARACION O PLASTIA PERIODONTAL REGENERATIVA (INJERTOS, MEMBRANAS)", precio: 550000, category: "PERIODONCIA" },

    // CIRUGÍA ORAL
    { code: "230101", name: "EXODONCIA DE DIENTE PERMANENTE UNIRRADICULAR", precio: 140000, category: "CIRUGÍA" },
    { code: "230102", name: "EXODONCIA DE DIENTE PERMANENTE MULTIRRADICULAR", precio: 220000, category: "CIRUGÍA" },
    { code: "230201", name: "EXODONCIA DE DIENTE TEMPORAL UNIRRADICULAR", precio: 90000, category: "CIRUGÍA" },
    { code: "230202", name: "EXODONCIA DE DIENTE TEMPORAL MULTIRRADICULAR", precio: 120000, category: "CIRUGÍA" },
    { code: "231101", name: "EXODONCIA QUIRURGICA UNIRRADICULAR", precio: 350000, category: "CIRUGÍA" },
    { code: "231201", name: "EXODONCIA QUIRURGICA MULTIRRADICULAR", precio: 380000, category: "CIRUGÍA" },
    { code: "231303", name: "EXODONCIA DE DIENTE INCLUIDO", precio: 480000, category: "CIRUGÍA" },
    { code: "241104", name: "BIOPSIA DE ENCIA", precio: 250000, category: "CIRUGÍA" },

    // PRÓTESIS / REHABILITACIÓN
    { code: "234101", name: "COLOCACION O APLICACION DE CORONA EN ACERO INOXIDABLE (PARA DIENTES TEMPORALES)", precio: 180000, category: "REHABILITACIÓN" },
    { code: "234103", name: "COLOCACION O APLICACION DE CORONA EN FORMA PLASTICA", precio: 350000, category: "REHABILITACIÓN" },
    { code: "234105", name: "INSERCION O APLICACION DE CORONA", precio: 850000, category: "REHABILITACIÓN" },
    { code: "234201", name: "COLOCACION O INSERCION DE PROTESIS FIJA CADA UNIDAD (PILAR Y PONTICOS)", precio: 750000, category: "REHABILITACIÓN" },
    { code: "234204", name: "REPARACION DE PROTESIS FIJA", precio: 200000, category: "REHABILITACIÓN" },
    { code: "234301", name: "INSERCION, ADAPTACION Y CONTROL DE PROTESIS REMOVIBLE PARCIAL (SUPERIOR O INFERIOR) MUCOSOPORTADA", precio: 850000, category: "REHABILITACIÓN" },
    { code: "234302", name: "INSERCION, ADAPTACION Y CONTROL DE PROTESIS REMOVIBLE PARCIAL (SUPERIOR O INFERIOR) DENTOMUCOSOPORTADA O IMPLANTOSOPORTADA", precio: 980000, category: "REHABILITACIÓN" },
    { code: "234401", name: "INSERCION, ADAPTACION Y CONTROL DE PROTESIS MUCOSOPORTADA TOTAL MEDIO CASO SUPERIOR O INFERIOR", precio: 1200000, category: "REHABILITACIÓN" },
    { code: "234402", name: "INSERCION, ADAPTACION Y CONTROL DE PROTESIS MUCOSOPORTADA TOTAL SUPERIOR E INFERIOR", precio: 2200000, category: "REHABILITACIÓN" },

    // ORTODONCIA
    { code: "890222", name: "CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN ORTODONCIA", precio: 120000, category: "ORTODONCIA" },
    { code: "890322", name: "CONSULTA DE CONTROL O DE SEGUIMIENTO POR ESPECIALISTA EN ORTODONCIA", precio: 90000, category: "ORTODONCIA" },
    { code: "247101", name: "COLOCACION DE APARATOLOGIA FIJA PARA ORTODONCIA (ARCADA)", precio: 1500000, category: "ORTODONCIA" },
    { code: "247201", name: "COLOCACION DE APARATOLOGIA REMOVIBLE INTRAORAL PARA ORTODONCIA (ARCADA)", precio: 650000, category: "ORTODONCIA" },
    { code: "893106", name: "CONTROL DE ORTODONCIA FIJA, REMOVIBLE O TRATAMIENTO ORTOPEDICO FUNCIONAL Y MECANICO", precio: 120000, category: "ORTODONCIA" },
    { code: "248201", name: "AJUSTAMIENTO OCLUSAL", precio: 150000, category: "ORTODONCIA" }
];
