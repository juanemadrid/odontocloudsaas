// src/api/recetasCatalog.js

/**
 * RECETAS (Kits de Insumos)
 * Mapea un ID de tratamiento (ej: 'caries', 'exodoncia') 
 * a una lista de insumos que deben descontarse del inventario.
 * 
 * NOTA: Los 'productoId' deben coincidir con los IDs reales en la colección 'inventario'.
 * Como es un MVP, usamos IDs semánticos que el usuario debería crear.
 */

export const RECETAS = {
    'caries': [
        { productoId: 'kit_basico', cantidad: 1 }, // Guantes, babero, eyector
        { productoId: 'resina_3m', cantidad: 0.2 }, // Unidades decimales (gramos, porciones)
        { productoId: 'anestesia', cantidad: 1 }
    ],
    'endodoncia': [
        { productoId: 'kit_basico', cantidad: 1 },
        { productoId: 'limas_rotatorias', cantidad: 1 },
        { productoId: 'cemento_endo', cantidad: 0.1 },
        { productoId: 'anestesia', cantidad: 2 } // Suele usar más anestesia
    ],
    'extraccion': [
        { productoId: 'kit_basico', cantidad: 1 },
        { productoId: 'hoja_bisturi', cantidad: 1 },
        { productoId: 'sutura', cantidad: 1 },
        { productoId: 'anestesia', cantidad: 2 },
        { productoId: 'gasa_esteril', cantidad: 5 }
    ],
    'limpieza': [
        { productoId: 'kit_basico', cantidad: 1 },
        { productoId: 'profijet_bicarbonato', cantidad: 10 }, // gramos
        { productoId: 'pasta_profilactica', cantidad: 1 }
    ],
    'blanqueamiento': [
        { productoId: 'kit_basico', cantidad: 1 },
        { productoId: 'barrera_gingival', cantidad: 1 },
        { productoId: 'peroxido_gel', cantidad: 1 }
    ]
};

export const getRecetaForTratamiento = (tratamientoId) => {
    // Intenta buscar exacto, o por palabras clave si no existe exacto
    if (RECETAS[tratamientoId]) return RECETAS[tratamientoId];

    // Fallback: Si no tiene receta específica, descontar solo Kit Básico
    return [{ productoId: 'kit_basico', cantidad: 1 }];
};
