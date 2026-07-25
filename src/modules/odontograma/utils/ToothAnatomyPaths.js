// src/modules/odontograma/utils/ToothAnatomyPaths.js

/**
 * Coordenadas adaptadas para un viewBox de 40x60
 * Todas las formas se dibujan sobre la corona del diente (y: 10-35 aprox)
 */
export const ANATOMY_PATHS = {
    molar: {
        outline: "M6,15 Q20,5 34,15 L34,35 Q34,42 28,45 L26,55 Q20,58 14,55 L12,45 Q6,42 6,35 Z", // Silueta total
        crown: "M6,15 Q20,5 34,15 L34,32 Q20,38 6,32 Z", // Solo la corona para "Coronas"
        center: "M15,18 Q20,15 25,18 Q28,23 25,28 Q20,31 15,28 Q12,23 15,18 Z",
        top: "M10,13 Q20,10 30,13 L30,20 Q20,17 10,20 Z",
        bottom: "M10,28 Q20,31 30,28 L30,35 Q20,38 10,35 Z",
        left: "M6,18 Q10,24 6,30 L13,30 Q16,24 13,18 Z",
        right: "M34,18 Q30,24 34,30 L27,30 Q24,24 27,18 Z",
    },
    premolar: {
        outline: "M10,15 Q20,8 30,15 L30,35 Q30,42 25,45 L22,55 Q20,58 18,55 L15,45 Q10,42 10,35 Z",
        crown: "M10,15 Q20,8 30,15 L30,32 Q20,36 10,32 Z",
        center: "M17,19 Q20,17 23,19 Q25,23 23,27 Q20,29 17,27 Q15,23 17,19 Z",
        top: "M13,15 Q20,12 27,15 L27,22 Q20,19 13,22 Z",
        bottom: "M13,28 Q20,31 27,28 L27,35 Q20,38 13,35 Z",
        left: "M10,19 Q14,24 10,30 L16,30 Q19,24 16,19 Z",
        right: "M30,19 Q26,24 30,30 L24,30 Q21,24 24,19 Z",
    },
    incisor: {
        outline: "M10,10 Q20,8 30,10 L30,35 Q30,40 25,43 L20,55 L15,43 Q10,40 10,35 Z",
        crown: "M10,10 Q20,8 30,10 L30,35 Q20,38 10,35 Z",
        center: "M10,10 L30,10 L30,15 L10,15 Z",
        top: "M10,15 Q20,13 30,15 L30,25 Q20,23 10,25 Z",
        bottom: "M10,28 Q20,30 30,28 L30,35 Q20,37 10,35 Z",
        left: "M10,15 Q14,25 10,35 L15,35 Q18,25 15,15 Z",
        right: "M30,15 Q26,25 30,35 L25,35 Q22,25 25,15 Z",
    },
    canine: {
        outline: "M10,15 Q20,5 30,15 L30,38 Q30,45 25,48 L20,58 L15,48 Q10,45 10,38 Z",
        crown: "M10,15 Q20,5 30,15 L30,35 Q20,38 10,35 Z",
        center: "M18,12 L22,12 L24,18 L16,18 Z",
        top: "M12,18 Q20,15 28,18 L28,28 Q20,26 12,28 Z",
        bottom: "M12,30 Q20,33 28,30 L28,38 Q20,41 12,38 Z",
        left: "M10,20 Q14,30 10,40 L16,40 Q19,30 16,20 Z",
        right: "M30,20 Q26,30 30,40 L24,40 Q21,30 24,20 Z",
    }
};

export const getToothTypeByIso = (iso) => {
    const n = iso % 10;
    if (n >= 1 && n <= 2) return 'incisor';
    if (n === 3) return 'canine';
    if (n >= 4 && n <= 5) return 'premolar';
    return 'molar';
};
