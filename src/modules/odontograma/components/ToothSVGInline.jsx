import React from 'react';

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

// Seleccionar zonas según tipo anatómico
// NOTA: En dentición temporal los dientes x4 y x5 son MOLARES (1° y 2° molar temporal)
//       En dentición permanente los dientes x4 y x5 son PREMOLARES
function getZoneType(fdiNum) {
    const n = parseInt(fdiNum, 10);
    const d = n % 10;                                          // último dígito
    const isTemporal = (n >= 51 && n <= 65) || (n >= 71 && n <= 85);
    if (d === 1 || d === 2) return 'incisor';
    if (d === 3)             return 'canine';
    // x4/x5 permanente = premolar; x4/x5 temporal = molar (p.ej. 54,55,64,65,74,75,84,85)
    if ((d === 4 || d === 5) && !isTemporal) return 'premolar';
    return 'molar';
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ToothSVGInline({ numero, data = {}, onZoneClick, isReadOnly }) {
    const cfg = getSpriteConfig(numero);
    const zoneType = getZoneType(numero);

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

    const handleZone = (zone) => {
        if (!isReadOnly) onZoneClick(numero, zone);
    };

    const ZonesComponent =
        zoneType === 'molar'    ? MolarZones    :
        zoneType === 'premolar' ? PremolarZones :
        zoneType === 'canine'   ? CanineZones   :
                                  IncisorZones;

    const n = parseInt(numero, 10);
    const isUpper = (n >= 11 && n <= 28) || (n >= 51 && n <= 65);
    const needsFlip = false;

    return (
        // Contenedor principal — DEBE tener width y height explícitos del padre
        <div 
            className="relative w-full h-full overflow-hidden select-none"
            style={{
                transform: needsFlip ? 'scaleY(-1)' : 'none',
            }}
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

            {/* ── Zonas SVG coloreables encima del PNG ──
                Sin mixBlendMode: el color se mezcla como alpha-compositing normal
                (rojo semitransparente sobre líneas azules = tinte rojo limpio, sin efecto morado) */}
            {!isReadOnly && (
                <svg
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`absolute ${isUpper ? 'bottom-0' : 'top-0'} left-0 right-0 w-full h-[35%]`}
                    preserveAspectRatio="xMidYMid meet"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ZonesComponent data={data} onClick={handleZone} />
                </svg>
            )}
            {/* Modo readOnly: misma visualización pero sin clicks */}
            {isReadOnly && (
                <svg
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`absolute ${isUpper ? 'bottom-0' : 'top-0'} left-0 right-0 w-full h-[35%]`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ pointerEvents: 'none' }}
                >
                    <ZonesComponent data={data} onClick={() => {}} />
                </svg>
            )}
        </div>
    );
}
