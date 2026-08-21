import React from 'react';
import { inferToothSurface } from '../utils/odontogramInteraction.mjs';
import { buildLesionPath, buildMaterialPath, buildOtherMarkPath, buildSealantPath, getSurfaceMarkScale, getToothKind, getTreatmentVisual } from '../utils/treatmentVisuals.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// SPRITES PNG del odontograma
// Cada sprite es un archivo panorámico con todos los dientes en fila
// ─────────────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL;

// Configuración de cada sprite:
//  img      → URL del archivo PNG
//  numCols  → cuántos dientes tiene el sprite en horizontal
//  posY     → background-position-y (50%=centro, 100%=abajo para imágenes con espacio en blanco arriba)
const SPRITES = {
    permSup: {
        img: `${BASE}assets/dontograma/permanente/superior.png`,
        numCols: 16,
        posY: '100%',
        // Orden izq→der: 18,17,16,15,14,13,12,11 | 21,22,23,24,25,26,27,28
    },
    permInf: {
        img: `${BASE}assets/dontograma/permanente/inferior.png`,
        numCols: 16,
        posY: '0%',
        // Orden izq→der: 48,47,46,45,44,43,42,41 | 31,32,33,34,35,36,37,38
    },
    tempSup: {
        img: `${BASE}assets/dontograma/temporal/superior.png`,
        numCols: 10,
        posY: '100%',  // anclado al fondo (imagen tiene ~75% espacio en blanco arriba)
        // Orden izq→der sprite: 55,54,53,52,51 | gap de arco | 61,62,63,64,65
    },
    tempInf: {
        img: `${BASE}assets/dontograma/temporal/inferior.png`,
        numCols: 10,
        posY: '0%',
        // Orden izq→der sprite: 85,84,83,82,81 | gap de arco | 71,72,73,74,75
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAPEO FDI → columna del sprite
// ─────────────────────────────────────────────────────────────────────────────
function getSpriteConfig(fdiNum) {
    const n = parseInt(fdiNum, 10);

    // Permanentes superiores
    if (n >= 11 && n <= 18) return { ...SPRITES.permSup, col: 18 - n };           // 18→col0 … 11→col7
    if (n >= 21 && n <= 28) return { ...SPRITES.permSup, col: 8 + (n - 21) };     // 21→col8 … 28→col15

    // Permanentes inferiores
    if (n >= 41 && n <= 48) return { ...SPRITES.permInf, col: 48 - n };           // 48→col0 … 41→col7
    if (n >= 31 && n <= 38) return { ...SPRITES.permInf, col: 8 + (n - 31) };     // 31→col8 … 38→col15

    // Temporales superiores
    if (n >= 51 && n <= 55) return { ...SPRITES.tempSup, col: 55 - n };           // 55→col0 … 51→col4
    if (n >= 61 && n <= 65) return { ...SPRITES.tempSup, col: 5 + (n - 61) };     // 61→col5 … 65→col9

    // Temporales inferiores
    if (n >= 81 && n <= 85) return { ...SPRITES.tempInf, col: 85 - n };           // 85→col0 … 81→col4
    if (n >= 71 && n <= 75) return { ...SPRITES.tempInf, col: 5 + (n - 71) };     // 71→col5 … 75→col9

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Posiciones bgPosX para dientes temporales, derivadas del centro real de cada
// diente en el sprite. Fórmula: bgPosX = (centerFrac × 10 − 0.5) / 9
// Los dientes del hemiarco izquierdo (61,71) se ajustan +2% para evitar que el
// gap de arco (espacio entre incisivos centrales) quede visible en su slot.
// ─────────────────────────────────────────────────────────────────────────────
// Valores derivados de posiciones REALES medidas pixel a pixel (measure_sprites.ps1):
// SUPERIOR (675×292px): dientes en X=13–575, whitespace derecha X=575–675
//   Seg[0]55 c=36  Seg[1]54 c=94  Seg[2]53 c=150 Seg[3]52 c=208 Seg[4]51 c=264
//   Seg[5]61 c=324 Seg[6]62 c=380 Seg[7]63 c=438 Seg[9]64 c=495 Seg[10]65 c=552
//   Gap arco: X=277-312; 61 ajustado +4% para no mostrar el gap
// INFERIOR (568×76px): 10 dientes exactos, gap arco X=262-304
//   Seg[0]85 c=26  Seg[1]84 c=83  Seg[2]83 c=140 Seg[3]82 c=197 Seg[4]81 c=254
//   Seg[5]71 c=312 Seg[6]72 c=370 Seg[7]73 c=427 Seg[8]74 c=484 Seg[9]75 c=540
//   71 ajustado +5% para no mostrar el gap; 81 ajustado -3% para minimizarlo
const TEMPORAL_BGPOS = {
    // Superior — bgPosX = (center/675 × 10 − 0.5) / 9
    '55':  0, '54': 10, '53': 19, '52': 29, '51': 38,
    '61': 48, '62': 57, '63': 67, '64': 76, '65': 85,
    // Inferior — bgPosX = (center/568 × 10 − 0.5) / 9, numCols=10
    '85':  0, '84': 11, '83': 22, '82': 33, '81': 44,
    '71': 55, '72': 67, '73': 78, '74': 89, '75': 100,
};

// Posiciones bgPosX para dientes permanentes basadas en medidas reales pixel a pixel
const PERMANENT_BGPOS = {
    // Superior (18 a 11, 21 a 28)
    '18': -1.08, '17': 5.66, '16': 12.41, '15': 19.16, '14': 25.91, '13': 32.66, '12': 39.40, '11': 46.15,
    '21': 53.14, '22': 59.89, '23': 66.63, '24': 73.38, '25': 80.13, '26': 86.88, '27': 93.63, '28': 100.37,
    // Inferior (48 a 41, 31 a 38)
    '48': -1.21, '47': 5.53, '46': 12.26, '45': 18.99, '44': 25.73, '43': 32.46, '42': 39.19, '41': 45.92,
    '31': 52.89, '32': 59.63, '33': 66.36, '34': 73.09, '35': 79.83, '36': 86.56, '37': 93.29, '38': 100.03,
};

// ZONAS SVG superpuestas — 5 áreas coloreables
// viewBox 0 0 100 100 (se escala al tamaño del contenedor)
// Los paths cubren la corona del diente (aprox. la mitad superior de la imagen)
// ─────────────────────────────────────────────────────────────────────────────

// Opacidad cuando hay diagnóstico activo (casi sólido para visibilidad clara)
const ZONE_OPACITY_ACTIVE = 0.85;

function zoneFill(zoneData)    { return zoneData?.id ? (zoneData.color || '#ef4444') : 'transparent'; }
function zoneOpacity(zoneData) { return zoneData?.id ? ZONE_OPACITY_ACTIVE : 0; }
function zoneStroke(zoneData)  { return zoneData?.id ? (zoneData.color || '#ef4444') : 'transparent'; }

// La capa anatómica no tiene el mismo ancho para un molar que para un incisivo.
// Estos porcentajes siguen la silueta de los sprites y evitan que la pintura
// quede como un punto o se salga del borde del diente.
const ZONE_LAYER_WIDTH = {
    molar: { upper: 94, lower: 94 },
    premolar: { upper: 66, lower: 58 },
    canine: { upper: 52, lower: 46 },
    incisor: { upper: 48, lower: 34 },
};

const ANATOMICAL_GEOMETRY = {
    molar:    { topLeft: 18, topRight: 82, outerLeft: 10, outerRight: 90, bottomLeft: 22, bottomRight: 78, innerLeft: 34, innerRight: 66 },
    premolar: { topLeft: 18, topRight: 82, outerLeft: 8, outerRight: 92, bottomLeft: 20, bottomRight: 80, innerLeft: 32, innerRight: 68 },
    canine:   { topLeft: 28, topRight: 72, outerLeft: 12, outerRight: 88, bottomLeft: 24, bottomRight: 76, innerLeft: 35, innerRight: 65 },
    incisor:  { topLeft: 18, topRight: 82, outerLeft: 10, outerRight: 90, bottomLeft: 22, bottomRight: 78, innerLeft: 34, innerRight: 66 },
};

function buildSurfacePaths(zoneType) {
    const g = ANATOMICAL_GEOMETRY[zoneType] || ANATOMICAL_GEOMETRY.molar;
    return {
        crown: `M ${g.topLeft},5 Q 50,-1 ${g.topRight},5 Q ${g.outerRight},48 ${g.bottomRight},94 Q 50,102 ${g.bottomLeft},94 Q ${g.outerLeft},48 ${g.topLeft},5 Z`,
        top: `M ${g.topLeft},5 Q 50,-1 ${g.topRight},5 L ${g.innerRight},43 Q 50,34 ${g.innerLeft},43 Z`,
        right: `M ${g.topRight},5 Q ${g.outerRight},48 ${g.bottomRight},94 L ${g.innerRight},57 L ${g.innerRight},43 Z`,
        bottom: `M ${g.bottomLeft},94 Q 50,102 ${g.bottomRight},94 L ${g.innerRight},57 Q 50,66 ${g.innerLeft},57 Z`,
        left: `M ${g.topLeft},5 L ${g.innerLeft},43 L ${g.innerLeft},57 L ${g.bottomLeft},94 Q ${g.outerLeft},48 ${g.topLeft},5 Z`,
        center: `M ${g.innerLeft},43 Q 50,34 ${g.innerRight},43 L ${g.innerRight},57 Q 50,66 ${g.innerLeft},57 Z`,
    };
}

const SURFACE_ORDER = ['top', 'right', 'bottom', 'left', 'center'];

function AnatomicalZones({ data, onClick, zoneType, clipId, numero }) {
    const paths = buildSurfacePaths(zoneType);
    const activeSurfaceCount = SURFACE_ORDER.reduce(
        (total, surface) => total + (data?.[surface]?.id ? 1 : 0),
        0,
    );
    const markScale = getSurfaceMarkScale(activeSurfaceCount);

    const renderTreatment = (surface) => {
        const zoneData = data?.[surface];
        if (!zoneData?.id) return null;
        const visual = getTreatmentVisual(zoneData.id, zoneData.color);
        if (visual.scope !== 'surface') return null;

        if (visual.mode === 'lesion') {
            return (
                <path
                    key={`treatment-${surface}`}
                    d={buildLesionPath(surface, numero, markScale)}
                    fill={visual.fill}
                    fillOpacity="0.94"
                    stroke={visual.stroke}
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                />
            );
        }

        if (visual.mode === 'sealant') {
            return (
                <path
                    key={`treatment-${surface}`}
                    d={buildSealantPath(surface, zoneType, numero, markScale)}
                    fill="none"
                    stroke={visual.stroke}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                />
            );
        }

        if (visual.mode === 'other') {
            return (
                <path
                    key={`treatment-${surface}`}
                    d={buildOtherMarkPath(surface, numero, markScale)}
                    fill={visual.fill}
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                />
            );
        }

        if (visual.mode === 'material') {
            const outerPath = buildMaterialPath(surface, numero, zoneType, visual.shape, 0, markScale);
            const innerPath = buildMaterialPath(surface, numero, zoneType, visual.shape, visual.alert ? 6 : 0, markScale);
            return (
                <g
                    key={`treatment-${surface}`}
                    className="pointer-events-none"
                    data-material-treatment={zoneData.id}
                    data-material-shape={visual.shape}
                    style={{ filter: 'drop-shadow(0 1px 0 rgba(15, 23, 42, 0.14))' }}
                >
                    {visual.alert && (
                        <path
                            d={outerPath}
                            fill={visual.alert}
                            fillOpacity="0.94"
                        />
                    )}
                    <path
                        d={innerPath}
                        fill={visual.fill}
                        fillOpacity="0.94"
                        stroke={visual.stroke}
                        strokeWidth="1.35"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                </g>
            );
        }

        return (
            <path
                key={`treatment-${surface}`}
                d={paths[surface]}
                fill="none"
                stroke={visual.stroke || zoneData.color}
                strokeWidth="2.4"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="pointer-events-none"
            />
        );
    };

    return (
        <>
            <defs>
                <clipPath id={clipId}>
                    <path d={paths.crown} />
                </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`} data-active-surface-count={activeSurfaceCount}>
                <g className="pointer-events-none">
                    {SURFACE_ORDER.map(renderTreatment)}
                </g>
                {SURFACE_ORDER.map((surface) => (
                    <path
                        key={`hit-${surface}`}
                        d={paths[surface]}
                        fill="transparent"
                        onClick={(event) => onClick(surface, event)}
                        className="cursor-pointer"
                    />
                ))}
            </g>
        </>
    );
}

function CrownSpriteMark({ data, cfg, bgSizeXPct, bgPosXPct, isUpper }) {
    const treatmentId = data?.general?.id;
    if (treatmentId !== 'corona_buena' && treatmentId !== 'corona_des') return null;
    const color = treatmentId === 'corona_buena' ? '#2563EB' : '#EF4444';
    const crownClip = isUpper
        ? 'polygon(0 57%, 100% 57%, 100% 100%, 0 100%)'
        : 'polygon(0 0, 100% 0, 100% 43%, 0 43%)';
    const maskStyles = {
        WebkitMaskImage: `url('${cfg.img}')`,
        WebkitMaskSize: `${bgSizeXPct}% auto`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: `${bgPosXPct.toFixed(2)}% ${cfg.posY}`,
        maskImage: `url('${cfg.img}')`,
        maskSize: `${bgSizeXPct}% auto`,
        maskRepeat: 'no-repeat',
        maskPosition: `${bgPosXPct.toFixed(2)}% ${cfg.posY}`,
    };

    return (
        <div
            className="absolute inset-0 pointer-events-none z-10"
            data-general-crown={treatmentId}
            style={{
                ...maskStyles,
                backgroundColor: color,
                clipPath: crownClip,
                opacity: 0.98,
                filter: `drop-shadow(0 0 1px ${color})`,
            }}
        />
    );
}

// Zonas para MOLAR — corona ancha (Y 0-62 = corona, 62-100 = raíz que queda limpia)
// Zonas para MOLAR — corona ancha (Y 0-62 = corona, 62-100 = raíz que queda limpia)
function MolarZones({ data, onClick }) {
    return (
        <g>
            {/* Capa Visual: Medialunas pegadas al borde de la corona */}
            {/* TOP: crescent en borde superior */}
            <path d="M 22,5 Q 50,0 78,5 Q 50,35 22,5 Z"
                  fill={zoneFill(data?.top)} opacity={zoneOpacity(data?.top)} stroke={zoneStroke(data?.top)} strokeWidth="1" className="pointer-events-none" />
            {/* BOTTOM: crescent en borde inferior de la corona */}
            <path d="M 22,95 Q 50,100 78,95 Q 50,65 22,95 Z"
                  fill={zoneFill(data?.bottom)} opacity={zoneOpacity(data?.bottom)} stroke={zoneStroke(data?.bottom)} strokeWidth="1" className="pointer-events-none" />
            {/* LEFT: crescent en borde izquierdo */}
            <path d="M 22,5 Q 12,50 22,95 Q 38,50 22,5 Z"
                  fill={zoneFill(data?.left)} opacity={zoneOpacity(data?.left)} stroke={zoneStroke(data?.left)} strokeWidth="1" className="pointer-events-none" />
            {/* RIGHT: crescent en borde derecho */}
            <path d="M 78,5 Q 88,50 78,95 Q 62,50 78,5 Z"
                  fill={zoneFill(data?.right)} opacity={zoneOpacity(data?.right)} stroke={zoneStroke(data?.right)} strokeWidth="1" className="pointer-events-none" />
            {/* CENTER: lente central (fosa oclusal) */}
            <path d="M 32,50 Q 50,32 68,50 Q 50,68 32,50 Z"
                  fill={zoneFill(data?.center)} opacity={zoneOpacity(data?.center)} stroke={zoneStroke(data?.center)} strokeWidth="1" className="pointer-events-none" />

            {/* Capa de Interactividad (Click Targets grandes transparentes) */}
            <path d="M 22,5 Q 50,0 78,5 L 68,45 Q 50,35 32,45 Z"
                  fill="transparent" onClick={() => onClick('top')} className="cursor-pointer" />
            <path d="M 22,95 Q 50,100 78,95 L 68,55 Q 50,65 32,55 Z"
                  fill="transparent" onClick={() => onClick('bottom')} className="cursor-pointer" />
            <path d="M 22,5 L 32,45 L 32,55 L 22,95 Q 12,50 22,5 Z"
                  fill="transparent" onClick={() => onClick('left')} className="cursor-pointer" />
            <path d="M 78,5 L 68,45 L 68,55 L 78,95 Q 88,50 78,5 Z"
                  fill="transparent" onClick={() => onClick('right')} className="cursor-pointer" />
            <path d="M 32,45 Q 50,35 68,45 L 68,55 Q 50,65 32,55 Z"
                  fill="transparent" onClick={() => onClick('center')} className="cursor-pointer" />
        </g>
    );
}

// Zonas para PREMOLAR — corona ovoide (Y 0-62 = corona)
function PremolarZones({ data, onClick }) {
    return (
        <g>
            {/* Capa Visual: Medialunas pegadas al borde de la corona */}
            <path d="M 28,5 Q 50,0 72,5 Q 50,30 28,5 Z"
                  fill={zoneFill(data?.top)} opacity={zoneOpacity(data?.top)} stroke={zoneStroke(data?.top)} strokeWidth="1" className="pointer-events-none" />
            <path d="M 28,95 Q 50,100 72,95 Q 50,70 28,95 Z"
                  fill={zoneFill(data?.bottom)} opacity={zoneOpacity(data?.bottom)} stroke={zoneStroke(data?.bottom)} strokeWidth="1" className="pointer-events-none" />
            <path d="M 28,5 Q 18,50 28,95 Q 42,50 28,5 Z"
                  fill={zoneFill(data?.left)} opacity={zoneOpacity(data?.left)} stroke={zoneStroke(data?.left)} strokeWidth="1" className="pointer-events-none" />
            <path d="M 72,5 Q 82,50 72,95 Q 58,50 72,5 Z"
                  fill={zoneFill(data?.right)} opacity={zoneOpacity(data?.right)} stroke={zoneStroke(data?.right)} strokeWidth="1" className="pointer-events-none" />
            <path d="M 34,50 Q 50,32 66,50 Q 50,68 34,50 Z"
                  fill={zoneFill(data?.center)} opacity={zoneOpacity(data?.center)} stroke={zoneStroke(data?.center)} strokeWidth="1" className="pointer-events-none" />

            {/* Capa de Interactividad */}
            <path d="M 28,5 Q 50,0 72,5 L 64,45 Q 50,35 36,45 Z"
                  fill="transparent" onClick={() => onClick('top')} className="cursor-pointer" />
            <path d="M 28,95 Q 50,100 72,95 L 64,55 Q 50,65 36,55 Z"
                  fill="transparent" onClick={() => onClick('bottom')} className="cursor-pointer" />
            <path d="M 28,5 L 36,45 L 36,55 L 28,95 Q 18,50 28,5 Z"
                  fill="transparent" onClick={() => onClick('left')} className="cursor-pointer" />
            <path d="M 72,5 L 64,45 L 64,55 L 72,95 Q 82,50 72,5 Z"
                  fill="transparent" onClick={() => onClick('right')} className="cursor-pointer" />
            <path d="M 36,45 Q 50,35 64,45 L 64,55 Q 50,65 36,55 Z"
                  fill="transparent" onClick={() => onClick('center')} className="cursor-pointer" />
        </g>
    );
}

// Zonas para CANINO — corona puntiaguda (Y 0-65 = corona, forma triangular superior)
function CanineZones({ data, onClick }) {
    return (
        <g>
            {/* Capa Visual: Medialunas pegadas al borde de la corona */}
            {/* TOP: crescent en borde puntiagudo superior */}
            <path d="M 33,8 Q 50,0 67,8 Q 50,32 33,8 Z"
                  fill={zoneFill(data?.top)} opacity={zoneOpacity(data?.top)} stroke={zoneStroke(data?.top)} strokeWidth="1" className="pointer-events-none" />
            {/* BOTTOM: crescent en base de la corona (más ancho, antes de cuello) */}
            <path d="M 30,95 Q 50,100 70,95 Q 50,68 30,95 Z"
                  fill={zoneFill(data?.bottom)} opacity={zoneOpacity(data?.bottom)} stroke={zoneStroke(data?.bottom)} strokeWidth="1" className="pointer-events-none" />
            {/* LEFT: crescent lateral izquierdo */}
            <path d="M 33,8 Q 22,50 30,95 Q 45,50 33,8 Z"
                  fill={zoneFill(data?.left)} opacity={zoneOpacity(data?.left)} stroke={zoneStroke(data?.left)} strokeWidth="1" className="pointer-events-none" />
            {/* RIGHT: crescent lateral derecho */}
            <path d="M 67,8 Q 78,50 70,95 Q 55,50 67,8 Z"
                  fill={zoneFill(data?.right)} opacity={zoneOpacity(data?.right)} stroke={zoneStroke(data?.right)} strokeWidth="1" className="pointer-events-none" />
            {/* CENTER: lente incisal/cingulum central */}
            <path d="M 38,52 L 50,32 L 62,52 Q 50,68 38,52 Z"
                  fill={zoneFill(data?.center)} opacity={zoneOpacity(data?.center)} stroke={zoneStroke(data?.center)} strokeWidth="1" className="pointer-events-none" />

            {/* Capa de Interactividad */}
            <path d="M 33,8 Q 50,0 67,8 L 62,49 L 50,38 L 38,49 Z"
                  fill="transparent" onClick={() => onClick('top')} className="cursor-pointer" />
            <path d="M 30,95 Q 50,100 70,95 L 62,60 Q 50,71 38,60 Z"
                  fill="transparent" onClick={() => onClick('bottom')} className="cursor-pointer" />
            <path d="M 33,8 L 38,49 L 38,60 L 30,95 Q 22,50 33,8 Z"
                  fill="transparent" onClick={() => onClick('left')} className="cursor-pointer" />
            <path d="M 67,8 L 62,49 L 62,60 L 70,95 Q 78,50 67,8 Z"
                  fill="transparent" onClick={() => onClick('right')} className="cursor-pointer" />
            <path d="M 38,49 L 50,38 L 62,49 L 62,60 Q 50,71 38,60 Z"
                  fill="transparent" onClick={() => onClick('center')} className="cursor-pointer" />
        </g>
    );
}

// Zonas para INCISIVO — corona rectangular-redondeada (Y 0-55 = corona en pala)
function IncisorZones({ data, onClick }) {
    return (
        <g>
            {/* Capa Visual: Medialunas pegadas al borde de la corona */}
            {/* TOP: banda horizontal en borde incisal */}
            <path d="M 25,4 L 75,4 L 75,32 Q 50,38 25,32 Z"
                  fill={zoneFill(data?.top)} opacity={zoneOpacity(data?.top)} stroke={zoneStroke(data?.top)} strokeWidth="1" className="pointer-events-none" />
            {/* BOTTOM: crescent en cervical de la corona */}
            <path d="M 28,96 Q 50,100 72,96 Q 50,68 28,96 Z"
                  fill={zoneFill(data?.bottom)} opacity={zoneOpacity(data?.bottom)} stroke={zoneStroke(data?.bottom)} strokeWidth="1" className="pointer-events-none" />
            {/* LEFT: crescent lateral mesial */}
            <path d="M 25,4 Q 17,50 28,96 Q 40,50 25,4 Z"
                  fill={zoneFill(data?.left)} opacity={zoneOpacity(data?.left)} stroke={zoneStroke(data?.left)} strokeWidth="1" className="pointer-events-none" />
            {/* RIGHT: crescent lateral distal */}
            <path d="M 75,4 Q 83,50 72,96 Q 60,50 75,4 Z"
                  fill={zoneFill(data?.right)} opacity={zoneOpacity(data?.right)} stroke={zoneStroke(data?.right)} strokeWidth="1" className="pointer-events-none" />
            {/* CENTER: lente incisal central */}
            <path d="M 33,50 Q 50,32 67,50 Q 50,68 33,50 Z"
                  fill={zoneFill(data?.center)} opacity={zoneOpacity(data?.center)} stroke={zoneStroke(data?.center)} strokeWidth="1" className="pointer-events-none" />

            {/* Capa de Interactividad */}
            <path d="M 25,4 L 75,4 L 67,46 Q 50,35 33,46 Z"
                  fill="transparent" onClick={() => onClick('top')} className="cursor-pointer" />
            <path d="M 28,96 Q 50,100 72,96 L 67,54 Q 50,65 33,54 Z"
                  fill="transparent" onClick={() => onClick('bottom')} className="cursor-pointer" />
            <path d="M 25,4 L 33,46 L 33,54 L 28,96 Q 17,50 25,4 Z"
                  fill="transparent" onClick={() => onClick('left')} className="cursor-pointer" />
            <path d="M 75,4 L 67,46 L 67,54 L 72,96 Q 83,50 75,4 Z"
                  fill="transparent" onClick={() => onClick('right')} className="cursor-pointer" />
            <path d="M 33,46 Q 50,35 67,46 L 67,54 Q 50,65 33,54 Z"
                  fill="transparent" onClick={() => onClick('center')} className="cursor-pointer" />
        </g>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ToothSVGInline({ numero, data = {}, onZoneClick, isReadOnly }) {
    const cfg = getSpriteConfig(numero);
    const zoneType = getToothKind(numero);
    const n = parseInt(numero, 10);
    const isUpper = (n >= 11 && n <= 28) || (n >= 51 && n <= 65);

    // Fallback si no hay configuración (número FDI desconocido)
    if (!cfg) {
        return (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-[10px] font-bold">
                {numero}
            </div>
        );
    }

    // ── Cálculo del sprite ──────────────────────────────────────────────────
    // Técnica estándar CSS sprites:
    // backgroundSize: '(N*100)% auto' → la imagen mide N veces el ancho del contenedor
    // backgroundPosition X:  usa TEMPORAL_BGPOS para dientes temporales (posiciones precisas)
    //                        o la fórmula col / (N-1) * 100% para permanentes
    const bgSizeXPct = cfg.numCols * 100;
    const bgPosXPct  = TEMPORAL_BGPOS[numero] !== undefined
        ? TEMPORAL_BGPOS[numero]
        : (PERMANENT_BGPOS[numero] !== undefined
            ? PERMANENT_BGPOS[numero]
            : (cfg.numCols > 1 ? (cfg.col / (cfg.numCols - 1)) * 100 : 0));

    const handleZone = (zone, event) => {
        event?.stopPropagation();
        if (!isReadOnly) onZoneClick(numero, zone);
    };

    const markSurfaceFromPointer = (event, rect) => {
        if (isReadOnly) return;
        const zone = inferToothSurface({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            width: rect.width,
            height: rect.height,
            isUpper,
        });
        onZoneClick(numero, zone);
    };

    const handleDirectClick = (event) => {
        markSurfaceFromPointer(event, event.currentTarget.getBoundingClientRect());
    };

    const handleZoneLayerClick = (event) => {
        event.stopPropagation();
        if (event.target !== event.currentTarget) return;
        const toothRect = event.currentTarget.parentElement?.getBoundingClientRect();
        if (toothRect) markSurfaceFromPointer(event, toothRect);
    };

    const handleKeyDown = (event) => {
        if (isReadOnly || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        // El teclado aplica la cara visible; un filtro de superficie activo la
        // reemplaza en el manejador principal igual que ocurre con el ratón.
        onZoneClick(numero, 'top');
    };

    const ZonesComponent = AnatomicalZones;
    const clipId = `odontograma-crown-${numero}-${isReadOnly ? 'readonly' : 'editable'}`;
    const zoneLayerWidth = ZONE_LAYER_WIDTH[zoneType]?.[isUpper ? 'upper' : 'lower'] || 90;
    const needsFlip = false;

    return (
        // Contenedor principal — DEBE tener width y height explícitos del padre
        <div 
            className={`relative w-full h-full overflow-hidden select-none ${isReadOnly ? '' : 'cursor-pointer'}`}
            style={{
                transform: needsFlip ? 'scaleY(-1)' : 'none',
            }}
            data-tooth-number={String(numero)}
            role={isReadOnly ? undefined : 'button'}
            tabIndex={isReadOnly ? undefined : 0}
            aria-label={isReadOnly ? undefined : `Marcar superficie del diente ${numero}`}
            onClick={isReadOnly ? undefined : handleDirectClick}
            onKeyDown={isReadOnly ? undefined : handleKeyDown}
        >

            {/* ── PNG sprite recortado con CSS ── */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage:    `url('${cfg.img}')`,
                    backgroundSize:     `${bgSizeXPct}% auto`,
                    backgroundRepeat:   'no-repeat',
                    backgroundPosition: `${bgPosXPct.toFixed(2)}% ${cfg.posY}`,
                }}
            />

            <CrownSpriteMark
                data={data}
                cfg={cfg}
                bgSizeXPct={bgSizeXPct}
                bgPosXPct={bgPosXPct}
                isUpper={isUpper}
            />

            {/* Capa anatómica: pinta el tratamiento dentro de la corona y
                conserva cinco áreas amplias de clic. */}
            {!isReadOnly && (
                <svg
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`absolute ${isUpper ? 'bottom-0' : 'top-0'} left-1/2 h-[38%]`}
                    style={{
                        width: `${zoneLayerWidth}%`,
                        transform: 'translateX(-50%)',
                    }}
                    preserveAspectRatio="none"
                    onClick={handleZoneLayerClick}
                >
                    <ZonesComponent
                        data={data}
                        onClick={handleZone}
                        zoneType={zoneType}
                        clipId={clipId}
                        numero={numero}
                    />
                </svg>
            )}
            {/* Modo readOnly: misma visualización pero sin clicks */}
            {isReadOnly && (
                <svg
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`absolute ${isUpper ? 'bottom-0' : 'top-0'} left-1/2 h-[38%]`}
                    preserveAspectRatio="none"
                    style={{
                        pointerEvents: 'none',
                        width: `${zoneLayerWidth}%`,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <ZonesComponent
                        data={data}
                        onClick={() => {}}
                        zoneType={zoneType}
                        clipId={clipId}
                        numero={numero}
                    />
                </svg>
            )}
        </div>
    );
}
