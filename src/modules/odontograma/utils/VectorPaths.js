export const ToothPaths = {
    // Upper Molar (3 raíces)
    molar_superior: "M 20 50 C 15 50 10 40 10 30 C 10 20 15 15 20 15 C 22 5 25 2 30 2 C 35 2 38 5 40 15 C 45 15 50 20 50 30 C 50 40 45 50 40 50 C 35 55 25 55 20 50 Z M 20 15 C 18 25 22 35 30 35 C 38 35 42 25 40 15",
    // Lower Molar (2 raíces anchas)
    molar_inferior: "M 15 50 C 10 50 10 40 10 30 C 10 20 15 10 25 10 C 35 10 40 20 40 30 C 40 40 40 50 35 50 C 30 50 28 40 25 40 C 22 40 20 50 15 50 Z",
    // Premolar (1 raíz grande ovalada/2 fusionadas)
    premolar: "M 20 50 C 15 50 15 40 15 30 C 15 15 20 5 25 5 C 30 5 35 15 35 30 C 35 40 35 50 30 50 C 28 50 26 45 25 45 C 24 45 22 50 20 50 Z",
    // Canino/Incisivo (1 raíz, puntiagudo/plano)
    incisivo: "M 20 50 C 15 50 15 35 15 25 C 15 10 20 2 25 2 C 30 2 35 10 35 25 C 35 35 35 50 30 50 C 28 50 25 48 25 48 C 25 48 22 50 20 50 Z"
};

// Refining paths for OralDrive aesthetic (Scale 0 to 100, viewBox "0 0 100 120", with crown below y=70, root above)
// OralDrive has very distinctive, clinical-looking vector paths:
export const EliteToothShapes = {
    // Las coronas y raíces están separadas para poder aplicar efectos mejor, o unidas en un solo contorno azul. 
    // Basado en la imagen, es un contorno continuo azul cielo (#38bdf8), vacío por dentro.
    
    // Molar Superior (Tronco grueso, trifurcado)
    molar_sup: `
        m 30,70 
        c -5,-10 -5,-30 -8,-50 c 0,-5 5,-10 10,-10 c 5,0 8,15 10,20 c 2,-5 5,-20 8,-20 c 5,0 8,10 8,20 c 2,-10 8,-20 12,-20 c 5,0 8,10 8,25 c 0,15 -5,25 -8,35
        c 8,5 15,15 15,25 c 0,15 -10,25 -25,25 c -5,0 -10,-2 -10,-2 c 0,0 -5,2 -10,2 c -15,0 -25,-10 -25,-25 c 0,-10 5,-20 15,-25 z
    `,
    // Molar Inferior (Bifurcado, raíces curvas)
    molar_inf: `
        m 25,70 
        c -10,-15 -10,-40 -5,-55 c 3,-8 10,-5 12,0 c 2,15 5,35 10,40 c 2,-15 5,-35 8,-40 c 2,-5 10,-8 15,0 c 5,15 8,40 2,55
        c 8,5 18,15 18,25 c 0,15 -10,25 -30,25 c -20,0 -30,-10 -30,-25 c 0,-10 5,-20 10,-25 z
    `,
    // Premolar
    premolar: `
        m 38,70
        c -5,-20 -5,-45 0,-55 c 3,-8 10,-8 12,-5 c 5,10 10,35 5,60 
        c 10,5 20,15 20,25 c 0,10 -15,20 -25,20 c -10,0 -25,-10 -25,-20 c 0,-10 5,-20 13,-25 z
    `,
    // Canino (raíz larga y gruesa)
    canino: `
        m 40,70
        c -8,-20 -8,-50 -2,-60 c 4,-8 10,-8 14,-4 c 6,10 8,30 2,64
        c 10,2 15,10 15,20 c 0,10 -15,25 -20,25 c -5,0 -20,-15 -20,-25 c 0,-10 5,-18 11,-20 z
    `,
    // Incisivo (raíz recta, corona ancha y plana abajo)
    incisivo: `
        m 42,70
        c -4,-25 -4,-50 0,-60 c 3,-5 8,-5 10,-2 c 8,10 8,30 4,62
        c 12,5 18,15 18,25 c 0,10 -2,15 -20,15 c -18,0 -20,-5 -20,-15 c 0,-10 6,-20 18,-25 z
    `
};

export const getToothPath = (toothNumber) => {
    const num = parseInt(toothNumber, 10);
    const n = num % 10;
    const q = Math.floor(num / 10);
    
    // Temporales son tratados como los adultos más pequeños (aunque anatómicamente son ligeramente distintos, las siluetas SVG funcionan igual)
    if (n >= 1 && n <= 2) return EliteToothShapes.incisivo;
    if (n === 3) return EliteToothShapes.canino;
    if (n >= 4 && n <= 5) return EliteToothShapes.premolar;
    if (n >= 6 && n <= 8) {
        // Superiores: Cuadrantes 1, 2, 5, 6
        if ([1, 2, 5, 6].includes(q)) return EliteToothShapes.molar_sup;
        return EliteToothShapes.molar_inf;
    }
    return EliteToothShapes.molar_inf; // fallback
};
