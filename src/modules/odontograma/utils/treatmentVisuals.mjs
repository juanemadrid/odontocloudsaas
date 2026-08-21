export const TREATMENT_VISUALS = Object.freeze({
    // Hallazgos y materiales localizados en una superficie dental.
    caries:             { scope: 'surface', mode: 'lesion',   fill: '#EF4444', stroke: '#B91C1C' },
    amalgama_ok:        { scope: 'surface', mode: 'material', shape: 'amalgam',     fill: '#2563EB', stroke: '#1E40AF' },
    amalgama_des:       { scope: 'surface', mode: 'material', shape: 'amalgam',     fill: '#2563EB', stroke: '#1E40AF', alert: '#EF4444' },
    rest_adaptado:      { scope: 'surface', mode: 'material', shape: 'restoration', fill: '#2DD4BF', stroke: '#0F766E' },
    rest_desadaptado:   { scope: 'surface', mode: 'material', shape: 'restoration', fill: '#2DD4BF', stroke: '#0F766E', alert: '#EF4444' },
    plomba:             { scope: 'surface', mode: 'material', shape: 'filling',     fill: '#8B5CF6', stroke: '#6D28D9' },
    sellante_bueno:     { scope: 'surface', mode: 'sealant',  fill: 'none', stroke: '#10B981' },
    sellante_des:       { scope: 'surface', mode: 'sealant',  fill: 'none', stroke: '#EF4444' },
    otras:              { scope: 'surface', mode: 'other',    fill: '#94A3B8', stroke: '#64748B' },

    // Estados de pieza completa. Se dibujan en GeneralToothMark.
    diente_sano:        { scope: 'general', mode: 'healthy',    stroke: '#10B981' },
    fractura:           { scope: 'general', mode: 'fracture',   stroke: '#EF4444' },
    corona_buena:       { scope: 'general', mode: 'crown',      stroke: '#2563EB' },
    corona_des:         { scope: 'general', mode: 'crown',      stroke: '#EF4444', alert: '#FCA5A5' },
    perno_bueno:        { scope: 'general', mode: 'post',       stroke: '#2563EB' },
    perno_malo:         { scope: 'general', mode: 'post',       stroke: '#E11D48', alert: '#FDA4AF' },
    ausente:            { scope: 'general', mode: 'absent',     stroke: '#94A3B8' },
    extraccion:         { scope: 'general', mode: 'extraction', stroke: '#DC2626' },
    endodoncia_buena:   { scope: 'general', mode: 'endo',       stroke: '#2563EB' },
    endodoncia_mala:    { scope: 'general', mode: 'endo',       stroke: '#EF4444', alert: '#FCA5A5' },
    implante_bueno:     { scope: 'general', mode: 'implant',    stroke: '#2563EB' },
    implante_malo:      { scope: 'general', mode: 'implant',    stroke: '#E11D48', alert: '#FDA4AF' },
});

export function getTreatmentVisual(toolId, fallbackColor = '#64748B') {
    return TREATMENT_VISUALS[toolId] || {
        scope: 'surface',
        mode: 'outline',
        fill: 'none',
        stroke: fallbackColor,
        isFallback: true,
    };
}

export function getToothKind(toothNumber) {
    const n = Number.parseInt(toothNumber, 10);
    const digit = n % 10;
    const isTemporary = (n >= 51 && n <= 65) || (n >= 71 && n <= 85);
    if (digit === 1 || digit === 2) return 'incisor';
    if (digit === 3) return 'canine';
    if ((digit === 4 || digit === 5) && !isTemporary) return 'premolar';
    return 'molar';
}

export function getToothSurfaceAnchor(surface, toothNumber) {
    const n = Number.parseInt(toothNumber, 10);
    const isUpper = (n >= 11 && n <= 28) || (n >= 51 && n <= 65);
    const lowerArchAnchor = {
        // El mapa interno usa top=vestibular, center=oclusal y bottom=lingual.
        // En la silueta frontal se separan horizontalmente para que no formen
        // una columna artificial sobre la corona.
        top: [33, 51],
        center: [50, 18],
        bottom: [67, 51],
        left: [27, 78],
        right: [73, 78],
    }[surface] || [50, 50];

    return isUpper
        ? [lowerArchAnchor[0], 100 - lowerArchAnchor[1]]
        : lowerArchAnchor;
}

export function getSurfaceMarkScale(activeSurfaceCount) {
    if (activeSurfaceCount >= 5) return 0.5;
    if (activeSurfaceCount === 4) return 0.56;
    if (activeSurfaceCount === 3) return 0.64;
    if (activeSurfaceCount === 2) return 0.76;
    return 1;
}

