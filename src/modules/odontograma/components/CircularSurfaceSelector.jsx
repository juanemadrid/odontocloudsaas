import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CircularSurfaceSelector
// Tamaño: 100% del ancho de su slot padre (OdontogramaVisual define el ancho)
// ─────────────────────────────────────────────────────────────────────────────

// Generador de path para segmento de anillo (donut slice)
const createSlicePath = (cx, cy, innerRadius, outerRadius, startAngle, endAngle) => {
    const startRad = (startAngle - 90) * Math.PI / 180.0;
    const endRad   = (endAngle   - 90) * Math.PI / 180.0;
    const x1 = cx + outerRadius * Math.cos(startRad);
    const y1 = cy + outerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(endRad);
    const y2 = cy + outerRadius * Math.sin(endRad);
    const x3 = cx + innerRadius * Math.cos(endRad);
    const y3 = cy + innerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(startRad);
    const y4 = cy + innerRadius * Math.sin(startRad);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
};

export default function CircularSurfaceSelector({ activeToothId, toothData = {}, onZoneClick, isReadOnly, isUpper, isRightSide }) {

    const getSectorColor = (zoneId) => {
        const zone = toothData?.[zoneId];
        const findingId = zone?.id;
        if (!findingId) return 'transparent';
        if (findingId.includes('caries'))  return '#EF4444';
        if (findingId.includes('amalgama')) return '#2563EB';
        if (findingId.includes('resina') || findingId.includes('rest_')) return '#10B981';
        if (findingId.includes('sellante')) return '#10B981';
        return zone.color || '#94A3B8';
    };

    const hasMark = (zoneId) => !!toothData?.[zoneId];

    const getFaceProps = (zoneId) => ({
        fill: getSectorColor(zoneId),
        stroke: '#1e293b',
        strokeWidth: '2.5',
        opacity: hasMark(zoneId) && toothData?.[zoneId]?.id?.includes('malo') ? 0.7 : 1,
        className: `transition-all duration-300 ${isReadOnly ? '' : 'cursor-pointer hover:fill-slate-200'} origin-center`,
        onClick: () => onZoneClick?.(activeToothId, zoneId),
    });

    const CX = 50, CY = 50, RADIUS_INNER = 18, RADIUS_OUTER = 44;

    const gen = toothData?.general?.id;

    return (
        <div className="w-full aspect-square relative">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* ARRIBA  – Vestibular */}
                <path d={createSlicePath(CX, CY, RADIUS_INNER, RADIUS_OUTER, -45,  45)} {...getFaceProps('top')} />
                {/* DERECHA – Mesial/Distal */}
                <path d={createSlicePath(CX, CY, RADIUS_INNER, RADIUS_OUTER,  45, 135)} {...getFaceProps('right')} />
                {/* ABAJO   – Lingual/Palatino */}
                <path d={createSlicePath(CX, CY, RADIUS_INNER, RADIUS_OUTER, 135, 225)} {...getFaceProps('bottom')} />
                {/* IZQUIERDA – Distal/Mesial */}
                <path d={createSlicePath(CX, CY, RADIUS_INNER, RADIUS_OUTER, 225, 315)} {...getFaceProps('left')} />
                {/* CENTRO  – Oclusal */}
                <circle cx={CX} cy={CY} r={RADIUS_INNER} {...getFaceProps('center')} />
            </svg>

            {/* Capa de Hallazgos Generales (Pieza Completa) en el Círculo */}
            {gen && (
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    {gen === 'fractura' && (
                        <g transform={isUpper ? 'translate(0 100) scale(1 -1)' : undefined}>
                            <path d="M 47,4 L 57,14 L 48,22 L 55,30 L 44,42" fill="none" stroke="white" strokeWidth="7" opacity="0.95" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M 47,4 L 57,14 L 48,22 L 55,30 L 44,42" fill="none" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    )}
                    {(gen === 'extraccion' || gen === 'ausente') && (
                        <g>
                            <line x1="12" y1="10" x2="88" y2="90" stroke="white" strokeWidth="7" strokeLinecap="round" />
                            <line x1="88" y1="10" x2="12" y2="90" stroke="white" strokeWidth="7" strokeLinecap="round" />
                            <line x1="12" y1="10" x2="88" y2="90" stroke={gen === 'extraccion' ? '#DC2626' : '#94A3B8'} strokeWidth="3.8" strokeLinecap="round" />
                            <line x1="88" y1="10" x2="12" y2="90" stroke={gen === 'extraccion' ? '#DC2626' : '#94A3B8'} strokeWidth="3.8" strokeLinecap="round" />
                        </g>
                    )}
                    {gen === 'diente_sano' && (
                        <g transform={isUpper ? 'translate(0 100) scale(1 -1)' : undefined}>
                            <path d="M 40,20 L 47,28 L 60,11" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M 40,20 L 47,28 L 60,11" fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    )}
                    {gen.includes('perno') && (
                        <g transform={isUpper ? 'translate(0 100) scale(1 -1)' : undefined}>
                            <path d="M 38,24 H 62" fill="none" stroke={gen.includes('malo') ? '#E11D48' : '#2563EB'} strokeWidth="4" strokeLinecap="round" />
                            <path d="M 50,24 L 50,88 L 45,80" fill="none" stroke={gen.includes('malo') ? '#E11D48' : '#2563EB'} strokeWidth="4" strokeLinecap="round" />
                        </g>
                    )}
                    {gen.includes('endodoncia') && (
                        <g transform={isUpper ? 'translate(0 100) scale(1 -1)' : undefined}>
                            <path d="M 50,20 Q 50,45 50,88" fill="none" stroke={gen.includes('mala') ? '#EF4444' : gen.includes('indicada') ? '#F97316' : '#2563EB'} strokeWidth="3.5" strokeLinecap="round" />
                            <path d="M 42,20 Q 42,45 38,88" fill="none" stroke={gen.includes('mala') ? '#EF4444' : gen.includes('indicada') ? '#F97316' : '#2563EB'} strokeWidth="3" strokeLinecap="round" />
                            <path d="M 58,20 Q 58,45 62,88" fill="none" stroke={gen.includes('mala') ? '#EF4444' : gen.includes('indicada') ? '#F97316' : '#2563EB'} strokeWidth="3" strokeLinecap="round" />
                        </g>
                    )}
                    {gen.includes('implante') && (
                        <g transform={isUpper ? 'translate(0 100) scale(1 -1)' : undefined}>
                            <rect x="38" y="9" width="24" height="18" rx="5" fill="white" fillOpacity="0.9" stroke={gen.includes('malo') ? '#E11D48' : '#2563EB'} strokeWidth="2.8" />
                            <path d="M 43,28 L 57,28 L 54,86 L 50,93 L 46,86 Z" fill={gen.includes('malo') ? '#E11D48' : '#2563EB'} fillOpacity="0.25" stroke={gen.includes('malo') ? '#E11D48' : '#2563EB'} strokeWidth="2.8" />
                        </g>
                    )}
                    {gen === 'pontico' && (
                        <g>
                            <circle cx="50" cy="50" r="46" fill="#FACC15" fillOpacity="0.35" stroke="#EAB308" strokeWidth="3.5" />
                            <line x1="16" y1="42" x2="84" y2="42" stroke="#CA8A04" strokeWidth="3.5" strokeLinecap="round" />
                            <line x1="16" y1="58" x2="84" y2="58" stroke="#CA8A04" strokeWidth="3.5" strokeLinecap="round" />
                        </g>
                    )}
                    {(gen.includes('corona') || gen.includes('provisional')) && (
                        <circle 
                            cx="50" cy="50" r="46" 
                            fill="none" 
                            stroke={gen.includes('des') || gen.includes('malo') ? '#EF4444' : '#2563EB'} 
                            strokeWidth="3.5" 
                            strokeDasharray={gen.includes('des') || gen.includes('provisional') ? '5,3' : 'none'} 
                        />
                    )}
                    {gen.includes('carilla') && (
                        <path 
                            d="M 20,20 Q 50,6 80,20 Q 70,40 50,36 Q 30,40 20,20 Z" 
                            fill={gen.includes('des') ? '#EF4444' : '#3B82F6'} 
                            fillOpacity="0.8" 
                            stroke={gen.includes('des') ? '#DC2626' : '#1D4ED8'} 
                            strokeWidth="2" 
                        />
                    )}
                    {gen === 'lesion_apical' && (
                        <circle cx="50" cy={isUpper ? 12 : 88} r="8" fill="#B91C1C" stroke="white" strokeWidth="2" />
                    )}
                    {gen === 'resto_radicular' && (
                        <line x1="20" y1="15" x2="80" y2="85" stroke="#78716C" strokeWidth="4" strokeLinecap="round" />
                    )}
                    {(gen === 'diente_incluido' || gen === 'diente_parcial_erup' || gen === 'diente_sin_erup') && (
                        <g>
                            <line x1="50" y1="80" x2="50" y2="20" stroke="#8B5CF6" strokeWidth="3.5" strokeLinecap="round" />
                            <polyline points="38,34 50,18 62,34" fill="none" stroke="#8B5CF6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    )}
                </svg>
            )}
        </div>
    );
}
