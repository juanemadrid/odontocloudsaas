/**
 * Catálogo Maestro de Códigos CUPS (Colombia) - Especialidad Odontología
 * Basado en la Resolución 2641 de 2024 (Vigencia 2025)
 */

export const CUPS_DENTAL_CODES = [
    // CONSULTAS Y URGENCIAS
    { code: "890203", name: "CONSULTA DE PRIMERA VEZ POR ODONTOLOGIA GENERAL", precio: 80000, category: "CONSULTAS" },
    { code: "890303", name: "CONSULTA DE PRIMERA VEZ POR ODONTOLOGIA ESPECIALIZADA", precio: 120000, category: "CONSULTAS" },
    { code: "890603", name: "CONSULTA DE CONTROL O DE SEGUIMIENTO POR ODONTOLOGIA GENERAL", precio: 60000, category: "CONSULTAS" },
    { code: "890604", name: "CONSULTA DE CONTROL O DE SEGUIMIENTO POR ODONTOLOGIA ESPECIALIZADA", precio: 90000, category: "CONSULTAS" },
    { code: "890703", name: "CONSULTA DE ODONTOLOGIA GENERAL DE URGENCIAS", precio: 100000, category: "CONSULTAS" },

    // RADIOLOGIA
    { code: "870001", name: "RADIOGRAFIA INTRAORAL: PERIAPICAL MILIMETRADA", precio: 35000, category: "RADIOLOGÍA" },
    { code: "870112", name: "RADIOGRAFIA PANORAMICA DE MANDIBULA Y MAXILAR", precio: 85000, category: "RADIOLOGÍA" },
    { code: "870104", name: "RADIOGRAFIA DE MAXILAR SUPERIOR O INFERIOR (OCLUSAL)", precio: 50000, category: "RADIOLOGÍA" },
    { code: "870002", name: "RADIOGRAFIA INTRAORAL: CORONAL (ALETA DE MORDIDA)", precio: 35000, category: "RADIOLOGÍA" },

    // PREVENCION Y PROMOCION
    { code: "990101", name: "EDUCACION EN SALUD ORAL (HIGIENE ORAL)", precio: 40000, category: "PREVENCIÓN" },
    { code: "990201", name: "TOPICACION DE FLUOR EN GEL", precio: 60000, category: "PREVENCIÓN" },
    { code: "990202", name: "TOPICACION DE FLUOR EN BARNIZ", precio: 80000, category: "PREVENCIÓN" },
    { code: "890205", name: "SELLANTES DE FOSAS Y FISURAS (POR DIENTE)", precio: 50000, category: "PREVENCIÓN" },
    { code: "997101", name: "PROFILAXIS DENTAL", precio: 110000, category: "PREVENCIÓN" },
    { code: "990112", name: "DETARTRAJE SUPRAGINGIVAL", precio: 160000, category: "PREVENCIÓN" },

    // OPERATORIA (OBTURACIONES)
    { code: "232101", name: "OBTURACION DE DIENTE CON RESINA DE FOTOCURADO (UNA SUPERFICIE)", precio: 150000, category: "OPERATORIA" },
    { code: "232102", name: "OBTURACION DE DIENTE CON RESINA DE FOTOCURADO (DOS SUPERFICIES)", precio: 190000, category: "OPERATORIA" },
    { code: "232103", name: "OBTURACION DE DIENTE CON RESINA DE FOTOCURADO (TRES O MAS SUPERFICIES)", precio: 240000, category: "OPERATORIA" },
    { code: "232301", name: "OBTURACION DE DIENTE CON IONOMERO DE VIDRIO", precio: 130000, category: "OPERATORIA" },
    { code: "232401", name: "RECONSTRUCCION DE DIENTE CON MATERIAL ESTETICO (CARILLA)", precio: 450000, category: "ESTÉTICA" },

    // ENDODONCIA
    { code: "237101", name: "TRATAMIENTO DE CONDUCTOS EN DIENTES UNIRRADICULARES", precio: 380000, category: "ENDODONCIA" },
    { code: "237102", name: "TRATAMIENTO DE CONDUCTOS EN DIENTES BIRRADICULARES", precio: 480000, category: "ENDODONCIA" },
    { code: "237103", name: "TRATAMIENTO DE CONDUCTOS EN DIENTES MULTIRRADICULARES", precio: 620000, category: "ENDODONCIA" },
    { code: "237201", name: "RETRATAMIENTO DE CONDUCTOS EN DIENTES UNIRRADICULARES", precio: 450000, category: "ENDODONCIA" },
    { code: "237202", name: "RETRATAMIENTO DE CONDUCTOS EN DIENTES BIRRADICULARES", precio: 580000, category: "ENDODONCIA" },
    { code: "237203", name: "RETRATAMIENTO DE CONDUCTOS EN DIENTES MULTIRRADICULARES", precio: 750000, category: "ENDODONCIA" },
    { code: "237301", name: "APEXIFICACION O APEXOGENESIS", precio: 320000, category: "ENDODONCIA" },
    { code: "237302", name: "PULPOTOMIA", precio: 220000, category: "ENDODONCIA" },
    { code: "237305", name: "PULPECTOMIA", precio: 250000, category: "ENDODONCIA" },

    // PERIODONCIA
    { code: "243101", name: "CURETAJE Y ALISADO RADICULAR CAMPO CERRADO (POR SEXTANTE)", precio: 180000, category: "PERIODONCIA" },
    { code: "243102", name: "CURETAJE Y ALISADO RADICULAR CAMPO ABIERTO (POR SEXTANTE)", precio: 280000, category: "PERIODONCIA" },
    { code: "242201", name: "GINGIVECTOMIA (POR CUADRANTE)", precio: 320000, category: "PERIODONCIA" },
    { code: "242202", name: "GINGIVOPLASTIA (POR CUADRANTE)", precio: 300000, category: "PERIODONCIA" },
    { code: "244101", name: "CIRUGIA A COLGAJO PARA TRATAMIENTO DE PERIODONTITIS (POR CUADRANTE)", precio: 450000, category: "PERIODONCIA" },

    // CIRUGIA ORAL
    { code: "230101", name: "EXODONCIA DE DIENTE PERMANENTE UNIRRADICULAR", precio: 140000, category: "CIRUGÍA" },
    { code: "230102", name: "EXODONCIA DE DIENTE PERMANENTE MULTIRRADICULAR", precio: 220000, category: "CIRUGÍA" },
    { code: "230201", name: "EXODONCIA DE DIENTE TEMPORAL UNIRRADICULAR", precio: 90000, category: "CIRUGÍA" },
    { code: "230202", name: "EXODONCIA DE DIENTE TEMPORAL MULTIRRADICULAR", precio: 120000, category: "CIRUGÍA" },
    { code: "231100", name: "EXODONCIA QUIRURGICA DE DIENTES MAXILARES", precio: 350000, category: "CIRUGÍA" },
    { code: "231200", name: "EXODONCIA QUIRURGICA DE DIENTES MANDIBULARES", precio: 380000, category: "CIRUGÍA" },
    { code: "231301", name: "EXODONCIA DE DIENTE INCLUIDO", precio: 480000, category: "CIRUGÍA" },
    { code: "250201", name: "BIOPSIA DE ENCÍA", precio: 250000, category: "CIRUGÍA" },

    // PROTESIS / REHABILITACION
    { code: "234101", name: "CORONA INDIVIDUAL (PROVISIONAL)", precio: 180000, category: "REHABILITACIÓN" },
    { code: "234102", name: "CORONA EN ACRILICO O METACRILATO", precio: 350000, category: "REHABILITACIÓN" },
    { code: "234103", name: "CORONA COMPUESTA (CERAMICA/METAL)", precio: 850000, category: "REHABILITACIÓN" },
    { code: "234201", name: "RETENEDORES INTRARADICULARES (NUCLEOS)", precio: 280000, category: "REHABILITACIÓN" },
    { code: "234301", name: "PUENTE FIJO (POR UNIDAD)", precio: 750000, category: "REHABILITACIÓN" },
    { code: "235101", name: "PROTESIS TOTAL SUPERIOR", precio: 1200000, category: "REHABILITACIÓN" },
    { code: "235102", name: "PROTESIS TOTAL INFERIOR", precio: 1200000, category: "REHABILITACIÓN" },
    { code: "235201", name: "PROTESIS PARCIAL REMOVIBLE (MUCO-SOPORTADA)", precio: 850000, category: "REHABILITACIÓN" },
    { code: "235202", name: "PROTESIS PARCIAL REMOVIBLE (DENTO-MUCO-SOPORTADA)", precio: 980000, category: "REHABILITACIÓN" },

    // ORTODONCIA
    { code: "247101", name: "COLOCACION DE APARATOLOGIA FIJA (BRACKETS)", precio: 1500000, category: "ORTODONCIA" },
    { code: "247201", name: "COLOCACION DE APARATOLOGIA REMOVIBLE", precio: 650000, category: "ORTODONCIA" },
    { code: "248101", name: "CONTROL DE ORTODONCIA", precio: 120000, category: "ORTODONCIA" },
    { code: "248201", name: "CONTROL DE ORTOPEDIA", precio: 120000, category: "ORTODONCIA" }
];