export function buildLesionPath(surface, toothNumber = 0, scale = 1) {
    const [baseX, baseY] = getToothSurfaceAnchor(surface, toothNumber);
    const variation = (Number.parseInt(toothNumber, 10) || 0) % 3;
    const x = baseX + (variation - 1) * 2;
    const y = baseY + (variation === 2 ? 1 : -1);
    const rx = 18 * scale;
    const ry = 13 * scale;
    return `M ${x - rx},${y - 2 * scale} C ${x - rx * 0.88},${y - ry} ${x - 3 * scale},${y - ry * 1.14} ${x + 4 * scale},${y - ry * 0.7} C ${x + rx * 0.78},${y - ry * 0.92} ${x + rx * 1.16},${y - 3 * scale} ${x + rx * 0.88},${y + 5 * scale} C ${x + rx * 0.78},${y + ry * 1.15} ${x + 2 * scale},${y + ry * 1.08} ${x - 5 * scale},${y + 10 * scale} C ${x - rx * 0.84},${y + ry * 0.92} ${x - rx * 1.22},${y + 4 * scale} ${x - rx},${y - 2 * scale} Z`;
}

export function buildMaterialPath(surface, toothNumber = 0, toothKind = 'molar', shape = 'amalgam', inset = 0, scale = 1) {
    const [baseX, baseY] = getToothSurfaceAnchor(surface, toothNumber);
    const variation = ((Number.parseInt(toothNumber, 10) || 0) % 3) - 1;
    const radiusXByKind = { molar: 28, premolar: 30, canine: 32, incisor: 34 };
    const radiusYByKind = { molar: 17, premolar: 18, canine: 19, incisor: 20 };
    const rx = Math.max(7, ((radiusXByKind[toothKind] || 28) - inset) * scale);
    const ry = Math.max(5, ((radiusYByKind[toothKind] || 17) - inset * 0.72) * scale);
    const x = baseX + variation;
    const y = baseY - variation * 0.5;

    if (shape === 'restoration') {
        return `M ${x - rx},${y - ry * 0.28} Q ${x - rx},${y - ry} ${x - rx * 0.35},${y - ry} L ${x + rx * 0.42},${y - ry} Q ${x + rx},${y - ry * 0.78} ${x + rx},${y - ry * 0.15} L ${x + rx},${y + ry * 0.35} Q ${x + rx * 0.76},${y + ry} ${x + rx * 0.18},${y + ry} L ${x - rx * 0.38},${y + ry} Q ${x - rx},${y + ry * 0.72} ${x - rx},${y - ry * 0.28} Z`;
    }

    if (shape === 'filling') {
        return `M ${x - rx},${y} C ${x - rx * 0.78},${y - ry} ${x - rx * 0.12},${y - ry * 1.08} ${x + rx * 0.4},${y - ry * 0.78} C ${x + rx},${y - ry * 0.52} ${x + rx},${y + ry * 0.55} ${x + rx * 0.35},${y + ry * 0.78} C ${x - rx * 0.22},${y + ry * 1.04} ${x - rx * 0.82},${y + ry * 0.72} ${x - rx},${y} Z`;
    }

    return `M ${x - rx},${y - ry * 0.15} C ${x - rx * 0.9},${y - ry * 0.88} ${x - rx * 0.24},${y - ry * 1.08} ${x + rx * 0.24},${y - ry * 0.82} C ${x + rx * 0.82},${y - ry * 1.02} ${x + rx},${y - ry * 0.2} ${x + rx * 0.9},${y + ry * 0.34} C ${x + rx * 0.66},${y + ry} ${x + rx * 0.02},${y + ry * 1.06} ${x - rx * 0.38},${y + ry * 0.74} C ${x - rx * 0.96},${y + ry * 0.82} ${x - rx * 1.04},${y + ry * 0.18} ${x - rx},${y - ry * 0.15} Z`;
}

export function buildSealantPath(surface, toothKind = 'molar', toothNumber = 0, scale = 1) {
    const [x, y] = getToothSurfaceAnchor(surface, toothNumber);
    const baseSpread = toothKind === 'molar' ? 25 : toothKind === 'premolar' ? 20 : 15;
    const spread = baseSpread * scale;
    return `M ${x - spread},${y} Q ${x - spread / 2},${y - 11 * scale} ${x},${y} T ${x + spread},${y}`;
}

export function buildOtherMarkPath(surface, toothNumber = 0, scale = 1) {
    const [x, y] = getToothSurfaceAnchor(surface, toothNumber);
    const outer = 13 * scale;
    const inner = 5.5 * scale;
    const points = [];
    for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + (Math.PI * i) / 5;
        const radius = i % 2 === 0 ? outer : inner;
        points.push(`${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`);
    }
    return `M ${points.join(' L ')} Z`;
}
